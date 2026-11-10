/**
 * Confusions (src/lib/confusion.js): the ledger and the contrast drill.
 *   node scripts/test-confusion.mjs
 */
import { recordConfusion, topConfusions, settleConfusion, pruneConfusions, contrastItems, contrastRound, editDistance, lookAlike, isRealConfusion } from '../src/lib/confusion.js'

let pass = 0, fail = 0
const ok = (c, label, detail = '') => { if (c) pass++; else { fail++; console.log(`FAIL ${label}${detail ? '  → ' + detail : ''}`) } }
const NOW = 1_800_000_000_000
const DAY = 86400000

const W = {
  1: { id: 1, headword: 'require', family: ['requires', 'required'], meanings: [{ pos: 'v.', zh: '需要；要求' }], examples: [{ en: 'This job requires patience.', zh: '這份工作需要耐心。' }] },
  2: { id: 2, headword: 'request', family: ['requests', 'requested'], meanings: [{ pos: 'n.', zh: '請求' }], examples: [{ en: 'She made a request for help.', zh: '她提出了協助的請求。' }] },
  3: { id: 3, headword: 'quiet', family: [], meanings: [{ pos: 'adj.', zh: '安靜的' }], examples: [] },
  4: { id: 4, headword: 'quite', family: [], meanings: [{ pos: 'adv.', zh: '相當' }], examples: [{ en: 'It is quite cold today.', zh: '今天相當冷。' }] },
  5: { id: 5, headword: 'big', family: [], meanings: [{ pos: 'adj.', zh: '大的' }], examples: [] },
  6: { id: 6, headword: 'large', family: [], meanings: [{ pos: 'adj.', zh: '大的（正式）' }], examples: [] },
  7: { id: 7, headword: 'empty', family: [], meanings: [], examples: [] }
}
const wordOf = id => W[id]

/* ---- ledger ---- */
{
  let L = {}
  L = recordConfusion(L, 1, 2, NOW)
  ok(L['1|2'].n === 1, 'a pick is recorded as target|chosen')
  L = recordConfusion(L, 1, 2, NOW + 1)
  ok(L['1|2'].n === 2 && L['1|2'].last === NOW + 1, 'and counted')
  const same = recordConfusion(L, 1, 1, NOW)
  ok(same === L, 'a word cannot be confused with itself')
  ok(recordConfusion(L, 1, null, NOW) === L && recordConfusion(L, 0, 2, NOW) === L && recordConfusion(L, 'x', 2, NOW) === L, 'bad ids are ignored')
  ok(Object.keys(recordConfusion(undefined, 3, 4, NOW)).length === 1, 'an empty ledger can be started')
  const frozen = Object.freeze({ ...L })
  const next = recordConfusion(frozen, 3, 4, NOW)
  ok(next !== frozen && frozen['3|4'] === undefined, 'the ledger is never mutated')
}

/* ---- ranking ---- */
{
  let L = {}
  L = recordConfusion(L, 1, 2, NOW)
  L = recordConfusion(L, 2, 1, NOW)        // the other direction of the same pair
  L = recordConfusion(L, 3, 4, NOW)
  const top = topConfusions(L, { now: NOW })
  ok(top.length === 2 && top[0].a === 1 && top[0].b === 2 && top[0].n === 2, 'both directions of a pair are one distinction', JSON.stringify(top))
  ok(top[1].a === 3 && top[1].b === 4, 'pairs are returned with the lower id first')

  // fading
  let F = recordConfusion({}, 3, 4, NOW - 200 * DAY)
  ok(topConfusions(F, { now: NOW }).length === 0, 'a pick from 200 days ago is not a problem any more')
  F = recordConfusion(F, 1, 2, NOW - 20 * DAY)
  ok(topConfusions(F, { now: NOW })[0].a === 1, 'a pick from 20 days ago still is')
  let R = {}
  for (let i = 0; i < 3; i++) R = recordConfusion(R, 5, 6, NOW - 60 * DAY)
  R = recordConfusion(R, 1, 2, NOW)
  ok(topConfusions(R, { now: NOW })[0].a === 1, 'one fresh confusion outranks three from two months ago')
  ok(topConfusions(L, { now: NOW, limit: 1 }).length === 1, 'limit is honoured')
  ok(topConfusions({ 'x|y': { n: 3, last: NOW }, '1|2': null }, { now: NOW }).length === 0, 'junk entries are skipped')
}

/* ---- settling ---- */
{
  let L = recordConfusion(recordConfusion({}, 1, 2, NOW), 2, 1, NOW)
  L = settleConfusion(L, 2, 1)
  ok(L['1|2'].clean === 1 && L['2|1'].clean === 1, 'one clean round is remembered on both directions')
  ok(topConfusions(L, { now: NOW }).length === 1, 'and the pair is still listed')
  const again = recordConfusion(L, 1, 2, NOW)
  ok(again['1|2'].clean === 0, 'confusing them again starts the count over')
  L = settleConfusion(L, 1, 2)
  ok(!L['1|2'] && !L['2|1'], 'the second clean round retires the pair')
  ok(Object.keys(settleConfusion({}, 1, 2)).length === 0, 'settling an unknown pair is harmless')
}

/* ---- pruning ---- */
{
  let L = {}
  for (let i = 1; i <= 400; i++) L = recordConfusion(L, i, i + 1000, NOW - i * 1000)
  L = recordConfusion(L, 9000, 9001, NOW - 200 * DAY)
  const P = pruneConfusions(L, { now: NOW, max: 300 })
  ok(Object.keys(P).length === 300, 'the ledger is capped')
  ok(P['1|1001'] && !P['400|1400'], 'keeping the most recent')
  ok(!P['9000|9001'], 'and dropping what has faded')
}

