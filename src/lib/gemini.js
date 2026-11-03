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
export const DEFAULT_MODEL = 'gemini-1.5-flash'

export class GeminiError extends Error {
  constructor (message, { status = 0, retryable = false } = {}) {
    super(message)
    this.name = 'GeminiError'
    this.status = status
    this.retryable = retryable
  }
}

function describeStatus (status, body) {
  const text = String(body || '')

  // Google AI Studio has started issuing keys prefixed `AQ.` on some accounts,
  // and a subset of those are rejected by the Generative Language API with
  // ACCESS_TOKEN_TYPE_UNSUPPORTED no matter how the request is authenticated.
  // It is a Google-side problem with a known workaround, so say so rather than
  // letting it read as "you typed your key wrong".
  if (status === 401 && /ACCESS_TOKEN_TYPE_UNSUPPORTED|Expected OAuth 2 access token/i.test(text)) {
    return 'Google 不接受這把金鑰（401）。AI Studio 對部分帳號發出的 AQ. 開頭金鑰'
      + '無法用於 Gemini API，這是 Google 端的已知問題，不是你設定錯。'
      + '解法：改到 Google Cloud Console → APIs & Services → Credentials 建立 API key'
      + '（格式為 AIza...），並確認該專案已啟用 Generative Language API。'
  }
  if (status === 403 && /SERVICE_DISABLED|has not been used in project/i.test(text)) {
    return '這個專案還沒啟用 Generative Language API（403）。'
      + '到 Google Cloud Console 搜尋 "Generative Language API" 並按 Enable。'
  }

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
          options_zh: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'Traditional Chinese translation of each option, same order, same length'
          },
          answer: { type: 'INTEGER', description: '0-based index into options' },
          explain_zh: { type: 'STRING' }
        },
        required: ['kind', 'q', 'q_zh', 'options', 'options_zh', 'answer', 'explain_zh']
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
- 選項（options）用英文，並且一定要附 options_zh：每個選項的繁體中文翻譯，順序與數量必須完全對應。學習者字彙量只有 400-500 字，看不懂選項時要能對照中文。
- 選項的英文用字也限制在最高頻 1000 字以內（文中出現過的字除外）。
- explain_zh 提到選項時一律用字母（選項 A / 選項 B / 選項 C / 選項 D），**不要用數字**，因為畫面上標的是 A B C D。
- 選項不要有明顯的長度或格式線索。${grammarLine}`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: WORD_SYSTEM,
    prompt,
    schema: ARTICLE_SCHEMA,
    temperature: 0.85
  }))

  const article = parseJson(text)
  article.questions = (article.questions || [])
    .filter(
      q => Array.isArray(q.options) && q.options.length >= 2 &&
           Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length
    )
    // A missing or short options_zh must not silently misalign the Chinese with
    // the wrong option — pad instead, so index i always describes option i.
    .map(q => ({
      ...q,
      options_zh: q.options.map((_, i) => (Array.isArray(q.options_zh) ? q.options_zh[i] : '') || '')
    }))
  return article
}

/* ------------------------------------------------------------------ *
 * 2b. Ad-hoc word lookup
 *
 * A generated article is not confined to the 2,801 NGSL headwords: it contains
 * irregular forms, proper nouns and the occasional word past the list. Those
 * words had no card to open, so tapping them did nothing at all — the reader
 * hit a dead end on exactly the words they most needed explained.
 * ------------------------------------------------------------------ */

const GLOSS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headword: { type: 'STRING', description: 'the surface form as it was tapped' },
    base: { type: 'STRING', description: 'dictionary/base form, empty if identical' },
    ipa: { type: 'STRING', description: 'General American IPA of the surface form, in slashes' },
    form_zh: {
      type: 'STRING',
      description: 'Traditional Chinese, one short line: what form this is (past tense, plural, comparative...). Empty when the word is already the base form.'
    },
    meanings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pos: { type: 'STRING' },
          zh: { type: 'STRING', description: 'Traditional Chinese gloss' }
        },
        required: ['pos', 'zh']
      }
    },
    examples: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { en: { type: 'STRING' }, zh: { type: 'STRING' } },
        required: ['en', 'zh']
      }
    }
  },
  required: ['headword', 'ipa', 'meanings', 'examples']
}

/**
 * Explain one word the learner tapped, in the sentence they tapped it in.
 *
 * @param {string} surface  the word exactly as it appears in the text
 * @param {string} context  the sentence around it, so a form like "left" is
 *                          glossed the way it is actually used
 */
export async function lookupWord (surface, { context = '', key, model = DEFAULT_MODEL, signal } = {}) {
  const line = context ? `\n\n它出現在這個句子裡：「${context}」，請依這個句子裡的用法解釋。` : ''
  const prompt = `學習者在閱讀時點了英文單字「${surface}」，他不認識這個字。${line}

