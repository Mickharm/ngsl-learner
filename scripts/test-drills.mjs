/**
 * Generated-drill validation, tested offline.
 *
 * Models return drills that are nearly right: a choice with three options, an
 * order drill whose tokens cannot spell its own answer, a "correct" whose
 * wrong and right sentences are identical. Any of those reaching the learner
 * is worse than one fewer question, so normalizeDrill() drops them.
 *
 *   npm run test:drills
 */
const here = new URL('../src/lib/gemini.js', import.meta.url)

function stubReturning (payload) {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }]
    })
  })
}

const { generateDrills } = await import(here)

const GOOD_CHOICE = {
  type: 'choice', q: 'The store opens _____ 9 a.m.',
  options: ['at', 'on', 'in', 'by'], answerIndex: 0, explain: '幾點用 at。'
}
const GOOD_CORRECT = {
  type: 'correct', wrong: 'She go to work by bus.',
  answer: 'She goes to work by bus.', explain: '第三人稱單數要加 s。'
}
const GOOD_ORDER = {
  type: 'order', tokens: ['we', 'left', 'the', 'office', 'early'],
  answer: 'We left the office early.', zh: '我們提早離開辦公室。', explain: '主詞在動詞前。'
}

const cases = [
  ['keeps a well-formed choice', [GOOD_CHOICE], 1],
  ['keeps a well-formed correct', [GOOD_CORRECT], 1],
  ['keeps a well-formed order', [GOOD_ORDER], 1],

  ['drops a choice with 3 options', [{ ...GOOD_CHOICE, options: ['at', 'on', 'in'] }], 0],
  ['drops a choice with a duplicate option', [{ ...GOOD_CHOICE, options: ['at', 'at', 'in', 'by'] }], 0],
  ['drops a choice with answerIndex out of range', [{ ...GOOD_CHOICE, answerIndex: 7 }], 0],
  ['drops a choice with no blank in the question', [{ ...GOOD_CHOICE, q: 'The store opens at 9 a.m.' }], 0],

  ['drops a correct whose wrong == answer', [{ ...GOOD_CORRECT, wrong: GOOD_CORRECT.answer }], 0],
  ['drops a correct missing the wrong sentence', [{ ...GOOD_CORRECT, wrong: '' }], 0],

  ['drops an order whose tokens cannot spell the answer',
    [{ ...GOOD_ORDER, tokens: ['we', 'left', 'the', 'office'] }], 0],
  ['drops an order with too few tokens', [{ ...GOOD_ORDER, tokens: ['we', 'left'], answer: 'We left' }], 0],
  ['accepts an order despite punctuation in tokens',
    [{ ...GOOD_ORDER, tokens: ['we', 'left', 'the', 'office', 'early.'] }], 1],

  ['drops an unknown type', [{ type: 'essay', explain: 'x' }], 0],
  ['drops junk entries', [null, 'nope', 42], 0],

  ['keeps the good ones out of a mixed batch',
    [GOOD_CHOICE, { ...GOOD_CHOICE, options: ['a', 'b'] }, GOOD_ORDER, { type: 'essay' }, GOOD_CORRECT], 3]
]

let fail = 0
for (const [label, payload, want] of cases) {
  stubReturning(payload)
  let got
  try {
    got = (await generateDrills({ topic: 't', key: 'k' })).length
  } catch (e) {
    got = `threw: ${e.message}`
  }
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  → want ${want}, got ${got}`}`)
}

// a kept choice must carry the fields the runner reads
stubReturning([GOOD_CHOICE])
const [d] = await generateDrills({ topic: 't', key: 'k' })
const shapeOk = d.type === 'choice' && Array.isArray(d.options) && d.options.length === 4 &&
  Number.isInteger(d.answer) && d.generated === true
console.log(`${shapeOk ? 'PASS' : 'FAIL'}  kept drill matches the runner's expected shape`)
if (!shapeOk) fail++

console.log(fail ? `\n${fail} FAILURE(S)` : '\nall passed')
process.exit(fail ? 1 : 0)
