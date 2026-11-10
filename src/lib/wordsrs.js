/**
 * Vocabulary scheduler v2 — FSRS memory model + a retrieval ladder.
 *
 * Why this replaced the modified SM-2 for words (concept cards — grammar,
 * essentials — still use srs.js):
 *
 * 1. "記住是因為短時間內多次複習，過一陣子又忘了." The SM-2 setup counted the
 *    1-minute and 10-minute re-showings inside one sitting as reviews and
 *    graduated a word on them. Massed repetition inflates in-session accuracy
 *    and the learner's own confidence while doing little for retention a week
 *    later (Nakata & Suzuki 2019, SSLA 41(2): massed learners also
 *    overestimated their 1-week recall; spaced learners did not). Here a word
 *    gets exactly ONE scheduled review per day. Whatever happens inside a
 *    Word Lab sitting is practice, not evidence.
 *
 * 2. Every review used to be the same card in the same direction: see English,
 *    recognise Chinese. Recognising a card is not recalling a word. Each word
 *    now carries a ladder level, and the level decides the task:
 *
 *       0  看字選義   word + audio  → pick the meaning (picture + 中文)
 *       1  聽音選義   audio only    → pick the meaning
 *       2  看圖選字   picture + 中文 → pick the English word
 *       3  拼出來     picture + 中文 + audio → build the spelling from tiles
 *       4  句中使用   sentence with a gap → produce the word in context
 *
 *    Correct climbs a rung, wrong drops one. So the second time a word comes
 *    back it is a harder task than the first, and a word cannot look
 *    "mastered" on recognition alone.
 *
 * 3. FSRS predicts recall probability far better than SM-2 on large Anki
 *    datasets (open-spaced-repetition benchmark: FSRS-6 beats SM-2 for 99.6%
 *    of users on log loss), and schedules for a target retention instead of a
 *    hand-tuned ease ratchet — which this repo had already had to recalibrate
 *    three times.
 *
 * 4. Grades are measured, not self-reported. A wrong answer is AGAIN, a slow or
 *    hinted correct answer is HARD, a clean one is GOOD. EASY is never given by
 *    a game: an automatic EASY on a recognition task is how an interval jumps
 *    past the point where the word was still remembered.
 *
 * Storage: card_progress keeps its columns (no migration to run before deploy).
 *   ease          ← FSRS difficulty (1–10)
 *   interval_days ← FSRS stability (days until recall falls to 90%)
 *   step_index    ← 100 + ladder level   (≥100 marks a v2 card)
 * A card with step_index < 100 is a legacy SM-2 card and is converted on read.
 */
import { fsrs, generatorParameters, createEmptyCard, Rating, State, forgetting_curve } from 'ts-fsrs'
import { GRADE, STATE } from './srs.js'

export const V2_BASE = 100
export const LADDER_TOP = 4

export const LADDER = Object.freeze([
  { level: 0, key: 'meaning', label: '看字選義', short: '認得' },
  { level: 1, key: 'listen', label: '聽音選義', short: '聽得懂' },
  { level: 2, key: 'recall', label: '看中文選字', short: '想得起' },
  { level: 3, key: 'spell', label: '拼出來', short: '拼得出' },
  { level: 4, key: 'cloze', label: '句中使用', short: '用得出' }
])

/**
 * Longest gap allowed before the next review, by ladder level.
 *
 * FSRS sizes intervals from how well the word was answered, but a correct
 * recognition answer says less about memory than a correct spelling. Without
 * this cap a word answered right three times on the easiest task would be
 * pushed a month out having never once been produced. Stability is still the
 * FSRS value; only the due date is held in, so the word climbs the ladder
 * before it earns long gaps.
 */
export const LADDER_CAP_DAYS = Object.freeze([3, 7, 14, 30, 365])

/**
 * After a miss, the word is checked again within this many days whatever FSRS
 * says. FSRS's post-lapse stability for a long-known word can be a week or
 * more — calibrated, but it means relearning gets tested once, a week later.
 * Successive relearning (Rawson & Dunlosky) is relearn-then-retrieve across
 * several close sessions; a two-day recheck is cheap and shows whether the
 * relearning stuck.
 */
export const LAPSE_CAP_DAYS = 2

/** Correct answers slower than this count as HARD, per task. */
export const SLOW_MS = Object.freeze({ meaning: 8000, listen: 10000, recall: 9000, spell: 25000, cloze: 25000 })

const DAY = 86400000

const params = generatorParameters({
  request_retention: 0.9,
  maximum_interval: 365,
  enable_fuzz: true,
  // Day-scale only. Sub-day steps are exactly the in-session repetition this
  // module exists to stop counting.
  enable_short_term: false
})
const scheduler = fsrs(params)
const DECAY_PARAMS = params.w

