/**
 * Confusions: which word was taken for which, and a drill that sets the two
 * against each other. Pure.
 *
 * A wrong answer in a choice task is not just "wrong" — the learner picked a
 * specific other word, and that pick is the most useful thing the app learns
 * all day. require / request, quite / quiet, affect / effect: a pair like that
 * is not two weak words, it is one unlearned distinction, and reviewing each
 * word on its own schedule (which is all the scheduler can do) never puts the
 * two side by side. Until v6.1 the pick was shown once ("你的答案") and thrown
 * away.
 *
 * The ledger keeps every pick as a directed count (target → chosen). The
 * drill takes the strongest pairs and asks only questions whose two options
 * are those two words, alternating which one is the answer, so the only way
 * through is to tell them apart (contrastive, interleaved practice). Two
 * clean rounds on a pair retire it.
 */

const DAY = 86400000
const key = (a, b) => `${a}|${b}`

/** Record that `chosenId` was picked when `targetId` was the answer. */
export function recordConfusion (ledger, targetId, chosenId, now = Date.now()) {
  const a = Number(targetId), b = Number(chosenId)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b || a <= 0 || b <= 0) return ledger || {}
  const k = key(a, b)
  const prev = ledger?.[k]
  return { ...(ledger || {}), [k]: { n: (prev?.n || 0) + 1, last: now, clean: 0 } }
}

/**
 * The pairs worth drilling, strongest first. Both directions of a pair are
 * merged (A taken for B and B taken for A are the same missing distinction),
 * and old picks fade: a pair confused once two months ago is not a problem
 * any more.
 */
export function topConfusions (ledger, { now = Date.now(), limit = 12, halfLifeDays = 30 } = {}) {
  const pairs = new Map()
  for (const [k, v] of Object.entries(ledger || {})) {
    const [a, b] = k.split('|').map(Number)
    if (!a || !b || !v?.n) continue
    const lo = Math.min(a, b), hi = Math.max(a, b)
    const age = Math.max(0, (now - (v.last || now)) / DAY)
    const score = v.n * Math.pow(0.5, age / halfLifeDays)
    const p = pairs.get(key(lo, hi)) || { a: lo, b: hi, n: 0, score: 0, last: 0 }
    p.n += v.n; p.score += score; p.last = Math.max(p.last, v.last || 0)
    pairs.set(key(lo, hi), p)
  }
  return [...pairs.values()]
    .filter(p => p.score >= 0.35)
    .sort((x, y) => y.score - x.score || y.last - x.last)
    .slice(0, limit)
}

/** Edit distance with adjacent swaps counted once (quite / quiet = 1). */
export function editDistance (s, t) {
  const a = String(s || ''), b = String(t || '')
  const m = a.length, n = b.length
  if (!m || !n) return m + n
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[m][n]
}

/**
 * Do two headwords look alike on the page? affect / effect, quite / quiet,
 * require / request, through / though. One slip between such a pair is
 * already evidence; one slip between "other" and "general" is a stray tap.
 */
export function lookAlike (h1, h2) {
  const a = String(h1 || '').toLowerCase().trim(), b = String(h2 || '').toLowerCase().trim()
  if (!a || !b || a === b) return false
  const short = Math.min(a.length, b.length)
  if (short < 3) return false
  const dist = editDistance(a, b)
  if (dist <= 1) return true
  if (dist === 2 && short >= 5) return true
  let p = 0
  while (p < short && a[p] === b[p]) p++
  return p >= 4 && short >= 6 && Math.abs(a.length - b.length) <= 3
}

/**
 * Is this pair a real confusion, or noise? Four options and a hurried thumb
 * produce wrong picks that mean nothing, and a notebook full of them hides
 * the pairs that matter. A pair is kept when it has been confused twice (in
 * either direction), or once when the two words look alike.
 */
export function isRealConfusion (pair, wa, wb) {
  if (!pair) return false
  if ((pair.n || 0) >= 2) return true
  return lookAlike(wa?.headword, wb?.headword)
}

/**
 * The pair was told apart cleanly in a drill round. The second clean round
 * retires it (both directions); a new confusion starts it again from zero.
 */
