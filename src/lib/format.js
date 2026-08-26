/** Escape then apply the tiny subset of Markdown used in lesson copy. */
export function inlineMd (s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

export function pct (n, digits = 0) {
  if (n == null || Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(digits)}%`
}

export function plural (n, one, many = one) {
  return `${n} ${n === 1 ? one : many}`
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

/** A Han ideograph — used to decide where a Latin label needs breathing room. */
const CJK = '\\u4e00-\\u9fff'

/**
 * Model-written explanations refer to answers as "選項2" while the UI labels
 * them A/B/C/D. The mismatch makes a correct explanation read as a mistake, so
 * rewrite the numbers into the labels the learner is actually looking at.
 *
 * Only option references are touched: paragraph numbers and plain quantities
 * ("文章第 2 段", "等了 3 分鐘") must survive untouched.
 */
export function normalizeOptionRefs (text) {
  if (!text) return text
  const toLetter = n => LETTERS[Number(n) - 1] || n

  const out = String(text)
    // 選項2 / 選項 2 / 選項（2）— the closing bracket is optional but the
    // trailing whitespace is never consumed, or the sentence runs together.
    .replace(/選項\s*(?:[（(]\s*)?([1-6])(?:\s*[)）])?/g, (_, n) => `選項 ${toLetter(n)}`)
    .replace(/第\s*([1-6])\s*個?選項/g, (_, n) => `選項 ${toLetter(n)}`)
    .replace(/答案\s*(?:[（(]\s*)?([1-6])(?:\s*[)）])?(?![0-9])/g, (_, n) => `答案 ${toLetter(n)}`)
    .replace(/\boption\s*([1-6])\b/gi, (_, n) => `option ${toLetter(n)}`)

  // Latin label butting against Han text reads as a typo; space it out.
  return out
    .replace(new RegExp(`([A-F])([${CJK}])`, 'g'), '$1 $2')
    .replace(new RegExp(`([${CJK}])([A-F])(?![a-z])`, 'g'), '$1 $2')
    .replace(/[ \t]{2,}/g, ' ')
}
