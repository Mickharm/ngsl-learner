/**
 * Browser smoke test. Serves dist/, stubs Supabase + Gemini at the network
 * layer, and walks the real app: placement → dashboard → Word Lab → review
 * games → Grammar Studio → essentials → write → article → listen → Story Time
 * → word parts → game centre → settings, capturing a screenshot and console
 * errors at each step.
 *
 *   node scripts/smoke.mjs [--dark]
 */
import { chromium } from 'playwright'
import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const DIST = join(ROOT, 'dist')
const SHOTS = join(ROOT, '.shots')
const DARK = process.argv.includes('--dark')
const BASE = '/ngsl-learner/'

// Mirrors SettingsView's preview phrase and tts.js's COLD_MS. Both are read
// back out of the engine stub below, so they have to agree with the app.
const TEST_PHRASE = "Ted took the ten o'clock train to the airport."
const TTS_COLD_MS = 4000
const TTS_LEAD_TEXT = 'a a'   // warmUpText(ttsLeadIn) at the default of 2

if (!existsSync(SHOTS)) mkdirSync(SHOTS, { recursive: true })

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon'
}

const server = http.createServer(async (req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0])
  if (p.startsWith(BASE)) p = p.slice(BASE.length - 1)
  if (p === '/' || p === '') p = '/index.html'
  const file = join(DIST, p)
  try {
    const buf = await readFile(file)
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' })
    res.end(buf)
  } catch {
    try {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(await readFile(join(DIST, 'index.html')))
    } catch { res.writeHead(404); res.end('nope') }
  }
})

await new Promise(r => server.listen(4173, r))
const URL_BASE = `http://localhost:4173${BASE}`

/* ------------------------------------------------------------------ *
 * fixtures
 * ------------------------------------------------------------------ */
const USER_ID = '11111111-2222-3333-4444-555555555555'
const SESSION = {
  access_token: 'stub-access', refresh_token: 'stub-refresh',
  token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: USER_ID, aud: 'authenticated', role: 'authenticated',
    email: 'mick@example.com', user_metadata: { display_name: 'Mick' },
    app_metadata: {}, created_at: new Date().toISOString()
  }
}

const WORD_ROWS = [
  ['achieve', '/əˈtʃiːv/', '達成；實現', 'She worked hard to achieve her goal.', '她努力工作以達成目標。', 'accomplish', 'achieve 強調達成目標，accomplish 強調完成任務'],
  ['require', '/rɪˈkwaɪər/', '需要；要求', 'This job requires patience.', '這份工作需要耐心。', 'request', 'require 是「需要」，request 是「請求」'],
  ['general', '/ˈdʒenrəl/', '一般的；普遍的', 'The general opinion is positive.', '普遍的看法是正面的。', '', ''],
  ['appear', '/əˈpɪr/', '出現；看起來', 'He appeared calm during the meeting.', '他在會議中看起來很冷靜。', 'apparent', 'appear 是動詞，apparent 是形容詞'],
  ['individual', '/ˌɪndɪˈvɪdʒuəl/', '個人的；個體', 'Each individual has a different role.', '每個人的角色都不同。', '', ''],
  ['toward', '/tɔːrd/', '朝向；對於', 'She walked toward the station.', '她朝車站走去。', '', ''],
  ['easy', '/ˈiːzi/', '容易的', 'The instructions were easy to follow.', '說明很容易照著做。', '', ''],
  ['full', '/fʊl/', '滿的；完整的', 'The train was full this morning.', '今天早上火車很滿。', '', ''],
  ['team', '/tiːm/', '團隊', 'Our team finished the project early.', '我們團隊提早完成專案。', '', ''],
  ['wait', '/weɪt/', '等待', 'Please wait at the entrance.', '請在入口等。', 'weight', 'wait 是等待，weight 是重量，發音相同']
]

function wordData (ids) {
  return ids.map((id, i) => {
    const [h, ipa, zh, en, exzh, cw, cd] = WORD_ROWS[i % WORD_ROWS.length]
    return {
      id, headword: h, band: id <= 1000 ? 'B1' : id <= 2000 ? 'B2' : 'B3',
      ipa, meanings: [{ pos: 'v.', zh }],
      examples: [{ en, zh: exzh }],
      confusables: cw ? [{ word: cw, diff: cd }] : [],
      mnemonic: '', family: []
    }
  })
}

/*
 * Legacy SM-2 rows (step_index < 100) that are due now — the state both
 * learners' databases are in on the day v2 ships. They exercise the in-memory
 * conversion, the ladder-chosen task types in review, and the write-back.
 * Intervals are spread so the converted rungs differ (1 → 0, 5 → 1, 10 → 2,
 * 25 → 3), which is what makes review hand out different games.
 */
const DAY_MS = 86400000
const LEGACY_DUE = [1, 5, 10, 25, 3, 8, 12, 30].map((iv, i) => ({
  user_id: USER_ID, word_id: 2300 + i, state: 'review', ease: 2.3, interval_days: iv, step_index: 0,
  due_at: new Date(Date.now() - DAY_MS).toISOString(), reps: 4, lapses: 0, streak: 2, last_grade: 2,
  last_reviewed_at: new Date(Date.now() - (iv + 1) * DAY_MS).toISOString(),
  introduced_at: new Date(Date.now() - 40 * DAY_MS).toISOString(), updated_at: new Date().toISOString()
}))
/* Three grammar points already studied and not yet due, so today's point is
 * the next new one (g04) and the mixed round has older rules to mix in. */
const LEARNED_GRAMMAR = ['g01', 'g02', 'g03'].map(id => ({
  user_id: USER_ID, grammar_id: id, state: 'review', ease: 2.5, interval_days: 2, step_index: 0,
  due_at: new Date(Date.now() + 3 * DAY_MS).toISOString(), reps: 1, lapses: 0, streak: 1, correct: 5, attempts: 6
}))

const db = {
  card_progress: [...LEGACY_DUE],
  daily_log: [],
  user_settings: [{ user_id: USER_ID, payload: { geminiKey: 'stub-key', newPerDay: 20, reviewCap: 40 } }],
  grammar_progress: [...LEARNED_GRAMMAR],
  error_log: [],
  articles: [],
  dialogues: [],
  review_log: []
}

const ARTICLE = {
  title: 'A Long Wait at the Station',
  title_zh: '在車站的漫長等待',
  body: 'Mia arrived at the station early. The platform was already full of people.\n\nShe waited for twenty minutes. A voice appeared on the speaker: the train would be late. Mia looked toward the board and saw a new time.\n\nShe wanted to achieve one thing that day: reach the office before nine. It was not easy, but she stayed calm.',
  body_zh: 'Mia 很早就到了車站。月台上已經站滿了人。\n\n她等了二十分鐘。廣播裡出現一個聲音：火車會誤點。Mia 朝看板望去，看到一個新的時間。\n\n那天她想達成一件事：九點前到辦公室。這不容易，但她保持冷靜。',
  used_words: ['wait', 'full', 'appear', 'toward', 'achieve', 'easy'],
  questions: Array.from({ length: 6 }, (_, i) => ({
    kind: ['vocab', 'detail', 'grammar', 'inference', 'vocab', 'detail'][i],
    q: `Question ${i + 1}: what does the passage say?`,
    q_zh: `第 ${i + 1} 題：文章說了什麼？`,
    options: ['The right answer', 'A wrong one', 'Another wrong one', 'Also wrong'],
    options_zh: ['正確的答案', '錯的選項', '另一個錯的', '也是錯的'],
    answer: 0,
    explain_zh: '正解在第二段可以找到，其他選項與文章描述不符。'
  }))
}

/* ------------------------------------------------------------------ *
 * run
 * ------------------------------------------------------------------ */