要求：
- headword 就是 ${surface}（原樣輸出）。
- base 給字典原形；如果 ${surface} 本身就是原形，base 給空字串。
- form_zh 用一句繁體中文說明這是什麼形態（過去式／複數／比較級／現在分詞…）；本來就是原形就給空字串。
- meanings 最多 2 個，依這個句子裡的用法排序。
- examples 給 1 句 CEFR A2 的實用例句與繁體中文翻譯。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: WORD_SYSTEM,
    prompt,
    schema: GLOSS_SCHEMA,
    temperature: 0.3
  }))
  return parseJson(text)
}

/* ------------------------------------------------------------------ *
 * Generated practice
 *
 * Fixed drill banks run dry: twelve units with six questions each is one
 * afternoon. With a paid Gemini quota the sensible shape is a fixed teaching
 * layer (explanations and tables, which must be right every time and work
 * offline) plus practice generated on demand, aimed at what this learner keeps
 * getting wrong.
 *
 * Generated drills reuse the shapes the drill runner already understands, so
 * nothing downstream needs to know where a question came from.
 * ------------------------------------------------------------------ */

const DRILL_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', description: 'choice | correct | order' },
      q: { type: 'STRING', description: 'choice only: the question, English, with _____ for the blank' },
      options: { type: 'ARRAY', items: { type: 'STRING' }, description: 'choice only: exactly 4' },
      answer: { type: 'STRING', description: 'correct/order: the full correct sentence. choice: leave empty' },
      answerIndex: { type: 'INTEGER', description: 'choice only: 0-based index of the correct option' },
      wrong: { type: 'STRING', description: 'correct only: the sentence containing one error' },
      tokens: { type: 'ARRAY', items: { type: 'STRING' }, description: 'order only: the scrambled words, no punctuation' },
      zh: { type: 'STRING', description: 'order only: the Chinese sentence to translate' },
      explain: { type: 'STRING', description: 'Traditional Chinese explanation of why the answer is right' }
    },
    required: ['type', 'explain']
  }
}

const DRILL_SYSTEM = `你是為台灣工程師出英文練習題的命題老師。學習者字彙量約 400-500 字、文法從零開始，目標是 TOEIC 600 與旅遊會話。

命題規則：
1. 中文一律繁體，禁止簡體。
2. 除了題目考的目標點以外，只使用最高頻的 1000 字以內字彙。句長 6-14 字。
3. 情境限定日常、旅遊、職場——不要抽象或教科書式的句子。
4. choice 題：options 必須剛好 4 個，answerIndex 是 0-based。錯誤選項要是「真的有人會選」的錯，不是明顯亂填。選項長度要接近，不要讓正確答案特別長。
5. correct 題：wrong 必須剛好含一個文法錯誤，answer 是修正後的完整句子。
6. order 題：tokens 是打散的單字（不含標點），answer 是正確語序的完整句子，zh 是對應中文。tokens 必須剛好能拼出 answer。
7. explain 一律繁體中文，直接說明為什麼對、錯的選項錯在哪，不要客套。
8. 提到選項時用字母（選項 A / 選項 B），不要用數字。
9. 每題只考一個點，不要混合多個文法概念。`

