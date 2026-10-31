/**
 * Pins the Word Parts course and the anatomy shown on every word card.
 *
 * A wrong split teaches a wrong rule, so this is strict: every example must
 * spell its word exactly from its pieces, use only parts the course defines,
 * and build on a base the learner can actually look up and read a meaning
 * for. The anatomy checks pin the cases where a naive split misleads.
 */
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PARTS, UNITS, EXAMPLES, EXAMPLE_BY_WORD, BASE_ZH, EXTRA_BASES, parseParts } from '../src/data/morphology.js'
import { makeAnatomy } from '../src/lib/anatomy.js'
import { partsRound, discoverOf, GAME_KINDS } from '../src/lib/partsGames.js'

const base = JSON.parse(fs.readFileSync(new URL('../src/data/words.base.json', import.meta.url), 'utf8'))
const affix = JSON.parse(fs.readFileSync(new URL('../src/data/affix.json', import.meta.url), 'utf8'))
const chunks = JSON.parse(fs.readFileSync(new URL('../src/data/chunks.json', import.meta.url), 'utf8'))
const heads = new Set(base.map(w => w.h.toLowerCase()))
const forms = new Set(base.flatMap(w => w.f || []))

let pass = 0
const fails = []
function ok (cond, msg) { if (cond) pass++; else fails.push(msg) }

/* ---------- parts table ---------- */
for (const [id, p] of Object.entries(PARTS)) {
  ok(['prefix', 'suffix', 'root'].includes(p.kind), `${id}: bad kind`)
  ok(p.zh && p.label, `${id}: needs label and zh`)
  if (p.kind === 'suffix') ok(['n.', 'adj.', 'v.', 'adv.'].includes(p.pos), `${id}: suffix needs the part of speech it makes`)
  if (p.of) ok(PARTS[p.of], `${id}: variant of unknown ${p.of}`)
}

/* ---------- units ---------- */
const ids = new Set()
for (const u of UNITS) {
  ok(!ids.has(u.id), `duplicate unit ${u.id}`); ids.add(u.id)
  ok(/^p\d\d$/.test(u.id), `unit id ${u.id} must be pNN (grammar_progress prefix)`)
  ok(u.title && u.hook, `${u.id}: title and hook`)
  ok(u.ex.length >= 8, `${u.id}: at least 8 examples for a game round (${u.ex.length})`)
  for (const p of u.parts) ok(PARTS[p], `${u.id}: unknown part ${p}`)
  const seen = new Set()
  for (const [w, spec, zh, pos] of u.ex) {
    ok(!seen.has(w), `${u.id}: duplicate example ${w}`); seen.add(w)
    ok(zh && pos, `${u.id}/${w}: needs zh and pos`)
    const tiles = parseParts(spec)
    ok(tiles.map(t => t.text).join('') === w, `${u.id}/${w}: pieces spell "${tiles.map(t => t.text).join('|')}"`)
    ok(tiles.length >= 2, `${u.id}/${w}: needs at least two pieces`)
    for (const t of tiles) {
      if (t.kind === 'base') {
        ok(heads.has(t.ref) || forms.has(t.ref) || EXTRA_BASES[t.ref], `${u.id}/${w}: base "${t.ref}" is not an NGSL word`)
        ok(BASE_ZH[t.ref], `${u.id}/${w}: base "${t.ref}" has no bundled meaning`)
      } else if (t.kind !== 'link') {
        ok(PARTS[t.ref], `${u.id}/${w}: unknown part ${t.ref}`)
      }
    }
    // the unit's own parts must actually appear (compounds have none)
    if (u.parts.length) {
      ok(tiles.some(t => u.parts.includes(t.ref) || u.parts.includes(PARTS[t.ref]?.of)), `${u.id}/${w}: uses none of the unit's parts`)
    }
  }
  for (const [w, why] of u.traps || []) {
    ok(!EXAMPLE_BY_WORD.has(w), `${u.id}: trap ${w} is also taught as a real example`)
    ok(why && why.includes(w), `${u.id}: trap ${w} must explain itself by name`)
  }
}
ok(UNITS.length >= 15, `course has ${UNITS.length} units`)

