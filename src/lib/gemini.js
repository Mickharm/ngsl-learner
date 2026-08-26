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
  article.questions = (article.questions || []).filter(
    q => Array.isArray(q.options) && q.options.length >= 2 &&
         Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length
  )
  return article
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

const PRODUCTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ok: { type: 'BOOLEAN', description: 'true if it is a usable English sentence that fulfils the task' },
    score: { type: 'INTEGER', description: '0-3: 0 unusable, 1 understandable but wrong, 2 correct, 3 correct and natural' },
    usedTarget: { type: 'BOOLEAN', description: 'did they actually use the target word/pattern correctly' },
    corrected: { type: 'STRING', description: 'their sentence with the minimum fixes; empty if already correct' },
    explain_zh: { type: 'STRING', description: 'Traditional Chinese. What was wrong, or what was good. One or two sentences.' },
    better: { type: 'STRING', description: 'a more natural way a native speaker would say roughly the same thing' }
  },
  required: ['ok', 'score', 'usedTarget', 'explain_zh']
}

const PRODUCTION_SYSTEM = `你是英文寫作教練，學生是台灣工程師，程度 CEFR A2-B1，目標是能開口說英文。

批改原則：
1. 標準是「這句話說出去，母語者聽得懂而且不覺得奇怪」，不是完美無瑕。
2. score：0 = 無法理解或根本沒用英文；1 = 看得懂但有明顯文法錯；2 = 正確；3 = 正確且自然。
3. 只要句子正確且完成任務就給 ok = true，即使很簡單。不要因為句子短就扣分。
4. corrected 只做**最小必要修改**，不要重寫整句、不要換掉學生選的字。
5. better 給一個更自然的說法，讓學生看到母語者會怎麼講；如果原句已經很自然，就重複原句。
6. explain_zh 一律繁體中文，具體指出問題，不要只說「很好」。
7. 中式英文（直譯自中文的句子）即使文法對也要指出來，並在 better 給自然說法。`

/**
 * Grade a sentence the learner wrote.
 * @param {string} task     what they were asked to do, in Chinese
 * @param {string} target   the word or pattern they had to use
 * @param {string} learner  what they wrote
 */
export async function judgeProduction ({ task, target, learner, key, model = DEFAULT_MODEL, signal } = {}) {
  const prompt = `任務：${task}
必須用到：${target}
學生寫的句子：${learner}

批改這個句子。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: PRODUCTION_SYSTEM,
    prompt,
    schema: PRODUCTION_SCHEMA,
    temperature: 0.2
  }))
  return parseJson(text)
}

/** A writing task for a word, phrased so there is something real to say. */
const TASK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    task_zh: { type: 'STRING', description: 'Traditional Chinese instruction, one sentence, concrete and answerable' },
    hint_en: { type: 'STRING', description: 'a short English sentence frame or starter, e.g. "I usually ___ when ..."' }
  },
  required: ['task_zh', 'hint_en']
}

export async function generateWritingTask ({ word, meaning, key, model = DEFAULT_MODEL, signal } = {}) {
  const prompt = `為單字「${word}」（意思：${meaning}）設計一個造句任務。

要求：
- task_zh 用繁體中文，一句話，要具體到學生馬上知道要寫什麼（例如「用 achieve 描述你今年完成的一件事」），不要出「請用 achieve 造句」這種空洞題目。
- 情境限定日常、旅遊或職場。
- hint_en 給一個很短的句型起頭，幫助程度不高的學生開口。`

  const text = await withRetry(() => callGemini({
    key, model, signal,
    systemInstruction: DRILL_SYSTEM,
    prompt,
    schema: TASK_SCHEMA,
    temperature: 0.9
  }))
  return parseJson(text)
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