// The sandbox ships its own Chromium builds; take the first one that exists
// rather than pinning a build number that rotates with the image.
const CHROME = [
  process.env.CHROME_PATH,
  '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/google-chrome'
].find(p => p && existsSync(p))
const browser = await chromium.launch({
  executablePath: CHROME,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
})
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: DARK ? 'dark' : 'light',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
})

/* --- record what the speech engine is actually handed ---
 *
 * The clipping bug is inaudible to a headless browser, so the only way to
 * regression-test it is to stub the engine and inspect the utterance. Two
 * things have to hold: the text carries its leading silence, and nothing
 * cancels an already-idle engine before speaking (an async cancel is what
 * swallowed the first syllable in the first place).
 */
await ctx.addInitScript(() => {
  const log = { spoken: [], cancels: 0 }
  window.__tts = log

  const voice = { voiceURI: 'stub-en-US', name: 'Stub Samantha', lang: 'en-US', localService: true, default: true }

  class StubUtterance {
    constructor (text) {
      this.text = text
      this.lang = ''
      this.rate = 1
      this.pitch = 1
      this.volume = 1
      this.voice = null
      this.onend = null
      this.onerror = null
      this.onstart = null
    }
  }

  const synth = {
    speaking: false,
    pending: false,
    paused: false,
    getVoices: () => [voice],
    addEventListener () {},
    removeEventListener () {},
    speak (u) {
      // cancelsAtSpeak is the point of the whole record: an utterance handed
      // over while a cancel is still unwinding is the one that loses its head.
      log.spoken.push({
        text: u.text, rate: u.rate, volume: u.volume,
        voiceURI: u.voice?.voiceURI || '', cancelsAtSpeak: log.cancels
      })
      synth.speaking = true
      setTimeout(() => { synth.speaking = false; u.onend?.({}) }, 60)
    },
    cancel () { log.cancels++; synth.speaking = false; synth.pending = false },
    pause () {},
    resume () {}
  }

  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true })
  Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: StubUtterance, configurable: true })
})

const errors = []
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
if (process.env.TRACE_FAIL) page.on('requestfailed', r => console.log('  REQFAIL', r.failure()?.errorText, r.url().slice(0, 120)))

// --- no service worker ---
// The precache answers from disk, so with a service worker in the way no
// asset request reaches the network and nothing here can decide what a
// request returns. The smoke never asserted anything about the worker; it
// does assert what happens when a chunk fails to arrive.
await ctx.route('**/registerSW.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }))
await ctx.route('**/sw.js', route => route.fulfill({ status: 404, contentType: 'text/plain', body: '' }))

// --- stub Supabase ---
await ctx.route('**/hlwmqtbgpconoclmxwll.supabase.co/**', async route => {
  const req = route.request()
  const url = new URL(req.url())
  const path = url.pathname
  const json = (body, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) })

  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' } })
  if (path.includes('/auth/v1/token')) return json(SESSION)
  if (path.includes('/auth/v1/user')) return json(SESSION.user)
  if (path.includes('/auth/v1/logout')) return json({})

  const table = path.replace('/rest/v1/', '').split('/')[0]

  if (table === 'word_data') {
    if (req.method() === 'GET') return json(wordData([...Array.from({ length: 120 }, (_, i) => i + 1), ...LEGACY_DUE.map(r => r.word_id)]))
    return json([])
  }
  if (!(table in db)) return json([])

  if (req.method() === 'GET') {
    const single = (req.headers().accept || '').includes('vnd.pgrst.object')
    const rows = db[table]
    return single ? (rows[0] ? json(rows[0]) : json(null)) : json(rows)
  }
  if (req.method() === 'POST' || req.method() === 'PATCH') {
    try {
      const body = JSON.parse(req.postData() || '[]')
      const arr = Array.isArray(body) ? body : [body]
      db[table].push(...arr)
    } catch { /* ignore */ }
    return json([])
  }
  return json([])
})

// --- stub Gemini ---
await ctx.route('**/generativelanguage.googleapis.com/**', async route => {
  const req = route.request()
  let payload
  const body = req.postData() || ''
  // Route by the response schema the app asked for — that is what actually
  // distinguishes the calls, and it does not drift when prompt wording changes.
  if (body.includes('usedTarget')) {
    payload = {
      ok: true, score: 2, usedTarget: true,
      corrected: '', explain_zh: '句子文法正確，目標單字也用對了。',
      better: 'I managed to finish the report before the deadline.'
    }
  } else if (body.includes('task_zh')) {
    payload = { task_zh: '用 achieve 描述你今年完成的一件事', hint_en: 'This year I managed to ___' }
  } else if (body.includes('answerIndex')) {
    // generated drills — one of each shape, plus one deliberately broken
    payload = [
      { type: 'choice', q: 'The train leaves _____ 7 a.m.', options: ['at', 'on', 'in', 'by'], answerIndex: 0, explain: '幾點用 at。' },
      { type: 'correct', wrong: 'She go to work by bus.', answer: 'She goes to work by bus.', explain: '第三人稱單數加 s。' },
      { type: 'order', tokens: ['we', 'left', 'the', 'office', 'early'], answer: 'We left the office early.', zh: '我們提早離開辦公室。', explain: '主詞在動詞前。' },
      { type: 'choice', q: 'broken', options: ['a', 'b'], answerIndex: 0, explain: 'should be dropped' }
    ]
  } else if (body.includes('severity')) {
    payload = { correct: true, severity: 'none', explain_zh: '這樣寫也對，和參考答案只是說法不同。', corrected: '' }
  } else if (body.includes('used_words') || body.includes('CEFR A2-B1 的英文短文')) payload = ARTICLE
  else if (body.includes('key_phrases')) {
    payload = {
      scene: 'At the hotel front desk', scene_zh: '在飯店櫃檯',
      lines: Array.from({ length: 10 }, (_, i) => ({
        speaker: i % 2 ? 'you' : 'other',
        en: i % 2 ? 'Yes, I have a reservation under Chen.' : 'Good evening. Are you checking in?',
        zh: i % 2 ? '是的，我用陳的名字訂了房。' : '晚安，您要辦入住嗎？'
      })),
      key_phrases: [{ en: 'I have a reservation.', zh: '我有訂房。' }, { en: 'Could I have a late check-out?', zh: '可以延後退房嗎？' }]
    }
  } else {
    const m = body.match(/\d+\.\s+([a-z-]+)/gi) || []
    payload = m.map(s => s.replace(/^\d+\.\s+/, '')).map((h, i) => {
      const row = WORD_ROWS[i % WORD_ROWS.length]
      return { headword: h, ipa: row[1], meanings: [{ pos: 'v.', zh: row[2] }], examples: [{ en: row[3].replace(row[0], h), zh: row[4] }], confusables: [], mnemonic: '' }
    })
  }
  return route.fulfill({
    status: 200, contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] })
  })
})

const checks = []
const shots = []
async function shot (name) {
  await page.waitForTimeout(650)
  const f = join(SHOTS, `${DARK ? 'dark-' : ''}${name}.png`)
  await page.screenshot({ path: f, fullPage: true })
  shots.push(name)
  console.log(`  · ${name}`)
}

async function tap (selector, { timeout = 6000 } = {}) {
  const el = page.locator(selector).first()
  await el.waitFor({ state: 'visible', timeout })
  await el.click({ timeout })
  await page.waitForTimeout(300)
}

console.log(`\n=== NGSL smoke (${DARK ? 'dark' : 'light'}) ===`)

// 1. login
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await shot('01-login')

// sign in through the real form (the stub answers /auth/v1/token)
// the login screen opens on the profile chooser, so pick one first
await page.locator('.who').first().waitFor({ state: 'visible', timeout: 8000 })
await shot('01a-profile-picker')
await page.locator('.who').first().click()
await page.waitForTimeout(350)
await page.fill('#pw', 'stub-password')
await page.click('button[type="submit"]')
await page.waitForTimeout(1400)

