/**
 * Pins the picture and chunk tables.
 *
 * A wrong picture is worse than no picture: the learner binds the word to the
 * image, so "be → 🇧🇪" teaches "be" means Belgium. The automatic tag matcher
 * that seeded this table produced exactly those, so the NEVER list below is a
 * record of real false matches that must not creep back in a later edit.
 *
 * v3 cut the table to literal depictions only — a thing or action you could
 * point at. The ABSTRACT list pins words whose emoji was a symbol rather than
 * the word itself (eat → 😋 is a face, not eating) so they stay out.
 */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PICTURES, THEMES, THEME_OF, pictureOf } from '../src/data/pictures.js'

const base = JSON.parse(fs.readFileSync(new URL('../src/data/words.base.json', import.meta.url), 'utf8'))
const chunks = JSON.parse(fs.readFileSync(new URL('../src/data/chunks.json', import.meta.url), 'utf8'))
const heads = new Set(base.map(w => w.h.toLowerCase()))

let pass = 0
function ok (cond, msg) { assert.ok(cond, msg); pass++ }

/* every key is a real NGSL headword */
for (const w of Object.keys(PICTURES)) ok(heads.has(w), `picture for non-NGSL word: ${w}`)

/* every value is an emoji (pictographic, keycap or regional indicator), nothing else */
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[0-9#*]️?⃣)(?:️|‍|\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Emoji_Presentation})*$/u
for (const [w, e] of Object.entries(PICTURES)) ok(EMOJI.test(e), `not a single emoji for ${w}: ${JSON.stringify(e)}`)

/* every theme word is in the flat map, and every theme has a label */
for (const [k, t] of Object.entries(THEMES)) {
  ok(typeof t.label === 'string' && t.label.length > 0, `theme ${k} has no label`)
  for (const w of Object.keys(t.words)) ok(PICTURES[w], `theme word missing from PICTURES: ${w}`)
}
for (const w of Object.keys(PICTURES)) ok(THEME_OF[w], `word without theme: ${w}`)

/* must map — the concrete core a beginner meets first */
const MUST = {
  apple: null, // not an NGSL headword — listed to document that absence is fine
  dog: '🐕', cat: '🐈', car: '🚗', bus: '🚌', train: '🚆', water: '💧', coffee: '☕',
  book: '📕', phone: '📱', money: '💰', hospital: '🏥', rain: '🌧️', sun: '☀️',
  run: '🏃', sleep: '😴', happy: '😊', increase: '📈', decrease: '📉'
}
for (const [w, e] of Object.entries(MUST)) {
  if (e === null) { ok(!heads.has(w) || PICTURES[w], `${w}`); continue }
  ok(pictureOf(w) === e, `${w} should be ${e}, got ${pictureOf(w) || '(none)'}`)
}

/* must never map — false matches the tag matcher produced */
const NEVER = {
  be: '🇧🇪', to: '🇹🇴', it: '🇮🇹', as: '🇦🇸', by: '🇧🇾', so: '🇸🇴', do: '🇩🇴',
  of: '💩', and: '☠️', in: '😱', with: '😃', but: '😥', from: '😤', can: '🗑️',
  day: '🧖', change: '🪸', life: '🪼', mean: '👺', good: '😴', country: '🏠',
  long: '🪘', place: '🥇', point: '💯', way: '🌌', why: '🥺', work: '💦', time: '😥'
}
for (const [w, bad] of Object.entries(NEVER)) {
  ok(PICTURES[w] !== bad, `${w} must never be pictured as ${bad}`)
}
/* function words get no picture at all */
for (const w of ['be', 'and', 'of', 'to', 'a', 'in', 'that', 'the', 'which', 'although', 'however', 'whether']) {
  ok(!PICTURES[w], `function word ${w} should have no picture`)
}

/* chunks: only real headwords, rejoin to the headword, stress index in range */
for (const [w, v] of Object.entries(chunks)) {
  ok(heads.has(w), `chunk entry for non-NGSL word ${w}`)
  ok(v.c.join('') === w, `chunks of ${w} do not rejoin: ${v.c.join('·')}`)
  ok(v.c.length >= 2, `${w} has a single chunk`)
  ok(Number.isInteger(v.s) && v.s >= 0 && v.s < v.c.length, `${w} stress index out of range`)
}
/* the split must agree with speech: these print splits are known to disagree */
for (const w of ['vegetable', 'every']) ok(!chunks[w], `${w} must stay whole (print split ≠ syllables)`)
ok(JSON.stringify(chunks.beautiful) === JSON.stringify({ c: ['beau', 'ti', 'ful'], s: 0 }), 'beautiful = BEAU·ti·ful')
ok(chunks.important?.s === 1, 'important = im·POR·tant')
ok(chunks.hotel?.s === 1, 'hotel = ho·TEL')

/* literal only: words whose old emoji was a symbol, a face or a mood */
const ABSTRACT = ['eat', 'drink', 'see', 'listen', 'think', 'wait', 'question', 'information', 'start', 'end',
  'good', 'great', 'help', 'peace', 'freedom', 'hope', 'wish', 'secret', 'thank', 'sorry', 'word', 'name', 'number']
for (const w of ABSTRACT) ok(!PICTURES[w], `${w} must not be pictured — its emoji was a symbol, not the word`)
ok(Object.keys(PICTURES).length <= 340, `picture table stays curated (${Object.keys(PICTURES).length})`)

console.log(`pictures: ${Object.keys(PICTURES).length} words, chunks: ${Object.keys(chunks).length} words — ${pass} checks ok`)
