/**
 * Word-formation graph checks.
 *
 *   node scripts/test-affix.mjs
 *
 * The graph is rule-derived, so the failure mode is not a crash — it is a
 * plausible-looking lie. "letter is built from let" and "party is built from
 * part" are both what the suffix rules say and both would teach a learner a
 * pattern that does not exist. These assertions pin the pairs that must be
 * there and the ones that must not.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const read = f => JSON.parse(readFileSync(resolve(here, '..', f), 'utf8'))

const affix = read('src/data/affix.json')
const base = read('src/data/words.base.json')

const idOf = new Map(base.map(w => [w.h.toLowerCase(), w.id]))
const headOf = new Map(base.map(w => [w.id, w.h]))

let pass = 0
let fail = 0
const ok = (label, cond, detail = '') => {
  if (cond) { pass++; console.log(`PASS  ${label}`) }
  else { fail++; console.log(`FAIL  ${label}${detail ? `  → ${detail}` : ''}`) }
}

const linkFor = word => affix.links[idOf.get(word)] || null
const baseWordOf = word => {
  const l = linkFor(word)
  return l ? headOf.get(l.base) : null
}

console.log('— pairs that must be linked —')
for (const [derived, stem] of [
  ['achievement', 'achieve'],   // the pair that started this: #745 vs #1998
  ['decision', 'decide'],
  ['management', 'manage'],
  ['happiness', 'happy'],
  ['ability', 'able'],
  ['possibility', 'possible'],
  ['careful', 'care'],
  ['dangerous', 'danger'],
  ['reasonable', 'reason'],
  ['effective', 'effect'],
  ['clearly', 'clear'],
  ['realize', 'real'],
  ['leadership', 'leader'],
  ['unusual', 'usual'],
  ['impossible', 'possible'],
  ['disappear', 'appear']
]) {
  ok(`${stem} → ${derived}`, baseWordOf(derived) === stem, `got ${baseWordOf(derived)}`)
}

console.log('\n— coincidences that must NOT be linked —')
for (const word of [
  'letter',   // not let + er
  'party',    // not part + y
  'carry',    // not car + ry
  'offer',    // not off + er
  'listen',   // not list + en
  'station',  // not state + tion
  'comment',  // not come + ment
  'shoulder', // not should + er
  'factory',  // not factor + y
  'finance',  // not fine + ance
  'insure',   // not in + sure
  'return',   // historically re + turn, useless as a family
  'remember',
  'resource',
  'apartment',
  'passion',
  'counter'
]) {
  const got = baseWordOf(word)
  ok(`${word} is not derived`, got === null, `linked to ${got}`)
}

console.log('\n— shape —')
const linkCount = Object.keys(affix.links).length
ok('the graph covers a useful slice of the list', linkCount >= 200 && linkCount <= 500, `${linkCount} links`)

ok('every link points at a real, earlier headword',
  Object.entries(affix.links).every(([id, d]) => headOf.has(d.base) && d.base < Number(id)))

ok('families and links agree',
  Object.entries(affix.families).every(([b, kids]) =>
    kids.every(k => affix.links[k]?.base === Number(b))))

ok('no word is its own stem',
  Object.entries(affix.links).every(([id, d]) => d.base !== Number(id)))

// The scheduler pulls derived words forward; if a stem carried a dozen of
// them the day would be nothing but one word family.
const widest = Math.max(...Object.values(affix.families).map(k => k.length))
ok('no stem drags in more than a handful of derivatives', widest <= 6, `widest family = ${widest}`)

console.log(`\n${fail ? `${fail} failed, ` : ''}${pass} passed`)
process.exit(fail ? 1 : 0)
