/**
 * Grammar Studio: content integrity + the two properties that answer the
 * complaint "練習都長一樣、照順序做就好":
 *
 *   1. every point's practice round mixes at least three game types, and
 *   2. the mixed round never puts two items from the same point side by side
 *      (when more than one point is available), so each item asks "which rule?"
 */
import assert from 'node:assert/strict'
import GRAMMAR from '../src/data/grammar.js'
import STUDIO, { TENSES, ROLES } from '../src/data/grammar-studio.js'
import { tapFromCorrection, derivedItems, sortItem, practiceRound, mixRound, permuteOptions } from '../src/lib/grammarGames.js'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++ }
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim()

/* ---- content ---- */
ok(Object.keys(STUDIO).length === GRAMMAR.length, 'one studio entry per grammar point')
for (const g of GRAMMAR) {
  const s = STUDIO[g.id]
  ok(s, `${g.id} has studio content`)
  const d = s.discover
  ok(d && d.q && Array.isArray(d.options) && d.options.length >= 2, `${g.id} discover has a question and options`)
  ok(Number.isInteger(d.answer) && d.answer >= 0 && d.answer < d.options.length, `${g.id} discover answer in range`)
  ok(new Set(d.options).size === d.options.length, `${g.id} discover options distinct`)
  ok(d.why && d.why.length > 10, `${g.id} discover explains the rule`)
  ok(Array.isArray(d.shown) && d.shown.length >= 1, `${g.id} discover shows sentences to notice from`)

  if (s.model) {
    ok(['slots', 'timeline'].includes(s.model.kind), `${g.id} model kind`)
    if (s.model.kind === 'timeline') ok(TENSES[s.model.tense], `${g.id} timeline tense known`)
    if (s.model.kind === 'slots') for (const [r] of s.model.slots) ok(ROLES[r], `${g.id} slot role ${r} known`)
  }

  ok(s.items.length >= 3, `${g.id} has at least three studio items`)
  for (const [i, it] of s.items.entries()) {
    const tag = `${g.id}#${i} (${it.type})`
    ok(['picture', 'timeline', 'meaning', 'blocks'].includes(it.type), `${tag} type known`)
    ok(it.explain && it.explain.length > 3, `${tag} has an explanation`)
    if (it.type === 'picture' || it.type === 'meaning') {
      ok(it.options.length >= 2 && new Set(it.options).size === it.options.length, `${tag} options distinct`)
      ok(Number.isInteger(it.answer) && it.answer < it.options.length, `${tag} answer in range`)
      if (it.type === 'picture') ok(it.scene && it.q, `${tag} has a scene and a question`)
      if (it.type === 'meaning') ok(it.s && it.q, `${tag} has a sentence and a question`)
    }
    if (it.type === 'timeline') {
      ok(TENSES[it.answer], `${tag} timeline answer is a known zone`)
      ok(it.s && it.zh, `${tag} has sentence and translation`)
    }
    if (it.type === 'blocks') {
      ok(it.blocks.length >= 2, `${tag} has blocks`)
      for (const [text, role] of it.blocks) ok(text && ROLES[role], `${tag} block "${text}" role ${role}`)
      ok(new Set(it.blocks.map(b => b[0])).size === it.blocks.length, `${tag} blocks distinct (else the order is ambiguous)`)
    }
  }
}

/* ---- tap derivation: applying the fix reproduces the answer ---- */
let taps = 0
for (const g of GRAMMAR) {
  for (const d of g.drills.filter(x => x.type === 'correct')) {
    const t = tapFromCorrection(d)
    if (!t) continue
    taps++
    const fixed = t.tokens.map((w, i) => (i === t.wrongIndex ? t.fix : w)).filter(Boolean).join(' ')
    ok(norm(fixed) === norm(d.answer), `${g.id} tap fix reproduces the answer: "${fixed}" vs "${d.answer}"`)
  }
}
ok(taps >= 20, `most correction drills become tap-the-error games (got ${taps})`)
ok(tapFromCorrection({ wrong: 'Is raining outside now.', answer: 'It is raining outside now.' }) === null, 'a missing word is not a tap game')