/**
 * Generate fresh practice for a topic.
 *
 * @param {string} topic     what to practise, in Chinese (a unit title)
 * @param {string} focus     the rule in one line, so the model does not drift
 * @param {string[]} types   which drill shapes to produce
 * @param {string[]} avoid   sentences already used, so questions do not repeat
 * @param {string[]} weak    points this learner keeps missing
 */
export async function generateDrills ({
  topic, focus = '', count = 6, types = ['choice', 'correct', 'order'],
  avoid = [], weak = [], words = [], key, model = DEFAULT_MODEL, signal
} = {}) {
  const prompt = `為「${topic}」出 ${count} 題練習。

考點：${focus || topic}
題型：只用這些型別 ${types.join(' / ')}，數量盡量平均分配。
${weak.length ? `這位學習者特別容易錯的地方，請多考：${weak.join('、')}\n` : ''}${words.length ? `盡量把這些單字融入句子：${words.join(', ')}\n` : ''}${avoid.length ? `避免重複這些已出過的句子：\n${avoid.slice(0, 12).map(a => '- ' + a).join('\n')}\n` : ''}
直接輸出題目陣列。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: DRILL_SYSTEM,
    prompt,
    schema: DRILL_SCHEMA,
    temperature: 0.9
  }))

  const raw = parseJson(text)
  if (!Array.isArray(raw)) throw new GeminiError('題目格式不正確')
  return raw.map(normalizeDrill).filter(Boolean)
}

/**
 * Generated questions arrive close to the right shape but not always usable —
 * a choice with three options, an order drill whose tokens cannot spell the
 * answer. Reject those rather than showing the learner a broken question.
 */
function normalizeDrill (d) {
  if (!d || typeof d !== 'object') return null
  const explain = d.explain || ''

  if (d.type === 'choice') {
    const options = (d.options || []).map(o => String(o).trim()).filter(Boolean)
    const answer = Number(d.answerIndex)
    if (options.length !== 4 || !Number.isInteger(answer) || answer < 0 || answer > 3) return null
    if (!d.q || !d.q.includes('_')) return null
    if (new Set(options.map(o => o.toLowerCase())).size !== 4) return null
    return { type: 'choice', q: String(d.q).trim(), options, answer, explain, generated: true }
  }

  if (d.type === 'correct') {
    if (!d.wrong || !d.answer) return null
    if (String(d.wrong).trim() === String(d.answer).trim()) return null
    return { type: 'correct', wrong: String(d.wrong).trim(), answer: String(d.answer).trim(), explain, generated: true }
  }

  if (d.type === 'order') {
    const tokens = (d.tokens || []).map(t => String(t).replace(/[.,?!]/g, '').trim()).filter(Boolean)
    if (tokens.length < 3 || !d.answer) return null
    const want = String(d.answer).replace(/[.,?!]/g, '').toLowerCase().split(/\s+/).sort().join(' ')
    const got = tokens.map(t => t.toLowerCase()).sort().join(' ')
    if (want !== got) return null           // tokens cannot build the answer
    return { type: 'order', tokens, answer: String(d.answer).trim(), zh: d.zh || '', explain, generated: true }
  }

  return null
}

/* ------------------------------------------------------------------ *
 * Production practice
 *
 * Recognition is not production. A learner can pass every multiple-choice
 * question and still be unable to say anything, which is exactly the gap
 * between "TOEIC 600" and "can hold a conversation". This asks for a sentence
 * and grades what comes back.
 * ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ *
 * 主題對話 — a bounded role-play
 *
 * v4 asked for one sentence per word and showed a finished example, which
 * learners copied. Now the model plays a partner in a fixed situation for at
 * most five learner replies. Two calls:
 *
 *   talkTurn    per reply: the partner's next line (with an implicit recast
 *               of what the learner meant), a minimal fix, which goals are
 *               done, and a partial sentence starter — never a full answer.
 *   talkReport  once, at the end: a four-criterion rubric, an honest CEFR
 *               estimate, what went well, at most three fixes, one phrase to
 *               learn next.
 *
 * The transcript travels as text in one prompt rather than as chat turns, so
 * every reply is a single schema-checked JSON object.
 * ------------------------------------------------------------------ */

const TALK_TURN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply_en: { type: 'STRING', description: "the partner's next line: at most 18 words, CEFR A1-A2, one question at most" },
    reply_zh: { type: 'STRING', description: 'Traditional Chinese translation of reply_en' },
    understood: { type: 'BOOLEAN', description: 'a patient listener would understand what the learner meant' },
    fix: { type: 'STRING', description: "the learner's message with the minimum changes to be correct English; empty string if already fine" },
    note_zh: { type: 'STRING', description: 'Traditional Chinese, at most 30 characters: the one thing to notice; empty if nothing' },
    goals_done: { type: 'ARRAY', items: { type: 'BOOLEAN' }, description: 'one per goal, cumulative over the whole conversation' },
    hint_en: { type: 'STRING', description: 'a 2-5 word sentence starter for answering reply_en, ending with "…"; never a complete sentence' },
    end: { type: 'BOOLEAN', description: 'true when reply_en closes the conversation' }
  },
  required: ['reply_en', 'reply_zh', 'understood', 'fix', 'note_zh', 'goals_done', 'hint_en', 'end']
}

const TALK_SYSTEM = `你在英文口說練習 app 裡扮演對話角色，對象是台灣的英文初學者（字彙量只有幾百到一千多字、文法很弱）。

角色規則：
1. 永遠待在角色裡，用簡短、自然、CEFR A1-A2 的英文回應，每次最多 18 個字、最多問一個問題。
2. 學生的英文有錯時，回應裡自然地用正確說法重述一次他的意思（recast），例如學生說 "I want big latte"，你回 "A large latte? Sure!"。不要在 reply_en 裡講解文法或糾正。
3. 學生用了中文或中英混雜，就當作你聽懂了，照常往下聊；fix 給出整句的英文說法。
4. 學生離題或答非所問，簡短回應一句，然後把話題帶回下一個還沒完成的目標。
5. 所有目標都完成，或 turns_left 是 0，就用一句話自然地結束對話，end = true；否則 end = false。
6. fix 只做最小必要修改，保留學生自己的用字；已經正確或只是不夠道地就給空字串。
7. note_zh 只講最重要的一點（例如「動詞 go 的過去式是 went」），沒有要提醒的就給空字串。
8. hint_en 是給學生回答你這句話用的開頭（2-5 個字加 "…"），不可以是完整句子，不可以直接給答案。
9. goals_done 依整段對話累計判斷，學生真的做到才算。`

/**
 * One partner turn.
 * @param {object} topic        an entry of data/talk-topics.js
 * @param {Array}  history      [{ who: 'ai'|'me', en }]
 * @param {string} learner      the learner's newest message
 * @param {number} turnsLeft    learner replies still allowed after this one
 * @param {Array}  targets      today's words to weave in, if they fit
 * @param {number} knownWords   rough vocabulary size, to pitch the partner
 */
export async function talkTurn ({ topic, twist = '', history = [], learner, turnsLeft, targets = [], knownWords = 0, key, model = DEFAULT_MODEL, signal } = {}) {
  const transcript = history.map(h => `${h.who === 'ai' ? topic.partner.name : '學生'}: ${h.en}`).join('\n')
  const prompt = `情境：${topic.scene_zh}
你的角色：${topic.partner.name}，${topic.partner.role_en}
學生要完成的目標：
${topic.goals.map((g, i) => `${i + 1}. ${g.en}（${g.zh}）`).join('\n')}
${twist ? `這次的狀況（在第一或第二次回應時自然地帶進來，讓學生要處理它）：${twist}\n` : ''}${targets.length ? `今天學的字（適合時可以自然地用上，讓學生聽到）：${targets.join(', ')}\n` : ''}${knownWords ? `學生大約認得 ${knownWords} 個英文字。\n` : ''}
到目前為止的對話：
${transcript}

學生剛剛說：${learner}
turns_left：${turnsLeft}

以 ${topic.partner.name} 的身分回應，並依 schema 回傳。goals_done 要有 ${topic.goals.length} 個值。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: TALK_SYSTEM,
    prompt,
    schema: TALK_TURN_SCHEMA,
    temperature: 0.6
  }))
  const r = parseJson(text)
  const goals = Array.isArray(r.goals_done) ? r.goals_done.slice(0, topic.goals.length).map(Boolean) : []
  while (goals.length < topic.goals.length) goals.push(false)
  return {
    reply_en: String(r.reply_en || '').trim(),
    reply_zh: String(r.reply_zh || '').trim(),
    understood: r.understood !== false,
    fix: sameSentence(r.fix, learner) ? '' : String(r.fix || '').trim(),
    note_zh: String(r.note_zh || '').trim(),
    goals_done: goals,
    // a starter that is really a full sentence defeats the point; drop it
    hint_en: cleanHint(r.hint_en),
    end: !!r.end
  }
}

