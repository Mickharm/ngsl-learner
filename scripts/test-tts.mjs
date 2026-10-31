/**
 * The silent lead-in handed to the speech engine.
 *
 * Restored in v2: commit 258b88f wired this file into `npm test` but never
 * committed it, so `npm test` on main failed at the last step. Pins the three
 * properties that commit described:
 *
 *   - the 0–4 setting maps to 0–4 warm-up units, clamped, 0 meaning none;
 *   - non-integer input (a slider value) is rounded, not truncated or rejected;
 *   - the lead-in is made of real words, never bare punctuation — a bare
 *     comma was assumed silent and was audible on-device as "con".
 */
import assert from 'node:assert/strict'
import { warmUpText } from '../src/lib/tts.js'

let n = 0
const eq = (a, b, m) => { assert.equal(a, b, m); n++ }
const ok = (c, m) => { assert.ok(c, m); n++ }

const units = s => (s ? s.split(/\s+/).length : 0)

eq(warmUpText(0), '', '0 queues nothing')
for (const k of [1, 2, 3, 4]) eq(units(warmUpText(k)), k, `${k} → ${k} units`)
eq(units(warmUpText(9)), 4, 'clamped at 4')
eq(units(warmUpText(-3)), 0, 'clamped at 0')
eq(units(warmUpText(2.4)), 2, '2.4 rounds to 2')
eq(units(warmUpText(2.6)), 3, '2.6 rounds to 3')
eq(units(warmUpText()), 2, 'default is 2')
for (const k of [1, 2, 3, 4]) {
  const t = warmUpText(k)
  ok(/^[a-z]+(\s[a-z]+)*$/i.test(t), `lead-in ${k} is words, not punctuation: ${JSON.stringify(t)}`)
  ok(!/[,.;:!?]/.test(t), `lead-in ${k} contains no punctuation`)
}
console.log(`tts: ${n} checks ok`)