/* ---- practice round variety ---- */
for (const g of GRAMMAR) {
  const round = practiceRound(g, STUDIO, 42)
  ok(round.length >= 5 && round.length <= 7, `${g.id} practice round size (${round.length})`)
  const types = new Set(round.map(r => r.type))
  ok(types.size >= 3, `${g.id} practice round mixes ≥3 game types (got ${[...types].join(',')})`)
  for (const it of round) ok(it.pointId === g.id, `${g.id} practice item belongs to the point`)
  // the old failure mode: same drill shape back to back
  for (let i = 1; i < round.length; i++) {
    if (round[i].type === round[i - 1].type) {
      // allowed only when the round literally has no alternative left
      const rest = round.slice(i)
      ok(rest.every(r => r.type === round[i].type), `${g.id} avoidable repeat of type ${round[i].type} at ${i}`)
    }
  }
  // seeds change the round
  const other = practiceRound(g, STUDIO, 43)
  ok(JSON.stringify(other) !== JSON.stringify(round), `${g.id} a different seed gives a different round`)
}

/* ---- option permutation keeps the right answer ---- */
for (const g of GRAMMAR) {
  for (const it of [...STUDIO[g.id].items, ...derivedItems(g)]) {
    if (!Array.isArray(it.options) || typeof it.answer !== 'number') continue
    const p = permuteOptions(it, 7)
    ok(p.options[p.answer] === it.options[it.answer], `${g.id} permutation keeps the answer text`)
  }
}
// answers are not all in slot 0 after permutation
{
  const slots = []
  for (const g of GRAMMAR) for (const it of practiceRound(g, STUDIO, 5)) if (typeof it.answer === 'number' && it.options) slots.push(it.answer)
  const zeroShare = slots.filter(s => s === 0).length / slots.length
  ok(zeroShare < 0.6, `correct option is not predictably first (share in slot 0: ${(zeroShare * 100).toFixed(0)}%)`)
}

/* ---- sort item ---- */
for (const g of GRAMMAR) {
  const s = sortItem(g, 3)
  if (!s) continue
  ok(s.cards.some(c => c.ok) && s.cards.some(c => !c.ok), `${g.id} sort round has both right and wrong sentences`)
}

/* ---- interleaving ---- */
{
  const learned = GRAMMAR.slice(0, 10)
  const mix = mixRound(learned, 'g10', STUDIO, { seed: 9, n: 8 })
  ok(mix.length === 8, 'mixed round has 8 items')
  const pts = mix.map(m => m.pointId)
  ok(new Set(pts).size >= 4, `mixed round spans ≥4 points (got ${new Set(pts).size})`)
  for (let i = 1; i < pts.length; i++) ok(pts[i] !== pts[i - 1], `no two neighbours from the same point (${pts.join(',')})`)
  const focus = pts.filter(p => p === 'g10').length
  ok(focus >= 2 && focus <= 4, `today's point gets about a third (got ${focus})`)

  // weakness over-samples a weak point
  let weakHits = 0; let plainHits = 0
  for (let s = 1; s <= 40; s++) {
    weakHits += mixRound(learned, 'g10', STUDIO, { seed: s, n: 8, weakness: { g03: 1 } }).filter(m => m.pointId === 'g03').length
    plainHits += mixRound(learned, 'g10', STUDIO, { seed: s, n: 8 }).filter(m => m.pointId === 'g03').length
  }
  ok(weakHits > plainHits * 1.5, `a weak point comes up more often (${weakHits} vs ${plainHits})`)

  ok(mixRound([], 'g01', STUDIO).length === 0, 'no learned points → empty mix')
  const solo = mixRound([GRAMMAR[0]], 'g01', STUDIO, { seed: 2, n: 6 })
  ok(solo.length >= 4 && solo.every(m => m.pointId === 'g01'), 'one learned point → mix from it alone')
}

console.log(`grammar studio: ${n} checks ok`)