/* ---------- anatomy over the whole word list ---------- */
const { anatomy } = makeAnatomy({ base, affix, chunks })
let partsN = 0, sylN = 0
for (const w of base) {
  const a = anatomy(w.h)
  ok(a && a.tiles.length >= 1, `${w.h}: no anatomy`)
  ok(a.tiles.map(t => t.text).join('') === w.h.toLowerCase(), `${w.h}: tiles spell ${a.tiles.map(t => t.text).join('|')}`)
  if (a.mode === 'parts') {
    partsN++
    for (const t of a.tiles) if (t.kind !== 'link' && t.kind !== 'base') ok(t.gloss, `${w.h}: part ${t.ref} has no meaning`)
  }
  if (a.mode === 'syllables') { sylN++; ok(a.tiles.filter(t => t.stress).length === 1, `${w.h}: exactly one stressed syllable`) }
}

const split = w => anatomy(w).tiles.map(t => t.text).join('|')
const PIN = {
  achievement: 'achieve|ment',
  unemployment: 'un|employ|ment',
  successfully: 'success|ful|ly',
  decision: 'deci|sion',
  impossible: 'im|possible',
  possibly: 'possib|ly',
  beautiful: 'beauti|ful',
  transport: 'trans|port',
  weekend: 'week|end'
}
for (const [w, want] of Object.entries(PIN)) ok(split(w) === want, `${w} should split ${want}, got ${split(w)}`)
for (const w of ['hardly', 'nearly', 'restore', 'modify']) ok(anatomy(w).mode !== 'parts', `${w} must not be shown as a sum of parts`)
ok(anatomy('decision').tiles[0].base === 'decide', 'a respelled base names the word it came from')
ok(anatomy('beautiful').mode === 'parts' && anatomy('beautiful').tiles[0].gloss === '美', 'a curated base carries its meaning')
ok(anatomy('important').mode === 'syllables' && anatomy('important').tiles[1].stress, 'important = im·POR·tant')

/* ---------- games generated from the course ---------- */
for (const u of UNITS) {
  const d = discoverOf(u, 7)
  ok(d.options.length >= 3 && d.options.includes(d.answer), `${u.id}: discover has the answer among its options`)
  ok(d.words.length >= 3, `${u.id}: discover shows at least three words`)
  for (let seed = 1; seed <= 6; seed++) {
    const r = partsRound(u, seed, 8)
    ok(r.length >= 6, `${u.id}: round of ${r.length}`)
    const kinds = new Set(r.map(i => i.kind))
    ok(kinds.size >= 3, `${u.id}/${seed}: round mixes ${kinds.size} game kinds`)
    for (const it of r) {
      ok(GAME_KINDS.includes(it.kind), `${u.id}: unknown game kind ${it.kind}`)
      if (it.kind === 'build') {
        const right = it.answer.join('')
        ok(right === it.word, `${u.id}/${it.word}: build answer spells the word`)
        ok(it.answer.every(p => it.bank.includes(p)), `${u.id}/${it.word}: build bank holds every answer piece`)
        ok(new Set(it.bank).size === it.bank.length, `${u.id}/${it.word}: build bank has no duplicate tiles`)
      }
      if (it.kind === 'split') {
        ok(it.cuts.length >= 1 && it.cuts.every(c => c > 0 && c < it.word.length), `${u.id}/${it.word}: split cuts in range`)
      }
      if (it.kind === 'choice' || it.kind === 'trap' || it.kind === 'pos') {
        ok(it.options.includes(it.answer), `${u.id}/${it.prompt}: answer among options`)
        ok(new Set(it.options).size === it.options.length, `${u.id}/${it.prompt}: options are distinct`)
      }
    }
  }
}

if (fails.length) {
  console.error(fails.slice(0, 40).join('\n'))
  console.error(`\nmorphology: ${fails.length} failures`)
  process.exit(1)
}
console.log(`morphology: ${UNITS.length} units, ${EXAMPLES.length} examples; anatomy parts=${partsN} syllables=${sylN} / ${base.length} — ${pass} checks ok`)
