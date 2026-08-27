/**
 * Deterministic drill variation.
 *
 * A concept point ships a fixed bank of six drills. Meeting it again means
 * meeting the same six questions in the same order with the correct answer in
 * the same slot — which is not a review, it is a memory test of the page
 * layout. Reviewing then feels identical to the first pass, which is precisely
 * what "第一天與第二天完全相同" describes.
 *
 * Varying it needs no model call: shuffle the order, and shuffle each
 * multiple-choice option list while remapping the answer index. Seeded by the
 * repetition count so the same review is stable across a reload but the next
 * review differs.
 */

/** Mulberry32 — small, fast, good enough for shuffling six items. */
function rng (seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleSeeded (arr, seed) {
  const out = [...arr]
  const rand = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * A varied view of a drill bank.
 *
 * @param {Array} drills  the point's fixed drills
 * @param {number} seed   0 keeps the original order (a first encounter should
 *                        run in the order the author wrote it)
 */
export function variedDrills (drills, seed = 0) {
  if (!Array.isArray(drills) || !drills.length || !seed) return drills || []

  return shuffleSeeded(drills, seed).map((d, n) => {
    if (d?.type !== 'choice' || !Array.isArray(d.options)) return d
    const order = shuffleSeeded(d.options.map((_, i) => i), seed * 31 + n)
    return {
      ...d,
      options: order.map(i => d.options[i]),
      answer: order.indexOf(d.answer)
    }
  })
}
