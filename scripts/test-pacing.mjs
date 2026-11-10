/**
 * Pacing (src/lib/pacing.js): measured retention and the new-word governor.
 *   node scripts/test-pacing.mjs
 */
import { measuredRetention, paceToday, PACE } from '../src/lib/pacing.js'

let pass = 0, fail = 0
const ok = (c, label, detail = '') => { if (c) pass++; else { fail++; console.log(`FAIL ${label}${detail ? '  → ' + detail : ''}`) } }

const NOW = Date.parse('2026-11-10T12:00:00+08:00')
const DAY = 86400000
const row = (daysAgo, grade, mode = 'meaning') => ({ grade, mode, reviewed_at: new Date(NOW - daysAgo * DAY).toISOString() })

/* ---- measured retention ---- */
{
  const r = measuredRetention([], { now: NOW })
  ok(r.n === 0 && r.retention === null, 'no reviews → no number, not 0% and not 100%')

  // grades are lib/srs.js GRADE: AGAIN 0, HARD 1, GOOD 2, EASY 3
  // 30 reviews, 24 recalled, 6 forgotten
  const rows = [...Array(24)].map((_, i) => row(i % 10, i % 2 ? 3 : 2)).concat([...Array(6)].map((_, i) => row(i, 0)))
  const m = measuredRetention(rows, { now: NOW, days: 30 })
  ok(m.n === 30 && Math.abs(m.retention - 0.8) < 1e-9, 'retention = recalled / reviewed', JSON.stringify(m))

  // HARD counts as recalled (slow is not forgotten); AGAIN does not
  ok(measuredRetention([...Array(20)].map(() => row(1, 1)), { now: NOW }).retention === 1, 'HARD — a slow correct answer — is still a recalled word')
  ok(measuredRetention([...Array(20)].map(() => row(1, 0)), { now: NOW }).retention === 0, 'AGAIN is a forgotten word')

  // the same-sitting recall that ends Word Lab is practice, not retention
  const lab = [...Array(40)].map(() => row(1, 3, 'learn'))
  ok(measuredRetention(lab, { now: NOW }).n === 0, 'Word Lab recall (mode learn) is not counted')
  const mixed = measuredRetention([...lab, ...[...Array(20)].map(() => row(2, 0, 'spell'))], { now: NOW })
  ok(mixed.n === 20 && mixed.retention === 0, 'and cannot hide a bad week of real reviews', JSON.stringify(mixed))

  // window
  const old = [...Array(25)].map(() => row(40, 3))
  ok(measuredRetention(old, { now: NOW, days: 30 }).n === 0, 'reviews outside the window are ignored')
  ok(measuredRetention(old, { now: NOW, days: 60 }).n === 25, 'and counted when the window covers them')

  // small samples give no percentage
  ok(measuredRetention([...Array(19)].map(() => row(1, 3)), { now: NOW }).retention === null, '19 reviews is below the sample floor')
  ok(measuredRetention([...Array(20)].map(() => row(1, 3)), { now: NOW }).retention === 1, '20 is enough')

  // per task
  const byTask = measuredRetention([
    ...[...Array(10)].map(() => row(1, 3, 'meaning')),
    ...[...Array(10)].map((_, i) => row(1, i < 4 ? 3 : 0, 'spell')),
    ...[...Array(3)].map(() => row(1, 0, 'cloze'))
  ], { now: NOW })
  ok(byTask.byMode.meaning.retention === 1 && Math.abs(byTask.byMode.spell.retention - 0.4) < 1e-9, 'retention is reported per task')
  ok(byTask.byMode.cloze.retention === null && byTask.byMode.cloze.n === 3, 'a task with three answers shows its count but no percentage')

  // junk rows do not throw or count
  ok(measuredRetention([null, {}, { grade: 'x', reviewed_at: 'nope' }, { grade: 3, reviewed_at: 'nope' }], { now: NOW }).n === 0, 'malformed rows are skipped')
  // numeric timestamps (rows added locally before the server echoes them)
  ok(measuredRetention([...Array(20)].map(() => ({ grade: 3, mode: 'recall', reviewed_at: NOW - 1000 })), { now: NOW }).n === 20, 'ms timestamps are accepted')
}

