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
const STUB_NOISE = /bad HTTP response code \(404\) was received when fetching the script/
page.on('console', m => { if (m.type() === 'error' && !STUB_NOISE.test(m.text())) errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))
if (process.env.TRACE_FAIL) page.on('requestfailed', r => console.log('  REQFAIL', r.failure()?.errorText, r.url().slice(0, 120)))
if (process.env.TRACE_NAV) page.on('framenavigated', f => { if (f === page.mainFrame()) console.log('  NAV', f.url()) })

// --- real Chinese faces, offline ---
// The container cannot reach Google Fonts, so without this every screenshot
// shows a fallback face and the design review is of the wrong thing. If the
// @fontsource packages are present (npm i --no-save @fontsource/lxgw-wenkai-tc
// @fontsource/noto-sans-tc, or SMOKE_FONTS=<dir containing @fontsource>), the
// Google Fonts stylesheet is answered from them.
{
  const dirs = [process.env.SMOKE_FONTS, join(ROOT, 'node_modules')].filter(Boolean)
  const fsrc = dirs.map(d => join(d, '@fontsource')).find(d => existsSync(join(d, 'lxgw-wenkai-tc')))
  if (fsrc) {
    const css = async (pkg, w) => (await readFile(join(fsrc, pkg, `${w}.css`), 'utf8'))
      .replace(/url\(\.\/files\//g, `url(https://fonts.local/${pkg}/files/`)
    const sheet = (await Promise.all([
      css('lxgw-wenkai-tc', 400), css('lxgw-wenkai-tc', 700),
      css('noto-sans-tc', 400), css('noto-sans-tc', 500), css('noto-sans-tc', 700),
      ...(existsSync(join(fsrc, 'noto-serif-tc')) ? [css('noto-serif-tc', 600), css('noto-serif-tc', 700)] : [])
    ])).join('\n')
    await ctx.route('**/fonts.googleapis.com/**', route => route.fulfill({ status: 200, contentType: 'text/css', body: sheet }))
    await ctx.route('https://fonts.local/**', async route => {
      const rel = new URL(route.request().url()).pathname.slice(1)
      try { route.fulfill({ status: 200, contentType: 'font/woff2', body: await readFile(join(fsrc, rel)) }) } catch { route.fulfill({ status: 404, body: '' }) }
    })
  }
}

// --- no service worker ---
// The precache answers from disk, so with a service worker in the way no
// asset request reaches the network and nothing here can decide what a
// request returns. The smoke never asserted anything about the worker; it
// does assert what happens when a chunk fails to arrive.
//
// Since v3.0.1 the app registers the worker itself (to reload onto a new
// deploy), and Chromium logs the refused registration to the console. That
// one line is the stub talking, not the app, so it is the only console error
// this run forgives. (An inert 200 worker was tried instead: once it controls
// the page, Chromium aborts a later page.goto, which is a harness problem, not
// one a learner can hit.)
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
  if (body.includes('partner_role_en')) {
    // 自己出題
    payload = {
      title: '藥妝店', scene_zh: '你在藥妝店找防曬乳，也想問能不能免稅。', partner_name: 'Yuki', partner_role_en: 'drugstore staff', partner_role_zh: '藥妝店店員',
      goals: [{ zh: '問防曬乳在哪裡', en: 'ask where the sunscreen is' }, { zh: '問有沒有小瓶的', en: 'ask for a small bottle' }, { zh: '問能不能免稅', en: 'ask about tax-free' }],
      opener_en: 'Hello! Are you looking for something?', opener_zh: '你好！在找什麼嗎？', frames: ['Where is …?', 'Do you have …?', 'Can I …?', 'How much …?']
    }
  } else if (body.includes('goals_done')) {
    // 主題對話 turn: count the learner lines so the goals fill up as it goes
    const n = (body.match(/學生: /g) || []).length
    payload = {
      reply_en: ['A large latte? Sure! Anything to eat?', 'We have muffins and sandwiches. For here or to go?', "That's seven dollars. Have a nice flight!"][Math.min(n, 2)],
      reply_zh: '好的！', understood: true,
      fix: n === 0 ? "I'd like a large latte, please." : '',
      note_zh: n === 0 ? '點餐用 I\'d like，比 I want 客氣' : '',
      goals_done: [true, n >= 1, n >= 2], hint_en: n === 0 ? 'I will have …' : 'To …', end: false
    }
  } else if (body.includes('"interaction"')) {
    payload = {
      task: 3, vocabulary: 2, accuracy: 2, interaction: 3, level: 'A1',
      summary_zh: '三個目標都完成了，句子短但對方都聽得懂。',
      strengths: [{ quote: 'A muffin, please.', why_zh: '簡短又有禮貌。' }],
      fixes: [{ said: 'I want big latte', better: "I'd like a large latte, please.", why_zh: '點餐用 I\'d like；大杯是 large。' }],
      upgrade: { en: 'Could I get that to go?', zh: '可以外帶嗎？', when_zh: '點完餐要外帶時' }
    }
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
// SHOT_VP=1 also saves what the phone actually shows (the first viewport, with
// the fixed chrome where it really sits) as vp-<name>.png, for design review;
// SMOKE_STOP=<name> ends the run after that shot, for a quick look at one screen.
async function shot (name) {
  await page.waitForTimeout(650)
  const f = join(SHOTS, `${DARK ? 'dark-' : ''}${name}.png`)
  await page.screenshot({ path: f, fullPage: true })
  if (process.env.SHOT_VP) await page.screenshot({ path: join(SHOTS, `vp-${DARK ? 'dark-' : ''}${name}.png`) })
  shots.push(name)
  console.log(`  · ${name}`)
  if (process.env.SMOKE_STOP === name) { await browser.close(); server.close(); process.exit(0) }
}

async function tap (selector, { timeout = 6000 } = {}) {
  const el = page.locator(selector).first()
  await el.waitFor({ state: 'visible', timeout })
  await el.click({ timeout })
  await page.waitForTimeout(300)
}


/* ------------------------------------------------------------------ *
 * v6: the scene. It is the day's progress indicator, so it gets checked
 * like one — what is painted, where the light is, and what it does when a
 * period is finished or a lesson is entered.
 * ------------------------------------------------------------------ */
async function sceneProbe () {
  return page.evaluate(() => {
    const c = document.querySelector('.bd__c')
    if (!c) return null
    const ctx = c.getContext('2d')
    const at = (fx, fy) => Array.from(ctx.getImageData(Math.floor(c.width * fx), Math.floor(c.height * fy), 1, 1).data.slice(0, 3))
    // average a short horizontal run so one grain speck cannot decide a check
    const band = fy => {
      const d = ctx.getImageData(Math.floor(c.width * 0.2), Math.floor(c.height * fy), Math.floor(c.width * 0.6), 1).data
      let r = 0, g = 0, b = 0, n = d.length / 4
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
      return [r / n, g / n, b / n]
    }
    const cs = getComputedStyle(document.documentElement)
    const bg = cs.getPropertyValue('--bg').trim()
    const hex = bg.replace('#', '')
    const paper = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
    return {
      w: c.width, h: c.height,
      top: at(0.5, 0.02), sky: band(0.1), range: band(0.33), low: band(0.6), foot: band(0.97),
      paper, lx: parseFloat(cs.getPropertyValue('--lx')), ly: parseFloat(cs.getPropertyValue('--ly')),
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute('content')
    }
  })
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])

console.log(`\n=== NGSL smoke (${DARK ? 'dark' : 'light'}) ===`)

// 1. login
await page.goto(URL_BASE, { waitUntil: 'networkidle' })
await shot('01-login')

// sign in through the real form (the stub answers /auth/v1/token)
// the login screen opens on the profile chooser, so pick one first
await page.locator('.book').first().waitFor({ state: 'visible', timeout: 8000 })
await shot('01a-profile-picker')
await page.locator('.book').first().click()
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

// v6: the first screen is a view, one sentence and one button
await page.waitForTimeout(2200)   // the opening (light rising) has finished
const sceneHome0 = await sceneProbe()
{
  const p = sceneHome0
  checks.push(['the scene is painted behind the app', !!p && p.w > 0 && dist(p.sky, p.foot) > 25, p ? `sky=${p.sky.map(Math.round)} foot=${p.foot.map(Math.round)}` : 'no canvas'])
  checks.push(['the scene ends in the page colour (no seam under the range)', !!p && dist(p.foot, p.paper) < 9 && dist(p.low, p.paper) < 12, p ? `foot=${p.foot.map(Math.round)} low=${p.low.map(Math.round)} paper=${p.paper}` : ''])
  checks.push(['on 今天 the range stands in the upper part of the screen', !!p && dist(p.range, p.paper) > 30, p ? `range=${p.range.map(Math.round)} paper=${p.paper}` : ''])
  checks.push(['the light publishes its position for the glass (--lx)', !!p && p.lx > 0 && p.lx < 100 && p.ly > 0, p ? `--lx=${p.lx} --ly=${p.ly}` : ''])
  checks.push(['the status bar takes the colour of the sky', !!p && /^#[0-9a-f]{6}$/i.test(p.themeColor || ''), p?.themeColor])
  const vh = page.viewportSize().height
  const go = await page.locator('.now .btn').first().boundingBox().catch(() => null)
  const bar = await page.locator('.tabbar').first().boundingBox().catch(() => null)
  checks.push(['the one filled button is on the first screen, clear of the tab bar', !!go && !!bar && go.y + go.height <= bar.y + 2 && go.y > vh * 0.4, go && bar ? `button ends ${Math.round(go.y + go.height)}, tab bar starts ${Math.round(bar.y)}` : 'no button / tab bar'])
  const nowT = (await page.locator('.now__t').first().innerText().catch(() => '')).trim()
  const curT = (await page.locator('.step--current .step__label').first().innerText().catch(() => '')).trim()
  checks.push(['the now-panel names the period the timetable marks as current', !!nowT && nowT === curT, `now="${nowT}" timetable="${curT}"`])
  checks.push(['only one filled button on 今天', (await page.locator('.home .btn--primary').count().catch(() => 0)) === 1, `${await page.locator('.home .btn--primary').count().catch(() => -1)} primary buttons`])
}

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
const trackA = /文法/.test(stepLabels) && /讀故事/.test(stepLabels)
const trackB = /基礎知識/.test(stepLabels) && /主題對話/.test(stepLabels)
checks.push([
  'the day runs one track, not both',
  trackA !== trackB,
  `A=${trackA} B=${trackB} · ${stepLabels.slice(0, 120)}`
])
const stepCount = await page.locator('.steps > li').count().catch(() => 0)
// v4: review, words, word parts, one taught pair, game, listening, summary
checks.push(['the quest is eight periods: daily strands, one taught pair, a game', stepCount === 8, `${stepCount} steps`])
checks.push(['a game is on the day', /遊戲時間/.test(stepLabels), stepLabels.slice(0, 160)])
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
const learnStep = await page.locator('.step:has-text("新單字")').first().innerText().catch(() => '')
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

let wrongWaited = null
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
  const cont = page.locator('.as__next').first()
  // A wrong answer must wait for the learner: still there after 2.6 s. Only
  // measured when the answer really was wrong — "last option" or the spelling
  // hint path can land on the right answer, which is meant to move on.
  if (wrong && wrongWaited === null && await page.locator('.as--wrong').first().isVisible().catch(() => false)) {
    await page.waitForTimeout(2600)
    wrongWaited = await cont.isVisible().catch(() => false)
  }
  if (await cont.isVisible({ timeout: 1500 }).catch(() => false)) await cont.click().catch(() => {})
  await page.waitForTimeout(250)
  return tag
}

const postedBeforeLearn = db.card_progress.length
await page.goto(URL_BASE + '#/learn', { waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await shot('06-wordlab-meet')

{
  const p = await sceneProbe()
  checks.push(['inside a lesson the range recedes: mid-screen is plain paper', !!p && dist(p.range, p.paper) < 12, p ? `at 33%: ${p.range.map(Math.round)} paper=${p.paper}` : 'no canvas'])
}

// v3: the learner guesses the meaning before the card is shown
checks.push([
  'Word Lab asks for a guess before showing the word card',
  await page.locator('.guess .gopt').first().isVisible().catch(() => false) &&
    !(await page.locator('.meet').first().isVisible().catch(() => false)),
  'no guess step, or the card was already open'
])
await page.locator('.guess .gopt').first().click().catch(() => {})
await page.waitForTimeout(700)
await shot('06a-wordlab-guess-feedback')
checks.push(['a guess waits on its feedback instead of jumping to the card', await page.locator('.guess .as__next').isVisible().catch(() => false) || await page.locator('.as__next').isVisible().catch(() => false), 'no answer sheet after guessing'])
await page.locator('.as__next').first().click().catch(() => {})
await page.waitForTimeout(500)
await shot('06b-wordlab-card')
checks.push([
  'the word card shows how the word is built, with a legend for its colours',
  await page.locator('.meet .ana').first().isVisible().catch(() => false) &&
    // coloured tiles always come with their legend; a one-syllable word has neither
    (await page.locator('.meet .ana .legend').first().isVisible().catch(() => false) ||
      await page.locator('.meet .ana__whole').first().isVisible().catch(() => false)),
  'anatomy or legend missing on the meet card'
])
checks.push(['there is no drawing canvas any more', !(await page.locator('.meet canvas, .wcard canvas').count().catch(() => 0)), 'a canvas is still on the card'])
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
    await page.locator('.guess .gopt:not([disabled])').first().click().catch(() => {})
    await page.waitForTimeout(300)
    await page.locator('.as__next').first().click().catch(() => {})
    await page.waitForTimeout(300)
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
  await playWordGame({ wrong: i === 0 || (wrongWaited === null && i < 4) })
  if (i === 0) await shot('08b-wordlab-reveal-after-miss')
}
await page.waitForTimeout(900)
await shot('09-wordlab-done')
checks.push(['a wrong answer waits for 繼續 instead of moving on by itself', wrongWaited === true, `still showing after 2.6 s: ${wrongWaited}`])

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
  let sortWaited = false
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
      for (let k = 0; k < 8; k++) {
        // a wrong judgement now waits for 下一句 instead of moving on by itself
        if (await page.locator('.sortnext').isVisible().catch(() => false)) {
          sortWaited = true
          await page.locator('.sortnext').click().catch(() => {}); await page.waitForTimeout(250)
          continue
        }
        if (!(await page.locator('.sortbtn--ok').isVisible().catch(() => false))) break
        await page.locator('.sortbtn--ok').click().catch(() => {}); await page.waitForTimeout(900)
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
    if (inMix && await page.locator('.fb__point:has-text("這題考")').first().isVisible().catch(() => false)) mixLabel = true
    const cont = page.locator('.as__next').first()
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

// 主題對話: brief → three replies → end → rubric report
await page.goto(URL_BASE + '#/talk', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot('14d-talk-brief')
const briefOk = await page.locator('.brief .goal').count().catch(() => 0)
checks.push(['the talk brief shows a scenario with three goals', briefOk === 3, `goals=${briefOk}`])
// 自己出題 replaces today's scenario with one built from a description
await page.locator('button:has-text("自己出題")').click().catch(() => {})
await page.locator('#idea').fill('在藥妝店問防曬乳和免稅').catch(() => {})
await page.locator('button:has-text("產生情境")').click().catch(() => {})
await page.waitForTimeout(900)
const customTitle = (await page.locator('.brief__title').innerText().catch(() => '')).trim()
checks.push(['自己出題 builds a scenario from a Chinese description', customTitle === '藥妝店', `title="${customTitle}"`])
await shot('14d2-talk-custom')
await page.locator('button:has-text("回到今天的情境")').click().catch(() => {})
await page.waitForTimeout(300)
await page.locator('button:has-text("開始對話")').click().catch(() => {})
await page.waitForTimeout(500)
for (const line of ['I want big latte', 'A muffin, please.', 'To go. How much is it?']) {
  await page.locator('.comp__box').fill(line).catch(() => {})
  await page.locator('.comp__send').click().catch(() => {})
  await page.waitForTimeout(900)
}
await shot('14e-talk-chat')
const bubbles = await page.locator('.bub--ai').count().catch(() => 0)
const fixShown = await page.locator('.fix .fix__en').first().isVisible().catch(() => false)
const goalsLit = await page.locator('.strip__g--on').count().catch(() => 0)
checks.push(['the partner answers every reply', bubbles === 4, `ai bubbles=${bubbles}`])
checks.push(['a wrong reply gets a correction under it', fixShown, 'no .fix shown'])
checks.push(['goals light up as they are met', goalsLit === 3, `goals on=${goalsLit}`])
await page.locator('.pill--end').click().catch(() => {})
await page.waitForTimeout(400)
await page.locator('button:has-text("看評分與回饋")').click().catch(() => {})
await page.waitForTimeout(1600)
await shot('14f-talk-report')
const crits = await page.locator('.crit').count().catch(() => 0)
const fixCards = await page.locator('.fixc').count().catch(() => 0)
checks.push(['the talk ends in a four-criterion report with fixes', crits === 4 && fixCards === 1, `crit=${crits} fixes=${fixCards}`])
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await page.waitForTimeout(300)
await shot('14g-talk-report-end')

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

/* the reading phase rotates: yesterday's story is not served again (v5.2.1) */
{
  const y = await page.evaluate(() => { const d = new Date(Date.now() - 86400000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })
  await page.evaluate(([id, y]) => {
    localStorage.setItem(`ngsl.stories.${id}`, '{}')
    localStorage.setItem(`ngsl.stories.log.${id}`, JSON.stringify({ s01: { first: y, last: y, opens: 1 } }))
  }, [USER_ID, y])
  // same component on a hash change is reused, not remounted — reload so the
  // view reads the seeded log like a fresh day would
  await page.goto(URL_BASE + '#/story?phase=1', { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const log = await page.evaluate(id => { try { return JSON.parse(localStorage.getItem(`ngsl.stories.log.${id}`) || '{}') } catch { return {} } }, USER_ID)
  const today = Object.entries(log).filter(([k, v]) => k !== 's01' && v.opens >= 1).map(([k]) => k)
  checks.push(['a story read-then-skipped yesterday is not opened again today', today.length === 1 && log.s01.last === y, JSON.stringify(log)])
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
    const cont = page.locator('.as__next').first()
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
  checks.push(['review comes before new words in the day', order[0] === '複習挑戰' && order[1] === '新單字', order.join(' → ')])
  checks.push(['the day carries a word part of the day', await page.locator('.wotd .ana').isVisible().catch(() => false), 'no 今日零件'])
  await shot('16q-dashboard-v2')
  // v6: periods have been finished since shot 05, so the light has travelled
  await page.waitForTimeout(2400)
  const p = await sceneProbe()
  const doneNow = await page.locator('.step--done').count().catch(() => 0)
  checks.push(['finishing periods moves the light along its arc', !!p && !!sceneHome0 && doneNow > 0 && p.lx > sceneHome0.lx + 3, `--lx ${sceneHome0?.lx} → ${p?.lx} with ${doneNow} periods done`])
  const sum = (await page.locator('.hero__sum').innerText().catch(() => '')).replace(/\s+/g, ' ')
  checks.push(['the hero counts the same periods the timetable ticks', new RegExp(`上完\\s*${doneNow}\\s*/\\s*8`).test(sum), `hero="${sum}" ticks=${doneNow}`])
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
for (const [route, name] of [['#/errors', '17-errors'], ['#/stats', '18-stats'], ['#/browse', '19-browse'], ['#/travel', '20-travel'], ['#/courses', '20b-courses'], ['#/me', '20c-me'], ['#/settings', '21-settings'], ['#/summary', '22-summary']]) {
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

/* update check (v5.2.2): the page compares itself with the server's version.json */
await page.goto(URL_BASE + '#/settings', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
{
  const btn = page.locator('button:has-text("檢查更新")').first()
  await btn.click().catch(() => {})
  await page.waitForSelector('[data-upd="current"]', { timeout: 8000 }).catch(() => {})
  const st = await page.locator('[data-upd]').first().getAttribute('data-upd').catch(() => null)
  checks.push(['檢查更新 reports the build as current when the server agrees', st === 'current', `state=${st}`])

  // a server that is ahead, and a worker that never takes over → clean reload
  await page.route('**/version.json*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '9.9.9', sha: 'fffffff' }) }))
  const before = page.url()
  await btn.click().catch(() => {})
  await page.waitForURL(/[?&]u=/, { timeout: 25000 }).catch(() => {})
  const reloaded = /[?&]u=/.test(page.url())
  const cachesLeft = await page.evaluate(async () => { try { return (await caches.keys()).length } catch { return -1 } })
  checks.push(['a stale build that the worker will not replace is cleared and reloaded', reloaded && cachesLeft <= 1, `url ${before} → ${page.url()}, caches=${cachesLeft}`])
  await page.unroute('**/version.json*')
  await page.waitForTimeout(3000)
}

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