const signedIn = !page.url().includes('login')
console.log('  signed in:', signedIn, '→', page.url().split('#')[1] || '/')
if (!signedIn) {
  await shot('01b-login-failed')
  throw new Error('sign-in stub did not take effect')
}

/* --- a route whose chunk vanished under the open page must recover --- */
// Every deploy force-pushes a new dist over gh-pages and the incoming service
// worker bins the old precache on the spot (skipWaiting + cleanupOutdatedCaches),
// so the first request for a chunk the open page had never imported can 404.
// Vue Router aborts that navigation and leaves the screen untouched: the tap
// does nothing at all and the only trace is a console line. The routes used
// daily survive because their modules are already in memory — the casualty is
// whichever route nobody has opened since the deploy, which is how 設定 →
// 重做分級測驗 became a dead button. Verified red by removing router.onError.
{
  let served = 0
  const fresh = await ctx.newPage()
  await fresh.route('**/assets/PlacementView-*.js', r =>
    served++ ? r.continue() : r.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }))
  await fresh.goto(URL_BASE + '#/settings', { waitUntil: 'networkidle' })
  await fresh.waitForTimeout(700)
  const retake = fresh.locator('a:has-text("重做分級測驗")').first()
  await retake.scrollIntoViewIfNeeded()
  await retake.click({ timeout: 6000 }).catch(() => {})
  await fresh.waitForTimeout(4000)
  const landed = fresh.url().includes('#/setup')
  const intro = await fresh.locator('text=先測一下你的起點').count()
  checks.push([
    'a route whose chunk 404s reloads instead of leaving a dead button',
    landed && intro > 0,
    `ended on ${fresh.url().split('#')[1] || '/'}${intro ? '' : ', placement intro never rendered'}`
  ])
  await fresh.close()
}

await page.goto(URL_BASE + '#/setup', { waitUntil: 'networkidle' })
await shot('02-placement-intro')

await tap('button:has-text("開始測驗")')
await shot('03-placement-test')

// The placement asks a real question now, so the smoke has to answer one.
const optCount = await page.locator('.quiz__opt').count().catch(() => 0)
checks.push([
  'the placement probe offers four meanings to choose from',
  optCount === 4,
  `${optCount} options rendered`
])

// answer 48 probes: pick a meaning (or 不知道), then advance
let revealShot = false
for (let i = 0; i < 60; i++) {
  const opts = page.locator('.quiz__opt')
  const n = await opts.count().catch(() => 0)
  if (!n) {
    // no options: fall back to the 不知道 escape so the run still terminates
    const dunno = page.locator('.quiz button:has-text("不知道")').first()
    if (!(await dunno.isVisible({ timeout: 1500 }).catch(() => false))) break
    await dunno.click().catch(() => {})
  } else if (i % 4 === 3) {
    await page.locator('.quiz button:has-text("不知道")').first().click().catch(() => {})
  } else {
    await opts.nth(i % n).click().catch(() => {})
  }
  await page.waitForTimeout(140)
  if (!revealShot) { await shot('03b-placement-answer-shown'); revealShot = true }
  const nextBtn = page.locator('.probe__confirm .btn--primary').first()
  if (await nextBtn.isVisible({ timeout: 2500 }).catch(() => false)) {
    await nextBtn.click().catch(() => {})
    await page.waitForTimeout(120)
  }
  if (await page.locator('.opt-card').first().isVisible({ timeout: 300 }).catch(() => false)) break
}
await shot('04-placement-result')

await tap('.opt-card--rec')
// placement writes a few hundred cards and then routes; wait for the dashboard
// to actually be on screen or the shot catches the fading placement result
await page.waitForTimeout(1200)
await page.locator('.quest').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
await page.waitForTimeout(500)
await shot('05-dashboard')

// Placement now sets a per-learner ceiling instead of pointing everyone at all
// 2,801 words. The dashboard shows the scope it actually settled on.
const placed = await page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem('ngsl.settings') || '{}') } catch { return {} }
})
checks.push([
  'placement stores a phase target instead of pointing at all 2801 words',
  Number(placed.targetWords) > 0,
  `targetWords=${placed.targetWords}`
])
checks.push([
  'placement derives the daily pace rather than keeping whatever was set',
  Number(placed.newPerDay) >= 5 && Number(placed.newPerDay) <= 12,
  `newPerDay=${placed.newPerDay} (fixture stores 20, which is what both learners had)`
])
const scope = await page.locator('.prog__scope').first().innerText().catch(() => '')
const scopeTo = Number((scope.replace(/\s/g, '').match(/(\d+)$/) || [])[1] || 0)
checks.push([
  'the dashboard shows that phase, not the whole list',
  scopeTo === Number(placed.targetWords) && scopeTo > 0,
  `scope="${scope}" → ${scopeTo}, targetWords=${placed.targetWords}`
])

// The four taught phases alternate day to day, so the quest is six steps
// (words, review, one taught pair, listening, summary) and carries exactly one
// of the two pairs.
const stepLabels = (await page.locator('.step__label, .step__title, .step h3, .step').allInnerTexts().catch(() => []))
  .join(' ').replace(/\s+/g, ' ')
const trackA = /Grammar Studio/.test(stepLabels) && /Story Time/.test(stepLabels)
const trackB = /基礎知識/.test(stepLabels) && /造句/.test(stepLabels)
checks.push([
  'the day runs one track, not both',
  trackA !== trackB,
  `A=${trackA} B=${trackB} · ${stepLabels.slice(0, 120)}`
])
const stepCount = await page.locator('.steps > li').count().catch(() => 0)
// v3: review, words, word parts, one taught pair, listening, summary
checks.push(['the quest is seven steps: both daily strands plus one taught pair', stepCount === 7, `${stepCount} steps`])
checks.push(['word parts run on the day', /字首字尾/.test(stepLabels), stepLabels.slice(0, 160)])
checks.push(['listening is on the day, every day', /聽力/.test(stepLabels), stepLabels.slice(0, 120)])

// Changing the daily new-word count before answering anything must re-plan
// today. Reproducing the real bug needs the learn screen to be opened first —
// that is what used to freeze the list — and then abandoned without answering.
await page.goto(URL_BASE + '#/learn', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)          // let lockNewIds() run
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(400)