/* ---- the drill ---- */
{
  const items = contrastItems(W[1], W[2], 7)
  ok(items.length === 6, 'a pair with sentences on both sides gives six items', String(items.length))
  for (const it of items) {
    ok(it.options.length === 2, 'every item is a two-way choice')
    const ids = it.options.map(o => o.id).sort()
    ok(ids[0] === 1 && ids[1] === 2, 'between exactly the two words of the pair')
    ok(it.options[it.answer].id === it.targetId, 'the marked answer is the target')
    ok(it.options[0].text !== it.options[1].text, 'the two options differ')
    ok(it.prompt && !it.prompt.toLowerCase().includes(String(W[it.targetId].headword)) || it.kind === 'word→zh', 'the prompt does not give the word away', `${it.kind}: ${it.prompt}`)
  }
  ok(items.every((it, i) => i === 0 || it.targetId !== items[i - 1].targetId), 'the answer alternates between the two words', items.map(i => i.targetId).join(''))
  const gap = items.find(i => i.kind === 'gap' && i.targetId === 1)
  ok(gap && gap.prompt === 'This job ＿＿＿ patience.' && gap.full === 'This job requires patience.', 'the gap is cut from the word\'s own sentence, inflection and all', JSON.stringify(gap))
  ok(items.filter(i => i.kind === 'word→zh').every(i => i.say === W[i.targetId].headword), 'the word is spoken when the word is the prompt')
  ok(items.filter(i => i.kind !== 'word→zh').every(i => i.say === ''), 'and never when hearing it would answer the question')

  ok(JSON.stringify(contrastItems(W[1], W[2], 7)) === JSON.stringify(items), 'same seed, same drill')
  const sides = new Set()
  for (let s = 1; s <= 40; s++) sides.add(contrastItems(W[1], W[2], s)[0].answer)
  ok(sides.size === 2, 'the answer is not always on the same side')

  ok(contrastItems(W[3], W[4], 1).length === 5, 'a word without a sentence just has no gap item')
  ok(contrastItems(W[5], W[6], 1).length === 0, 'a pair whose short meanings coincide is not drilled: no question would have one answer')
  ok(contrastItems(W[1], W[7], 1).length === 0 && contrastItems(W[1], undefined, 1).length === 0, 'nor a pair with a meaning missing')
  ok(contrastItems(W[1], { ...W[1], id: 99 }, 1).length === 0, 'nor a word against itself')

  const round = contrastRound([{ a: 5, b: 6, n: 9 }, { a: 1, b: 2, n: 3 }, { a: 3, b: 4, n: 1 }, { a: 1, b: 7, n: 1 }], wordOf, { maxPairs: 5, seed: 3 })
  ok(round.length === 2 && round[0].a === 1 && round[1].a === 3, 'a round keeps only the pairs that can be drilled, in order', JSON.stringify(round.map(r => [r.a, r.b])))
  ok(contrastRound([{ a: 1, b: 2, n: 1 }, { a: 3, b: 4, n: 1 }], wordOf, { maxPairs: 1 }).length === 1, 'maxPairs is honoured')
}

/* ---- which pairs are real ---- */
{
  ok(editDistance('quite', 'quiet') === 1, 'a swap of two neighbours is one edit')
  ok(editDistance('affect', 'effect') === 1 && editDistance('accept', 'except') === 2, 'substitutions are counted')
  ok(editDistance('', 'abc') === 3 && editDistance('abc', 'abc') === 0, 'edges')
  ok(editDistance('through', 'though') === 1 && editDistance('kitten', 'sitting') === 3, 'insertions and the textbook case')

  const alike = [['affect', 'effect'], ['quite', 'quiet'], ['require', 'request'], ['accept', 'except'], ['through', 'though'],
    ['personal', 'personnel'], ['rise', 'raise'], ['lose', 'loose'], ['adapt', 'adopt'], ['Desert', 'dessert'], ['principal', 'principle']]
  for (const [a, b] of alike) ok(lookAlike(a, b) && lookAlike(b, a), `${a} / ${b} look alike`)
  const apart = [['other', 'general'], ['have', 'there'], ['big', 'large'], ['on', 'in'], ['at', 'it'], ['station', 'question'],
    ['borrow', 'lend'], ['make', 'take off'], ['same', 'same'], ['', 'word'], ['into', 'interest']]
  for (const [a, b] of apart) ok(!lookAlike(a, b), `${a} / ${b} do not`)

  ok(!isRealConfusion({ a: 5, b: 6, n: 1 }, W[5], W[6]), 'one stray pick between unlike words is not listed')
  ok(isRealConfusion({ a: 5, b: 6, n: 2 }, W[5], W[6]), 'the second one is')
  ok(isRealConfusion({ a: 3, b: 4, n: 1 }, W[3], W[4]), 'one pick between look-alikes is listed at once')
  ok(!isRealConfusion(null, W[3], W[4]) && !isRealConfusion({ a: 1, b: 9, n: 1 }, W[1], undefined), 'missing data is not a confusion')

  // both directions merge before the test is applied
  let L = recordConfusion({}, 5, 6, NOW)
  L = recordConfusion(L, 6, 5, NOW)
  const [p] = topConfusions(L, { now: NOW })
  ok(p.n === 2 && isRealConfusion(p, W[5], W[6]), 'A for B and B for A count as two')
}

console.log(`confusion: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
