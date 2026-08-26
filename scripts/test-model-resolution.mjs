/**
 * Model resolution, tested offline.
 *
 * Google renames and retires model IDs on its own schedule. resolveModel() is
 * what stops that from surfacing as a dead app, so its ranking needs to be
 * checked without depending on a live API key.
 *
 *   npm run test:models
 */

// Stub the network so resolveModel() can be exercised offline.
const CATALOG = [
  'gemini-3.5-flash',
  'gemini-3.5-pro',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-embedding-001',
  'gemini-2.5-flash-image',
  'gemini-live-2.5-flash-preview',
  'gemini-2.5-flash-tts',
  'gemini-3.5-flash-002'
]

globalThis.fetch = async (url) => ({
  ok: true,
  status: 200,
  json: async () => ({
    models: CATALOG.map(n => ({
      name: `models/${n}`,
      supportedGenerationMethods: /embedding/.test(n) ? ['embedContent'] : ['generateContent']
    }))
  })
})

const here = new URL('../src/lib/gemini.js', import.meta.url)
const { resolveModel, DEFAULT_MODEL } = await import(here)

const cases = [
  ['no preference → best available', null, 'gemini-3.5-flash'],
  ['preference exists → keep it', 'gemini-2.5-flash', 'gemini-2.5-flash'],
  ['preference retired → best available', 'gemini-2.0-flash', 'gemini-3.5-flash'],
  ['DEFAULT_MODEL is in catalog', DEFAULT_MODEL, 'gemini-3.5-flash']
]

let fail = 0
for (const [label, pref, want] of cases) {
  const got = await resolveModel('fake-key', pref)
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        want ${want}  got ${got}`)
}

// never pick a special-purpose variant
const picked = await resolveModel('fake-key', null)
const bad = /embedding|image|tts|live/.test(picked)
console.log(`${bad ? 'FAIL' : 'PASS'}  avoids embedding/image/tts/live variants (${picked})`)
if (bad) fail++

console.log(`\nDEFAULT_MODEL = ${DEFAULT_MODEL}`)
console.log(fail ? `${fail} ranking FAILURE(S)` : 'ranking checks passed')

/* ---- error diagnosis: the AQ.-key trap must not read as user error ---- */

async function statusFor (status, body) {
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => ({ ok: false, status, text: async () => body })
  try {
    await (await import(here)).listModels('any-key')
    return '(no error thrown)'
  } catch (e) {
    return e.message
  } finally { globalThis.fetch = realFetch }
}

const diagCases = [
  [
    'AQ. key rejected → names the Google-side cause and the workaround',
    401,
    '{"error":{"code":401,"status":"UNAUTHENTICATED","message":"Request had invalid authentication credentials. Expected OAuth 2 access token","details":[{"reason":"ACCESS_TOKEN_TYPE_UNSUPPORTED"}]}}',
    m => m.includes('Google Cloud Console') && m.includes('不是你設定錯')
  ],
  [
    'API not enabled → tells them to enable it',
    403,
    '{"error":{"code":403,"message":"Generative Language API has not been used in project 1234 before","status":"PERMISSION_DENIED","details":[{"reason":"SERVICE_DISABLED"}]}}',
    m => m.includes('Enable')
  ],
  [
    'plain 401 → generic message, not the AQ. story',
    401,
    '{"error":{"code":401,"message":"API key not valid"}}',
    m => !m.includes('Google Cloud Console')
  ]
]

let dfail = 0
for (const [label, status, body, check] of diagCases) {
  const msg = await statusFor(status, body)
  const ok = check(msg)
  if (!ok) dfail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
  if (!ok) console.log(`        got: ${msg}`)
}
console.log(dfail ? `${dfail} diagnosis FAILURE(S)` : 'diagnosis checks passed')

const total = fail + dfail
console.log(total ? `\n${total} FAILURE(S)` : '\nall passed')
process.exit(total ? 1 : 0)
