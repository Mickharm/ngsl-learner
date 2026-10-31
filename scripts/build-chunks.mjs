/**
 * Reading chunks + stress for every NGSL headword → src/data/chunks.json
 *
 *   npm i --no-save hyphen cmu-pronouncing-dictionary
 *   node scripts/build-chunks.mjs
 *
 * Why: orthographic mapping (Ehri) — a word sticks when its spelling is bound
 * to its pronunciation, and long words become readable once they are seen as
 * a few chunks instead of a row of letters. "beau·ti·ful" with the stress on
 * the first chunk is easier to say, spell and remember than "beautiful".
 *
 * Two independent sources, and a word is only chunked when they agree:
 *
 *   hyphen (Liang/TeX en-US patterns)  where the word may be broken in print
 *   CMU Pronouncing Dictionary         how many syllables it has, which one is stressed
 *
 * Print hyphenation is not phonetic syllabification ("veg-etable" is two print
 * chunks, four spoken syllables). Showing that split would teach a wrong
 * pronunciation, so when the chunk count differs from the CMU syllable count
 * the word is left whole. Nothing is better than a confident wrong answer.
 *
 * Output: { headword: { c: ['beau','ti','ful'], s: 0 } } — `s` is the index of
 * the primary-stressed chunk. Single-chunk words are omitted.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let hyphenate, dictionary
try {
  const h = require('hyphen/en-us')
  hyphenate = h.hyphenateSync || h.hyphenate
  ;({ dictionary } = await import('cmu-pronouncing-dictionary'))
} catch {
  console.error('需要先安裝建置用套件：npm i --no-save hyphen cmu-pronouncing-dictionary')
  process.exit(1)
}

const base = JSON.parse(fs.readFileSync(path.join(root, 'src/data/words.base.json'), 'utf8'))
const out = {}
let agreed = 0
let disagreed = 0

for (const w of base) {
  const head = w.h.toLowerCase()
  if (!/^[a-z]+$/.test(head)) continue
  const chunks = hyphenate(head, { hyphenChar: '-' }).split('-')
  if (chunks.length < 2) continue
  const pron = dictionary[head]
  if (!pron) continue
  const vowels = pron.split(' ').filter(p => /\d$/.test(p))
  if (vowels.length !== chunks.length) { disagreed++; continue }
  const stress = vowels.findIndex(p => p.endsWith('1'))
  out[head] = { c: chunks, s: stress < 0 ? 0 : stress }
  agreed++
}

fs.writeFileSync(path.join(root, 'src/data/chunks.json'), JSON.stringify(out))
console.log(`chunked ${agreed} words; left ${disagreed} whole because print and speech disagreed`)
