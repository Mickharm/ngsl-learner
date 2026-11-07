/**
 * The daily story rotation never serves the same story on back-to-back
 * reading days, whatever the learner does with it.
 *
 * Regression: v5.2 opened "first unfinished story at level", and a story only
 * counted as finished after all four stages — so read-then-skip gave s01
 * every reading day. The simulations below cover the three behaviours that
 * matter: always finish, always skip after reading, and a random mix.
 */
import assert from 'node:assert/strict'
import STORIES from '../src/data/stories.js'
import { planStory, logOpen, logFinish, MIN_GAP, REREAD_MIN, REREAD_MAX } from '../src/lib/storyPlan.js'

let n = 0
const ok = (c, m) => { assert.ok(c, m); n++ }
const DAY = 86400000
const dayOf = i => new Date(Date.UTC(2026, 10, 1) + i * DAY).toISOString().slice(0, 10)
const gap = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / DAY)

function rng (seed) { let x = seed >>> 0 || 1; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32) }

/**
 * Reading happens every other day (A days). `behave(story)` returns
 * 'finish' with stars, or 'skip' (opened, read, left).
 */
function simulate ({ days = 180, level = 1, behave, every = 2 }) {
  let stars = {}; let log = {}; const served = []
  for (let i = 0; i < days; i += every) {
    const day = dayOf(i)
    const { story, reason } = planStory({ day, stories: STORIES, level, stars, log })
    ok(story, `a story is always picked (${day})`)
    // re-entering the phase the same day gives the same story
    log = logOpen(log, story.id, day)
    const again = planStory({ day, stories: STORIES, level, stars, log })
    ok(again.story.id === story.id && again.reason === 'today', `same day keeps ${story.id}`)
    const r = behave(story, i)
    if (r.finish) {
      stars = { ...stars, [story.id]: Math.max(stars[story.id] || 0, r.stars) }
      log = logFinish(log, story.id, day)
    }
    served.push({ day, id: story.id, reason, level: story.level })
  }
  return served
}

function checkSpacing (served, label) {
  for (let k = 1; k < served.length; k++) {
    const prev = served.filter((s, j) => j < k && s.id === served[k].id).pop()
    if (prev) ok(gap(served[k].day, prev.day) >= MIN_GAP, `${label}: ${served[k].id} back after ${gap(served[k].day, prev.day)} d`)
  }
  for (let k = 1; k < served.length; k++) ok(served[k].id !== served[k - 1].id, `${label}: consecutive repeat ${served[k].id} on ${served[k].day}`)
}

// 1. the reported case — read, then skip, every time
{
  const s = simulate({ behave: () => ({ finish: false }) })
  checkSpacing(s, 'skip')
  const first3 = new Set(s.slice(0, 3).map(x => x.id))
  ok(first3.size === 3, `skip: first three reading days are three different stories (${[...first3]})`)
}

// 2. always finish, mid stars → planned re-reads appear inside the window, once each
{
  const s = simulate({ behave: () => ({ finish: true, stars: 2 }) })
  checkSpacing(s, 'finish2')
  const rereads = s.filter(x => x.reason === 'reread')
  ok(rereads.length > 0, 'finish2: planned re-reads happen')
  for (const r of rereads) {
    const firstSeen = s.find(x => x.id === r.id)
    const g = gap(r.day, firstSeen.day)
    ok(g >= REREAD_MIN && g <= REREAD_MAX, `finish2: re-read of ${r.id} after ${g} d`)
    ok(rereads.filter(x => x.id === r.id).length === 1, `finish2: ${r.id} re-read only once`)
  }
}

// 3. three stars → never a planned re-read
{
  const s = simulate({ behave: () => ({ finish: true, stars: 3 }) })
  checkSpacing(s, 'finish3')
  ok(!s.some(x => x.reason === 'reread'), 'finish3: no re-read for a perfect story')
}

// 4. random behaviour, three levels, daily and every-other-day
for (let seed = 1; seed <= 40; seed++) {
  const r = rng(seed)
  for (const level of [1, 2, 3]) {
    const s = simulate({
      level, every: 1 + (seed % 2), days: 120,
      behave: () => r() < 0.5 ? { finish: false } : { finish: true, stars: 1 + Math.floor(r() * 3) }
    })
    checkSpacing(s, `rand${seed}/L${level}`)
    ok(s.every(x => x.level <= level + 1), `rand${seed}/L${level}: never two levels above`)
  }
}

// 5. legacy data: s01 finished before the log existed → not served first
{
  const { story } = planStory({ day: dayOf(0), stories: STORIES, level: 1, stars: { s01: 1 }, log: {} })
  ok(story.id !== 's01', `legacy: finished s01 is not served again first (got ${story.id})`)
}

console.log(`story-plan: ${n} checks passed`)
