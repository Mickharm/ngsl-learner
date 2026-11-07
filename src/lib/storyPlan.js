/**
 * Which story the daily "讀故事" phase opens.
 *
 * Until v5.2 the phase opened "the first story at your level not yet
 * finished". A story only counted as finished after all four stages (read →
 * order → quiz → hunt), so a learner who read it and then skipped or left
 * got the same story — s01 "Where Is My Key?" — every reading day. Nothing
 * in the rule ever moved on.
 *
 * The rule is now driven by what was *opened*, not only by what was
 * finished, and has an explicit order:
 *
 *   0. Same day → same story. Coming back to the phase after leaving it
 *      continues the story already started instead of handing out another.
 *   1. Never a story opened in the last MIN_GAP days.
 *   2. A planned re-read: finished once with fewer than 3 stars, first read
 *      REREAD_MIN–REREAD_MAX days ago. Repeated reading of the same text at an
 *      interval is what the result screen already promises ("隔幾天再讀一次").
 *      Each story gets one planned re-read.
 *   3. A story never opened, at or below the learner's level.
 *   4. A story opened but never finished (they left early) — a second chance.
 *   5. A story never opened, one level up.
 *   6. Otherwise the least recently opened story at or below level + 1.
 *
 * Pure function: the view owns storage, this owns the decision, and
 * scripts/test-story-plan.mjs simulates months of use against it.
 */

export const MIN_GAP = 3
export const REREAD_MIN = 5
export const REREAD_MAX = 14

const DAY = 86400000
const gap = (a, b) => (a && b) ? Math.round((Date.parse(a) - Date.parse(b)) / DAY) : Infinity

/**
 * @param {{
 *   day: string,                         // 'YYYY-MM-DD'
 *   stories: Array<{id:string, level:number}>,
 *   level: number,                       // learner level 1..3
 *   stars?: Record<string, number>,      // best stars per finished story
 *   log?: Record<string, {first?:string, last?:string, opens?:number, finishes?:number}>
 * }} input
 * @returns {{ story: object, reason: 'today'|'reread'|'new'|'unfinished'|'stretch'|'oldest' }}
 */
export function planStory ({ day, stories, level, stars = {}, log = {} }) {
  if (!stories?.length) return { story: null, reason: 'oldest' }
  const L = id => log[id] || {}
  const last = id => L(id).last || ''

  // 0. continuity within the day
  const today = stories.find(s => last(s.id) === day)
  if (today) return { story: today, reason: 'today' }

  const rested = stories.filter(s => gap(day, last(s.id)) >= MIN_GAP)
  const pool = rested.length ? rested : stories
  const opened = s => (L(s.id).opens || 0) > 0 || stars[s.id] >= 1
  const byOldest = (a, b) => last(a.id).localeCompare(last(b.id)) || a.level - b.level

  // 2. planned re-read
  const reread = pool.filter(s => {
    const e = L(s.id)
    const g = gap(day, e.first || e.last)
    return stars[s.id] >= 1 && stars[s.id] < 3 && (e.finishes || 0) < 2 &&
      g >= REREAD_MIN && g <= REREAD_MAX
  }).sort(byOldest)
  if (reread.length) return { story: reread[0], reason: 'reread' }

  // 3. new, at level
  const fresh = pool.filter(s => s.level <= level && !opened(s))
  if (fresh.length) return { story: fresh[0], reason: 'new' }

  // 4. started, never finished
  const unfinished = pool.filter(s => s.level <= level + 1 && opened(s) && !(stars[s.id] >= 1)).sort(byOldest)
  if (unfinished.length) return { story: unfinished[0], reason: 'unfinished' }

  // 5. new, one level up
  const stretch = pool.filter(s => s.level === level + 1 && !opened(s))
  if (stretch.length) return { story: stretch[0], reason: 'stretch' }

  // 6. least recently opened
  const near = pool.filter(s => s.level <= level + 1)
  return { story: [...(near.length ? near : pool)].sort(byOldest)[0], reason: 'oldest' }
}

/** Record that a story was opened on `day`. Returns a new log object. */
export function logOpen (log, id, day) {
  const e = log[id] || {}
  if (e.last === day) return log
  return { ...log, [id]: { ...e, first: e.first || day, last: day, opens: (e.opens || 0) + 1 } }
}

/** Record that a story was finished on `day`. Returns a new log object. */
export function logFinish (log, id, day) {
  const e = log[id] || {}
  return { ...log, [id]: { ...e, first: e.first || day, last: day, opens: Math.max(1, e.opens || 0), finishes: (e.finishes || 0) + 1 } }
}
