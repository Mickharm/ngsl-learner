/**
 * Scheduling regression tests.
 *
 * These exist because a 365-day simulation, not a unit test, is what caught the
 * three defects below — the engine was self-consistent and every existing test
 * passed while intervals quietly collapsed to one day. Each case here asserts a
 * property the simulation showed mattering, so the next parameter change has to
 * argue with something.
 *
 *   node scripts/test-srs.mjs
 */
import {
  schedule, newCard, gradeFromRatio, isMastered,
  GRADE, STATE, START_EASE
} from '../src/lib/srs.js'

let pass = 0
let fail = 0

function ok (label, cond, detail = '') {
  if (cond) { pass++; console.log(`PASS  ${label}`) }
  else { fail++; console.log(`FAIL  ${label}${detail ? `  → ${detail}` : ''}`) }
}

const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol

/** Deterministic runs: the engine fuzzes intervals ≥ 2.5 days by ±5%. */
const realRandom = Math.random
Math.random = () => 0.5

const T0 = Date.parse('2026-01-01T20:00:00Z')
const DAY = 86400000

/** Grade a card repeatedly, letting each step land exactly when it is due. */
function play (card, grades, start = T0) {
  let c = card
  let t = start
  for (const g of grades) {
    t = Math.max(t, c.dueAt)
    c = schedule(c, g, t)
  }
  return c
}

/* ------------------------------------------------------------------ *
 * 1. Nothing may deadlock in the learning steps
 * ------------------------------------------------------------------ */
console.log('\n— learning steps always terminate —')

{
  // Grammar and essentials grade a whole drill set at once, so a learner who
  // keeps scoring 4/6 used to sit on step 0 for ever and never open the next
  // point in the syllabus.
  const c = play(newCard(1), Array(8).fill(GRADE.HARD))
  ok('8× HARD graduates instead of repeating step 0',
    c.state === STATE.REVIEW,
    `state=${c.state} step=${c.stepIndex} iv=${c.intervalDays}`)
}

{
  const c = play(newCard(2), [GRADE.HARD, GRADE.HARD])
  ok('HARD advances the step index',
    c.state === STATE.REVIEW,
    `state=${c.state} step=${c.stepIndex}`)
}

{
  // AGAIN legitimately restarts the steps, but must not be able to hold a card
  // in learning once the learner starts getting it right.
  const c = play(newCard(3), [GRADE.AGAIN, GRADE.AGAIN, GRADE.GOOD, GRADE.GOOD])
  ok('AGAIN restarts but does not trap the card',
    c.state === STATE.REVIEW,
    `state=${c.state}`)
}

/* ------------------------------------------------------------------ *
 * 2. A lapse costs the interval once, not twice
 * ------------------------------------------------------------------ */
console.log('\n— lapse arithmetic —')

{
  const base = { ...newCard(10), state: STATE.REVIEW, intervalDays: 25, ease: 2.5, reps: 5, streak: 5 }
  const lapsed = schedule(base, GRADE.AGAIN, T0)
  ok('a lapse cuts the interval to 60%', near(lapsed.intervalDays, 15, 0.01),
    `${lapsed.intervalDays}d`)
  ok('a lapse moves the card into relearning', lapsed.state === STATE.RELEARNING)

  const back = schedule(lapsed, GRADE.GOOD, lapsed.dueAt)
  ok('graduating out of relearning does NOT cut it again',
    near(back.intervalDays, 15, 0.01),
    `${back.intervalDays}d — expected 15, a second cut would give 9`)
}

{
  // The old engine bottomed out at the 1-day floor after two lapses, which is
  // the full reset the design explicitly set out to avoid.
  let c = { ...newCard(11), state: STATE.REVIEW, intervalDays: 25, ease: 2.5, reps: 5, streak: 5 }
  for (let i = 0; i < 2; i++) {
    c = schedule(c, GRADE.AGAIN, Math.max(T0, c.dueAt))
    c = schedule(c, GRADE.GOOD, c.dueAt)
  }
  ok('two lapses do not collapse a 25-day card to the 1-day floor',
    c.intervalDays > 5,
    `${c.intervalDays.toFixed(2)}d after 2 lapses`)
}

