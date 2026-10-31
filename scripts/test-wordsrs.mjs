/**
 * Vocabulary scheduler v2 — behaviour that the learner would notice if it broke.
 *
 * Every assertion here encodes a promise the UI makes: a word answered only by
 * recognition never vanishes for a month, a wrong answer makes the next task
 * easier and the gap shorter, a converted SM-2 card keeps its due date, and
 * nothing is ever scheduled for "later today".
 */
import assert from 'node:assert/strict'
import {
  scheduleWord, migrateLegacy, ladderOf, isV2, isMasteredV2, retrievabilityV2,
  gradeFromAnswer, modeFor, clozeSentence, easeToDifficulty, LADDER_CAP_DAYS, LAPSE_CAP_DAYS, V2_BASE
} from '../src/lib/wordsrs.js'
import { GRADE, STATE, newCard } from '../src/lib/srs.js'

const DAY = 86400000
const T0 = Date.parse('2026-11-01T09:00:00+08:00')
let n = 0
function ok (c, m) { assert.ok(c, m); n++ }
function eq (a, b, m) { assert.equal(a, b, m); n++ }

/* ---- a new word ---- */
{
  const c0 = newCard(7, T0)
  const c1 = scheduleWord(c0, GRADE.GOOD, T0, { level: 0 })
  ok(isV2(c1), 'graded card is v2')
  eq(ladderOf(c1), 1, 'correct at level 0 climbs to 1')
  ok(c1.dueAt - T0 >= 0.9 * DAY, 'never due later the same day')
  ok(c1.dueAt - T0 <= LADDER_CAP_DAYS[1] * DAY + 1, 'level-1 cap holds')
  eq(c1.state, STATE.REVIEW, 'day-scale only: straight to review')
  eq(c1.reps, 1)
  eq(c1.lapses, 0, 'failing a NEW card is not a lapse')

  const again = scheduleWord(c0, GRADE.AGAIN, T0, { level: 0 })
  eq(ladderOf(again), 0, 'level never below 0')
  ok(again.dueAt - T0 >= 0.9 * DAY && again.dueAt - T0 <= 1.6 * DAY, 'a missed new word comes back tomorrow')
  eq(again.lapses, 0)
}

/* ---- recognition alone cannot earn a long gap ---- */
{
  // Answer correctly forever but never get past the recognition rungs.
  let c = newCard(9, T0)
  let t = T0
  for (let i = 0; i < 12; i++) {
    c = scheduleWord(c, GRADE.GOOD, t, { level: 0 }) // always answered at level 0
    ok(c.dueAt - t <= LADDER_CAP_DAYS[1] * DAY + 1, `recognition-only answer ${i} stays within ${LADDER_CAP_DAYS[1]} days`)
    t = c.dueAt
  }
  ok(!isMasteredV2(c), 'recognition-only word is never "mastered"')
}

/* ---- climbing the ladder unlocks longer gaps ---- */
{
  let c = newCard(11, T0)
  let t = T0
  const gaps = []
  for (let i = 0; i < 8; i++) {
    c = scheduleWord(c, GRADE.GOOD, t)
    gaps.push((c.dueAt - t) / DAY)
    t = c.dueAt
  }
  eq(ladderOf(c), 4, 'eight clean answers reach the top rung')
  ok(gaps.at(-1) > gaps[0] * 4, `gaps grow (${gaps.map(g => g.toFixed(1)).join(', ')})`)
  ok(isMasteredV2(c), 'a word produced in context and lasting 3+ weeks is mastered')

  // then forget it
  const lapsed = scheduleWord(c, GRADE.AGAIN, t)
  eq(ladderOf(lapsed), 3, 'a miss drops one rung, not to the floor')
  eq(lapsed.lapses, c.lapses + 1, 'a miss on a review card is a lapse')
  ok(lapsed.intervalDays < c.intervalDays, 'stability falls after a lapse')
  ok(lapsed.dueAt - t <= LAPSE_CAP_DAYS * DAY + 1, `a lapsed word is rechecked within ${LAPSE_CAP_DAYS} days (got ${((lapsed.dueAt - t) / DAY).toFixed(1)} d)`)
  ok(lapsed.dueAt - t >= 0.9 * DAY, 'but not later today')
}

