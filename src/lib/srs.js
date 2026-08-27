/**
 * Modified SM-2 spaced repetition engine.
 *
 * Design notes for this specific learner (≈400-500 word baseline, high lapse rate):
 *  - Two short learning steps before graduation, so a brand-new word is seen
 *    three times inside the first session rather than once.
 *  - Lapses drop the card into a relearning queue AND shrink the post-lapse
 *    interval, instead of resetting to 1 day. Resetting fully is demoralising
 *    at this volume; a partial cut keeps pressure without restarting.
 *  - `mastered` is a display state only — mastered cards still come back, just
 *    rarely. Nothing is ever permanently removed from rotation.
 *
 * Calibrated 2026-08 against a 365-day simulation of a 25%-lapse learner, which
 * showed the previous constants collapsing: intervals fell to 1 day, review
 * demand outran the daily cap by more than an order of magnitude, and ~2,200
 * cards ended the year permanently overdue. Three changes, all here:
 *
 *  1. LAPSE_RETENTION is applied ONCE per lapse. It used to be applied twice —
 *     on the way into relearning and again on the way out — so a "40% cut" was
 *     really 16%, and two lapses put any card back at 1 day, exactly the full
 *     reset the comment above says we are avoiding.
 *  2. GOOD returns a little ease. With AGAIN −0.20 / HARD −0.15 / EASY +0.15
 *     and GOOD neutral, ease was a one-way ratchet downward: staying level
 *     required pressing EASY on a third of all reviews, which no honest learner
 *     does. Every card drifted to MIN_EASE and stuck there.
 *  3. HARD advances the learning step instead of repeating it. Repeating meant
 *     a card — or, worse, a grammar point, which grades a whole drill set at
 *     once — could never graduate at all.
 */

export const GRADE = Object.freeze({
  AGAIN: 0, // 忘記
  HARD: 1,  // 模糊
  GOOD: 2,  // 記得
  EASY: 3   // 簡單
})

export const STATE = Object.freeze({
  NEW: 'new',
  LEARNING: 'learning',
  REVIEW: 'review',
  RELEARNING: 'relearning'
})

const LEARNING_STEPS_MIN = [1, 10]
const RELEARN_STEPS_MIN = [10]
const GRADUATE_DAYS = 1
const EASY_GRADUATE_DAYS = 4
const MIN_EASE = 1.3
const MAX_EASE = 3.0
export const START_EASE = 2.5
const MAX_INTERVAL_DAYS = 365
/** Share of the interval a card keeps after one lapse. Applied exactly once. */
const LAPSE_RETENTION = 0.6

/**
 * Ease adjustments, set so that ease holds steady at ~75% retention — roughly
 * where this learner sits — instead of only ever falling.
 *
 *   drift per review = pGood·GAIN − pAgain·AGAIN_COST − pHard·HARD_COST + pEasy·0.15
 *   neutral at 75% correct:  0.75 × 0.06 = 0.25 × 0.18  ✓
 *
 * Below that retention ease still falls, which is what should happen; above it
 * ease climbs back. The previous GAIN of 0 made recovery impossible without
 * pressing 簡單 on a third of all reviews, so every card ended at MIN_EASE.
 */
const GOOD_EASE_GAIN = 0.06
const AGAIN_EASE_COST = 0.18
const HARD_EASE_COST = 0.15

export const MASTER_INTERVAL_DAYS = 21
export const MASTER_STREAK = 3

const MIN = 60 * 1000
const DAY = 24 * 60 * MIN

export function newCard (wordId, now = Date.now()) {
  return {
    wordId,
    state: STATE.NEW,
    ease: START_EASE,
    intervalDays: 0,
    stepIndex: 0,
    dueAt: now,
    reps: 0,
    lapses: 0,
    streak: 0,
    lastGrade: null,
    lastReviewedAt: null,
    introducedAt: null
  }
}

