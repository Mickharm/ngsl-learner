/**
 * 應答聽力 (TOEIC Part 2 shape): choosing items, laying one out, and the
 * per-learner record of what has been answered. Pure — the view only plays
 * audio and collects taps.
 */
import { KIND_TIP, trapText } from '../data/part2.js'

const DAY = 86400000
const LETTERS = ['A', 'B', 'C']

function rng (seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
function shuffle (arr, r) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Every English word an item makes the learner hear. */
export function tokensOf (item) {
  const text = [item.q, item.right[0], ...item.wrong.map(w => w[0])].join(' ')
  return text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || []
}

/**
 * Share of an item's words the learner has met (0..1). `lookup` resolves a
 * surface form to an NGSL id (or null); `known` is a Set of ids. Words the
 * lexicon does not hold — names, numbers, contractions — are not counted
 * either way.
 */
export function coverageOf (item, known, lookup) {
  let total = 0, hit = 0
  for (const t of tokensOf(item)) {
    const id = lookup(t.split(/['’]/)[0])
    if (!id) continue
    total++
    if (known.has(id)) hit++
  }
  return total ? hit / total : 1
}

/** One answer goes into the record. */
export function recordPart2 (log, id, correct, now = Date.now()) {
  const prev = log?.[id] || { right: 0, wrong: 0, last: 0, lastRight: false }
  return {
    ...(log || {}),
    [id]: { right: prev.right + (correct ? 1 : 0), wrong: prev.wrong + (correct ? 0 : 1), last: now, lastRight: !!correct }
  }
}

/** Items last answered wrong: what the error book lists. */
export function missedPart2 (items, log) {
  return items.filter(it => log?.[it.id] && !log[it.id].lastRight)
}

/**
 * Pick a round.
 *
 *   1. items missed last time, once a night has passed — at most half the
 *      round, so a bad day does not become a round of nothing but failures;
 *   2. items never heard, the ones whose words the learner knows best first
 *      (comprehensible input: the point is the question type, not new words);
 *   3. items answered right longest ago.
 *
 * No kind takes more than two places while other kinds are available, so a
 * round is never "five When questions".
 */
export function selectPart2 (items, { log = {}, known = new Set(), lookup = () => null, n = 5, now = Date.now(), seed = 1 } = {}) {
  const r = rng(seed)
  const cov = new Map(items.map(it => [it.id, coverageOf(it, known, lookup)]))
  const missed = shuffle(items.filter(it => log[it.id] && !log[it.id].lastRight && now - log[it.id].last > DAY * 0.6), r)
  const fresh = shuffle(items.filter(it => !log[it.id]), r).sort((a, b) => cov.get(b.id) - cov.get(a.id))
  const old = items.filter(it => log[it.id]?.lastRight).sort((a, b) => log[a.id].last - log[b.id].last)

  const out = []
  const perKind = {}
  const take = (list, max, strict) => {
    for (const it of list) {
      if (out.length >= max) return
      if (out.includes(it)) continue
      if (strict && (perKind[it.kind] || 0) >= 2) continue
      out.push(it); perKind[it.kind] = (perKind[it.kind] || 0) + 1
    }
  }
  take(missed, Math.ceil(n / 2), true)
  take(fresh, n, true)
  take(old, n, true)
  // not enough variety left to honour the two-per-kind rule: fill anyway
  take([...missed, ...fresh, ...old], n, false)
  return shuffle(out, r)
}

/**
 * Lay an item out for one sitting: options in a seeded order with their
 * letters, and the explanation that is shown once the answer is in.
 */
export function layoutPart2 (item, seed = 1) {
  const r = rng(seed)
  const opts = shuffle([
    { en: item.right[0], zh: item.right[1], correct: true, why: '' },
    ...item.wrong.map(w => ({ en: w[0], zh: w[1], correct: false, why: trapText(w[2], w[3]) }))
  ], r).map((o, i) => ({ ...o, letter: LETTERS[i] }))
  return {
    id: item.id,
    kind: item.kind,
    q: item.q,
    zh: item.zh,
    options: opts,
    answer: opts.findIndex(o => o.correct),
    tip: KIND_TIP[item.kind] || ''
  }
}

/**
 * What to say, in order. The question and the responses use the same voice
 * at two pitches: a second voice would be more like the test, but two voices
 * are mastered at different loudness and v5.2.1 pinned one voice per session
 * for exactly that reason.
 */
export function scriptPart2 (laid) {
  return [
    { text: laid.q, pitch: 1, gap: 650 },
    ...laid.options.map(o => ({ text: `${o.letter}. ${o.en}`, pitch: 1.12, gap: 450 }))
  ]
}
