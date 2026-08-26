/**
 * Local answer matching, tested offline.
 *
 * These are the shapes that used to be marked wrong despite being right.
 * npm run test:answer
 */
const here = new URL('../src/lib/answer.js', import.meta.url)
const { matchesAnswer, normalizeAnswer, worthJudging, wordDistance } = await import(here)

const shouldMatch = [
  ["I will wait until you come.", "I'll wait until you come."],
  ["She doesn't like spicy food.", 'She does not like spicy food.'],
  ['he works in taipei', 'He works in Taipei.'],
  ['It is raining outside now', "It's raining outside now."],
  ['They were late', 'They were late.'],
  ['I agree with you', 'I agree with you.'],
  ['We cannot park here', "We can't park here."],
  ["I have finished the report", "I've finished the report."],
  ['The office is closed on Sunday', 'The office is closed on Sunday'],
  ["He won't come today", 'He will not come today.']
]

const shouldNotMatch = [
  ['She like spicy food.', 'She does not like spicy food.'],
  ['I waited until you came.', 'I will wait until you come.'],
  ['', 'He works in Taipei.'],
  ['Taipei he works in', 'He works in Taipei.']
]

let fail = 0
console.log('— should be accepted locally —')
for (const [learner, ref] of shouldMatch) {
  const ok = matchesAnswer(learner, ref)
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  "${learner}"  ==  "${ref}"`)
  if (!ok) console.log(`        normalised: "${normalizeAnswer(learner)}" vs "${normalizeAnswer(ref)}"`)
}

console.log('\n— should NOT match locally —')
for (const [learner, ref] of shouldNotMatch) {
  const ok = !matchesAnswer(learner, ref)
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  "${learner}"  !=  "${ref}"`)
}

console.log('\n— worth asking the model? —')
const judgeCases = [
  ['She do not like spicy food.', 'She does not like spicy food.', true, 'near miss → ask'],
  ['', 'She does not like spicy food.', false, 'empty → do not ask'],
  ['ok', 'She does not like spicy food.', false, 'one word → do not ask'],
  ['The train left the station yesterday morning early', 'She does not like spicy food.', false, 'unrelated → do not ask']
]
for (const [learner, ref, want, label] of judgeCases) {
  const got = worthJudging(learner, ref)
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label} (dist=${wordDistance(learner, ref)})`)
}

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall passed')
process.exit(fail ? 1 : 0)