/** ±5% jitter so a big batch learned on one day doesn't all resurface together. */
function fuzz (days) {
  if (days < 2.5) return days
  const spread = Math.max(1, days * 0.05)
  return days + (Math.random() * 2 - 1) * spread
}

function clampEase (e) {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, Number(e.toFixed(3))))
}

function clampInterval (d) {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1 / 1440, d))
}

/**
 * Apply a grade to a card and return the NEXT card state.
 * Pure function — never mutates the input.
 */
export function schedule (card, grade, now = Date.now()) {
  const c = { ...card }
  c.reps += 1
  c.lastGrade = grade
  c.lastReviewedAt = now
  if (c.introducedAt == null) c.introducedAt = now

  c.streak = grade === GRADE.AGAIN ? 0 : c.streak + 1

  const inLearning = c.state === STATE.NEW || c.state === STATE.LEARNING
  const inRelearn = c.state === STATE.RELEARNING

  if (inLearning || inRelearn) {
    const steps = inRelearn ? RELEARN_STEPS_MIN : LEARNING_STEPS_MIN

    if (grade === GRADE.AGAIN) {
      c.state = inRelearn ? STATE.RELEARNING : STATE.LEARNING
      c.stepIndex = 0
      c.ease = clampEase(c.ease - AGAIN_EASE_COST)
      c.dueAt = now + steps[0] * MIN
      return c
    }

    if (grade === GRADE.EASY) {
      // Skip remaining steps entirely.
      c.state = STATE.REVIEW
      c.stepIndex = 0
      c.ease = clampEase(c.ease + 0.15)
      c.intervalDays = clampInterval(
        inRelearn ? Math.max(GRADUATE_DAYS, c.intervalDays) : EASY_GRADUATE_DAYS
      )
      c.dueAt = now + fuzz(c.intervalDays) * DAY
      return c
    }

    // HARD and GOOD both advance a step; HARD just pays some ease for it.
    // Repeating the step on HARD deadlocked anything graded from a ratio —
    // a grammar point scoring 4/6 forever sat on step 0 and never graduated,
    // so the syllabus behind it never opened.
    if (grade === GRADE.HARD) c.ease = clampEase(c.ease - HARD_EASE_COST / 3)

    const next = c.stepIndex + 1
    if (next < steps.length) {
      c.state = inRelearn ? STATE.RELEARNING : STATE.LEARNING
      c.stepIndex = next
      c.dueAt = now + steps[next] * MIN
      return c
    }

    // Graduating out of relearning does NOT re-apply LAPSE_RETENTION: the cut
    // already happened when the card lapsed. Applying it here as well made one
    // lapse cost 0.6 × 0.6, and two lapses bottom out at the 1-day floor.
    //
    // It DOES pay back ease, because it is a correct answer. Without that, a
    // lapse cost one AGAIN penalty and also swallowed the recovery it should
    // have earned, so the drift stayed negative however generous GOOD was.
    if (inRelearn && grade === GRADE.GOOD) c.ease = clampEase(c.ease + GOOD_EASE_GAIN)
    c.state = STATE.REVIEW
    c.stepIndex = 0
    c.intervalDays = clampInterval(
      inRelearn ? Math.max(GRADUATE_DAYS, c.intervalDays) : GRADUATE_DAYS
    )
    c.dueAt = now + fuzz(c.intervalDays) * DAY
    return c
  }

  // --- REVIEW state ---
  if (grade === GRADE.AGAIN) {
    c.lapses += 1
    c.state = STATE.RELEARNING
    c.stepIndex = 0
    c.ease = clampEase(c.ease - AGAIN_EASE_COST)
    c.intervalDays = clampInterval(c.intervalDays * LAPSE_RETENTION)
    c.dueAt = now + RELEARN_STEPS_MIN[0] * MIN
    return c
  }

  const overdueBonus = overdueFactor(c, now)
  let mult
  if (grade === GRADE.HARD) {
    c.ease = clampEase(c.ease - HARD_EASE_COST)
    mult = 1.2
  } else if (grade === GRADE.GOOD) {
    c.ease = clampEase(c.ease + GOOD_EASE_GAIN)
    mult = c.ease
  } else {
    c.ease = clampEase(c.ease + 0.15)
    mult = c.ease * 1.3
  }

  c.intervalDays = clampInterval(Math.max(c.intervalDays + 1 / 1440, c.intervalDays * mult * overdueBonus))
  c.dueAt = now + fuzz(c.intervalDays) * DAY
  return c
}