function sameSentence (a, b) {
  const n = s => String(s || '').toLowerCase().replace(/[^a-z0-9']+/g, ' ').trim()
  return !n(a) || n(a) === n(b)
}
function cleanHint (h) {
  let t = String(h || '').trim()
  if (!t) return ''
  // no ellipsis and ends like a sentence: a full answer, not a starter
  if (!t.includes('…')) {
    if (/[.!?]$/.test(t)) return ''
    t = `${t.replace(/\.+$/, '')} …`
  }
  const words = t.replace(/[…?.!,]/g, ' ').trim().split(/\s+/)
  return words.length > 6 ? '' : t
}

const TALK_REPORT_SCHEMA = {
  type: 'OBJECT',
  properties: {
    task: { type: 'INTEGER', description: '0-4 goals achieved' },
    vocabulary: { type: 'INTEGER', description: '0-4 range and fit of words' },
    accuracy: { type: 'INTEGER', description: '0-4 grammar and word form' },
    interaction: { type: 'INTEGER', description: '0-4 responding, asking, keeping it going' },
    level: { type: 'STRING', description: 'one of Pre-A1, A1, A2, B1, B2 — CEFR estimate of this performance, not of the person' },
    summary_zh: { type: 'STRING', description: 'Traditional Chinese, one or two sentences, specific to this conversation' },
    strengths: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { quote: { type: 'STRING' }, why_zh: { type: 'STRING' } }, required: ['quote', 'why_zh'] }
    },
    fixes: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { said: { type: 'STRING' }, better: { type: 'STRING' }, why_zh: { type: 'STRING' } }, required: ['said', 'better', 'why_zh'] }
    },
    upgrade: {
      type: 'OBJECT',
      properties: { en: { type: 'STRING' }, zh: { type: 'STRING' }, when_zh: { type: 'STRING' } },
      required: ['en', 'zh', 'when_zh']
    }
  },
  required: ['task', 'vocabulary', 'accuracy', 'interaction', 'level', 'summary_zh', 'strengths', 'fixes', 'upgrade']
}