/* ---- HARD grows slower than GOOD ---- */
{
  let g = newCard(13, T0); let h = newCard(13, T0)
  g = scheduleWord(g, GRADE.GOOD, T0); h = scheduleWord(h, GRADE.GOOD, T0)
  const t = g.dueAt
  const g2 = scheduleWord(g, GRADE.GOOD, t)
  const h2 = scheduleWord(h, GRADE.HARD, t)
  ok(h2.intervalDays < g2.intervalDays, 'HARD → smaller stability than GOOD')
  ok(h2.ease > g2.ease, 'HARD → higher difficulty than GOOD')
}

/* ---- legacy SM-2 conversion ---- */
{
  const legacy = {
    wordId: 21, state: STATE.REVIEW, ease: 2.2, intervalDays: 16, stepIndex: 0,
    dueAt: T0 + 3 * DAY, reps: 6, lapses: 1, streak: 3, lastGrade: GRADE.GOOD,
    lastReviewedAt: T0 - 13 * DAY, introducedAt: T0 - 40 * DAY
  }
  ok(!isV2(legacy), 'step_index 0 is legacy')
  const m = migrateLegacy(legacy)
  ok(isV2(m), 'migrated card is v2')
  eq(m.dueAt, legacy.dueAt, 'conversion keeps the due date')
  eq(ladderOf(m), 2, '16-day legacy interval starts at level 2')
  eq(m.intervalDays, 8, 'stability = half the SM-2 interval')
  ok(Math.abs(m.ease - easeToDifficulty(2.2)) < 1e-9, 'ease mapped to difficulty')
  eq(m.lapses, 1); eq(m.reps, 6)
  eq(migrateLegacy(m), m, 'migration is idempotent')

  // A legacy learning-step card (mid-session in the old app) converts safely.
  const learning = { ...legacy, state: STATE.LEARNING, intervalDays: 0, stepIndex: 1 }
  const ml = migrateLegacy(learning)
  eq(ml.state, STATE.REVIEW); eq(ladderOf(ml), 0)
  ok(ml.intervalDays >= 0.5, 'learning card gets a floor stability')

  // ease direction: low SM-2 ease is a hard word → high difficulty
  ok(easeToDifficulty(1.3) > easeToDifficulty(2.5) && easeToDifficulty(2.5) > easeToDifficulty(3.0), 'ease ↔ difficulty is monotone decreasing')
  ok(easeToDifficulty(1.3) <= 10 && easeToDifficulty(3.0) >= 1, 'difficulty in [1,10]')

  // grading a legacy card works and yields v2
  const g = scheduleWord(legacy, GRADE.GOOD, T0 + 3 * DAY)
  ok(isV2(g) && ladderOf(g) === 3, 'graded legacy card climbs from its converted level')
}

/* ---- retrievability ---- */
{
  let c = scheduleWord(newCard(31, T0), GRADE.GOOD, T0)
  const r0 = retrievabilityV2(c, T0 + 1000)
  const r1 = retrievabilityV2(c, T0 + 10 * DAY)
  ok(r0 > 0.98, 'just reviewed ≈ 1')
  ok(r1 < r0 && r1 > 0, 'retrievability decays')
  eq(retrievabilityV2(newCard(32, T0), T0), 0, 'a new card has nothing to retrieve')
}