/**
 * A card answered correctly long after it was due proves stronger memory than
 * the schedule assumed — give it a small bonus (capped, so a 3-month gap
 * doesn't launch the interval into orbit).
 */
function overdueFactor (card, now) {
  if (!card.intervalDays || card.intervalDays < 1) return 1
  const elapsedDays = (now - (card.lastReviewedAt ?? now)) / DAY
  if (elapsedDays <= card.intervalDays) return 1
  const ratio = elapsedDays / card.intervalDays
  return Math.min(1.3, 1 + (ratio - 1) * 0.15)
}

/** Preview of what each button will do, for the button labels in the UI. */
export function previewIntervals (card, now = Date.now()) {
  const out = {}
  for (const g of [GRADE.AGAIN, GRADE.HARD, GRADE.GOOD, GRADE.EASY]) {
    const next = schedule(card, g, now)
    out[g] = next.dueAt - now
  }
  return out
}

export function formatDelay (ms) {
  const mins = ms / MIN
  if (mins < 1) return '<1 分'
  if (mins < 60) return `${Math.round(mins)} 分`
  const hours = mins / 60
  if (hours < 24) return `${Math.round(hours)} 時`
  const days = hours / 24
  if (days < 30) return `${Math.round(days)} 天`
  const months = days / 30
  if (months < 12) return `${months.toFixed(months < 2 ? 1 : 0)} 月`
  return `${(days / 365).toFixed(1)} 年`
}

/**
 * Map a drill-set score onto the four-grade scale.
 *
 * Grammar and essentials both grade a whole set at once, so the thresholds
 * decide how fast the syllabus opens. They are deliberately generous: for a
 * learner with no grammar foundation, 4 out of 6 on a point met for the first
 * time is a pass, not a struggle. The old cut-off called it HARD, which — back
 * when HARD repeated the learning step — meant the point never graduated and
 * everything behind it stayed locked.
 */
export function gradeFromRatio (correct, total) {
  if (!total) return GRADE.AGAIN
  const ratio = correct / total
  if (ratio >= 0.95) return GRADE.EASY   // 6/6
  if (ratio >= 0.65) return GRADE.GOOD   // 5/6, 4/6
  if (ratio >= 0.45) return GRADE.HARD   // 3/6
  return GRADE.AGAIN                     // 2/6 and below
}

export function isMastered (card) {
  return card.state === STATE.REVIEW &&
    card.intervalDays >= MASTER_INTERVAL_DAYS &&
    card.streak >= MASTER_STREAK
}

export function isDue (card, now = Date.now()) {
  return card.dueAt <= now
}

/**
 * Retrievability estimate (0-1) using an exponential forgetting curve whose
 * stability is the current interval. Used for the "遺忘風險" display and to
 * order the review queue when there are more due cards than the daily cap.
 */
export function retrievability (card, now = Date.now()) {
  if (card.state === STATE.NEW) return 0
  const stability = Math.max(card.intervalDays, 0.02)
  const elapsed = Math.max(0, (now - (card.lastReviewedAt ?? now)) / DAY)
  return Math.exp(-elapsed / (stability * 1.8))
}

/**
 * Order the day's queue. Overdue-and-weakest first, because those are the
 * cards actually at risk; comfortable cards can wait a day without harm.
 */
export function sortReviewQueue (cards, now = Date.now()) {
  return [...cards].sort((a, b) => {
    const ra = retrievability(a, now)
    const rb = retrievability(b, now)
    if (Math.abs(ra - rb) > 0.001) return ra - rb
    return a.dueAt - b.dueAt
  })
}
