/**
 * Gemini client — runs entirely in the browser.
 *
 * The API key is NEVER committed to this repository. It lives in the user's
 * settings row (RLS-protected in Supabase) and a localStorage mirror, and is
 * sent directly from the browser to Google. Nothing proxies through a server
 * we control, so there is no place for the key to leak on our side.
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Current at time of writing; resolveModel() takes over if it ever 404s. */
export const DEFAULT_MODEL = 'gemini-3.5-flash'

export class GeminiError extends Error {
  constructor (message, { status = 0, retryable = false } = {}) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
    this.retryable = retryable
  }
}

function describeStatus (status, body) {
  if (status === 400) return 'API Key 格式錯誤或請求無效（400）'
  if (status === 401 || status === 403) return 'API Key 無效或沒有權限（' + status + '）'
  if (status === 404) return '這個 API Key 沒有這個模型（404）'
  if (status === 429) return '已達 Gemini 免費額度上限，請稍後再試（429）'
  if (status >= 500) return 'Gemini 服務暫時異常（' + status + '）'
  return `Gemini 回應錯誤（${status}）${body ? '：' + String(body).slice(0, 160) : ''}`
}

/* ------------------------------------------------------------------ *
 * Model resolution
 *
 * Model IDs get renamed and retired on Google's schedule, not ours, so a
 * hard-coded default is a time bomb: the app breaks one morning with a 404 and
 * the learner is told to "pick a model" they have no way to pick from. Instead
 * we ask the API what it has and choose, then remember the answer.
 * ------------------------------------------------------------------ */

let resolvedModel = null
let onModelChange = null

/** Let the settings store persist a model we discovered on the user's behalf. */
export function onModelResolved (fn) { onModelChange = fn }

export function getResolvedModel () { return resolvedModel }

/**
 * Rank candidates for this app's job: high volume, short outputs, latency
 * matters more than depth. Flash tiers win; previews and special-purpose
 * variants lose.
 */
function scoreModel (name) {
  const n = name.toLowerCase()
  if (/embedding|aqa|imagen|veo|tts|image|audio|live|native/.test(n)) return -1

  let score = 0
  if (n.includes('flash')) score += 40
  else if (n.includes('pro')) score += 20

  // Newest major.minor wins, e.g. gemini-3.5-flash > gemini-3.1-flash-lite
  const v = n.match(/gemini-(\d+)(?:\.(\d+))?/)
  if (v) score += Number(v[1]) * 6 + (v[2] ? Number(v[2]) : 0)

  if (/preview|exp|experimental/.test(n)) score -= 12
  if (n.includes('lite')) score -= 4          // fine, just second choice
  if (/-\d{3,}$/.test(n)) score -= 3          // dated snapshot pin

  return score
}

/**
 * Find a model this key can actually call. Returns the chosen id.
 * `preferred` is kept if the API still lists it.
 */
export async function resolveModel (key, preferred) {
  const available = await listModels(key)
  if (!available.length) throw new GeminiError('這個 API Key 沒有任何可用的模型')

  if (preferred && available.includes(preferred)) {
    resolvedModel = preferred
    return preferred
  }

  const best = available
    .map(name => ({ name, score: scoreModel(name) }))
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score)[0]

  if (!best) throw new GeminiError('找不到適合的文字生成模型')

  resolvedModel = best.name
  onModelChange?.(best.name)
  return best.name
}