const STATE_TO_FSRS = {
  [STATE.NEW]: State.New,
  [STATE.LEARNING]: State.Learning,
  [STATE.REVIEW]: State.Review,
  [STATE.RELEARNING]: State.Relearning
}
const FSRS_TO_STATE = {
  [State.New]: STATE.NEW,
  [State.Learning]: STATE.LEARNING,
  [State.Review]: STATE.REVIEW,
  [State.Relearning]: STATE.RELEARNING
}
const GRADE_TO_RATING = {
  [GRADE.AGAIN]: Rating.Again,
  [GRADE.HARD]: Rating.Hard,
  [GRADE.GOOD]: Rating.Good,
  [GRADE.EASY]: Rating.Easy
}

export function isV2 (card) {
  return !!card && Number(card.stepIndex) >= V2_BASE
}

export function ladderOf (card) {
  if (!card) return 0
  if (isV2(card)) return clampLevel(card.stepIndex - V2_BASE)
  return legacyLadder(card)
}

function clampLevel (n) {
  return Math.max(0, Math.min(LADDER_TOP, Math.round(Number(n) || 0)))
}

/** Where a legacy SM-2 card starts on the ladder: by how long it already lasts. */
function legacyLadder (card) {
  if (!card || card.state === STATE.NEW) return 0
  const iv = Number(card.intervalDays) || 0
  if (card.state !== STATE.REVIEW) return 0
  if (iv >= 21) return 3
  if (iv >= 7) return 2
  if (iv >= 2) return 1
  return 0
}

/** SM-2 ease (1.3–3.0) → FSRS difficulty (1–10). Low ease = hard word. */
export function easeToDifficulty (ease) {
  const e = Math.min(3.0, Math.max(1.3, Number(ease) || 2.5))
  return Math.min(10, Math.max(1, 1 + ((3.0 - e) / 1.7) * 9))
}

/**
 * Convert a legacy SM-2 card to a v2 card, in memory. Pure.
 *
 * Stability is taken as half the SM-2 interval: under the FSRS-6 forgetting
 * curve that is the stability at which recall would sit near 85% when the
 * card falls due, which is optimistic for this learner (measured ~75%) and
 * pessimistic for a well-known word. One real review corrects it either way,
 * so the due date is left where SM-2 put it — converting must not reshuffle
 * the whole queue on the day of the update.
 */
export function migrateLegacy (card) {
  if (!card || isV2(card)) return card
  const level = legacyLadder(card)
  if (card.state === STATE.NEW) {
    return { ...card, stepIndex: V2_BASE, ease: 0, intervalDays: 0 }
  }
  const iv = Number(card.intervalDays) || 0
  return {
    ...card,
    state: STATE.REVIEW,
    ease: easeToDifficulty(card.ease),
    intervalDays: Math.max(0.5, iv * 0.5),
    stepIndex: V2_BASE + level
  }
}

function toFsrsCard (card, now) {
  if (!card || card.state === STATE.NEW || !(card.intervalDays > 0)) {
    return createEmptyCard(new Date(now))
  }
  const last = card.lastReviewedAt ?? card.introducedAt ?? now
  return {
    due: new Date(card.dueAt ?? now),
    stability: Math.max(0.1, card.intervalDays),
    difficulty: Math.min(10, Math.max(1, card.ease || 5)),
    elapsed_days: Math.max(0, Math.floor((now - last) / DAY)),
    scheduled_days: Math.max(0, Math.round(((card.dueAt ?? now) - last) / DAY)),
    learning_steps: 0,
    reps: card.reps || 0,
    lapses: card.lapses || 0,
    state: STATE_TO_FSRS[card.state] ?? State.Review,
    last_review: new Date(last)
  }
}

/**
 * Apply one measured review. Pure — returns the next card.
 *
 * @param {object} card   app card (legacy or v2; legacy is converted first)
 * @param {number} grade  GRADE.*
 * @param {number} now    ms
 * @param {object} [opt]
 * @param {number} [opt.level]  ladder level the answer was given at; defaults
 *                              to the card's current level
 */
