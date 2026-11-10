/**
 * The v6.1 audit fixes that are pure functions:
 *   - one scheduled review per word per day (lib/wordsrs.js reviewedToday)
 *   - per-learner keys for browser state, and the one-time carry-over
 *     (lib/userScope.js)
 *   node scripts/test-audit.mjs
 */
import { reviewedToday, sameLocalDay, scheduleWord } from '../src/lib/wordsrs.js'
import { GRADE as G, newCard } from '../src/lib/srs.js'
import { scoped, adopt } from '../src/lib/userScope.js'

let pass = 0, fail = 0
const ok = (c, label, detail = '') => { if (c) pass++; else { fail++; console.log(`FAIL ${label}${detail ? '  → ' + detail : ''}`) } }

/* ---- same local day ---- */
{
  const d = (h, m = 0, day = 10) => new Date(2026, 10, day, h, m).getTime()
  ok(sameLocalDay(d(0, 1), d(23, 59)), 'a minute past midnight and a minute before the next are the same day')
  ok(!sameLocalDay(d(23, 59), d(0, 1, 11)), 'two minutes apart across midnight are different days')
  ok(!sameLocalDay(d(12), new Date(2026, 11, 10, 12).getTime()), 'same day-of-month in another month is a different day')
  ok(!sameLocalDay(d(12), new Date(2027, 10, 10, 12).getTime()), 'and in another year')
}

/* ---- reviewedToday ---- */
{
  const now = new Date(2026, 10, 10, 20, 0).getTime()
  const morning = new Date(2026, 10, 10, 7, 30).getTime()
  const yesterday = new Date(2026, 10, 9, 23, 50).getTime()
  const fresh = newCard(1, morning)

  ok(!reviewedToday(null, now) && !reviewedToday(undefined, now), 'no card → not reviewed')
  ok(!reviewedToday(fresh, now), 'a new word has not had its review')

  // grade it this morning with the real scheduler, then ask again tonight
  const graded = scheduleWord(fresh, G.GOOD, morning, { level: 0 })
  ok(reviewedToday(graded, now), 'a word graded this morning has had today\'s review')
  ok(!reviewedToday(graded, new Date(2026, 10, 11, 0, 5).getTime()), 'and is open again after midnight')
  const failed = scheduleWord(fresh, G.AGAIN, morning, { level: 0 })
  ok(reviewedToday(failed, now), 'a failed review is still the day\'s review (a second one would be massed practice)')

  const old = scheduleWord(fresh, G.GOOD, yesterday, { level: 0 })
  ok(!reviewedToday(old, now), 'ten minutes before midnight yesterday does not count for today')

  // the invariant, end to end: grading twice on one day must leave the first schedule alone
  const guard = (card, grade, at) => (reviewedToday(card, at) ? card : scheduleWord(card, grade, at, { level: 0 }))
  const first = guard(fresh, G.GOOD, morning)
  const second = guard(first, G.AGAIN, now)
  ok(second === first, 'the second grade of a day changes nothing')
  ok(second.dueAt === first.dueAt && second.reps === first.reps && second.lapses === first.lapses, 'not the due date, the count or the lapses')
  const nextDay = guard(second, G.GOOD, new Date(2026, 10, 11, 9, 0).getTime())
  ok(nextDay !== second && nextDay.reps === first.reps + 1, 'the next day it is graded normally')

  // without the guard the same two answers do move the schedule — this is the bug
  const unguarded = scheduleWord(first, G.AGAIN, now, { level: 0 })
  ok(unguarded.dueAt !== first.dueAt, '(without the guard the second answer reschedules the word)')
}

/* ---- per-learner keys ---- */
{
  const store = () => {
    const m = new Map()
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }
  }
  ok(scoped('ngsl.session', 'u1') === 'ngsl.session.u1' && scoped('ngsl.session', 'u2') !== scoped('ngsl.session', 'u1'), 'two learners never share a key')
  ok(scoped('ngsl.session', null) === 'ngsl.session.anon', 'signed out has its own key, not another learner\'s')

  // the learner who used the device last keeps their state
  let s = store()
  s.setItem('ngsl.lastUser', 'dai@ngsl.app'); s.setItem('ngsl.session', '{"day":"2026-11-10","done":{"review":1}}')
  adopt('ngsl.session', 'u-dai', 'dai@ngsl.app', s)
  ok(s.getItem('ngsl.session.u-dai')?.includes('review'), 'the last user of the device keeps their day')
  ok(s.getItem('ngsl.session') === null, 'and the shared key is gone')

  // anyone else starts clean, and the shared key is still removed so it cannot be adopted later
  s = store()
  s.setItem('ngsl.lastUser', 'dai@ngsl.app'); s.setItem('ngsl.session', '{"day":"2026-11-10","done":{"review":1}}')
  adopt('ngsl.session', 'u-xin', 'xin@ngsl.app', s)
  ok(s.getItem('ngsl.session.u-xin') === null, 'another learner does not inherit it')
  ok(s.getItem('ngsl.session') === null, 'and it is removed, so the next person cannot either')

  // never overwrite state the learner already has under their own key
  s = store()
  s.setItem('ngsl.lastUser', 'dai@ngsl.app'); s.setItem('ngsl.session', 'OLD'); s.setItem('ngsl.session.u-dai', 'MINE')
  adopt('ngsl.session', 'u-dai', 'dai@ngsl.app', s)
  ok(s.getItem('ngsl.session.u-dai') === 'MINE', 'existing per-learner state wins over the legacy value')

  // nothing to do
  s = store()
  adopt('ngsl.session', 'u1', 'a@b', s)
  ok(s.m.size === 0, 'no legacy value, nothing written')
  s.setItem('ngsl.session', 'X')
  adopt('ngsl.session', null, null, s)
  ok(s.getItem('ngsl.session') === 'X', 'signed out: the legacy value is left for whoever signs in')
  // a storage that throws (private mode) must not take the app down
  let threw = false
  try { adopt('k', 'u', 'e', { getItem () { throw new Error('denied') }, setItem () {}, removeItem () {} }) } catch { threw = true }
  ok(!threw, 'a storage that throws is tolerated')
}

console.log(`audit: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