async function callGemini ({ key, model, systemInstruction, prompt, schema, temperature = 0.7, signal, _retriedModel = false }) {
  if (!key) throw new GeminiError('尚未設定 Gemini API Key，請到「設定」頁面填入。')

  const generationConfig = { temperature, maxOutputTokens: 8192 }
  if (schema) {
    generationConfig.responseMimeType = 'application/json'
    generationConfig.responseSchema = schema
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig
  }
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] }
  }

  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`
  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new GeminiError('無法連線到 Gemini（網路問題或被瀏覽器阻擋）', { retryable: true })
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')

    // A renamed or retired model is recoverable without bothering the learner:
    // ask what this key can call, switch to it, and run the request again.
    if (res.status === 404 && !_retriedModel) {
      const next = await resolveModel(key, null).catch(() => null)
      if (next && next !== model) {
        return callGemini({
          key, model: next, systemInstruction, prompt, schema, temperature, signal,
          _retriedModel: true
        })
      }
    }

    throw new GeminiError(describeStatus(res.status, text), {
      status: res.status,
      retryable: res.status === 429 || res.status >= 500
    })
  }

  const json = await res.json()
  const cand = json?.candidates?.[0]
  if (!cand) throw new GeminiError('Gemini 沒有回傳內容（可能被安全過濾器擋下）')
  if (cand.finishReason === 'MAX_TOKENS') {
    throw new GeminiError('回應被截斷，請縮小批次大小後重試', { retryable: true })
  }

  const text = (cand.content?.parts || []).map(p => p.text || '').join('')
  if (!text.trim()) throw new GeminiError('Gemini 回傳空白內容', { retryable: true })
  return text
}

/** Models sometimes wrap JSON in a fence even when asked not to. */
function parseJson (text) {
  const cleaned = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
  try {
    return JSON.parse(cleaned)
  } catch {
    const first = cleaned.search(/[[{]/)
    const last = Math.max(cleaned.lastIndexOf(']'), cleaned.lastIndexOf('}'))
    if (first >= 0 && last > first) {
      try { return JSON.parse(cleaned.slice(first, last + 1)) } catch { /* fall through */ }
    }
    throw new GeminiError('無法解析 Gemini 回傳的 JSON')
  }
}

async function withRetry (fn, { attempts = 3, baseDelay = 1200 } = {}) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (err?.name === 'AbortError') throw err
      if (!(err instanceof GeminiError) || !err.retryable || i === attempts - 1) throw err
      await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, i)))
    }
  }
  throw lastErr
}

/* ------------------------------------------------------------------ *
 * 1. Word enrichment
 * ------------------------------------------------------------------ */

const WORD_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      headword: { type: 'STRING' },
      ipa: { type: 'STRING', description: 'General American IPA, wrapped in slashes' },
      meanings: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            pos: { type: 'STRING', description: 'n. / v. / adj. / adv. / prep. / conj. / pron. / det.' },
            zh: { type: 'STRING', description: 'Traditional Chinese gloss' }
          },
          required: ['pos', 'zh']
        }
      },
      examples: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            en: { type: 'STRING' },
            zh: { type: 'STRING' }
          },
          required: ['en', 'zh']
        }
      },
      confusables: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            word: { type: 'STRING' },
            diff: { type: 'STRING', description: 'Traditional Chinese, one sentence' }
          },
          required: ['word', 'diff']
        }
      },
      mnemonic: { type: 'STRING', description: 'Traditional Chinese memory hook, may be empty' }
    },
    required: ['headword', 'ipa', 'meanings', 'examples']
  }
}

const WORD_SYSTEM = `你是一位專為台灣工程師設計英文教材的教學設計師。學習者字彙量約 400-500 字、無文法基礎，目標是 TOEIC 600 與旅遊會話。

規則：
1. 所有中文一律使用「繁體中文」，禁止簡體字。
2. 例句難度限制在 CEFR A2-B1，句長 6-14 字，只使用高頻字彙。
3. 例句必須是日常、旅遊或職場能真的用到的句子，不要教科書式的抽象句。
4. meanings 最多 3 個，依常用度排序，只收學習者這個階段真的用得到的義項。
5. examples 提供 2 句，展示該字最典型的兩種用法。
6. confusables 只在真的容易混淆時填寫（拼字相近、意思相近、中文翻譯相同），最多 2 個；沒有就給空陣列。
7. ipa 使用美式發音，含前後斜線，例如 /əˈtʃiːv/。
8. mnemonic 只在有真正好記的聯想時填寫，否則留空字串。不要硬湊。`

/**
 * @param {string[]} headwords  batch of NGSL headwords (keep ≤ 25 per call)
 * @returns {Promise<Object[]>} enriched entries, keyed back by headword
 */
export async function enrichWords (headwords, { key, model = DEFAULT_MODEL, signal } = {}) {
  const list = headwords.map((w, i) => `${i + 1}. ${w}`).join('\n')
  const prompt = `為以下 ${headwords.length} 個英文單字產生學習資料。務必依照原順序輸出同樣數量的項目，headword 必須與輸入完全一致。