const TALK_REPORT_SYSTEM = `你是英文口說評量老師，評的是台灣初學者剛完成的一段情境對話。依下面的量表給分，要誠實：做不到就給低分，但評語要具體、讓人知道下一步。

量表（每項 0-4）：
- task 任務達成：0 一個目標都沒做到；1 做到一個；2 大部分做到但要對方幫忙；3 全部做到；4 全部做到而且說得清楚、有補充細節。
- vocabulary 用字：0 幾乎都是中文；1 只有零星單字；2 基本字夠用；3 用字貼切、有用到情境需要的字；4 用字多樣又精準。
- accuracy 正確度：0 看不懂；1 錯很多、影響理解；2 有錯但看得懂；3 只有少數小錯；4 幾乎沒錯。
- interaction 互動：0 沒有回應到對方；1 只有單字或片段；2 用短句回應；3 用完整句回應，也會主動問問題；4 自然地一來一往、讓對話延續。

level 是這段表現大約的 CEFR 等級（Pre-A1 / A1 / A2 / B1 / B2），只看這段對話。
strengths 最多 2 個，quote 要引用學生原句。
fixes 最多 3 個，挑最影響溝通的；said 是學生原句，better 是最小修改後的正確說法，why_zh 一句話說明。學生句子都正確就給空陣列。
upgrade 給一個這個情境很實用、學生還沒用過的說法（en、zh、when_zh 說明什麼時候用）。
所有中文都用繁體中文。`