export function settleConfusion (ledger, a, b) {
  const out = { ...(ledger || {}) }
  const ks = [key(a, b), key(b, a)].filter(k => out[k])
  if (!ks.length) return out
  const clean = Math.max(...ks.map(k => out[k].clean || 0)) + 1
  for (const k of ks) {
    if (clean >= 2) delete out[k]
    else out[k] = { ...out[k], clean }
  }
  return out
}

/** Keep the ledger small: drop faded entries, cap the rest. */
export function pruneConfusions (ledger, { now = Date.now(), max = 300, maxAgeDays = 120 } = {}) {
  const live = Object.entries(ledger || {}).filter(([, v]) => v?.n && now - (v.last || 0) < maxAgeDays * DAY)
  live.sort((x, y) => (y[1].last || 0) - (x[1].last || 0))
  return Object.fromEntries(live.slice(0, max))
}

const gloss = w => {
  const zh = w?.meanings?.[0]?.zh || ''
  return zh.replace(/[（(][^）)]*[）)]/g, '').split(/[;；，,、/]/)[0].trim() || zh
}

function gapOf (word) {
  const head = String(word?.headword || '').toLowerCase()
  const forms = new Set([head, ...(word?.family || []).map(f => String(f).toLowerCase())])
  for (const ex of word?.examples || []) {
    if (!ex?.en) continue
    const m = [...ex.en.matchAll(/[A-Za-z']+/g)].find(t => forms.has(t[0].toLowerCase()))
    if (m) return { before: ex.en.slice(0, m.index), after: ex.en.slice(m.index + m[0].length), zh: ex.zh || '', surface: m[0] }
  }
  return null
}

function rand (seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Drill items for one pair of words. Every item has exactly two options —
 * the two words (or their two meanings) — and the answer alternates, so no
 * item can be answered without discriminating.
 *
 *   zh→word   one meaning shown, pick which word it is
 *   word→zh   one word shown (and spoken), pick which meaning
 *   gap       that word's own sentence with a blank, pick which word fits
 *
 * Returns [] when the pair cannot be drilled fairly (no meaning yet, or the
 * two short glosses are the same so no question has one right answer).
 */
export function contrastItems (wa, wb, seed = 1) {
  const ga = gloss(wa), gb = gloss(wb)
  if (!wa || !wb || !ga || !gb || ga === gb || ga.includes(gb) || gb.includes(ga)) return []
  if (String(wa.headword).toLowerCase() === String(wb.headword).toLowerCase()) return []
  const r = rand(seed)
  const two = (x, y) => (r() < 0.5 ? [x, y] : [y, x])
  const items = []
  const make = (target, other) => {
    const out = []
    const w = two({ id: target.id, text: target.headword }, { id: other.id, text: other.headword })
    out.push({
      kind: 'zh→word', targetId: target.id, otherId: other.id,
      prompt: gloss(target), options: w, answer: w.findIndex(o => o.id === target.id), say: ''
    })
    const z = two({ id: target.id, text: gloss(target) }, { id: other.id, text: gloss(other) })
    out.push({
      kind: 'word→zh', targetId: target.id, otherId: other.id,
      prompt: target.headword, options: z, answer: z.findIndex(o => o.id === target.id), say: target.headword
    })
    const g = gapOf(target)
    if (g) {
      const s = two({ id: target.id, text: target.headword }, { id: other.id, text: other.headword })
      out.push({
        kind: 'gap', targetId: target.id, otherId: other.id,
        prompt: `${g.before}＿＿＿${g.after}`, zh: g.zh, full: `${g.before}${g.surface}${g.after}`,
        options: s, answer: s.findIndex(o => o.id === target.id), say: ''
      })
    }
    return out
  }
  const A = make(wa, wb), B = make(wb, wa)
  // interleave A, B, A, B … so the answer changes side every time
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i]) items.push(A[i])
    if (B[i]) items.push(B[i])
  }
  return items
}

/** A whole drill: the top pairs, their items, pair by pair. */
export function contrastRound (pairs, wordOf, { maxPairs = 5, seed = 1 } = {}) {
  const out = []
  for (const p of pairs) {
    if (out.length >= maxPairs) break
    const items = contrastItems(wordOf(p.a), wordOf(p.b), seed + p.a * 31 + p.b)
    if (items.length >= 2) out.push({ a: p.a, b: p.b, n: p.n, items })
  }
  return out
}
