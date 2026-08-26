/**
 * Modified SM-2 spaced repetition engine.
 *
 * Design notes for this specific learner (≈400-500 word baseline, high lapse rate):
 *  - Two short learning steps before graduation, so a brand-new word is seen
 *    three times inside the first session rather than once.
 *  - Lapses drop the card into a relearning queue AND shrink the post-lapse
 *    interval to 40% of what it was, instead of resetting to 1 day. Resetting
 *    fully is demoralising at this volume; 40% keeps pressure without restarting.
 *  - `mastered` is a display state only — mastered cards still come back, just
 *    rarely. Nothing is ever permanently removed from rotation.
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
const LAPSE_RETENTION = 0.4

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
      c.ease = clampEase(c.ease - 0.20)
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

    if (grade === GRADE.HARD) {
      c.ease = clampEase(c.ease - 0.05)
      // Repeat the current step rather than advancing.
      c.state = inRelearn ? STATE.RELEARNING : STATE.LEARNING
      c.dueAt = now + steps[Math.min(c.stepIndex, steps.length - 1)] * MIN
      return c
    }

    // GOOD → advance one step, graduate if past the last one.
    const next = c.stepIndex + 1
    if (next < steps.length) {
      c.state = inRelearn ? STATE.RELEARNING : STATE.LEARNING
      c.stepIndex = next
      c.dueAt = now + steps[next] * MIN
      return c
    }

    c.state = STATE.REVIEW
    c.stepIndex = 0
    c.intervalDays = clampInterval(
      inRelearn ? Math.max(GRADUATE_DAYS, c.intervalDays * LAPSE_RETENTION) : GRADUATE_DAYS
    )
    c.dueAt = now + fuzz(c.intervalDays) * DAY
    return c
  }

  // --- REVIEW state ---
  if (grade === GRADE.AGAIN) {
    c.lapses += 1
    c.state = STATE.RELEARNING
    c.stepIndex = 0
    c.ease = clampEase(c.ease - 0.20)
    c.intervalDays = clampInterval(c.intervalDays * LAPSE_RETENTION)
    c.dueAt = now + RELEARN_STEPS_MIN[0] * MIN
    return c
  }

  const overdueBonus = overdueFactor(c, now)
  let mult
  if (grade === GRADE.HARD) {
    c.ease = clampEase(c.ease - 0.15)
    mult = 1.2
  } else if (grade === GRADE.GOOD) {
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
