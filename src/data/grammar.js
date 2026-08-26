import b1 from './grammar-b1.js'
import b2 from './grammar-b2.js'
import b3 from './grammar-b3.js'

/**
 * 30 grammar points, ordered so that each one only depends on the ones before
 * it. `order` is the study sequence; `band` gates when it unlocks relative to
 * vocabulary progress.
 */
const GRAMMAR = [...b1, ...b2, ...b3].map((g, i) => ({ ...g, order: i + 1 }))

export default GRAMMAR

export const GRAMMAR_BY_ID = Object.fromEntries(GRAMMAR.map(g => [g.id, g]))

export const GRAMMAR_BY_BAND = GRAMMAR.reduce((acc, g) => {
  ;(acc[g.band] ||= []).push(g)
  return acc
}, {})

export const DRILL_COUNT = GRAMMAR.reduce((n, g) => n + g.drills.length, 0)
