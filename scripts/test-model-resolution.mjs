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
console.log(fail ? `${fail} FAILURE(S)` : 'all passed')
process.exit(fail ? 1 : 0)