/** The end-of-talk evaluation. */
export async function talkReport ({ topic, twist = '', history = [], key, model = DEFAULT_MODEL, signal } = {}) {
  const transcript = history.map(h => `${h.who === 'ai' ? topic.partner.name : '學生'}: ${h.en}`).join('\n')
  const prompt = `情境：${topic.scene_zh}（對方：${topic.partner.role_en}）
學生的目標：
${topic.goals.map((g, i) => `${i + 1}. ${g.en}（${g.zh}）`).join('\n')}
${twist ? `這次另外加了一個狀況：${twist}（處理得好可以反映在 task 與 interaction）\n` : ''}
完整對話：
${transcript}

依量表評這位學生（只評「學生」說的話）。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: TALK_REPORT_SYSTEM,
    prompt,
    schema: TALK_REPORT_SCHEMA,
    temperature: 0.2
  }))
  const r = parseJson(text)
  const clamp = v => Math.max(0, Math.min(4, Math.round(Number(v) || 0)))
  return {
    scores: { task: clamp(r.task), vocabulary: clamp(r.vocabulary), accuracy: clamp(r.accuracy), interaction: clamp(r.interaction) },
    level: ['Pre-A1', 'A1', 'A2', 'B1', 'B2'].includes(r.level) ? r.level : '',
    summary_zh: String(r.summary_zh || ''),
    strengths: (r.strengths || []).slice(0, 2).filter(x => x?.quote),
    fixes: (r.fixes || []).slice(0, 3).filter(x => x?.said && x?.better && !sameSentence(x.better, x.said)),
    upgrade: r.upgrade?.en ? r.upgrade : null
  }
}

/* 自己出題: the learner describes a situation in Chinese, the model writes a
 * scenario in the same shape as data/talk-topics.js. Validated here — a
 * scenario without three goals or with a full-sentence "frame" is rejected
 * rather than shown. */
const TALK_TOPIC_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: 'Traditional Chinese, at most 8 characters' },
    scene_zh: { type: 'STRING', description: 'Traditional Chinese, one sentence: where the learner is and what they want' },
    partner_name: { type: 'STRING', description: 'an English first name' },
    partner_role_en: { type: 'STRING' },
    partner_role_zh: { type: 'STRING' },
    goals: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { zh: { type: 'STRING' }, en: { type: 'STRING' } }, required: ['zh', 'en'] },
      description: 'exactly three concrete things the learner must say or ask'
    },
    opener_en: { type: 'STRING', description: "the partner's first line, at most 14 words, CEFR A1-A2" },
    opener_zh: { type: 'STRING' },
    frames: { type: 'ARRAY', items: { type: 'STRING' }, description: 'four partial sentence starters of 2-5 words, each ending with "…"' }
  },
  required: ['title', 'scene_zh', 'partner_name', 'partner_role_en', 'partner_role_zh', 'goals', 'opener_en', 'opener_zh', 'frames']
}

export async function buildTalkTopic ({ idea, key, model = DEFAULT_MODEL, signal } = {}) {
  const prompt = `學生想練習的情境（中文描述）：${String(idea || '').slice(0, 80)}

把它設計成一段英文會話練習：學生是初學者（CEFR A1-A2），對方是情境中的一個人。
- goals 剛好三個，具體到學生知道要說什麼（例如「問有沒有素食」），由簡單到稍難。
- opener_en 是對方開口的第一句。
- frames 是學生可以用的句子開頭，不是完整句子。
- 情境要安全、日常；如果描述不適合或看不懂，就改成最接近的日常情境。`
  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: '你是為台灣英文初學者設計會話練習情境的老師。英文限 CEFR A1-A2，所有中文用繁體中文。',
    prompt,
    schema: TALK_TOPIC_SCHEMA,
    temperature: 0.7
  }))
  return normalizeTalkTopic(parseJson(text), idea)
}

export function normalizeTalkTopic (r, idea = '') {
  const goals = (r?.goals || []).filter(g => g?.zh && g?.en).slice(0, 3)
  const frames = (r?.frames || []).map(cleanHint).filter(Boolean).slice(0, 4)
  const opener = String(r?.opener_en || '').trim()
  if (goals.length < 3 || !opener || opener.split(/\s+/).length > 20 || !r?.partner_name) {
    throw new GeminiError('這個情境沒有產生成功，換個說法再試一次')
  }
  let h = 0
  for (const ch of String(idea)) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0
  return {
    id: `custom-${(h >>> 0).toString(36)}`,
    area: 'custom',
    custom: true,
    title: String(r.title || '自訂情境').slice(0, 12),
    scene_zh: String(r.scene_zh || idea),
    partner: { name: String(r.partner_name).split(/\s+/)[0], role_en: String(r.partner_role_en || ''), role_zh: String(r.partner_role_zh || '') },
    goals: goals.map(g => ({ zh: String(g.zh), en: String(g.en) })),
    opener: { en: opener, zh: String(r.opener_zh || '') },
    frames: frames.length ? frames : ['I would like …', 'Can I …?', 'How much …?'],
    script: [], samples: [], twists: []
  }
}

/* ------------------------------------------------------------------ *
 * Sentence judging
 *
 * Grammar drills used to compare the learner's sentence to one reference
 * answer as normalised strings. English does not work that way: "I will wait"
 * and "I'll wait" are the same sentence, word order is often free, and a fix
 * for the target error can be correct while differing from the model answer.
 * Marking those wrong teaches the learner to guess the phrasing rather than
 * the grammar. So: strict match first (free, offline, instant), and only when
 * it fails do we ask the model whether the answer is nonetheless right.
 * ------------------------------------------------------------------ */

const JUDGE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    correct: { type: 'BOOLEAN', description: 'true if the learner sentence is grammatically correct AND fixes the target error AND keeps the intended meaning' },
    severity: { type: 'STRING', description: 'none | minor | major — minor means a typo or punctuation slip only' },
    explain_zh: { type: 'STRING', description: 'Traditional Chinese, one or two sentences. If wrong, say exactly what is wrong. If right but phrased differently from the reference, say so.' },
    corrected: { type: 'STRING', description: 'The learner sentence with only the necessary fixes; empty if already correct' }
  },
  required: ['correct', 'severity', 'explain_zh']
}

const JUDGE_SYSTEM = `你是英文文法批改老師，學生是台灣工程師，程度 CEFR A2-B1。

判定原則：
1. 只要句子文法正確、修正了目標錯誤、意思沒跑掉，就算對——即使跟參考答案用字不同。
2. 縮寫等同展開（I'll = I will、doesn't = does not），不影響對錯。
3. 大小寫、句尾標點、多餘空白：severity 記 minor，但 correct 仍為 true。
4. 意思改變、目標錯誤沒修好、或產生新的文法錯誤：correct = false。
5. explain_zh 一律繁體中文，直接講哪裡錯、為什麼，不要客套。
6. 若學生答案正確但和參考答案不同，明講「這樣寫也對」並簡短說明差異。`

/**
 * Judge a learner's sentence against a reference answer.
 * @returns {Promise<{correct:boolean, severity:string, explain_zh:string, corrected?:string}>}
 */
export async function judgeSentence ({
  learner, reference, task, targetError = '', key, model = DEFAULT_MODEL, signal
} = {}) {
  const prompt = `題目類型：${task}
${targetError ? `原句（含錯誤）：${targetError}\n` : ''}參考答案：${reference}
學生作答：${learner}

判斷學生的答案是否正確。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: JUDGE_SYSTEM,
    prompt,
    schema: JUDGE_SCHEMA,
    temperature: 0
  }))
  return parseJson(text)
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
  if (!key) throw new GeminiError('尚未設定 Gemini API Key')
  const res = await fetch(`${ENDPOINT}?pageSize=200`, { headers: { 'x-goog-api-key': key } })
  if (!res.ok) throw new GeminiError(describeStatus(res.status, await res.text().catch(() => '')), { status: res.status })
  const json = await res.json()
  return (json.models || [])
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(n => n.startsWith('gemini'))
}
