/**
 * Derive the NGSL word-formation graph.
 *
 *   node scripts/build-affix.mjs   →  src/data/affix.json
 *
 * `words.base.json` ships an *inflection* list ("achieve, achieves, achieved,
 * achieving"), which is not a word family. The derivations — achieve #745 and
 * achievement #1998 — sit 1,253 ranks apart, so the scheduler introduced them
 * four months apart and the learner met them as two unrelated words. Word
 * formation is also the single largest scoring block in TOEIC Part 5, and
 * nothing in the app taught it.
 *
 * This builds the links offline and deterministically: strip a known affix,
 * repair the spelling, and keep the link only when the result is itself an
 * NGSL headword. No model call, so the graph is identical for both learners
 * and reviewable by eye.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const base = JSON.parse(readFileSync(resolve(here, '../src/data/words.base.json'), 'utf8'))

const byHead = new Map(base.map(w => [w.h.toLowerCase(), w]))

/**
 * Suffixes, longest first so `-ation` is tried before `-ion`.
 * `pos` is the part of speech the suffix produces — that is the part a Part 5
 * question actually tests ("choose the noun").
 */
const SUFFIXES = [
  { s: 'ation', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ition', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ution', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ment', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ness', pos: 'n.', zh: '形容詞 → 名詞' },
  { s: 'ship', pos: 'n.', zh: '名詞 → 抽象名詞' },
  { s: 'hood', pos: 'n.', zh: '名詞 → 抽象名詞' },
  { s: 'ance', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ence', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ity', pos: 'n.', zh: '形容詞 → 名詞' },
  { s: 'sion', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'tion', pos: 'n.', zh: '動詞 → 名詞' },
  { s: 'ist', pos: 'n.', zh: '→ 從事者' },
  { s: 'ian', pos: 'n.', zh: '→ 從事者' },
  { s: 'er', pos: 'n.', zh: '動詞 → 做這件事的人／物' },
  { s: 'or', pos: 'n.', zh: '動詞 → 做這件事的人／物' },
  { s: 'ant', pos: 'n.', zh: '動詞 → 從事者' },
  { s: 'able', pos: 'adj.', zh: '動詞 → 可以…的' },
  { s: 'ible', pos: 'adj.', zh: '動詞 → 可以…的' },
  { s: 'ious', pos: 'adj.', zh: '名詞 → 形容詞' },
  { s: 'ous', pos: 'adj.', zh: '名詞 → 形容詞' },
  { s: 'ful', pos: 'adj.', zh: '名詞 → 充滿…的' },
  { s: 'less', pos: 'adj.', zh: '名詞 → 沒有…的' },
  { s: 'ive', pos: 'adj.', zh: '動詞 → 形容詞' },
  { s: 'al', pos: 'adj.', zh: '名詞 → 形容詞' },
  { s: 'ic', pos: 'adj.', zh: '名詞 → 形容詞' },
  { s: 'ly', pos: 'adv.', zh: '形容詞 → 副詞' },
  { s: 'ize', pos: 'v.', zh: '→ 使…化' },
  { s: 'ify', pos: 'v.', zh: '→ 使…化' },
  { s: 'en', pos: 'v.', zh: '形容詞 → 動詞' },
  { s: 'y', pos: 'adj.', zh: '名詞 → 形容詞' }
]

const PREFIXES = [
  { p: 'un', zh: '否定：不、非' },
  { p: 'in', zh: '否定：不、非' },
  { p: 'im', zh: '否定：不、非' },
  { p: 'il', zh: '否定：不、非' },
  { p: 'ir', zh: '否定：不、非' },
  { p: 'dis', zh: '否定／相反' },
  { p: 'non', zh: '否定：非' },
  { p: 're', zh: '再一次、往回' },
  { p: 'pre', zh: '事前' },
  { p: 'mis', zh: '錯誤地' },
  { p: 'over', zh: '過度' },
  { p: 'under', zh: '不足、在下' },
  { p: 'inter', zh: '之間、互相' },
  { p: 'sub', zh: '在下、次級' },
  { p: 'co', zh: '共同' },
  { p: 'ex', zh: '向外、前任' }
]

/** Spelling repairs after cutting a suffix: happi|ness → happy, us|able → use. */
function stemCandidates (stem, suffix) {
  const out = new Set([stem])
  out.add(stem + 'e')                                   // us|able  → use
  if (stem.endsWith('i')) out.add(stem.slice(0, -1) + 'y')   // happi|ness → happy
  if (stem.endsWith('i')) out.add(stem.slice(0, -1))
  if (suffix === 'ity' && stem.endsWith('bil')) out.add(stem.slice(0, -3) + 'ble') // possibil|ity
  if (suffix === 'tion' || suffix === 'sion') {
    out.add(stem + 'e')                                 // decora|tion → decorate (below)
    out.add(stem + 'te')                                // crea|tion → create
    out.add(stem + 'd')                                 // deci|sion → decid(e)
    out.add(stem + 'de')
    out.add(stem + 't')                                 // connec|tion is direct; inser|tion → insert
  }
  if (suffix === 'ation' || suffix === 'ition' || suffix === 'ution') {
    out.add(stem + 'e')                                 // inform|ation is direct; declar|ation → declare
  }
  // running|-> run, stopp|er → stop
  if (stem.length > 2 && stem.at(-1) === stem.at(-2)) out.add(stem.slice(0, -1))
  return [...out].filter(s => s.length >= 3)
}