export function scheduleWord (card, grade, now = Date.now(), { level } = {}) {
  const base = migrateLegacy(card)
  const fc = toFsrsCard(base, now)
  const { card: nx } = scheduler.next(fc, new Date(now), GRADE_TO_RATING[grade] ?? Rating.Again)

  const at = clampLevel(level ?? ladderOf(base))
  const nextLevel = grade === GRADE.AGAIN ? Math.max(0, at - 1) : Math.min(LADDER_TOP, at + 1)

  const fsrsDue = nx.due.getTime()
  const capDays = grade === GRADE.AGAIN ? Math.min(LAPSE_CAP_DAYS, LADDER_CAP_DAYS[nextLevel]) : LADDER_CAP_DAYS[nextLevel]
  const capDue = now + capDays * DAY
  // Never sooner than tomorrow: sub-day re-showing is Word Lab's job, not the scheduler's.
  const dueAt = Math.max(now + DAY * 0.9, Math.min(fsrsDue, capDue))

  return {
    ...base,
    state: FSRS_TO_STATE[nx.state] ?? STATE.REVIEW,
    ease: Number(nx.difficulty.toFixed(3)),
    intervalDays: Number(nx.stability.toFixed(3)),
    stepIndex: V2_BASE + nextLevel,
    dueAt,
    reps: (base.reps || 0) + 1,
    lapses: (base.lapses || 0) + (grade === GRADE.AGAIN && base.state !== STATE.NEW ? 1 : 0),
    streak: grade === GRADE.AGAIN ? 0 : (base.streak || 0) + 1,
    lastGrade: grade,
    lastReviewedAt: now,
    introducedAt: base.introducedAt ?? now
  }
}

/** Probability the word is recalled right now (0–1). */
export function retrievabilityV2 (card, now = Date.now()) {
  if (!card || card.state === STATE.NEW) return 0
  const c = migrateLegacy(card)
  const S = Math.max(0.1, c.intervalDays || 0.1)
  const elapsed = Math.max(0, (now - (c.lastReviewedAt ?? now)) / DAY)
  return forgetting_curve(DECAY_PARAMS, elapsed, S)
}

/** "熟練": lasts three weeks AND has been produced, not just recognised. */
export function isMasteredV2 (card) {
  if (!card || card.state === STATE.NEW) return false
  const c = migrateLegacy(card)
  return c.intervalDays >= 21 && ladderOf(c) >= 3
}

/**
 * Turn a measured answer into a grade.
 *
 * @param {object} a
 * @param {boolean} a.correct
 * @param {number}  [a.elapsedMs]
 * @param {boolean} [a.hinted]     the learner asked for a letter / the answer
 * @param {string}  [a.mode]       ladder key, for the slow threshold
 */
export function gradeFromAnswer ({ correct, elapsedMs = 0, hinted = false, mode = 'meaning' }) {
  if (!correct) return GRADE.AGAIN
  if (hinted) return GRADE.HARD
  if (elapsedMs > (SLOW_MS[mode] ?? 10000)) return GRADE.HARD
  return GRADE.GOOD
}

/**
 * Which task to give a word, given what data it has.
 *
 * Falls back down the ladder rather than skipping the word: a word with no
 * example sentence cannot be clozed, so it is spelled; a word with no meaning
 * yet cannot be played at all and the caller must enrich it first.
 */
export function modeFor (card, word) {
  let level = ladderOf(card)
  const hasZh = !!word?.meanings?.[0]?.zh
  if (!hasZh) return null
  if (level >= 4 && !clozeSentence(word)) level = 3
  if (level === 3 && !/^[a-z]+$/i.test(word.headword || '')) level = 2
  return LADDER[level].key
}

/**
 * An example sentence that contains the word in a form the learner can type.
 * Returns { before, answer, after, zh } or null.
 */
export function clozeSentence (word) {
  const head = String(word?.headword || '').toLowerCase()
  if (!head) return null
  const forms = new Set([head, ...(word.family || []).map(f => String(f).toLowerCase())])
  for (const ex of word.examples || []) {
    if (!ex?.en) continue
    const m = [...ex.en.matchAll(/[A-Za-z']+/g)].find(t => forms.has(t[0].toLowerCase()) && t[0].length >= 2)
    if (!m) continue
    return {
      before: ex.en.slice(0, m.index),
      answer: m[0],
      after: ex.en.slice(m.index + m[0].length),
      zh: ex.zh || ''
    }
  }
  return null
}

/** Two instants on the same calendar day, in the learner's own time zone. */
export function sameLocalDay (a, b) {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/**
 * Has this word already had its scheduled review today?
 *
 * "One scheduled review per day" was a rule every caller had to keep. Two
 * did not: leaving Word Lab during the recall round and coming back graded
 * the same new words again, and re-entering a review after the app had been
 * closed could do the same. The second grade of a day is the massed
 * repetition this module exists to stop counting, so progress.gradeCard asks
 * this first and treats a repeat as practice.
 */
export function reviewedToday (card, now = Date.now()) {
  if (!card || card.state === STATE.NEW || !card.lastReviewedAt || !(card.reps > 0)) return false
  return sameLocalDay(card.lastReviewedAt, now)
}

export function dueSoonest (cards, now = Date.now()) {
  return [...cards].sort((a, b) => retrievabilityV2(a, now) - retrievabilityV2(b, now) || a.dueAt - b.dueAt)
}