/* ---- the governor ---- */
{
  const base = { newPerDay: 8, reviewCap: 60 }
  const p = a => paceToday({ ...base, ...a })

  ok(p({ dueCount: 0 }).count === 8 && p({ dueCount: 0 }).reason === 'ok', 'nothing wrong → the setting is used')
  ok(p({ dueCount: 60 }).count === 8, 'a full day of reviews is not a backlog')
  ok(p({ dueCount: 61 }).count === 4 && p({ dueCount: 61 }).reason === 'backlog', 'one over the cap halves the new words')
  ok(p({ dueCount: 90 }).count === 4, 'still half at 1.5x')
  ok(p({ dueCount: 91 }).count === 0, 'past 1.5x the cap: no new words')
  ok(/不加新字/.test(p({ dueCount: 91 }).note), 'and the note says why', p({ dueCount: 91 }).note)

  ok(p({ dueCount: 10, retention: 0.6, sample: 30 }).count === 4 && p({ dueCount: 10, retention: 0.6, sample: 30 }).reason === 'retention', 'a retention slump halves')
  ok(p({ dueCount: 10, retention: 0.45, sample: 30 }).count === 2, 'a deep slump quarters')
  ok(p({ dueCount: 10, retention: 0.2, sample: 19 }).count === 8, 'but not on a sample too small to trust')
  ok(p({ dueCount: 10, retention: 0.66, sample: 100 }).count === 8, 'and not above the threshold')
  ok(paceToday({ newPerDay: 1, dueCount: 0, reviewCap: 60, retention: 0.1, sample: 50 }).count === 1, 'a slump alone never takes the last new word away')

  const both = p({ dueCount: 80, retention: 0.4, sample: 40 })
  ok(both.reason === 'both' && both.count === 2, 'backlog and slump together take the lower of the two', JSON.stringify(both))
  ok(p({ dueCount: 100, retention: 0.4, sample: 40 }).count === 0, 'a hard backlog still wins')

  const ready = p({ dueCount: 5, retention: 0.93, sample: 60 })
  ok(ready.count === 8 && ready.reason === 'ready' && /調高/.test(ready.note), 'doing well is a suggestion, never an automatic increase', JSON.stringify(ready))
  ok(p({ dueCount: 40, retention: 0.93, sample: 60 }).reason === 'ok', 'no suggestion while the queue is more than half a day')
  ok(p({ dueCount: 5, retention: 0.93, sample: 39 }).reason === 'ok', 'nor on a thin sample')

  const off = paceToday({ ...base, dueCount: 500, retention: 0.1, sample: 100, auto: false })
  ok(off.count === 8 && off.reason === 'manual', 'switched off, the governor does nothing')
  ok(paceToday({ newPerDay: 0, dueCount: 0 }).count === 0, 'a setting of zero stays zero')

  // never more than the setting, never negative, always an integer — for every combination
  for (const n of [1, 2, 3, 5, 8, 12, 20]) {
    for (const due of [0, 30, 60, 61, 90, 91, 400]) {
      for (const ret of [null, 0.2, 0.5, 0.64, 0.65, 0.9]) {
        const x = paceToday({ newPerDay: n, dueCount: due, reviewCap: 60, retention: ret, sample: 50 })
        ok(Number.isInteger(x.count) && x.count >= 0 && x.count <= n, 'count is an integer within [0, setting]', `${n}/${due}/${ret} → ${x.count}`)
        ok((x.count < n) === ['backlog', 'retention', 'both'].includes(x.reason), 'a lowered count always carries a reason, and only then', `${n}/${due}/${ret} → ${x.count} ${x.reason}`)
        ok(x.reason === 'ok' ? x.note === '' : true, 'no note when nothing changed')
      }
    }
  }
  ok(PACE.RETENTION_HALF < 0.9, 'the slump threshold is below the scheduler target (a harder task each time lowers measured recall)')
}

console.log(`pacing: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
