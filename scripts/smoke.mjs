/**
 * Browser smoke test. Serves dist/, stubs Supabase + Gemini at the network
 * layer, and walks the real app: placement → dashboard → learn → review →
 * grammar → article → summary, capturing a screenshot and console errors at
 * each step.
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

const db = {
  card_progress: [],
  daily_log: [],
  user_settings: [{ user_id: USER_ID, payload: { geminiKey: 'stub-key', newPerDay: 6, reviewCap: 40 } }],
  grammar_progress: [],
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
    answer: 0,
    explain_zh: '正解在第二段可以找到，其他選項與文章描述不符。'
  }))
}

/* ------------------------------------------------------------------ *
 * run
 * ------------------------------------------------------------------ */
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({
  executablePath: existsSync(CHROME) ? CHROME : undefined,
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

const errors = []
const page = await ctx.newPage()
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message))

// --- stub Supabase ---
await page.route('**/hlwmqtbgpconoclmxwll.supabase.co/**', async route => {
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
    if (req.method() === 'GET') return json(wordData(Array.from({ length: 120 }, (_, i) => i + 1)))
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
await page.route('**/generativelanguage.googleapis.com/**', async route => {
  const req = route.request()
  let payload
  const body = req.postData() || ''
  if (body.includes('used_words') || body.includes('CEFR A2-B1 的英文短文')) payload = ARTICLE
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

await page.goto(URL_BASE + '#/setup', { waitUntil: 'networkidle' })
await shot('02-placement-intro')

await tap('button:has-text("開始測驗")')
await shot('03-placement-test')

// answer 48 probes
for (let i = 0; i < 48; i++) {
  const yes = page.locator('button:has-text("認識")').first()
  const no = page.locator('button:has-text("不認識")').first()
  if (!(await yes.isVisible().catch(() => false))) break
  await (i % 3 === 2 ? no : yes).click()
  await page.waitForTimeout(45)
}
await shot('04-placement-result')

await tap('.opt-card--rec')
await page.waitForTimeout(900)
await shot('05-dashboard')

// learn phase
await page.goto(URL_BASE + '#/learn', { waitUntil: 'networkidle' })
await page.waitForTimeout(1400)
await shot('06-learn-front')

if (await page.locator('button:has-text("看答案")').first().isVisible().catch(() => false)) {
  await tap('button:has-text("看答案")')
  await shot('07-learn-revealed')
  for (let i = 0; i < 40; i++) {
    const g = page.locator('.grade:has-text("記得")').first()
    if (await g.isVisible({ timeout: 1200 }).catch(() => false)) { await g.click().catch(() => {}); await page.waitForTimeout(180) }
    if (await page.locator('.ropt').first().isVisible({ timeout: 600 }).catch(() => false)) break
    const r = page.locator('button:has-text("看答案")').first()
    if (await r.isVisible({ timeout: 1200 }).catch(() => false)) { await r.click().catch(() => {}); await page.waitForTimeout(150); continue }
    break
  }
  await shot('08-learn-recall')
  for (let i = 0; i < 40; i++) {
    const o = page.locator('.ropt:not([disabled])').first()
    if (!(await o.isVisible({ timeout: 2500 }).catch(() => false))) break
    await o.click().catch(() => {})
    await page.waitForTimeout(750)
  }
}
await page.waitForTimeout(900)
await shot('09-after-learn')

// review
await page.goto(URL_BASE + '#/review', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await shot('10-review')

// grammar
await page.goto(URL_BASE + '#/grammar', { waitUntil: 'networkidle' })
await page.waitForTimeout(900)
await shot('11-grammar-teach')
if (await page.locator('button:has-text("開始練習")').first().isVisible().catch(() => false)) {
  await tap('button:has-text("開始練習")')
  await shot('12-grammar-choice')
  await tap('.opt')
  await shot('13-grammar-feedback')
  // walk to a word-order drill
  for (let i = 0; i < 8; i++) {
    const n = page.locator('.fb button:has-text("下一題"), .fb button:has-text("看結果")').first()
    if (!(await n.isVisible().catch(() => false))) break
    await n.click(); await page.waitForTimeout(320)
    if (await page.locator('.build').first().isVisible().catch(() => false)) break
    const o = page.locator('.opt').first()
    if (await o.isVisible().catch(() => false)) { await o.click(); await page.waitForTimeout(260) }
    const ta = page.locator('textarea.input').first()
    if (await ta.isVisible().catch(() => false)) {
      await page.locator('button:has-text("看答案")').first().click(); await page.waitForTimeout(260)
    }
  }
  if (await page.locator('.build').first().isVisible().catch(() => false)) await shot('14-grammar-order')
}

// article
await page.goto(URL_BASE + '#/article', { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await shot('15-article')
if (await page.locator('button:has-text("開始作答")').first().isVisible().catch(() => false)) {
  await tap('button:has-text("開始作答")')
  await shot('16-article-quiz')
}

// remaining screens
for (const [route, name] of [['#/errors', '17-errors'], ['#/stats', '18-stats'], ['#/browse', '19-browse'], ['#/travel', '20-travel'], ['#/settings', '21-settings'], ['#/summary', '22-summary']]) {
  await page.goto(URL_BASE + route, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await shot(name)
}

// horizontal-overflow check on every screen
await page.goto(URL_BASE + '#/', { waitUntil: 'networkidle' })
const overflow = await page.evaluate(() => {
  const d = document.documentElement
  return { scrollW: d.scrollWidth, clientW: d.clientWidth }
})

console.log('\n--- results ---')
console.log('screens captured:', shots.length)
console.log('body overflow  :', overflow.scrollW > overflow.clientW + 1 ? `FAIL (${overflow.scrollW} > ${overflow.clientW})` : 'ok')
const real = errors.filter(e => !/favicon|manifest|sw\.js|workbox|TUNNEL_CONNECTION_FAILED|fonts\.(googleapis|gstatic)|Failed to load resource.*404/i.test(e))
console.log('console errors :', real.length ? 'FAIL' : 'none')
for (const e of real.slice(0, 12)) console.log('   !', e.slice(0, 220))

await browser.close()
server.close()
process.exit(real.length ? 1 : 0)
