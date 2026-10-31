/**
 * Pins the game centre's rules: Wordle scoring (duplicate letters are where
 * hand-rolled versions go wrong), the daily word list, and the falling-word
 * pacing. A game that scores wrongly teaches the learner to distrust it.
 */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { scoreGuess, wordleAnswers, wordleAllowed, dailyAnswer, dayNumber, rainPoints, rainDuration, GAMES } from '../src/lib/arcade.js'
import { builderItem } from '../src/lib/partsGames.js'
import { EXAMPLES } from '../src/data/morphology.js'

const base = JSON.parse(fs.readFileSync(new URL('../src/data/words.base.json', import.meta.url), 'utf8'))
let pass = 0
const eq = (a, b, m) => { assert.deepEqual(a, b, m); pass++ }
const ok = (c, m) => { assert.ok(c, m); pass++ }

/* Wordle scoring */
eq(scoreGuess('apple', 'apple'), ['hit', 'hit', 'hit', 'hit', 'hit'], 'all hits')
eq(scoreGuess('crane', 'hello'), ['miss', 'miss', 'miss', 'miss', 'near'], 'one present letter')
// two l's guessed, answer has two l's in other positions
eq(scoreGuess('allot', 'hello'), ['miss', 'near', 'hit', 'near', 'miss'], 'duplicates counted against the answer')
// three e's guessed, answer has two: the hit first, then only one more may light up
eq(scoreGuess('eerie', 'there'), ['near', 'miss', 'near', 'miss', 'hit'], 'eerie vs there')
eq(scoreGuess('speed', 'abide'), ['miss', 'miss', 'near', 'miss', 'near'], 'one e present, the other is not')
eq(scoreGuess('lever', 'level'), ['hit', 'hit', 'hit', 'hit', 'miss'], 'exact hits take precedence')

/* word lists */
const answers = wordleAnswers(base)
const allowed = wordleAllowed(base)
ok(answers.length >= 150, `enough daily answers (${answers.length})`)
ok(answers.every(w => /^[a-z]{5}$/.test(w)), 'answers are five plain letters')
ok(answers.every(w => allowed.has(w)), 'every answer is an allowed guess')
ok(allowed.size > answers.length, 'inflected forms are accepted as guesses')
const seen = new Set()
for (let d = 0; d < answers.length; d++) seen.add(dailyAnswer(answers, 20000 + d))
ok(seen.size === answers.length, 'the daily word does not repeat until the list runs out')
ok(dailyAnswer(answers, dayNumber()) === dailyAnswer(answers, dayNumber()), 'same day, same word')
ok(dayNumber(Date.parse('2026-10-31T15:59:00Z')) !== dayNumber(Date.parse('2026-10-31T16:01:00Z')), 'turns over at Taipei midnight')

/* rain pacing */
ok(rainDuration(0) > rainDuration(10) && rainDuration(1000) >= 2600, 'falls faster, with a floor')
ok(rainPoints(1000, 1000, 1) > rainPoints(100, 1000, 1), 'faster answers pay more')
ok(rainPoints(500, 1000, 10) === 3 * rainPoints(500, 1000, 1), 'a 10-streak triples points')

/* builder items from every course example */
for (const [i, ex] of EXAMPLES.entries()) {
  if (ex.tiles.some(t => t.kind === 'link')) continue
  const pool = EXAMPLES.filter(e => e.unit === ex.unit)
  const it = builderItem(ex, pool, i + 1)
  ok(it.answer.join('') === ex.w, `${ex.w}: answer spells the word`)
  ok(it.answer.every(p => it.bank.includes(p)), `${ex.w}: bank holds the answer`)
  ok(it.bank.length > it.answer.length, `${ex.w}: bank has decoys`)
}

ok(new Set(GAMES.map(g => g.id)).size === GAMES.length, 'game ids unique')
console.log(`arcade: ${answers.length} daily words, ${allowed.size} accepted guesses — ${pass} checks ok`)
