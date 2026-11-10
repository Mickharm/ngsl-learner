/**
 * 應答聽力: the item bank (src/data/part2.js), round selection and layout
 * (src/lib/part2.js), and which words the listening round is about
 * (listenTargets in src/lib/listening.js).
 *   node scripts/test-part2.mjs
 */
import fs from 'node:fs'
import PART2, { KIND_TIP, KIND_LABEL, trapText } from '../src/data/part2.js'
import { tokensOf, coverageOf, recordPart2, missedPart2, selectPart2, layoutPart2, scriptPart2 } from '../src/lib/part2.js'
import { listenTargets } from '../src/lib/listening.js'
import { makeLookup } from '../src/lib/lexicon.js'

let pass = 0, fail = 0
const ok = (c, label, detail = '') => { if (c) pass++; else { fail++; console.log(`FAIL ${label}${detail ? '  → ' + detail : ''}`) } }

const base = JSON.parse(fs.readFileSync(new URL('../src/data/words.base.json', import.meta.url), 'utf8'))
const lookup = makeLookup(base)
const NOW = 1_800_000_000_000
const DAY = 86400000

/* ---- the bank ---- */
const TRAPS = new Set(['wh', 'yesno', 'echo', 'sound', 'tense', 'subject', 'off'])
// Everyday words NGSL leaves to its supplementary lists (numbers, days,
// titles), names, and the travel nouns a beginner meets in the first week.
const BASIC = new Set(`two three four five six seven eight nine ten twenty thirty forty hundred
  monday friday sunday sundays mr ms ok the o'clock a.m p.m
  tokyo taiwan japan lin chen lee tom main
  taxi hotel airport passport restroom platform museum printer heater email
  i'm i'd i'll it's they're he's that's where's who's what's let's you've isn't don't didn't haven't can't
  am`.split(/\s+/))
const RANK_CAP = 1800

