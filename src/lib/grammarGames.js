/**
 * Grammar Studio item builder.
 *
 * Turns a grammar point's six fixed drills plus its Studio items into a varied
 * set of games, and mixes items across points for the interleaved round.
 *
 * Derived game types — no new content needed:
 *
 *   tap    from a `correct` drill whose fix is one changed or one extra word:
 *          the learner taps the wrong word instead of retyping the sentence.
 *          Finding the error IS the skill; retyping was mostly typing.
 *   judge  from a `correct` drill whose fix is bigger: which of the two is right?
 *   sort   ✅ / ❌ — the point's own example sentences mixed with the wrong
 *          versions from its correction drills; judge each quickly.
 *   choice / order  kept as they were.
 *
 * Pure functions, seeded, so a reload shows the same round and the next
 * review shows a different one.
 */
import { shuffle, rng } from './game.js'

const norm = t => String(t).toLowerCase().replace(/[^a-z0-9']/g, '')
const tok = s => String(s).split(/\s+/).filter(Boolean)

/** Classify a correction drill. Returns a tap item, or null when the edit is bigger. */
export function tapFromCorrection (d) {
  const a = tok(d.wrong)
  const b = tok(d.answer)
  if (a.length === b.length) {
    const diff = a.map((t, i) => (norm(t) !== norm(b[i]) ? i : -1)).filter(i => i >= 0)
    if (diff.length === 1) {
      const i = diff[0]
      return { type: 'tap', tokens: a, wrongIndex: i, fix: b[i].replace(/[.,!?]$/, ''), answer: d.answer, explain: d.explain }
    }
    return null
  }
  if (a.length === b.length + 1) {
    for (let i = 0; i < a.length; i++) {
      const rest = [...a.slice(0, i), ...a.slice(i + 1)]
      if (rest.map(norm).join(' ') === b.map(norm).join(' ')) {
        return { type: 'tap', tokens: a, wrongIndex: i, fix: '', answer: d.answer, explain: d.explain }
      }
    }
  }
  return null
}

/** Every original drill of a point as a Studio game item, tagged with its point. */
export function derivedItems (point) {
  const out = []
  for (const d of point.drills || []) {
    if (d.type === 'choice') out.push({ type: 'choice', q: d.q, options: d.options, answer: d.answer, explain: d.explain })
    else if (d.type === 'order') out.push({ type: 'order', tokens: d.tokens, answer: d.answer, zh: d.zh })
    else if (d.type === 'correct') {
      out.push(tapFromCorrection(d) || {
        type: 'judge',
        options: [d.wrong, d.answer],
        answer: 1,
        explain: d.explain
      })
    }
  }
  return out.map(it => ({ ...it, pointId: point.id }))
}

/** ✅/❌ sorting round: correct examples vs the point's known wrong versions. */
export function sortItem (point, seed = 1) {
  const good = (point.examples || []).map(e => ({ s: e.en, ok: true }))
  const bad = (point.drills || []).filter(d => d.type === 'correct').map(d => ({ s: d.wrong, ok: false, fix: d.answer }))
  if (good.length < 2 || bad.length < 1) return null
  const picked = [...shuffle(good, seed).slice(0, 2), ...shuffle(bad, seed + 1).slice(0, 2)]
  return { type: 'sort', cards: shuffle(picked, seed + 2), pointId: point.id }
}

/** Studio (visual) items of a point, tagged. */
export function studioItems (point, studio) {
  return (studio?.[point.id]?.items || []).map(it => ({ ...it, pointId: point.id }))
}

/** Shuffle each item's options and remap its answer, seeded per item. */
export function permuteOptions (item, seed) {
  if (!Array.isArray(item.options) || typeof item.answer !== 'number') return item
  const order = shuffle(item.options.map((_, i) => i), seed)
  return { ...item, options: order.map(i => item.options[i]), answer: order.indexOf(item.answer) }
}

/**
 * Practice for one point — the blocked round right after it is taught.
 * Visual / meaning items first (input before output), then derived drills,
 * capped at `n`, with types spread out.
 */
export function practiceRound (point, studio, seed = 1, n = 7) {
  const visual = shuffle(studioItems(point, studio), seed)
  const derived = shuffle(derivedItems(point), seed + 5)
  const sorted = sortItem(point, seed + 9)
  const pool = [...visual.slice(0, 3), ...(sorted ? [sorted] : []), ...derived]
  return spreadTypes(pool.slice(0, n), seed).map((it, i) => permuteOptions(it, seed * 97 + i))
}

/**
 * The interleaved round. Items come from every learned point; the focus point
 * (today's) gets about a third of them, weak points (low accuracy) are
 * over-sampled, and no two neighbours share a point when it can be avoided.
 *
 * @param {Array}  points     grammar points the learner has already studied
 * @param {string} focusId    today's point (may be new)
 * @param {object} studio     grammar-studio data
 * @param {object} weakness   pointId → 0..1 (1 = always wrong)
 */
export function mixRound (points, focusId, studio, { seed = 1, n = 8, weakness = {} } = {}) {
  if (!points.length) return []
  const r = rng(seed)
  const byPoint = new Map(points.map(p => [p.id, shuffle([...studioItems(p, studio), ...derivedItems(p)], seed + p.order)]))
  const focusN = points.some(p => p.id === focusId) ? Math.max(1, Math.round(n / 3)) : 0
  const others = points.filter(p => p.id !== focusId)

  const picks = []
  const take = id => {
    const list = byPoint.get(id)
    if (list?.length) picks.push(list.shift())
  }
  for (let i = 0; i < focusN; i++) take(focusId)
  // weighted draw over the other points
  for (let guard = 0; picks.length < n && guard < n * 10; guard++) {
    const pool = others.length ? others : points
    const weights = pool.map(p => 1 + 3 * (weakness[p.id] || 0))
    let x = r() * weights.reduce((a, b) => a + b, 0)
    let k = 0
    while (k < pool.length - 1 && x > weights[k]) { x -= weights[k]; k++ }
    take(pool[k].id)
  }
  return noNeighbours(picks, seed).map((it, i) => permuteOptions(it, seed * 131 + i))
}

/** Reorder so equal types are not adjacent when possible. */
function spreadTypes (items, seed) {
  return reorder(shuffle(items, seed), it => it.type)
}
function noNeighbours (items, seed) {
  return reorder(shuffle(items, seed), it => it.pointId)
}
function reorder (items, key) {
  const out = []
  const left = [...items]
  while (left.length) {
    const prev = out.length ? key(out[out.length - 1]) : null
    let i = left.findIndex(it => key(it) !== prev)
    if (i < 0) i = 0
    out.push(left.splice(i, 1)[0])
  }
  return out
}
