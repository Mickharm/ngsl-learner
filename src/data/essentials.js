import time from './essentials-time.js'
import forms from './essentials-forms.js'
import usage from './essentials-usage.js'
import affix from './essentials-affix.js'

/**
 * 13 foundation units covering the closed sets a 450-word learner needs
 * constantly but never meets as flashcards: time prepositions, dates, numbers,
 * pronouns, irregular verbs, contractions, quantifiers, question order, place
 * prepositions, phrasal verbs, money — and word formation, which is the
 * largest single scoring block in TOEIC Part 5 and was missing entirely.
 *
 * The teaching layer (explanations, tables, pitfalls) is fixed and offline so
 * it is right every time. Practice beyond the seed drills is generated per
 * learner — see generateDrills() in lib/gemini.js.
 */
const ESSENTIALS = [...time, ...forms, ...usage, ...affix].map((u, i) => ({ ...u, order: i + 1 }))

export default ESSENTIALS

export const ESSENTIAL_BY_ID = Object.fromEntries(ESSENTIALS.map(u => [u.id, u]))

export const ESSENTIAL_GROUPS = ESSENTIALS.reduce((acc, u) => {
  ;(acc[u.group] ||= []).push(u)
  return acc
}, {})

export const ESSENTIAL_DRILL_COUNT = ESSENTIALS.reduce((n, u) => n + u.drills.length, 0)
