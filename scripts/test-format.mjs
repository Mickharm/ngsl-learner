/**
 * Option-label normalisation, tested offline.
 *
 * The model writes "選項2"; the UI shows A/B/C/D. Left alone, a correct
 * explanation points at the wrong thing.  npm run test:format
 */
const here = new URL('../src/lib/format.js', import.meta.url)
const { normalizeOptionRefs } = await import(here)

const cases = [
  ['選項2 說的是昨天的事', '選項 B 說的是昨天的事'],
  ['選項 3 與文章不符', '選項 C 與文章不符'],
  ['選項（4）語意相反', '選項 D 語意相反'],
  ['第2個選項才是正解', '選項 B 才是正解'],
  ['option 1 is wrong', 'option A is wrong'],
  ['選項1、選項3 都錯', '選項 A、選項 C 都錯'],
  ['正解是選項4，因為第2個選項時態錯了', '正解是選項 D，因為選項 B 時態錯了'],
  ['文章第 2 段提到', '文章第 2 段提到'],          // must not touch paragraph numbers
  ['他等了 3 分鐘', '他等了 3 分鐘']                 // must not touch plain numbers
]

let fail = 0
for (const [input, want] of cases) {
  const got = normalizeOptionRefs(input)
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${input}`)
  if (!ok) console.log(`        want: ${want}\n        got : ${got}`)
}
console.log(fail ? `\n${fail} FAILURE(S)` : '\nall passed')
process.exit(fail ? 1 : 0)