${list}`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: WORD_SYSTEM,
    prompt,
    schema: WORD_SCHEMA,
    temperature: 0.4
  }))

  const parsed = parseJson(text)
  if (!Array.isArray(parsed)) throw new GeminiError('單字資料格式不正確')

  const byWord = new Map()
  for (const entry of parsed) {
    if (entry?.headword) byWord.set(String(entry.headword).toLowerCase().trim(), entry)
  }
  return headwords.map(w => byWord.get(w.toLowerCase().trim()) || null)
}

/* ------------------------------------------------------------------ *
 * 2. Daily article + comprehension questions
 * ------------------------------------------------------------------ */

const ARTICLE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    title_zh: { type: 'STRING' },
    body: { type: 'STRING', description: 'The article. Plain text, 2-4 paragraphs separated by \\n\\n' },
    body_zh: { type: 'STRING', description: 'Traditional Chinese translation, same paragraph breaks' },
    used_words: { type: 'ARRAY', items: { type: 'STRING' } },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', description: 'vocab | detail | grammar | inference' },
          q: { type: 'STRING' },
          q_zh: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          answer: { type: 'INTEGER', description: '0-based index into options' },
          explain_zh: { type: 'STRING' }
        },
        required: ['kind', 'q', 'options', 'answer', 'explain_zh']
      }
    }
  },
  required: ['title', 'title_zh', 'body', 'body_zh', 'used_words', 'questions']
}

const TOPIC_LABEL = {
  daily: '日常生活（通勤、購物、家事、朋友聚會）',
  travel: '旅遊（機場、飯店、餐廳、問路、購物）',
  work: '職場（會議、email、專案、同事互動）',
  tech: '科技（軟體、裝置、網路、AI，但用字要淺白）',
  news: '簡易新聞（天氣、體育、生活消息）'
}

export async function generateArticle ({
  words, topic = 'daily', grammarPoint = null, key, model = DEFAULT_MODEL, signal
} = {}) {
  const wordList = words.map(w => w.headword).join(', ')
  const grammarLine = grammarPoint
    ? `\n\n本篇必須自然地示範這個文法點，至少出現 3 次：${grammarPoint.title}（${grammarPoint.pattern}）。第 3 題請針對這個文法點出題。`
    : ''

  const prompt = `寫一篇 CEFR A2-B1 的英文短文，主題是「${TOPIC_LABEL[topic] || TOPIC_LABEL.daily}」。

必須使用的單字（盡可能全部用上，可用其變化形）：
${wordList}

要求：
- 180-260 字，2-4 段，有具體情節或場景，不要寫成說明文。
- 除了上列單字外，其他用字必須是最高頻的 1000 字以內。
- 句子平均長度 8-14 字，避免子句層層嵌套。
- used_words 列出你實際用到的上列單字（原形）。
- 出 6 題選擇題，每題 4 個選項：2 題 vocab（考文中單字的語境意思）、2 題 detail（考細節理解）、1 題 grammar、1 題 inference（推論或情境判斷）。
- 題目本身用英文（q），另附繁體中文翻譯（q_zh）；解析（explain_zh）一律繁體中文，說明為什麼對、為什麼其他選項錯。
- 選項不要有明顯的長度或格式線索。${grammarLine}`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: WORD_SYSTEM,
    prompt,
    schema: ARTICLE_SCHEMA,
    temperature: 0.85
  }))

  const article = parseJson(text)
  article.questions = (article.questions || []).filter(
    q => Array.isArray(q.options) && q.options.length >= 2 &&
         Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length
  )
  return article
}

/* ------------------------------------------------------------------ *
 * 3. Travel roleplay dialogue
 * ------------------------------------------------------------------ */

const DIALOGUE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    scene: { type: 'STRING' },
    scene_zh: { type: 'STRING' },
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          speaker: { type: 'STRING', description: 'you | other' },
          en: { type: 'STRING' },
          zh: { type: 'STRING' }
        },
        required: ['speaker', 'en', 'zh']
      }
    },
    key_phrases: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { en: { type: 'STRING' }, zh: { type: 'STRING' } },
        required: ['en', 'zh']
      }
    }
  },
  required: ['scene', 'scene_zh', 'lines', 'key_phrases']
}

export async function generateDialogue ({ sceneKey, sceneLabel, words = [], key, model = DEFAULT_MODEL, signal } = {}) {
  const wordHint = words.length
    ? `\n盡量用上這些單字：${words.map(w => w.headword).join(', ')}`
    : ''
  const prompt = `寫一段旅遊情境對話，場景是「${sceneLabel}」。

要求：
- 10-14 句來回，speaker 只能是 "you"（學習者）或 "other"（對方）。
- 英文限 CEFR A2 難度，句子短、實用、可以直接背起來就用。
- 每句附繁體中文翻譯。
- key_phrases 挑出 5 個這個場景最該記住的句型或片語。${wordHint}`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: WORD_SYSTEM,
    prompt,
    schema: DIALOGUE_SCHEMA,
    temperature: 0.8
  }))
  return parseJson(text)
}

/* ------------------------------------------------------------------ *
 * 4. Connection test
 * ------------------------------------------------------------------ */

export async function testConnection ({ key, model = DEFAULT_MODEL } = {}) {
  const started = performance.now()
  // Settle on a model this key can call before timing anything, so the result
  // reports the model that will actually be used day to day.
  const chosen = await resolveModel(key, model)
  const text = await callGemini({
    key, model: chosen,
    prompt: 'Reply with exactly: OK',
    temperature: 0
  })
  return {
    ok: /ok/i.test(text),
    ms: Math.round(performance.now() - started),
    model: chosen,
    switched: chosen !== model,
    raw: text.trim().slice(0, 80)
  }
}

export async function listModels (key) {
  const res = await fetch(`${ENDPOINT}?pageSize=100`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) throw new GeminiError(describeStatus(res.status, await res.text().catch(() => '')), { status: res.status })
  const json = await res.json()
  return (json.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => n.startsWith('gemini'))
}