/* ---- grading from measured answers ---- */
eq(gradeFromAnswer({ correct: false }), GRADE.AGAIN)
eq(gradeFromAnswer({ correct: true, elapsedMs: 2000, mode: 'meaning' }), GRADE.GOOD)
eq(gradeFromAnswer({ correct: true, elapsedMs: 20000, mode: 'meaning' }), GRADE.HARD, 'slow recognition is HARD')
eq(gradeFromAnswer({ correct: true, elapsedMs: 20000, mode: 'spell' }), GRADE.GOOD, 'spelling is allowed to take longer')
eq(gradeFromAnswer({ correct: true, hinted: true }), GRADE.HARD, 'a hint caps at HARD')
for (const mode of ['meaning', 'listen', 'recall', 'spell', 'cloze']) {
  ok(gradeFromAnswer({ correct: true, elapsedMs: 0, mode }) !== GRADE.EASY, `games never award EASY (${mode})`)
}

/* ---- task selection falls back on missing data ---- */
{
  const word = {
    headword: 'arrive', family: ['arrives', 'arrived', 'arriving'],
    meanings: [{ pos: 'v.', zh: '抵達' }],
    examples: [{ en: 'The train arrived ten minutes late.', zh: '火車晚了十分鐘到。' }]
  }
  const at = lvl => ({ ...newCard(1, T0), state: STATE.REVIEW, intervalDays: 3, stepIndex: V2_BASE + lvl })
  eq(modeFor(at(0), word), 'meaning'); eq(modeFor(at(1), word), 'listen'); eq(modeFor(at(2), word), 'recall')
  eq(modeFor(at(3), word), 'spell'); eq(modeFor(at(4), word), 'cloze')
  const noEx = { ...word, examples: [] }
  eq(modeFor(at(4), noEx), 'spell', 'no example sentence → spell instead of cloze')
  eq(modeFor(at(2), { ...word, meanings: [] }), null, 'no meaning → cannot be played')
  const cz = clozeSentence(word)
  eq(cz.answer, 'arrived', 'cloze finds the inflected form')
  eq(cz.before + cz.answer + cz.after, word.examples[0].en, 'cloze pieces rejoin')
  eq(clozeSentence({ ...word, examples: [{ en: 'We got there late.', zh: '' }] }), null, 'no form present → no cloze')
  eq(modeFor(at(3), { ...word, headword: "o'clock" }), 'recall', 'non-letter headword is not spelled with tiles')
}

/* ---- a 120-day simulation: workload stays bounded, retention near target ---- */
{
  // A learner who recalls with the probability FSRS predicts, 10 new words a day.
  let seed = 7
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const cards = new Map()
  let maxDue = 0
  let correct = 0; let total = 0
  for (let day = 0; day < 120; day++) {
    const now = T0 + day * DAY
    let due = 0
    for (const [id, c] of cards) {
      if (c.dueAt > now) continue
      due++
      const p = retrievabilityV2(c, now)
      const hit = rand() < p
      total++; if (hit) correct++
      cards.set(id, scheduleWord(c, hit ? GRADE.GOOD : GRADE.AGAIN, now))
    }
    maxDue = Math.max(maxDue, due)
    for (let k = 0; k < 10; k++) {
      const id = day * 10 + k
      cards.set(id, scheduleWord(newCard(id, now), rand() < 0.8 ? GRADE.GOOD : GRADE.AGAIN, now, { level: 0 }))
    }
  }
  const acc = correct / total
  ok(acc > 0.8 && acc < 0.97, `simulated review accuracy near target (got ${(acc * 100).toFixed(1)}%)`)
  ok(maxDue < 160, `daily review load stays bounded at 10 new/day (peak ${maxDue})`)
  const mastered = [...cards.values()].filter(isMasteredV2).length
  ok(mastered > 300, `words reach mastery over 4 months (got ${mastered}/1200)`)
  console.log(`  sim: accuracy ${(acc * 100).toFixed(1)}%, peak daily reviews ${maxDue}, mastered ${mastered}/1200`)
}

console.log(`wordsrs: ${n} checks ok`)
