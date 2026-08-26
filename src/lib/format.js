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