const ids = new Set()
const kinds = {}
let total = 0, hard = 0
const hardWords = new Map()
for (const it of PART2) {
  ok(!ids.has(it.id), `duplicate id ${it.id}`); ids.add(it.id)
  ok(KIND_TIP[it.kind] && KIND_LABEL[it.kind], `${it.id} has a known kind`, it.kind)
  kinds[it.kind] = (kinds[it.kind] || 0) + 1
  ok(it.q && it.zh, `${it.id} has a question and its Chinese`)
  ok(Array.isArray(it.right) && it.right[0] && it.right[1], `${it.id} has a right answer with Chinese`)
  ok(it.wrong.length === 2, `${it.id} has exactly two wrong answers (Part 2 has three options)`)
  const texts = [it.right[0], ...it.wrong.map(w => w[0])]
  ok(new Set(texts.map(t => t.toLowerCase())).size === 3, `${it.id} options are distinct`)
  for (const w of it.wrong) {
    ok(w[0] && w[1], `${it.id} wrong answer has English and Chinese`)
    ok(TRAPS.has(w[2]), `${it.id} wrong answer names its trap`, String(w[2]))
    if (w[2] === 'echo' || w[2] === 'sound') ok(!!w[3], `${it.id} ${w[2]} trap names the word`, w[0])
    if (w[2] === 'echo') {
      // the echoed word really is in both the question and the wrong answer
      const cue = w[3].toLowerCase()
      const stem = cue.replace(/(es|s|e)$/, '').slice(0, Math.max(3, cue.length - 2))
      const inQ = it.q.toLowerCase().includes(stem)
      const inA = w[0].toLowerCase().includes(stem) || lookup(cue) && (w[0].match(/[A-Za-z']+/g) || []).some(t => lookup(t) === lookup(cue))
      ok(inQ, `${it.id} echo cue "${w[3]}" is in the question`, it.q)
      ok(inA, `${it.id} echo cue "${w[3]}" is in the wrong answer`, w[0])
    }
    if (w[2] === 'yesno') ok(/^(yes|no)\b/i.test(w[0]), `${it.id} a yes/no trap starts with Yes or No`, w[0])
    if (w[2] === 'subject') ok(/\b(he|she)\b/i.test(w[0]), `${it.id} a subject trap is about he/she`, w[0])
  }
  // a Wh question's right answer never starts with Yes/No; neither does an A-or-B's
  if (['when', 'where', 'who', 'what', 'how', 'choice'].includes(it.kind)) ok(!/^(yes|no)\b/i.test(it.right[0]), `${it.id} right answer does not start with Yes/No`, it.right[0])
  if (it.kind === 'choice') ok(/\bor\b/.test(it.q), `${it.id} is really an A-or-B question`)
  if (it.kind === 'statement') ok(!it.q.trim().endsWith('?'), `${it.id} is a statement`)
  if (['when', 'where', 'who', 'why', 'how'].includes(it.kind)) ok(new RegExp(`^${it.kind}`, 'i').test(it.q), `${it.id} starts with ${it.kind}`, it.q)
  // every sentence ends like a sentence (the speech engine pauses on it)
  for (const t of [it.q, ...texts]) ok(/[.?!]$/.test(t.trim()), `${it.id} sentence is punctuated`, t)
  ok(trapText(it.wrong[0][2], it.wrong[0][3]).length > 4, `${it.id} trap has an explanation`)

  // vocabulary level
  for (const tok of tokensOf(it)) {
    const k = tok.toLowerCase().replace(/’/g, "'")
    total++
    if (BASIC.has(k)) continue
    const id = lookup(k) || lookup(k.split("'")[0])
    if (!id || id > RANK_CAP) { hard++; hardWords.set(k, id || 0) }
  }
}
ok(PART2.length >= 60, 'at least 60 items', String(PART2.length))
ok(Object.keys(kinds).length === Object.keys(KIND_TIP).length, 'every kind has items', JSON.stringify(kinds))
ok(Object.values(kinds).every(n => n >= 4), 'at least four items of each kind', JSON.stringify(kinds))
ok(hard / total <= 0.02, `words outside the first ${RANK_CAP} ranks are at most 2% of what is heard`, `${hard}/${total}: ${[...hardWords].map(([w, r]) => `${w}(${r || 'not NGSL'})`).join(', ')}`)

/* ---- coverage ---- */
{
  const it = PART2[0]
  ok(coverageOf(it, new Set(), lookup) === 0, 'knowing nothing covers nothing')
  const all = new Set(tokensOf(it).map(t => lookup(t.split(/['’]/)[0])).filter(Boolean))
  ok(coverageOf(it, all, lookup) === 1, 'knowing every word covers the item')
  ok(coverageOf({ q: 'Tokyo?', right: ['Tokyo.', ''], wrong: [['Tokyo.', '', 'off'], ['Tokyo.', '', 'off']] }, new Set(), () => null) === 1, 'an item with no NGSL words is fully covered, not divided by zero')
}

/* ---- the record ---- */
{
  let log = {}
  log = recordPart2(log, 'w01', false, NOW)
  ok(log.w01.wrong === 1 && log.w01.lastRight === false, 'a miss is recorded')
  ok(missedPart2(PART2, log).length === 1 && missedPart2(PART2, log)[0].id === 'w01', 'and listed as missed')
  log = recordPart2(log, 'w01', true, NOW + 1)
  ok(log.w01.right === 1 && log.w01.wrong === 1 && log.w01.lastRight, 'getting it right later clears it')
  ok(missedPart2(PART2, log).length === 0, 'so it leaves the missed list')
  const frozen = Object.freeze({})
  ok(recordPart2(frozen, 'x', true, NOW).x.right === 1, 'the record is not mutated')
  ok(recordPart2(undefined, 'x', true, NOW).x.right === 1, 'and can start from nothing')
}

/* ---- selection ---- */
{
  const opt = { lookup, known: new Set(), now: NOW, n: 5, seed: 3 }
  const round = selectPart2(PART2, opt)
  ok(round.length === 5 && new Set(round.map(i => i.id)).size === 5, 'a round has n different items')
  const perKind = {}
  for (const it of round) perKind[it.kind] = (perKind[it.kind] || 0) + 1
  ok(Object.values(perKind).every(c => c <= 2), 'no kind takes more than two places', JSON.stringify(perKind))
  ok(JSON.stringify(selectPart2(PART2, opt).map(i => i.id)) === JSON.stringify(round.map(i => i.id)), 'same seed, same round')
  ok(JSON.stringify(selectPart2(PART2, { ...opt, seed: 4 }).map(i => i.id)) !== JSON.stringify(round.map(i => i.id)), 'another day, another round')

  // items already answered right are not repeated while unheard ones remain
  let log = {}
  for (const it of round) log = recordPart2(log, it.id, true, NOW)
  const second = selectPart2(PART2, { ...opt, log, now: NOW + DAY })
  ok(second.every(it => !log[it.id]), 'unheard items come before ones already answered right')

  // a missed item comes back the next day, not the same hour
  let missed = recordPart2({}, 'h05', false, NOW)
  ok(!selectPart2(PART2, { ...opt, log: missed, now: NOW + 3600_000 }).some(i => i.id === 'h05'), 'a miss is not re-asked within the hour')
  ok(selectPart2(PART2, { ...opt, log: missed, now: NOW + DAY }).some(i => i.id === 'h05'), 'it is re-asked the next day')

  // misses take at most half the round
  let many = {}
  for (const it of PART2.slice(0, 20)) many = recordPart2(many, it.id, false, NOW)
  const mixed = selectPart2(PART2, { ...opt, log: many, now: NOW + DAY, n: 6 })
  const nMissed = mixed.filter(it => many[it.id]).length
  ok(nMissed === 3, 'misses fill at most half of a round', String(nMissed))

  // every item heard and right: the oldest come back
  let done = {}
  PART2.forEach((it, i) => { done = recordPart2(done, it.id, true, NOW + i * 1000) })
  const again = selectPart2(PART2, { ...opt, log: done, now: NOW + 30 * DAY })
  ok(again.length === 5, 'when everything has been heard the round is still full')
  const lastSeen = again.map(it => done[it.id].last)
  ok(Math.max(...lastSeen) < NOW + 20 * 1000, 'and takes the ones heard longest ago', String(lastSeen.map(t => (t - NOW) / 1000)))

  // coverage: with the same seed, an item whose words are known is preferred
  const target = PART2.find(i => i.id === 'a02')
  const knownA02 = new Set(tokensOf(target).map(t => lookup(t.split(/['’]/)[0])).filter(Boolean))
  let hits = 0
  for (let s = 1; s <= 30; s++) if (selectPart2(PART2, { ...opt, known: knownA02, seed: s, n: 4 }).some(i => i.id === 'a02')) hits++
  ok(hits >= 24, 'items whose words the learner knows are chosen first', `${hits}/30`)

  ok(selectPart2(PART2, { ...opt, n: 500 }).length === PART2.length, 'asking for more than there is returns everything once')
  ok(selectPart2([], opt).length === 0, 'an empty bank gives an empty round')
}

/* ---- layout ---- */
{
  const it = PART2.find(i => i.id === 'y02')
  const laid = layoutPart2(it, 5)
  ok(laid.options.length === 3 && laid.options.map(o => o.letter).join('') === 'ABC', 'three options lettered A B C')
  ok(laid.options[laid.answer].correct && laid.options.filter(o => o.correct).length === 1, 'exactly one is right and the index points at it')
  ok(laid.options.filter(o => !o.correct).every(o => o.why.length > 4), 'each wrong option says what the trap was')
  ok(laid.options.find(o => o.en.startsWith('It’s close')).why.includes('close'), 'a sound-alike trap names the word', laid.options.find(o => o.en.startsWith('It’s close')).why)
  ok(laid.tip === KIND_TIP.why, 'the tip is the one for this kind of question')
  const positions = new Set()
  for (let s = 1; s <= 60; s++) positions.add(layoutPart2(it, s).answer)
  ok(positions.size === 3, 'the right answer turns up in every position')
  ok(JSON.stringify(layoutPart2(it, 5)) === JSON.stringify(laid), 'same seed, same layout')

  const script = scriptPart2(laid)
  ok(script.length === 4 && script[0].text === it.q, 'the question is spoken first')
  ok(script.slice(1).every((s, i) => s.text.startsWith(`${'ABC'[i]}. `)), 'then A, B, C, each with its letter')
  ok(script[0].pitch !== script[1].pitch, 'question and responses are told apart by pitch')
}

/* ---- which words the listening round is about ---- */
{
  ok(JSON.stringify(listenTargets({ dayIds: [1, 2, 3], weakIds: [9, 8, 7, 6, 5, 4, 3], want: 6 })) === '[1,2,3,9,8,7]', 'a short day is topped up with the weakest words')
  ok(listenTargets({ dayIds: [], weakIds: [4, 5, 6], want: 10 }).length === 3, 'a day with nothing new or due still has a round')
  ok(JSON.stringify(listenTargets({ missedIds: [7, 8], dayIds: [1, 2], weakIds: [], want: 6 })) === '[7,8,1,2]', 'words missed by ear before come first')
  const big = listenTargets({ missedIds: [...Array(30)].map((_, i) => 100 + i), dayIds: [1, 2, 3, 4], weakIds: [], want: 10 })
  ok(big.filter(id => id >= 100).length === 5 && [1, 2, 3, 4].every(id => big.includes(id)), 'but never crowd out today\'s words', JSON.stringify(big))
  const all = listenTargets({ dayIds: [...Array(25)].map((_, i) => i + 1), weakIds: [99], want: 10 })
  ok(all.length === 25 && !all.includes(99), 'every one of today\'s words is included even past the target')
  ok(new Set(listenTargets({ missedIds: [1, 2], dayIds: [2, 3], weakIds: [3, 4], want: 9 })).size === 4, 'no word twice')
  ok(JSON.stringify(listenTargets({ dayIds: [1, 2, 3], weakIds: [4, 5], want: 5, usable: id => id % 2 === 1 })) === '[1,3,5]', 'words without data yet are left out')
  ok(listenTargets().length === 0, 'no input, no targets')
}

console.log(`part2: ${pass} passed, ${fail} failed (${PART2.length} items, ${total} words heard)`)
process.exit(fail ? 1 : 0)
