/**
 * Listening round construction.
 *
 * Half of a TOEIC score is listening, and this app spent zero minutes on it:
 * fourteen pronunciation buttons, every one of them next to the word already
 * printed on the screen, which trains nothing — the learner reads the word and
 * hears confirmation. Listening only starts when the text is *not* there.
 *
 * So every item here plays audio with the English hidden until the answer is
 * in. Built entirely from data already on the device (headwords, glosses and
 * example sentences), so the phase works offline and costs no API quota.
 *
 * Item shapes, easiest to hardest:
 *   word-zh      hear a word            → pick its Chinese
 *   gap          hear a sentence        → pick the word that filled the blank
 *   sentence-zh  hear a whole sentence  → pick its Chinese
 *   spell        hear a word            → type it
 */

function rng (seed) {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle (arr, rand) {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const glossOf = w => w?.meanings?.[0]?.zh || ''
const exampleOf = w => w?.examples?.find(e => e?.en && e?.zh) || null

/** Distractors have to be plausible but not synonymous with the answer. */
function pickDistractors (pool, exclude, n, rand, valueOf) {
  const want = valueOf(exclude)
  const seen = new Set([want])
  const out = []
  for (const w of shuffle(pool, rand)) {
    if (out.length >= n) break
    if (w.id === exclude.id) continue
    const v = valueOf(w)
    if (!v || seen.has(v)) continue
    // near-duplicate glosses make a question unanswerable, not hard
    if (want && (v.includes(want) || want.includes(v))) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

function optionsFrom (correct, distractors, rand) {
  const opts = shuffle([correct, ...distractors], rand)
  return { options: opts, answer: opts.indexOf(correct) }
}

/**
 * @param {Object[]} dayWords  the words today touched (enriched)
 * @param {Object[]} pool      every enriched word available, for distractors
 * @param {{count?:number, seed?:number}} opts
 */
export function buildListenRound (dayWords, pool, { count = 14, seed = 1 } = {}) {
  const rand = rng(seed)
  const usable = dayWords.filter(w => glossOf(w))
  const distractorPool = (pool.length >= 8 ? pool : usable).filter(w => glossOf(w))
  if (usable.length < 2 || distractorPool.length < 4) return []

  // Sentence-based items need an example; not every word has one yet.
  const withExample = usable.filter(exampleOf)
  const exemplarPool = distractorPool.filter(exampleOf)

  const items = []
  const order = shuffle(usable, rand)

  const makeWordZh = w => {
    const correct = glossOf(w)
    const d = pickDistractors(distractorPool, w, 3, rand, glossOf)
    if (d.length < 3) return null
    return { type: 'word-zh', wordId: w.id, audio: w.headword, reveal: w.headword, ipa: w.ipa, ...optionsFrom(correct, d, rand) }
  }

  const makeSentenceZh = w => {
    const ex = exampleOf(w)
    if (!ex || exemplarPool.length < 4) return null
    const d = pickDistractors(exemplarPool, w, 3, rand, x => exampleOf(x)?.zh || '')
    if (d.length < 3) return null
    return { type: 'sentence-zh', wordId: w.id, audio: ex.en, reveal: ex.en, ...optionsFrom(ex.zh, d, rand) }
  }

  const makeGap = w => {
    const ex = exampleOf(w)
    if (!ex) return null
    // Blank the target word wherever it appears, in any inflected form.
    const re = new RegExp(`\\b${w.headword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i')
    const m = ex.en.match(re)
    if (!m) return null
    const d = pickDistractors(distractorPool, w, 3, rand, x => x.headword)
    if (d.length < 3) return null
    return {
      type: 'gap',
      wordId: w.id,
      audio: ex.en,
      prompt: ex.en.replace(re, '______'),
      reveal: ex.en,
      zh: ex.zh,
      ...optionsFrom(m[0], d, rand)
    }
  }

  const makeSpell = w => ({
    type: 'spell', wordId: w.id, audio: w.headword, reveal: w.headword, answer: w.headword, hint: glossOf(w), ipa: w.ipa
  })

  // Ratio: recognition first, production last. A beginner who cannot yet map
  // sound to meaning gains nothing from being asked to spell.
  const plan = []
  for (let i = 0; i < count; i++) {
    const r = i / Math.max(1, count)
    if (r < 0.4) plan.push(makeWordZh)
    else if (r < 0.65) plan.push(makeGap)
    else if (r < 0.85) plan.push(makeSentenceZh)
    else plan.push(makeSpell)
  }

  let wi = 0
  for (const make of plan) {
    let built = null
    // Walk the word list until one of them can carry this item type.
    for (let tries = 0; tries < order.length && !built; tries++) {
      const w = order[(wi + tries) % order.length]
      built = make(w)
      if (built) wi = (wi + tries + 1) % order.length
    }
    if (!built) {
      const w = order[wi % order.length]
      built = makeWordZh(w)
      wi++
    }
    if (built) items.push(built)
  }

  return items.slice(0, count)
}

/**
 * Which words today's listening round is about.
 *
 * Until v6.1 it was "the words the day touched", which broke at both ends:
 * on a day with nothing new and nothing due the phase was skipped although
 * the learner holds hundreds of words, and on a day with three words the
 * same three were asked fourteen times. And a word missed by ear was logged
 * and never asked again.
 *
 *   1. words missed in listening before and not yet got right, newest first
 *   2. today's words
 *   3. the words whose memory is weakest right now
 *
 * until there are `want` of them. Returns ids, in that priority.
 */
export function listenTargets ({ missedIds = [], dayIds = [], weakIds = [], want = 10, usable = () => true } = {}) {
  const out = []
  const seen = new Set()
  const push = (ids, cap) => {
    for (const id of ids) {
      if (out.length >= cap) return
      if (seen.has(id) || !usable(id)) continue
      seen.add(id); out.push(id)
    }
  }
  push(missedIds, Math.max(2, Math.ceil(want / 2)))   // misses never crowd out today's words
  push(dayIds, Math.max(want, out.length + dayIds.length))
  push(weakIds, want)
  return out
}

export const LISTEN_LABEL = {
  'word-zh': '聽單字',
  gap: '聽句子填字',
  'sentence-zh': '聽整句',
  spell: '聽寫'
}
