/**
 * Every "put it back in order" bank must start out of order.
 *
 * v4.0.1 shipped a pseudo-shuffle whose key (i · 2654435761 mod 997) is
 * 30·i, monotonic for i < 34: every sentence bank appeared in answer order and
 * the drill became "tap left to right". This walks every order / blocks item in
 * the data, many seeds each, and asserts the bank is never the answer and keeps
 * at most a small share of the answer's adjacent pairs.
 *
 *   npm run test:scramble
 */
import assert from 'node:assert/strict'
import { scramble, hashSeed, letterTiles } from '../src/lib/game.js'
import time from '../src/data/essentials-time.js'
import usage from '../src/data/essentials-usage.js'
import b1 from '../src/data/grammar-b1.js'
import b2 from '../src/data/grammar-b2.js'
import b3 from '../src/data/grammar-b3.js'
import studio from '../src/data/grammar-studio.js'

let pass = 0
const ok = (c, m) => { assert.ok(c, m); pass++ }

/* collect every order / blocks item anywhere in the data */
const items = []
const walk = (v, seen = new Set()) => {
  if (!v || typeof v !== 'object' || seen.has(v)) return
  seen.add(v)
  if (v.type === 'order' && Array.isArray(v.tokens)) items.push(v.tokens)
  if (v.type === 'blocks' && Array.isArray(v.blocks)) items.push(v.blocks.map(b => b[0]))
  for (const x of Array.isArray(v) ? v : Object.values(v)) walk(x, seen)
}
;[time, usage, b1, b2, b3, studio].forEach(d => walk(d))
ok(items.length >= 40, `found ${items.length} reorder items`)

const bigrams = t => new Set(t.slice(0, -1).map((x, i) => x + '\u0000' + t[i + 1]))
let worstShare = 0
for (const tokens of items) {
  const ans = tokens.join(' ')
  const fwd = bigrams(tokens)
  for (let s = 0; s < 60; s++) {
    const seed = hashSeed(ans) + s * 101
    const bank = scramble(tokens.map((t, i) => ({ t, i })), seed, b => b.t)
    const text = bank.map(b => b.t)
    assert.equal(bank.length, tokens.length)
    assert.deepEqual([...text].sort(), [...tokens].sort(), 'same multiset of tiles')
    if (new Set(tokens).size > 1) assert.notEqual(text.join(' '), ans, `identity bank for "${ans}" seed ${seed}`)
    if (tokens.length >= 4) {
      const kept = text.slice(0, -1).filter((x, i) => fwd.has(x + '\u0000' + text[i + 1])).length
      worstShare = Math.max(worstShare, kept / (tokens.length - 1))
      assert.ok(kept <= Math.floor((tokens.length - 1) / 3), `"${ans}" keeps ${kept} answer pairs: ${text.join(' | ')}`)
    }
  }
  pass++
}

/* the old pseudo-shuffle, kept here as the regression it was */
const old = n => [...Array(n).keys()].sort((a, b) => ((a * 2654435761) % 997) - ((b * 2654435761) % 997))
ok(old(8).join() === '0,1,2,3,4,5,6,7', 'documents the v4.0.1 bug: identity for 8 tokens')

/* duplicates and degenerate inputs */
ok(scramble(['the', 'cat', 'saw', 'the', 'dog'], 3).join(' ') !== 'the cat saw the dog', 'duplicate tokens still scrambled')
ok(scramble(['a', 'b'], 9).join('') === 'ba', 'two tiles: the only other order')
ok(scramble(['x', 'x', 'x'], 9).length === 3, 'all-identical tiles do not loop')
ok(scramble([], 1).length === 0 && scramble(['solo'], 1).length === 1, 'empty / single')

/* spelling tiles: the letters never spell the word left to right */
for (const w of ['apple', 'because', 'friend', 'go', 'information']) {
  for (let s = 1; s < 40; s++) {
    const t = letterTiles(w, s, 0).map(x => x.ch).join('')
    assert.notEqual(t, w, `letterTiles ${w} seed ${s}`)
  }
  pass++
}

console.log(`scramble: ${pass} checks passed · ${items.length} reorder items · worst kept-pair share ${(worstShare * 100).toFixed(0)}%`)