/* ------------------------------------------------------------------ *
 * 3. Ease can recover, not only fall
 * ------------------------------------------------------------------ */
console.log('\n— ease drift —')

{
  const base = { ...newCard(20), state: STATE.REVIEW, intervalDays: 10, ease: 2.0, reps: 5, streak: 3 }
  const good = schedule(base, GRADE.GOOD, T0)
  ok('GOOD returns some ease', good.ease > base.ease, `${base.ease} → ${good.ease}`)
}

{
  // The failure mode: a learner who forgets a quarter of the time, and never
  // presses 簡單, must not ratchet every card down to the ease floor.
  let c = { ...newCard(21), state: STATE.REVIEW, intervalDays: 10, ease: START_EASE, reps: 5, streak: 3 }
  let t = T0
  for (let i = 0; i < 100; i++) {
    const g = i % 4 === 3 ? GRADE.AGAIN : GRADE.GOOD   // exactly 25% lapses, no EASY
    t = Math.max(t, c.dueAt)
    c = schedule(c, g, t)
  }
  ok('a 25%-lapse learner does not sink to the ease floor',
    c.ease > 1.5, `ease=${c.ease}`)
  ok('and keeps a usable interval', c.intervalDays >= 2,
    `${c.intervalDays.toFixed(2)}d`)
}

/* ------------------------------------------------------------------ *
 * 4. Steady-state load has to fit the daily cap
 * ------------------------------------------------------------------ */
console.log('\n— steady-state review demand —')

{
  // Sum of 1/interval across the deck is how many reviews per day the schedule
  // is asking for. With a 60-card cap and learning cards taking roughly half of
  // it, anything past ~30/day accumulates a backlog that never clears.
  const N = 1500
  let t = T0
  let cards = Array.from({ length: N }, (_, i) => newCard(i + 1, T0))
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648

  for (let day = 0; day < 365; day++) {
    const now = T0 + day * DAY
    cards = cards.map(c => {
      if (c.dueAt > now) return c
      const r = rnd()
      const g = r < 0.25 ? GRADE.AGAIN : r < 0.30 ? GRADE.EASY : GRADE.GOOD
      return schedule(c, g, now)
    })
    t = now
  }
  const demand = cards.reduce((a, c) => a + 1 / Math.max(1, c.intervalDays), 0)
  ok('1500 words at a 25% lapse rate settle under 30 reviews/day',
    demand < 30, `${demand.toFixed(1)} reviews/day`)

  const mastered = cards.filter(isMastered).length
  ok('and most of the deck reaches the mastered threshold',
    mastered > N * 0.6, `${mastered}/${N} mastered`)
}

/* ------------------------------------------------------------------ *
 * 5. Drill-set scores map onto sane grades
 * ------------------------------------------------------------------ */
console.log('\n— drill-set grading —')

const gradeName = ['AGAIN', 'HARD', 'GOOD', 'EASY']
for (const [correct, total, want] of [
  [6, 6, GRADE.EASY],
  [5, 6, GRADE.GOOD],
  [4, 6, GRADE.GOOD],   // a pass for someone meeting the point for the first time
  [3, 6, GRADE.HARD],
  [2, 6, GRADE.AGAIN],
  [0, 6, GRADE.AGAIN],
  [5, 5, GRADE.EASY],
  [4, 5, GRADE.GOOD],
  [6, 7, GRADE.GOOD],
  [0, 0, GRADE.AGAIN]
]) {
  const got = gradeFromRatio(correct, total)
  ok(`${correct}/${total} → ${gradeName[want]}`, got === want, `got ${gradeName[got]}`)
}

{
  // The point of widening the mapping: a 4/6 opener must not stall the syllabus.
  const c = play(newCard(30), [gradeFromRatio(4, 6), gradeFromRatio(4, 6)])
  ok('two 4/6 scores graduate a grammar point', c.state === STATE.REVIEW,
    `state=${c.state}`)
}

Math.random = realRandom

console.log(`\n${fail ? `${fail} failed, ` : ''}${pass} passed`)
process.exit(fail ? 1 : 0)