await page.goto(URL_BASE + '#/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('#new').evaluate(el => {
  el.value = '20'
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
await page.waitForTimeout(500)
await shot('05b-settings-daily-count')

const effect = await page.locator('.effect--newcount').first().innerText().catch(() => '')
checks.push([
  'settings names the count that will actually be used',
  /今天就會套用[^0-9]*20|今天只排得出[^0-9]*20/.test(effect),
  effect.replace(/\s+/g, ' ')
])

await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
const learnStep = await page.locator('.step:has-text("Word Lab")').first().innerText().catch(() => '')
checks.push(['dashboard reflects the new count', /20 個新字/.test(learnStep), learnStep.replace(/\s+/g, ' ')])

/* ------------------------------------------------------------------ *
 * Word Lab — meet (picture, chunks, own drawing) → 連連看 → recall
 * ------------------------------------------------------------------ */

/** Solve a 連連看 board by trying pairs; returns the number of rounds it took. */
async function solveMatch () {
  for (let guard = 0; guard < 60; guard++) {
    const left = page.locator('.mcard--l:not([disabled])')
    const nL = await left.count().catch(() => 0)
    if (!nL) return true
    await left.first().click().catch(() => {})
    const rights = page.locator('.mcard--r:not([disabled])')
    const nR = await rights.count().catch(() => 0)
    let matched = false
    for (let j = 0; j < nR; j++) {
      const before = await page.locator('.mcard--l:not([disabled])').count()
      await page.locator('.mcard--l:not([disabled])').first().click().catch(() => {})
      await page.locator('.mcard--r:not([disabled])').nth(j).click().catch(() => {})
      await page.waitForTimeout(520)
      const after = await page.locator('.mcard--l:not([disabled])').count()
      if (after < before) { matched = true; break }
    }
    if (!matched) return false
  }
  return false
}

/** Answer whatever WordGame is on screen. `wrong` deliberately misses. */
async function playWordGame ({ wrong = false } = {}) {
  const tag = (await page.locator('.wg__tag .chip').first().innerText().catch(() => '')).trim()
  if (await page.locator('.wg__grid .opt').first().isVisible().catch(() => false)) {
    const opts = page.locator('.wg__grid .opt')
    await opts.nth(wrong ? (await opts.count()) - 1 : 0).click().catch(() => {})
  } else if (await page.locator('.optw').first().isVisible().catch(() => false)) {
    const opts = page.locator('.optw')
    await opts.nth(wrong ? (await opts.count()) - 1 : 0).click().catch(() => {})
  } else if (await page.locator('.tile').first().isVisible().catch(() => false)) {
    // spell: use the hint until the word is complete — exercises the hint path
    for (let k = 0; k < 20; k++) {
      if (!(await page.locator('.wg__hintbtn').isVisible().catch(() => false))) break
      await page.locator('.wg__hintbtn').click().catch(() => {})
      await page.waitForTimeout(60)
    }
  } else if (await page.locator('.wg__input').isVisible().catch(() => false)) {
    await page.locator('.wg__input').fill(wrong ? 'zzz' : 'wait')
    await page.locator('.wg__cloze button[type="submit"]').click().catch(() => {})
  }
  await page.waitForTimeout(300)
  const cont = page.locator('.reveal button:has-text("繼續")').first()
  if (await cont.isVisible({ timeout: 1500 }).catch(() => false)) await cont.click().catch(() => {})
  await page.waitForTimeout(250)
  return tag
}

const postedBeforeLearn = db.card_progress.length
await page.goto(URL_BASE + '#/learn', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await shot('06-wordlab-meet')

// v3: the learner guesses the meaning before the card is shown
checks.push([
  'Word Lab asks for a guess before showing the word card',
  await page.locator('.guess .gopt').first().isVisible().catch(() => false) &&
    !(await page.locator('.meet').first().isVisible().catch(() => false)),
  'no guess step, or the card was already open'
])
await page.locator('.guess .gopt').first().click().catch(() => {})
await page.waitForTimeout(1400)
await shot('06b-wordlab-card')
checks.push([
  'the word card shows how the word is built, with a legend for its colours',
  await page.locator('.meet .ana').first().isVisible().catch(() => false) &&
    // coloured tiles always come with their legend; a one-syllable word has neither
    (await page.locator('.meet .ana .legend').first().isVisible().catch(() => false) ||
      await page.locator('.meet .ana__whole').first().isVisible().catch(() => false)),
  'anatomy or legend missing on the meet card'
])
checks.push(['there is no drawing canvas any more', !(await page.locator('canvas').count().catch(() => 0)), 'a canvas is still on the card'])
await page.locator('.mine__open').first().click().catch(() => {})
await page.waitForTimeout(150)
await page.locator('textarea.mine__note').first().fill('I wait for the bus every day.').catch(() => {})

let sawMatch = false
let matchSolved = false
for (let i = 0; i < 160; i++) {
  if (await page.locator('.wg').first().isVisible({ timeout: 200 }).catch(() => false)) break
  if (await page.locator('.mcard').first().isVisible({ timeout: 300 }).catch(() => false)) {
    if (!sawMatch) await shot('07-wordlab-match')
    sawMatch = true
    matchSolved = (await solveMatch()) || matchSolved
    await page.waitForTimeout(700)
    continue
  }
  if (await page.locator('.guess .gopt').first().isVisible({ timeout: 200 }).catch(() => false)) {
    await page.locator('.guess .gopt').first().click().catch(() => {})
    await page.waitForTimeout(1300)
    continue
  }
  // the last word may still be followed by a final 連連看 before recall starts
  const nextBtn = page.locator('.lab > button.btn--primary').first()
  if (await nextBtn.isVisible({ timeout: 400 }).catch(() => false)) {
    await nextBtn.click().catch(() => {})
    await page.waitForTimeout(350)
  }
}
checks.push(['連連看 appears after a few new words and can be solved', sawMatch && matchSolved, `seen=${sawMatch} solved=${matchSolved}`])

const notes = await page.evaluate(async () => new Promise(res => {
  const req = indexedDB.open('ngsl-learner')
  req.onsuccess = () => {
    const out = []
    const c = req.result.transaction('meta', 'readonly').objectStore('meta').openCursor()
    c.onsuccess = () => { const cur = c.result; if (!cur) return res(out); if (String(cur.key).startsWith('note:')) out.push(cur.key); cur.continue() }
    c.onerror = () => res(out)
  }
  req.onerror = () => res([])
}))
checks.push(['the learner\'s own sentence is kept on the device', notes.length > 0, 'no note:<id> key in IndexedDB'])

await page.locator('.wg').first().waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
await shot('08-wordlab-recall')
const recallTag = (await page.locator('.wg__tag .chip').first().innerText().catch(() => '')).trim()
checks.push(['the recall round asks 中文 → English, not recognition', /看中文選字/.test(recallTag), `task="${recallTag}"`])
for (let i = 0; i < 60; i++) {
  if (await page.locator('.done').first().isVisible({ timeout: 300 }).catch(() => false)) break
  if (!(await page.locator('.wg').first().isVisible({ timeout: 1500 }).catch(() => false))) break
  await playWordGame({ wrong: i === 0 })
  if (i === 0) await shot('08b-wordlab-reveal-after-miss')
}
await page.waitForTimeout(900)
await shot('09-wordlab-done')

{
  const posted = db.card_progress.slice(postedBeforeLearn).filter(r => r.word_id < 2300)
  const now = Date.now()
  checks.push([
    'each new word is scheduled once, by its recall answer, as a v2 card',
    posted.length > 0 && posted.every(r => r.step_index >= 100),
    `${posted.length} rows, step_index=${[...new Set(posted.map(r => r.step_index))].join(',')}`
  ])
  checks.push([
    'Word Lab never schedules a word for later the same day',
    posted.every(r => Date.parse(r.due_at) - now > 0.8 * 86400000),
    posted.map(r => ((Date.parse(r.due_at) - now) / 3600000).toFixed(1) + 'h').slice(0, 6).join(' ')
  ])
  const learnLogs = db.review_log.filter(r => r.mode === 'learn')
  checks.push(['the first review is logged as a measured recall, not a self-grade', learnLogs.length > 0, `${learnLogs.length} learn-mode reviews`])
}

/* ------------------------------------------------------------------ *
 * review — one game per due word, chosen by its rung
 * ------------------------------------------------------------------ */
await page.goto(URL_BASE + '#/review', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await shot('10-review-game')
{
  const tags = new Set()
  let reanswered = 0
  for (let i = 0; i < 40; i++) {
    const hdr = (await page.locator('.shead__count').first().innerText().catch(() => '')).replace(/\s/g, '')
    if (await page.locator('.sum').first().isVisible({ timeout: 300 }).catch(() => false)) break
    if (!(await page.locator('.wg').first().isVisible({ timeout: 2000 }).catch(() => false))) break
    const t = await playWordGame({ wrong: i === 1 })
    if (t) tags.add(t)
    // the header must move on after every answer — a task that resets under
    // the learner's finger lets the same word be answered over and over
    const hdr2 = (await page.locator('.shead__count').first().innerText().catch(() => '')).replace(/\s/g, '')
    if (hdr2 && hdr2.split('/')[0] === hdr.split('/')[0] && !(await page.locator('.sum').isVisible().catch(() => false))) reanswered++
    if (i === 2) await shot('10b-review-later-task')
  }
  await page.waitForTimeout(600)
  await shot('10c-review-summary')
  checks.push(['review hands out different tasks by ladder rung', tags.size >= 2, `tasks: ${[...tags].join(' / ')}`])
  checks.push(['every review answer moves the session on (no re-answering the same word)', reanswered === 0, `${reanswered} answers left the counter where it was`])
  const legacyBack = db.card_progress.filter(r => r.word_id >= 2300 && r.step_index >= 100)
  checks.push([
    'a legacy SM-2 card is converted on read and written back as v2 once answered',
    legacyBack.length >= 4,
    `${legacyBack.length} of ${LEGACY_DUE.length} legacy rows written back as v2`
  ])
  checks.push(['review ends on a summary with rung changes', await page.locator('.sum__grid').isVisible().catch(() => false), 'no summary'])
}

/* ------------------------------------------------------------------ *
 * Grammar Studio — discover → rule → mixed game types → interleaved mix
 * ------------------------------------------------------------------ */
await page.goto(URL_BASE + '#/grammar', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await shot('11-grammar-discover')
{
  const askedFirst = await page.locator('.dopt').first().isVisible().catch(() => false) &&
    !(await page.locator('.gram__explain').first().isVisible().catch(() => false))
  checks.push(['a new grammar point asks the learner to find the pattern before the rule is shown', askedFirst, 'rule page showed first'])
  await page.locator('.dopt').first().click().catch(() => {})
  await page.waitForTimeout(300)
  await tap('button:has-text("看完整規則")').catch(() => {})
  await shot('12-grammar-teach-visual')
  checks.push([
    'the rule is drawn (time line or sentence slots), not only described',
    await page.locator('.model svg, .model .slots').first().isVisible().catch(() => false),
    'no diagram on the teach page'
  ])
  await tap('button:has-text("開始練習")').catch(() => {})

  const kinds = new Set()
  let mixLabel = false
  let sawMix = false
  let shotN = 0
  for (let i = 0; i < 30; i++) {
    if (await page.locator('.res').first().isVisible({ timeout: 300 }).catch(() => false)) break
    if (!(await page.locator('.gg').first().isVisible({ timeout: 1500 }).catch(() => false))) break
    const inMix = await page.locator('.chip:has-text("混合挑戰")').first().isVisible().catch(() => false)
    if (inMix && !sawMix) { sawMix = true; await shot('13b-grammar-mix') }
    if (await page.locator('.gopt').first().isVisible().catch(() => false)) { kinds.add('choice'); await page.locator('.gopt').first().click() }
    else if (await page.locator('.zone').first().isVisible().catch(() => false)) { kinds.add('timeline'); await page.locator('.zone').first().click() }
    else if (await page.locator('.tapw').first().isVisible().catch(() => false)) { kinds.add('tap'); await page.locator('.tapw').first().click() }
    else if (await page.locator('.sortbtn').first().isVisible().catch(() => false)) {
      kinds.add('sort')
      for (let k = 0; k < 6; k++) {
        if (!(await page.locator('.sortbtn--ok').isVisible().catch(() => false))) break
        await page.locator('.sortbtn--ok').click().catch(() => {}); await page.waitForTimeout(1600)
      }
    } else if (await page.locator('.bank .wtile').first().isVisible().catch(() => false)) {
      kinds.add(await page.locator('.slots').first().isVisible().catch(() => false) ? 'blocks' : 'order')
      for (let k = 0; k < 14; k++) {
        const t = page.locator('.bank .wtile').first()
        if (!(await t.isVisible().catch(() => false))) break
        await t.click().catch(() => {}); await page.waitForTimeout(60)
      }
    }
    await page.waitForTimeout(300)
    if (shotN < 2) { await shot(`13-grammar-game-${shotN}`); shotN++ }
    if (inMix && await page.locator('.fb .chip:has-text("這題考")').first().isVisible().catch(() => false)) mixLabel = true
    const cont = page.locator('.fb button:has-text("繼續")').first()
    if (await cont.isVisible({ timeout: 2500 }).catch(() => false)) await cont.click().catch(() => {})
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(500)
  await shot('14-grammar-result')
  checks.push(['grammar practice mixes at least three game types', kinds.size >= 3, `types: ${[...kinds].join(', ')}`])
  checks.push(['with older points learned, an interleaved round follows practice', sawMix, 'no mixed round'])
  checks.push(['each mixed item names the rule it was testing', mixLabel, 'no 這題考 label in the mixed round'])
  const g04 = db.grammar_progress.find(r => r.grammar_id === 'g04')
  checks.push(["today's point is scheduled from its own answers", !!g04, 'no g04 row written'])
}

// essentials
await page.goto(URL_BASE + '#/essentials', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('14a-essentials-teach')
checks.push([
  'essentials unit renders its reference table',
  await page.locator('.ess__table tbody tr').count().then(n => n > 0).catch(() => false),
  'no table rows'
])
if (await page.locator('button:has-text("開始練習")').first().isVisible().catch(() => false)) {
  await tap('button:has-text("開始練習")')
  await shot('14b-essentials-drill')

  // the sort drill is new — make sure it can be completed and marked
  const buckets = page.locator('.sortrow')
  if (await buckets.count().catch(() => 0)) {
    const rows = await buckets.count()
    for (let i = 0; i < rows; i++) {
      await buckets.nth(i).locator('.bkt').first().click().catch(() => {})
      await page.waitForTimeout(60)
    }
    const canCheck = await page.locator('button:has-text("檢查答案")').first().isEnabled().catch(() => false)
    checks.push(['sort drill becomes checkable once every item is placed', canCheck, 'check button still disabled'])
    await page.locator('button:has-text("檢查答案")').first().click().catch(() => {})
    await page.waitForTimeout(500)
    await shot('14c-essentials-sort')
  }
}

// production writing
await page.goto(URL_BASE + '#/write', { waitUntil: 'networkidle' })
await page.waitForTimeout(1600)
await shot('14d-write-task')
const boxVisible = await page.locator('.wr__box').isVisible().catch(() => false)
if (boxVisible) {
  await page.locator('.wr__box').fill('I managed to achieve my goal this year.')
  await page.locator('button:has-text("送出批改")').click().catch(() => {})
  await page.waitForTimeout(1200)
  const graded = await page.locator('.fb__explain').first().isVisible().catch(() => false)
  checks.push(['production sentence gets graded feedback', graded, 'no feedback shown'])
  await shot('14e-write-feedback')
} else {
  checks.push(['production sentence gets graded feedback', false, 'writing box never appeared'])
}

// article
await page.goto(URL_BASE + '#/article', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await shot('15-article')

// tapping a word in the prose must open its card
const tappable = page.locator('.tt__w')
const tappableCount = await tappable.count().catch(() => 0)
if (tappableCount) {
  await tappable.nth(Math.min(3, tappableCount - 1)).click().catch(() => {})
  await page.waitForTimeout(900)
  const popped = await page.locator('.pop').isVisible().catch(() => false)
  checks.push(['tapping a word in the article opens its card', popped, `tappable=${tappableCount}`])
  await shot('15b-article-word-popover')
  await page.locator('.pop__x').click().catch(() => {})
  await page.waitForTimeout(300)
} else {
  checks.push(['tapping a word in the article opens its card', false, 'no tappable words rendered'])
}

// Every alphabetic token must be tappable, not only the ones with an NGSL id.
// "arrived", "waited", "twenty" and the proper noun "Mia" are exactly the words
// a beginner stops on, and they used to render as inert spans.
{
  const firstPara = await page.locator('.art__body .para').first().innerText().catch(() => '')
  const wordCount = (firstPara.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length
  const btnCount = await page.locator('.art__body .para').first().locator('.tt__w').count().catch(() => 0)
  checks.push([
    'every word in the article is tappable, not just NGSL headwords',
    wordCount > 0 && btnCount === wordCount,
    `${btnCount} tappable / ${wordCount} words`
  ])
}

if (await page.locator('button:has-text("開始作答")').first().isVisible().catch(() => false)) {
  await tap('button:has-text("開始作答")')
  await shot('16-article-quiz')

  // The article has to stay on the page while answering — a comprehension
  // question answered from memory is a memory test.
  const readerVisible = await page.locator('.reader__body .tt__w').first().isVisible().catch(() => false)
  checks.push(['the article stays on screen during the quiz', readerVisible])

  // and the options carry their Chinese, because the learner cannot read them yet
  const optZh = await page.locator('.opt__zh').first().innerText().catch(() => '')
  checks.push(['options show their Chinese translation', optZh.includes('正確的答案'), `zh="${optZh}"`])

  // answering, leaving to re-read, and coming back must keep the answers
  await page.locator('.opt').first().click().catch(() => {})
  await page.waitForTimeout(700)
  await page.locator('.fb button:has-text("下一題")').first().click().catch(() => {})
  await page.waitForTimeout(400)
  await page.locator('.opt').first().click().catch(() => {})
  await page.waitForTimeout(700)

  await page.locator('button:has-text("回到閱讀模式")').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const resumeLabel = await page.locator('button:has-text("繼續作答")').first().innerText().catch(() => '')
  checks.push([
    'article quiz resumes instead of restarting',
    /繼續作答（已答\s*2\//.test(resumeLabel.replace(/\s+/g, '')) || /繼續作答/.test(resumeLabel),
    `button="${resumeLabel.replace(/\s+/g, ' ')}"`
  ])
  await shot('16b-article-resume')
}

/* ------------------------------------------------------------------ *
 * listening — the phase that flexes, and the only one that hides the text
 * ------------------------------------------------------------------ */
await page.goto(URL_BASE + '#/listen', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('16c-listen-intro')

{
  const introText = await page.locator('.lis__desc').first().innerText().catch(() => '')
  const claimed = Number((introText.match(/出\s*(\d+)\s*題/) || [])[1] || 0)
  checks.push(['the listening round is sized, not fixed', claimed >= 8 && claimed <= 30, `${claimed} items`])

  await page.locator('button:has-text("開始")').first().click().catch(() => {})
  await page.waitForTimeout(900)
  await shot('16d-listen-item')

  const playerVisible = await page.locator('.player__big').isVisible().catch(() => false)
  checks.push(['a listening item plays audio instead of showing the word', playerVisible])

  // The English must not be on screen before the answer — that is the whole
  // point of the phase. Every other screen prints the word next to a play
  // button, which trains reading with an audio garnish.
  const beforeText = await page.locator('.lis').innerText().catch(() => '')
  const revealed = await page.locator('.fb__answer').count().catch(() => 0)
  checks.push([
    'the English is hidden until the item is answered',
    revealed === 0 && !/[A-Za-z]{4,}/.test(beforeText.replace(/[A-D]\b/g, '')),
    `revealed=${revealed}`
  ])

  await page.locator('.opt').first().click().catch(() => {})
  await page.waitForTimeout(600)
  const after = await page.locator('.fb__answer').first().innerText().catch(() => '')
  checks.push(['answering reveals what was said', after.trim().length > 0, `"${after.trim().slice(0, 40)}"`])
  await shot('16e-listen-feedback')
}

// the elastic phase has to react to the target, or it is not elastic
{
  const readCount = async () => {
    // leave and come back, so the view remounts at its intro stage
    await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.goto(URL_BASE + '#/listen', { waitUntil: 'networkidle' })
    // a cold reload has to finish hydrating before the round can be sized
    await page.waitForFunction(
      () => /出\s*\d+\s*題/.test(document.querySelector('.lis__desc')?.textContent || ''),
      null, { timeout: 12000 }
    ).catch(() => {})
    const t = await page.locator('.lis__desc').first().innerText().catch(() => '')
    return Number((t.match(/出\s*(\d+)\s*題/) || [])[1] || 0)
  }
  const setTarget = async minutes => {
    await page.goto(URL_BASE + '#/settings', { waitUntil: 'networkidle' })
    await page.waitForTimeout(700)
    await page.locator('#mins').evaluate((el, m) => {
      el.value = String(m)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }, minutes)
    await page.waitForTimeout(500)
  }

  const before = await readCount()
  await setTarget(115)
  await shot('16f-settings-daily-budget')
  const after = await readCount()
  checks.push([
    'raising the daily target lengthens the listening round',
    after > before, `${before} → ${after} items`
  ])
  await setTarget(60)
}

/* ------------------------------------------------------------------ *
 * Story Time — read, tap a word, put the story in order, quiz, word hunt
 * ------------------------------------------------------------------ */
await page.goto(URL_BASE + '#/story', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await shot('16g-story-hub')
await page.locator('.rec').first().click().catch(() => {})
await page.waitForTimeout(700)
await shot('16h-story-page')
{
  const sceneOk = await page.locator('.scene').first().isVisible().catch(() => false)
  const line = page.locator('.line').first()
  const text = await line.locator('.tt').innerText().catch(() => '')
  const wordsN = (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length
  const btnN = await line.locator('.tt__w').count().catch(() => 0)
  checks.push(['a story page has its picture scene and every word is tappable', sceneOk && wordsN > 0 && btnN === wordsN, `scene=${sceneOk} ${btnN}/${wordsN}`])
  await line.locator('.tt__w').nth(1).click().catch(() => {})
  await page.waitForTimeout(600)
  checks.push(['tapping a story word opens its card', await page.locator('.pop').isVisible().catch(() => false), 'no popover'])
  await page.locator('.pop__x').click().catch(() => {})
  await page.waitForTimeout(250)
  const zhHidden = await page.locator('.line__zh').first().innerText().catch(() => '')
  checks.push(['the Chinese is hidden until asked for', zhHidden.trim() === '中文', `showed "${zhHidden}"`])

  for (let i = 0; i < 10; i++) {
    const b = page.locator('.readbar .btn--primary')
    if (!(await b.isVisible({ timeout: 800 }).catch(() => false))) break
    await b.click().catch(() => {}); await page.waitForTimeout(250)
  }
  await shot('16i-story-sequence')
  // brute-force the order: the next card is the one the game accepts
  for (let pos = 0; pos < 8; pos++) {
    const bank = page.locator('.seqbank .seqcard')
    const n = await bank.count().catch(() => 0)
    if (!n) break
    for (let j = 0; j < n; j++) {
      const before = await page.locator('.seqbank .seqcard').count()
      await page.locator('.seqbank .seqcard').nth(j).click().catch(() => {})
      await page.waitForTimeout(500)
      if ((await page.locator('.seqbank .seqcard').count()) < before) break
    }
  }
  const seqOk = await page.locator('button:has-text("排好了")').isVisible().catch(() => false)
  checks.push(['the sequencing game accepts the story order', seqOk, 'never completed'])
  await page.locator('button:has-text("排好了")').click().catch(() => {})
  await page.waitForTimeout(300)
  await shot('16j-story-quiz')
  for (let q = 0; q < 5; q++) {
    if (!(await page.locator('.qopt').first().isVisible({ timeout: 800 }).catch(() => false))) break
    await page.locator('.qopt').first().click().catch(() => {}); await page.waitForTimeout(250)
    await page.locator('.qfb button').click().catch(() => {}); await page.waitForTimeout(250)
  }
  await shot('16k-story-hunt')
  const target = (await page.locator('.target').first().innerText().catch(() => '')).trim()
  if (target) {
    await page.locator(`.huntbox .tt__w`).filter({ hasText: new RegExp(`^${target}`, 'i') }).first().click().catch(() => {})
    await page.waitForTimeout(300)
  }
  checks.push(['the word hunt marks a found word', await page.locator('.target--found').count().then(n => n > 0).catch(() => false), `target=${target}`])
  await page.locator('button:has-text("直接結算")').click().catch(() => {})
  await page.waitForTimeout(500)
  await shot('16l-story-result')
  const saved = await page.evaluate(id => {
    try { return JSON.parse(localStorage.getItem(`ngsl.stories.${id}`) || '{}') } catch { return {} }
  }, USER_ID)
  checks.push(['finishing a story records its stars', Object.values(saved).some(v => v >= 1), JSON.stringify(saved)])
}

/* ------------------------------------------------------------------ *
 * Word Parts — map → guess → teach → an 8-item round → schedule
 * ------------------------------------------------------------------ */
await page.goto(URL_BASE + '#/parts', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await shot('16m-parts-map')
checks.push(['the word-parts course lists its fifteen units', (await page.locator('.unit').count().catch(() => 0)) === 15, 'unit count'])
await page.locator('.unit').first().click().catch(() => {})
await page.waitForTimeout(400)
await shot('16n-parts-discover')
checks.push(['a unit opens on a guess, before any explanation', await page.locator('.disc .lt').first().isVisible().catch(() => false) && !(await page.locator('.tp').count().catch(() => 0)), 'no discover step'])
await page.locator('.opts .popt').first().click().catch(() => {})
await page.waitForTimeout(300)
await page.locator('button:has-text("看看怎麼用")').click().catch(() => {})
await page.waitForTimeout(400)
await shot('16o-parts-teach')
checks.push(['the teach step shows parts as coloured tiles', (await page.locator('.tp .lt').count().catch(() => 0)) > 3, 'no tiles'])
await page.locator('button:has-text("開始練習")').click().catch(() => {})
await page.waitForTimeout(400)
{
  const kinds = new Set()
  let shots = 0
  for (let i = 0; i < 40; i++) {
    if (await page.locator('.res').first().isVisible({ timeout: 200 }).catch(() => false)) break
    if (!(await page.locator('.pg').first().isVisible({ timeout: 1500 }).catch(() => false))) break
    kinds.add((await page.locator('.pg__tag .chip').first().innerText().catch(() => '')).trim())
    if (shots < 3) { await shot(`16p-parts-item-${shots}`); shots++ }
    if (await page.locator('.pg .popt').first().isVisible().catch(() => false)) {
      await page.locator('.pg .popt').first().click().catch(() => {})
    } else if (await page.locator('.bank .lt').first().isVisible().catch(() => false)) {
      for (let k = 0; k < 6; k++) {
        const free = page.locator('.bank .lt:not([disabled])')
        if (!(await free.count().catch(() => 0)) || !(await page.locator('.bank').isVisible().catch(() => false))) break
        await free.first().click().catch(() => {})
        await page.waitForTimeout(80)
      }
    } else if (await page.locator('.split__gap').first().isVisible().catch(() => false)) {
      await page.locator('.split__gap').nth(1).click().catch(() => {})
      await page.locator('button:has-text("切好了")').click().catch(() => {})
    }
    await page.waitForTimeout(350)
    const cont = page.locator('.fb button:has-text("繼續")').first()
    if (await cont.isVisible({ timeout: 1600 }).catch(() => false)) await cont.click().catch(() => {})
    await page.waitForTimeout(250)
  }
  await page.waitForTimeout(500)
  await shot('16q-parts-result')
  checks.push(['a parts round mixes at least three game kinds', kinds.size >= 3, [...kinds].join(', ')])
  checks.push(['finishing a parts unit shows its stars', await page.locator('.res__stars').isVisible().catch(() => false), 'no result'])
  checks.push(['the unit is scheduled in grammar_progress as p01', db.grammar_progress.some(r => r.grammar_id === 'p01'), 'no p01 row'])
}

/* ------------------------------------------------------------------ *
 * game centre
 * ------------------------------------------------------------------ */
await page.goto(URL_BASE + '#/games', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await shot('16r-games')
checks.push(['the game centre offers its games', (await page.locator('.game').count().catch(() => 0)) >= 5, 'game tiles'])

await page.goto(URL_BASE + '#/games/wordle', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
for (const k of 'water') await page.keyboard.press(k)
await page.keyboard.press('Enter')
await page.waitForTimeout(900)
await shot('16s-wordle')
checks.push(['a daily-puzzle guess is scored letter by letter', (await page.locator('.cell--hit, .cell--near, .cell--miss').count().catch(() => 0)) === 5, 'no scored row'])
for (const k of 'zzzzz') await page.keyboard.press(k)
await page.keyboard.press('Enter')
await page.waitForTimeout(500)
checks.push(['a non-word is rejected, not scored', (await page.locator('.cell--hit, .cell--near, .cell--miss').count().catch(() => 0)) === 5, 'zzzzz was accepted'])

await page.goto(URL_BASE + '#/games/rain', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('16t-rain')
{
  const before = await page.locator('.gs__heart--off').count().catch(() => 0)
  const opts = page.locator('.opts .opt')
  let scored = false
  for (let i = 0; i < 4 && !scored; i++) {
    await opts.nth(i).click().catch(() => {})
    await page.waitForTimeout(600)
    const score = Number(await page.locator('.gs__score b').innerText().catch(() => '0'))
    const lost = await page.locator('.gs__heart--off').count().catch(() => 0)
    scored = score > 0 || lost > before
    if (!scored) await page.waitForTimeout(500)
  }
  checks.push(['word rain reacts to an answer (points or a life)', scored, 'no change'])
}

await page.goto(URL_BASE + '#/games/memory', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('.card3').nth(0).click().catch(() => {})
await page.waitForTimeout(150)
await page.locator('.card3').nth(1).click().catch(() => {})
await page.waitForTimeout(150)
checks.push(['memory cards flip', (await page.locator('.card3--open').count().catch(() => 0)) >= 1, 'no open card'])
await shot('16u-memory')

await page.goto(URL_BASE + '#/games/builder', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
await page.locator('.bank .lt').first().click().catch(() => {})
await page.waitForTimeout(150)
await shot('16v-builder')
checks.push(['part builder places a tile in its slots', (await page.locator('.slots .lt').count().catch(() => 0)) >= 1, 'no tile placed'])

await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle' })
await page.waitForTimeout(700)
{
  const lv = await page.locator('.lvl__badge').innerText().catch(() => '')
  checks.push(['the dashboard shows a word-power level', /^Lv\.\d+$/.test(lv.trim()), `badge="${lv}"`])
  const order = await page.locator('.step__label').allInnerTexts().catch(() => [])
  checks.push(['review comes before new words in the day', order[0] === '複習挑戰' && order[1] === 'Word Lab', order.join(' → ')])
  checks.push(['the day carries a word part of the day', await page.locator('.wotd .ana').isVisible().catch(() => false), 'no 今日零件'])
  await shot('16q-dashboard-v2')
}

/* ------------------------------------------------------------------ *
 * pronunciation — what the engine is actually handed
 * ------------------------------------------------------------------ */
{
  const tts = await ctx.newPage()
  await tts.goto(URL_BASE + '#/settings', { waitUntil: 'networkidle' })
  await tts.waitForTimeout(900)

  /* The first tap of a page's life is the one that comes out clipped on a
   * real phone, and it is the one this block used to throw away: the WebKit
   * unlock utterance fires on that same pointerdown, so the engine is still
   * busy when the click handler asks it to speak. Measure that tap. */
  await tts.evaluate(() => { window.__tts.spoken = []; window.__tts.cancels = 0 })
  await tts.locator('button:has-text("試聽")').first().click().catch(() => {})
  await tts.waitForTimeout(1200)

  const cold = await tts.evaluate(() => window.__tts)
  const at = cold.spoken.findIndex(u => /Ted took/.test(u.text))
  const phrase = cold.spoken[at] || { text: '', cancelsAtSpeak: -1 }
  const lead = at > 0 ? cold.spoken[at - 1] : null

  // Cancelling an idle engine is half the bug: cancel() is async in Chromium,
  // so speaking on the next line hands over an utterance mid-teardown. The
  // unlock utterance must not be what triggers that cancel.
  checks.push([
    'the first tap of the page is not handed to a cancelling engine',
    phrase.cancelsAtSpeak === 0,
    `cancels pending when the first phrase was handed over = ${phrase.cancelsAtSpeak}`
  ])

  // The other half is the audio-stream ramp, which has to be spent on silence
  // queued in the same tick. The silence is its own utterance at volume 0:
  // spliced into the phrase's text it was audible on-device twice, in two
  // different ways (leading commas, then an echoed first word).
  checks.push([
    'a cold engine gets silent lead-in queued ahead of the phrase',
    !!lead && lead.text === TTS_LEAD_TEXT && lead.volume === 0 &&
      lead.voiceURI === phrase.voiceURI,
    JSON.stringify(lead && { text: lead.text, volume: lead.volume, voice: lead.voiceURI })
  ])

  checks.push([
    'the phrase itself is handed over with nothing spliced into it',
    phrase.text === TEST_PHRASE,
    JSON.stringify(phrase.text.slice(0, 24))
  ])

  // Back-to-back taps are the case that already sounded right, because the
  // stream is still open. Paying the lead-in there would just add latency.
  await tts.evaluate(() => { window.__tts.spoken = []; window.__tts.cancels = 0 })
  await tts.locator('button:has-text("試聽")').first().click().catch(() => {})
  await tts.waitForTimeout(1200)
  const warm = await tts.evaluate(() => window.__tts.spoken)
  checks.push([
    'a still-warm engine is not made to sit through the lead-in again',
    warm.length === 1 && /Ted took/.test(warm[0].text),
    `${warm.length} utterance(s): ${JSON.stringify(warm.map(u => u.text.slice(0, 10)))}`
  ])

  // Turning the lead-in off has to actually turn it off, or the setting is a
  // decoration and cannot be used to tune the device. Let the stream go cold
  // first, otherwise this passes for the wrong reason.
  await tts.locator('#lead').evaluate(el => {
    el.value = '0'
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await tts.waitForTimeout(TTS_COLD_MS + 400)
  await tts.evaluate(() => { window.__tts.spoken = [] })
  await tts.locator('button:has-text("試聽")').first().click().catch(() => {})
  await tts.waitForTimeout(1200)
  const bare = await tts.evaluate(() => window.__tts.spoken)
  checks.push([
    'turning the lead-in off removes it from a cold engine too',
    bare.length === 1 && bare[0].text === TEST_PHRASE,
    `${bare.length} utterance(s): ${JSON.stringify(bare.map(u => u.text.slice(0, 10)))}`
  ])

  await shot('21b-tts-settings')
  await tts.close()
}

// remaining screens
for (const [route, name] of [['#/errors', '17-errors'], ['#/stats', '18-stats'], ['#/browse', '19-browse'], ['#/travel', '20-travel'], ['#/settings', '21-settings'], ['#/summary', '22-summary']]) {
  await page.goto(URL_BASE + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await shot(name)

  if (route === '#/errors') {
    const badge = Number((await page.locator('.tab__badge').first().innerText().catch(() => '0')) || 0)
    const tabs = await page.locator('.seg__btn .num').allInnerTexts().catch(() => [])
    const listed = tabs.reduce((a, t) => a + (Number(t) || 0), 0)
    const rows = await page.locator('.titem').count().catch(() => 0)

    checks.push([
      'mistake badge equals what the page lists',
      badge === listed,
      `badge=${badge} tabs=${tabs.join('+')} (=${listed})`
    ])
    checks.push([
      'a wrong answer on a new word actually appears',
      badge === 0 || rows > 0,
      `badge=${badge} word rows=${rows}`
    ])
  }
}

// horizontal-overflow check on every screen
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle' })
const overflow = await page.evaluate(() => {
  const d = document.documentElement
  return { scrollW: d.scrollWidth, clientW: d.clientWidth }
})

/* ------------------------------------------------------------------ *
 * "remember me": losing the Supabase session must not show a password box
 * ------------------------------------------------------------------ */
async function dropStoredSession () {
  await page.evaluate(async () => {
    try { localStorage.removeItem('ngsl.auth') } catch { /* ignore */ }
    await new Promise(res => {
      const req = indexedDB.open('ngsl-learner')
      req.onsuccess = () => {
        const db = req.result
        const t = db.transaction('meta', 'readwrite')
        t.objectStore('meta').delete('auth.mirror:ngsl.auth')
        t.oncomplete = () => res()
        t.onerror = () => res()
      }
      req.onerror = () => res()
    })
  })
}

const vaultSaved = await page.evaluate(async () => {
  return await new Promise(res => {
    const req = indexedDB.open('ngsl-learner')
    req.onsuccess = () => {
      const g = req.result.transaction('meta', 'readonly').objectStore('meta').get('auth.remembered')
      g.onsuccess = () => res(!!g.result?.data)
      g.onerror = () => res(false)
    }
    req.onerror = () => res(false)
  })
})
checks.push(['signing in stores an encrypted credential on the device', vaultSaved, 'nothing in the vault'])

const vaultPlain = await page.evaluate(async () => {
  return await new Promise(res => {
    const req = indexedDB.open('ngsl-learner')
    req.onsuccess = () => {
      const g = req.result.transaction('meta', 'readonly').objectStore('meta').get('auth.remembered')
      g.onsuccess = () => {
        const row = g.result
        if (!row) return res('missing')
        const bytes = new Uint8Array(row.data || new ArrayBuffer(0))
        res(new TextDecoder().decode(bytes))
      }
      g.onerror = () => res('err')
    }
    req.onerror = () => res('err')
  })
})
checks.push([
  'the stored blob is not the password in the clear',
  !/stub-password/.test(vaultPlain),
  'plaintext password found in IndexedDB'
])

await dropStoredSession()
await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)
const backIn = !page.url().includes('#/login')
checks.push([
  'a lost session is restored without asking for the password again',
  backIn,
  `landed on ${page.url().split('#')[1] || '/'}`
])
await shot('23-remembered-relaunch')

// and "forget this device" must genuinely put the password box back
await page.goto(URL_BASE + '#/settings', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(900)
const forgetBtn = page.locator('button:has-text("忘記這台裝置")').first()
if (await forgetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await forgetBtn.click().catch(() => {})
  await page.waitForTimeout(600)
  await dropStoredSession()
  await page.goto(URL_BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  checks.push([
    'forgetting the device brings the password box back',
    page.url().includes('#/login'),
    `landed on ${page.url().split('#')[1] || '/'}`
  ])
  const preset = await page.locator('.who__mail').first().innerText().catch(() => '')
  checks.push([
    'the login screen still opens on the last person used',
    /@/.test(preset),
    `header showed "${preset}"`
  ])
  await shot('24-after-forget')
} else {
  checks.push(['forgetting the device brings the password box back', false, 'no 忘記這台裝置 button in settings'])
}

console.log('\n--- results ---')
console.log('screens captured:', shots.length)
let checkFail = 0
for (const [label, ok, detail] of checks) {
  if (!ok) checkFail++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${ok ? '' : `  → ${detail}`}`)
}
console.log('body overflow  :', overflow.scrollW > overflow.clientW + 1 ? `FAIL (${overflow.scrollW} > ${overflow.clientW})` : 'ok')
// The sandbox has no egress, so the Google Fonts stylesheet always fails and
// Chrome reports it as a bare "Failed to load resource" with no URL attached.
const NOISE = /favicon|manifest|sw\.js|workbox|TUNNEL_CONNECTION_FAILED|fonts\.(googleapis|gstatic)|Failed to load resource.*(404|net::ERR_(FAILED|ABORTED|TUNNEL))/i
const real = errors.filter(e => !NOISE.test(e))
console.log('console errors :', real.length ? 'FAIL' : 'none')
for (const e of real.slice(0, 12)) console.log('   !', e.slice(0, 220))

await browser.close()
server.close()
process.exit(real.length || checkFail ? 1 : 0)