/**
 * Short affixes on short stems are mostly coincidence, not derivation:
 * letter←let, party←part, carry←car, listen←list, offer←off. Requiring a
 * longer base kills most of them without a hand-written list.
 */
const RISKY = new Set(['er', 'or', 'y', 'en', 'al', 'ic', 'ant', 'ist', 'ian', 'ive'])
const MIN_BASE = 5

/**
 * Pairs the rules find that are not live derivations for a learner. Some are
 * historically real (return ← turn) and still useless: knowing "turn" does not
 * get you to "return". Teaching these as a word family is worse than teaching
 * nothing, because it tells the learner a rule that will mislead them.
 */
const NOT_A_FAMILY = new Set([
  'return', 'remember', 'insure', 'mayor', 'company', 'country', 'county',
  'family', 'really', 'only', 'early', 'reply', 'record', 'report', 'result',
  'present', 'president', 'represent', 'concern', 'context', 'contract',
  'expect', 'export', 'express', 'extend', 'exist', 'interest', 'internet',
  'internal', 'international', 'submit', 'subject', 'discuss', 'display',
  'distance', 'district', 'disease', 'coffee', 'college', 'collect', 'common',
  'consider', 'corner', 'cover', 'current', 'preference', 'president',
  'undertake', 'understand', 'overall', 'inside', 'income', 'increase',
  'indeed', 'index', 'industry', 'influence', 'inform', 'injury', 'insect',
  'instance', 'instead', 'institute', 'instrument', 'insurance', 'intend',
  'invite', 'involve', 'import', 'impact', 'improve', 'impress', 'nonsense',
  // caught by the rules, but not a live derivation for a learner
  'station', 'comment', 'resource', 'exchange', 'finance', 'factory',
  'shoulder', 'discount', 'reserve', 'preserve', 'resolution', 'passion',
  'portion', 'pollution', 'apartment', 'incorporate', 'insight', 'counter',
  'tradition', 'attend', 'attendance', 'novel', 'planet', 'pattern', 'season'
])

/** The shortest real headword this word could have been built from. */
function derive (word) {
  const w = word.toLowerCase()
  if (NOT_A_FAMILY.has(w)) return null

  for (const { s, pos, zh } of SUFFIXES) {
    if (!w.endsWith(s) || w.length - s.length < 3) continue
    const stem = w.slice(0, -s.length)
    for (const cand of stemCandidates(stem, s)) {
      const hit = byHead.get(cand)
      if (!hit || hit.h.toLowerCase() === w) continue
      if (RISKY.has(s) && hit.h.length < MIN_BASE) continue
      return { base: hit.id, affix: `-${s}`, kind: 'suffix', pos, zh }
    }
  }

  for (const { p, zh } of PREFIXES) {
    if (!w.startsWith(p) || w.length - p.length < 4) continue
    const rest = w.slice(p.length)
    const hit = byHead.get(rest)
    if (!hit || hit.h.toLowerCase() === w) continue
    if (hit.h.length < MIN_BASE) continue
    return { base: hit.id, affix: `${p}-`, kind: 'prefix', pos: '', zh }
  }
  return null
}

const links = {}
for (const w of base) {
  const d = derive(w.h)
  // A link is only useful in one direction: the derived word must be the rarer
  // of the two, or "act ← action" would teach the frequent word from the rare.
  if (d && d.base !== w.id && d.base < w.id) links[w.id] = d
}

/** base id → the derived words built on it, in rank order. */
const families = {}
for (const [id, d] of Object.entries(links)) {
  ;(families[d.base] ||= []).push(Number(id))
}
for (const k of Object.keys(families)) families[k].sort((a, b) => a - b)

const out = { generated: new Date().toISOString().slice(0, 10), links, families }
writeFileSync(resolve(here, '../src/data/affix.json'), JSON.stringify(out), 'utf8')

const headById = new Map(base.map(w => [w.id, w.h]))
const bySuffix = {}
for (const d of Object.values(links)) bySuffix[d.affix] = (bySuffix[d.affix] || 0) + 1

console.log(`${Object.keys(links).length} derived words, ${Object.keys(families).length} roots`)
console.log('\ntop affixes:')
for (const [a, n] of Object.entries(bySuffix).sort((x, y) => y[1] - x[1]).slice(0, 14)) {
  console.log(`  ${a.padEnd(7)} ${n}`)
}
console.log('\nsample:')
for (const [id, d] of Object.entries(links).slice(0, 12)) {
  console.log(`  ${headById.get(Number(id))} (#${id}) ← ${headById.get(d.base)} (#${d.base})  ${d.affix}`)
}
const gaps = Object.entries(links)
  .map(([id, d]) => [Number(id) - d.base, headById.get(d.base), headById.get(Number(id))])
  .sort((a, b) => b[0] - a[0]).slice(0, 8)
console.log('\nwidest rank gaps (these are the pairs the scheduler was splitting):')
for (const [gap, a, b] of gaps) console.log(`  ${String(gap).padStart(5)}  ${a} → ${b}`)
