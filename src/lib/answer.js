/**
 * Local answer matching for grammar drills.
 *
 * This runs before any API call, and it is worth doing properly: most
 * "wrong" answers that were actually right differed only by a contraction,
 * a capital letter, or a full stop. Catching those here costs nothing, keeps
 * the drill instant, and works offline. Only genuinely different wordings
 * fall through to the model.
 */

const CONTRACTIONS = [
  ["won't", 'will not'], ["can't", 'cannot'], ["shan't", 'shall not'],
  ["n't", ' not'],
  ["'ll", ' will'], ["'re", ' are'], ["'ve", ' have'], ["'d", ' would'],
  ["'m", ' am'],
  ["it's", 'it is'], ["that's", 'that is'], ["there's", 'there is'],
  ["he's", 'he is'], ["she's", 'she is'], ["what's", 'what is'],
  ["who's", 'who is'], ["let's", 'let us']
]

/** Curly quotes and full-width punctuation reach us from phone keyboards. */
function unifyPunctuation (s) {
  return s
    .replace(/[‘’ʼ＇]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[，]/g, ',')
    .replace(/[．。]/g, '.')
    .replace(/[？]/g, '?')
    .replace(/[！]/g, '!')
}

export function normalizeAnswer (input) {
  let s = unifyPunctuation(String(input || '')).toLowerCase().trim()
  // Expand contractions before punctuation is stripped, or "'ll" disappears.
  for (const [from, to] of CONTRACTIONS) s = s.split(from).join(to)
  return s
    .replace(/[.,!?;:"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Exact match after normalisation. */
export function matchesAnswer (learner, reference) {
  const a = normalizeAnswer(learner)
  const b = normalizeAnswer(reference)
  return !!a && a === b
}

/** Word-level edit distance, used to tell a typo from a different sentence. */
export function wordDistance (a, b) {
  const x = normalizeAnswer(a).split(' ').filter(Boolean)
  const y = normalizeAnswer(b).split(' ').filter(Boolean)
  const d = Array.from({ length: x.length + 1 }, (_, i) =>
    Array.from({ length: y.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      d[i][j] = x[i - 1] === y[j - 1]
        ? d[i - 1][j - 1]
        : 1 + Math.min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])
    }
  }
  return d[x.length][y.length]
}

/**
 * Should the model be asked about this answer?
 *
 * No point spending a call on an empty box or on something that shares almost
 * nothing with the reference — that is a wrong answer, not a rephrasing.
 */
export function worthJudging (learner, reference) {
  const a = normalizeAnswer(learner)
  if (a.split(' ').filter(Boolean).length < 2) return false
  const ref = normalizeAnswer(reference).split(' ').filter(Boolean)
  const dist = wordDistance(learner, reference)
  return dist <= Math.max(3, Math.ceil(ref.length * 0.6))
}
