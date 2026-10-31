/**
 * Shared machinery for the word games: seeded shuffles, distractors, tiles.
 *
 * Distractor quality decides whether a multiple-choice game tests memory or
 * tests elimination. Four rules, each from a failure the old recall round had:
 *
 *  - Never two options with the same Chinese gloss or the same picture: the
 *    question becomes unanswerable, and the learner learns to distrust it.
 *  - English distractors look like the answer (same first letter, similar
 *    length, the word's own confusables), so picking by shape alone fails.
 *  - Meaning distractors share the answer's part of speech when possible, so
 *    "a verb among three nouns" cannot give it away.
 *  - Everything is seeded by word id + attempt, so a re-render never reshuffles
 *    the options under the learner's finger, but the next review differs.
 */
import { pictureOf } from '../data/pictures.js'

export function rng (seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle (arr, seed = Date.now()) {
  const out = [...arr]
  const r = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The short Chinese gloss shown on a card: first sense, parentheticals dropped. */
export function glossOf (word) {
  const zh = word?.meanings?.[0]?.zh || ''
  return zh.replace(/[（(][^）)]*[）)]/g, '').split(/[;；，,、/]/)[0].trim() || zh
}

export function posOf (word) {
  return String(word?.meanings?.[0]?.pos || '').replace(/\./g, '').trim()
}

/** Levenshtein, small and bounded — headwords are short. */
export function editDistance (a, b) {
  a = String(a); b = String(b)
  if (a === b) return 0
  const m = a.length; const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  for (let i = 1; i <= m; i++) {
    const cur = [i]
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[n]
}

/**
 * Four meaning options (the answer plus three), each { id, zh, pic, correct }.
 * `pool` is a list of enriched words to draw from.
 */
export function meaningOptions (word, pool, seed = 1, n = 4) {
  const answer = glossOf(word)
  const ansPic = pictureOf(word.headword)
  const pos = posOf(word)
  const usedZh = new Set([answer])
  const usedPic = new Set(ansPic ? [ansPic] : [])
  const cands = shuffle(pool.filter(w => w.id !== word.id && glossOf(w)), seed)
  // same part of speech first, then anything
  cands.sort((a, b) => (posOf(b) === pos) - (posOf(a) === pos))
  const picks = []
  for (const c of cands) {
    if (picks.length >= n - 1) break
    const zh = glossOf(c)
    const pic = pictureOf(c.headword)
    if (usedZh.has(zh) || (pic && usedPic.has(pic))) continue
    // A gloss that contains the answer (or vice versa) is a near-synonym — unfair.
    if (zh.includes(answer) || answer.includes(zh)) continue
    usedZh.add(zh); if (pic) usedPic.add(pic)
    picks.push({ id: c.id, zh, pic, correct: false })
  }
  return shuffle([{ id: word.id, zh: answer, pic: ansPic, correct: true }, ...picks], seed * 7 + 3)
}

/**
 * Four English options for a picture/meaning prompt, { id, text, correct }.
 * Look-alikes first: the word's own confusables, then pool words that share a
 * first letter and are within two edits or close in length.
 */
export function wordOptions (word, pool, seed = 1, n = 4) {
  const head = word.headword
  const answerZh = glossOf(word)
  const used = new Set([head.toLowerCase()])
  const out = []
  const push = (text, id = null) => {
    const k = String(text).toLowerCase()
    if (!text || used.has(k) || out.length >= n - 1) return
    used.add(k); out.push({ id, text, correct: false })
  }
  for (const c of word.confusables || []) {
    if (c?.word && /^[a-z' -]+$/i.test(c.word)) push(c.word)
  }
  const scored = pool
    .filter(w => w.id !== word.id && glossOf(w) !== answerZh)
    .map(w => {
      const h = w.headword
      let s = editDistance(h, head)
      if (h[0] === head[0]) s -= 1.5
      s += Math.abs(h.length - head.length) * 0.4
      return { w, s }
    })
    .sort((a, b) => a.s - b.s)
  const near = scored.slice(0, 12)
  for (const { w } of shuffle(near, seed)) push(w.headword, w.id)
  for (const { w } of scored.slice(12)) push(w.headword, w.id)
  return shuffle([{ id: word.id, text: head, correct: true }, ...out], seed * 11 + 5)
}

const DECOYS = 'etaoinsrhlcdmup'

/**
 * Letter tiles for spelling: the word's letters plus two decoys that are not
 * in the word, shuffled. Each tile carries an index so duplicate letters are
 * distinct tiles.
 */
export function letterTiles (headword, seed = 1, decoys = 2) {
  const letters = String(headword).toLowerCase().split('')
  const extra = []
  const r = rng(seed)
  for (let i = 0; i < 40 && extra.length < decoys; i++) {
    const ch = DECOYS[Math.floor(r() * DECOYS.length)]
    if (!letters.includes(ch) && !extra.includes(ch)) extra.push(ch)
  }
  return shuffle([...letters, ...extra].map((ch, i) => ({ ch, key: `${ch}${i}` })), seed + 17)
}

/** Strip punctuation/case for comparing a typed answer to the target. */
export function sameWord (a, b) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z']/g, '')
  return norm(a) === norm(b) && norm(a).length > 0
}

/**
 * Pairs for the matching game: up to n words with a picture or gloss, no two
 * sharing a picture or gloss on the left side.
 */
export function matchPairs (words, seed = 1, n = 5) {
  const usedL = new Set()
  const out = []
  for (const w of shuffle(words, seed)) {
    if (out.length >= n) break
    const pic = pictureOf(w.headword)
    const zh = glossOf(w)
    if (!zh) continue
    const key = `${pic}|${zh}`
    if (usedL.has(pic) || usedL.has(zh) || usedL.has(key)) continue
    if (pic) usedL.add(pic)
    usedL.add(zh)
    out.push({ id: w.id, left: { pic, zh }, right: w.headword })
  }
  return out
}
