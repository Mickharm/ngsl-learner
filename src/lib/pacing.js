/**
 * Pacing: how much is actually being retained, and how many new words today
 * can afford. Pure.
 *
 * Two things the app could not answer before v6.1:
 *
 * 1. "Is it sticking?" The scheduler aims at 90% recall, but the only number
 *    on screen was the day's mixed accuracy — new-word practice and week-old
 *    reviews in one figure. Retention is a property of *reviews*: of the words
 *    that came back after a gap, what share was still there. It is measured
 *    here from the review log, per task, because recognising a word and
 *    spelling it are different memories and the weak one is where the time
 *    should go.
 *
 * 2. "Should I take new words today?" The daily count was a setting, and the
 *    summary screen told the learner in words when to lower it. A learner who
 *    is behind does not read that; they take eight new words on top of a
 *    queue that already does not fit in the day, and the queue is what kills
 *    a vocabulary habit. So the count is governed: a backlog or a retention
 *    slump lowers today's number, with the reason shown, and it comes back by
 *    itself. It is never raised automatically — more load is the learner's
 *    decision.
 */

const DAY = 86400000
/** lib/srs.js GRADE: AGAIN 0 · HARD 1 · GOOD 2 · EASY 3 */
const GRADE_HARD = 1

/** A review row counts toward retention unless it was the same-sitting recall
 *  that ends Word Lab ('learn'): that is practice right after study, not a
 *  memory surviving a gap. */
const isRetentionRow = r => r && r.mode !== 'learn' && Number.isFinite(Number(r.grade))

/**
 * @param {Array<{grade:number, mode?:string, reviewed_at:string|number}>} rows
 * @param {{now?:number, days?:number, minSample?:number}} [opt]
 * @returns {{ n:number, retention:number|null, byMode:Record<string,{n:number, right:number, retention:number|null}> }}
 *   retention is null below minSample: a percentage of four answers is noise.
 */
export function measuredRetention (rows, { now = Date.now(), days = 30, minSample = 20 } = {}) {
  const since = now - days * DAY
  let n = 0, right = 0
  const byMode = {}
  for (const r of rows || []) {
    if (!isRetentionRow(r)) continue
    const at = typeof r.reviewed_at === 'number' ? r.reviewed_at : Date.parse(r.reviewed_at)
    if (!Number.isFinite(at) || at < since || at > now + DAY) continue
    const ok = Number(r.grade) >= GRADE_HARD  // HARD / GOOD / EASY: it was recalled; AGAIN (0) was not
    n++; if (ok) right++
    const m = r.mode || 'meaning'
    const b = (byMode[m] ||= { n: 0, right: 0, retention: null })
    b.n++; if (ok) b.right++
  }
  for (const b of Object.values(byMode)) b.retention = b.n >= Math.max(5, Math.floor(minSample / 4)) ? b.right / b.n : null
  return { n, retention: n >= minSample ? right / n : null, byMode }
}

export const PACE = Object.freeze({
  /** due cards beyond the day's review cap, as a multiple of the cap */
  BACKLOG_HALF: 1.0,
  BACKLOG_STOP: 1.5,
  /** 7-day measured retention; the ladder makes every success a harder task
   *  next time, so these sit well under the scheduler's 90% target */
  RETENTION_HALF: 0.65,
  RETENTION_QUARTER: 0.5,
  RETENTION_READY: 0.88,
  MIN_SAMPLE: 20,
  READY_SAMPLE: 40
})

/**
 * Today's new-word count.
 *
 * @param {object} a
 * @param {number} a.newPerDay     the learner's setting
 * @param {number} a.dueCount      cards due now (before the cap)
 * @param {number} a.reviewCap     reviews the day is allowed
 * @param {number|null} a.retention  measured over the last 7 days, or null
 * @param {number} a.sample        reviews that retention is measured on
 * @param {boolean} [a.auto=true]  the governor can be switched off in settings
 * @returns {{ count:number, base:number, reason:'manual'|'ok'|'backlog'|'retention'|'both'|'ready', note:string }}
 */
export function paceToday ({ newPerDay, dueCount = 0, reviewCap = 60, retention = null, sample = 0, auto = true }) {
  const base = Math.max(0, Math.round(Number(newPerDay) || 0))
  if (!auto || base === 0) return { count: base, base, reason: 'manual', note: '' }

  let count = base
  let backlog = false, slump = false
  const cap = Math.max(1, reviewCap)
  const ratio = dueCount / cap
  if (ratio > PACE.BACKLOG_STOP) { count = 0; backlog = true }
  else if (ratio > PACE.BACKLOG_HALF) { count = Math.min(count, Math.ceil(base / 2)); backlog = true }

  if (retention !== null && sample >= PACE.MIN_SAMPLE) {
    if (retention < PACE.RETENTION_QUARTER) { count = Math.min(count, Math.max(1, Math.ceil(base / 4))); slump = true }
    else if (retention < PACE.RETENTION_HALF) { count = Math.min(count, Math.ceil(base / 2)); slump = true }
  }
  // a backlog can stop new words outright; a slump alone never goes below 1
  if (!backlog && slump) count = Math.max(1, count)
  // with a setting of 1 there is nothing to halve: say nothing rather than
  // announce a reduction that did not happen
  if (count >= base) { backlog = false; slump = false }

  const pct = retention === null ? '' : `${Math.round(retention * 100)}%`
  if (backlog && slump) {
    return { count, base, reason: 'both', note: `待複習 ${dueCount} 個字，超過一天的量，而且最近複習只答對 ${pct}：今天新字 ${count} 個（原本 ${base}）。` }
  }
  if (backlog) {
    return {
      count, base, reason: 'backlog',
      note: count === 0
        ? `待複習 ${dueCount} 個字，已經超過一天上限的一倍半：今天不加新字，先把欠的還完。`
        : `待複習 ${dueCount} 個字，超過一天的上限 ${cap} 個：今天新字減半為 ${count} 個。`
    }
  }
  if (slump) {
    return { count, base, reason: 'retention', note: `最近七天複習只答對 ${pct}：今天新字 ${count} 個（原本 ${base}），把時間留給複習。` }
  }
  if (retention !== null && sample >= PACE.READY_SAMPLE && retention >= PACE.RETENTION_READY && ratio <= 0.5) {
    return { count, base, reason: 'ready', note: `最近七天複習答對 ${pct}，複習量也不多：想快一點，可以到設定調高每日新字數。` }
  }
  return { count, base, reason: 'ok', note: '' }
}
