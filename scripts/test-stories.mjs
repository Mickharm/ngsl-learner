/**
 * Every bundled story meets its level, checked with the app's own lexicon.
 *
 * A token counts as known when it resolves to an NGSL headword at or below the
 * story's rank cap. Proper nouns listed in `names` are skipped; words listed in
 * `gloss` are pre-taught and allowed. Anything else above the cap is an
 * unglossed hard word — at most 2% of the running words, the graded-reader
 * coverage threshold — and every one is printed so a failing edit says
 * exactly which word broke it.
 */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import STORIES, { LEVEL_CAP } from '../src/data/stories.js'
import { makeLookup, wordTokens } from '../src/lib/lexicon.js'

const base = JSON.parse(fs.readFileSync(new URL('../src/data/words.base.json', import.meta.url), 'utf8'))
const lookup = makeLookup(base)
const headById = new Map(base.map(w => [w.id, w.h]))

/**
 * NGSL leaves numbers, days, months and titles to a supplementary list — every
 * beginner knows them, so they count as known. "the" sits at rank 1000 in the
 * source CSV (an artifact of how the list was assembled), not where its
 * frequency puts it, so it is known at every level too.
 */
const BASIC = new Set([
  'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
  'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety', 'hundred', 'thousand',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'mr', 'ms', 'mrs', 'ok', 'the'
])

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++ }

const ids = new Set()
for (const s of STORIES) {
  ok(!ids.has(s.id), `duplicate story id ${s.id}`); ids.add(s.id)
  ok(LEVEL_CAP[s.level], `${s.id} has a known level`)
  ok(s.pages.length >= 4, `${s.id} has at least 4 pages (the sequencing game needs them)`)
  ok(new Set(s.pages.map(p => p.scene)).size === s.pages.length, `${s.id} scenes are distinct (else sequencing is ambiguous)`)
  for (const p of s.pages) {
    ok(p.scene && p.lines.length >= 1, `${s.id} page has a scene and lines`)
    for (const l of p.lines) ok(l.en && l.zh, `${s.id} every line has English and Chinese`)
  }
  ok(s.quiz.length >= 3, `${s.id} has a quiz`)
  for (const q of s.quiz) {
    ok(q.options.length >= 2 && new Set(q.options).size === q.options.length, `${s.id} quiz options distinct`)
    ok(Number.isInteger(q.answer) && q.answer < q.options.length, `${s.id} quiz answer in range`)
    ok(q.q_zh && q.explain_zh, `${s.id} quiz has Chinese support`)
  }

  const names = new Set((s.names || []).map(x => x.toLowerCase()))
  const gloss = new Set(Object.keys(s.gloss || {}).map(x => x.toLowerCase()))
  const cap = LEVEL_CAP[s.level]
  const text = s.pages.flatMap(p => p.lines.map(l => l.en)).join(' ')
  const tokens = wordTokens(text)
  let total = 0; let hard = 0
  const hardWords = new Set()
  for (const t of tokens) {
    const k = t.toLowerCase().replace(/’/g, "'")
    if (names.has(k) || names.has(k.replace(/'s$/, ''))) continue
    total++
    if (BASIC.has(k) || BASIC.has(k.replace(/s$/, '')) || [...gloss].some(g => k.startsWith(g))) continue
    const id = lookup(k)
    if (!id || id > cap) { hard++; hardWords.add(id ? `${t}(#${id} ${headById.get(id)})` : `${t}(?)`) }
  }
  const coverage = 1 - hard / total
  ok(coverage >= 0.98, `${s.id} "${s.title}" level ${s.level}: coverage ${(coverage * 100).toFixed(1)}% < 98% — above-level: ${[...hardWords].join(', ')}`)

  // the word-hunt targets must actually appear in the text and be NGSL words
  for (const w of s.words) {
    const id = lookup(w)
    ok(id || gloss.has(w), `${s.id} target "${w}" is an NGSL word or glossed`)
    ok(tokens.some(t => lookup(t) === id || t.toLowerCase() === w), `${s.id} target "${w}" appears in the story`)
  }
  // glossed words must really be needed (above the cap) and really used
  for (const g of gloss) {
    const id = lookup(g)
    ok(!id || id > cap, `${s.id} gloss "${g}" is within level — no need to pre-teach it`)
    ok(tokens.some(t => t.toLowerCase().startsWith(g)), `${s.id} gloss "${g}" is used in the text`)
  }
  console.log(`  ${s.id} L${s.level} ${s.title.padEnd(20)} ${tokens.length} words, coverage ${(coverage * 100).toFixed(1)}%${hardWords.size ? ' · above-level: ' + [...hardWords].join(', ') : ''}`)
}

ok(STORIES.filter(s => s.level === 1).length >= 3, 'at least three entry-level stories')

/* the shared lexicon: frequent readings win collisions, no -er/-ly guessing */
const H = w => headById.get(lookup(w))
ok(H('found') === 'find', 'found → find (not the rare headword "found")')
ok(H('saw') === 'see', 'saw → see')
ok(H('went') === 'go' && H('children') === 'child' && H('better') === 'good', 'irregulars resolve')
ok(H('raining') === 'rain' && H('stopped') === 'stop' && H('arrived') === 'arrive', 'suffix rules')
ok(lookup('belly') === null && lookup('liver') === null, 'no false -ly / -er stems')
console.log(`stories: ${n} checks ok`)
