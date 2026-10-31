/**
 * 誰不一樣 — Marzano's "Which one doesn't belong?" game, built from the
 * picture themes. Three words from one theme and one from another; the
 * learner taps the odd one out, then sees the category named. Categorising
 * is deeper processing than recognising, and needs no enrichment data, so it
 * works on day one.
 */
import { THEMES } from '../data/pictures.js'
import { shuffle, rng } from './game.js'

/**
 * Themes whose members are all the same KIND of thing, so "which one does not
 * belong" has one right answer. Mixed bags (actions, symbols, describe, mind,
 * media) are left out: a smoke run once offered "embrace" as one of the people
 * and "tall" was filed under animals because of its 🦒 — categories that
 * teach a wrong grouping are worse than no game.
 */
export const ODD_THEMES = ['food', 'animals', 'body', 'people', 'jobs', 'places', 'home', 'transport', 'nature', 'feelings', 'clothes', 'sport', 'colors']

/**
 * One round: { theme, label, options: [{ word, emoji, odd }] }.
 * `known` (optional Set of headwords) biases toward words the learner has met.
 */
export function oddRound (seed = 1, known = null) {
  const r = rng(seed)
  const themes = ODD_THEMES.filter(k => Object.keys(THEMES[k].words).length >= 6)
  const main = themes[Math.floor(r() * themes.length)]
  let other = main
  while (other === main) other = themes[Math.floor(r() * themes.length)]

  const pickFrom = (key, n) => {
    const ws = Object.entries(THEMES[key].words)
    const prefer = known ? ws.filter(([w]) => known.has(w)) : []
    const pool = prefer.length >= n ? prefer : ws
    const out = []
    const usedEmoji = new Set()
    for (const [w, e] of shuffle(pool, Math.floor(r() * 1e9))) {
      if (usedEmoji.has(e)) continue
      usedEmoji.add(e); out.push({ word: w, emoji: e })
      if (out.length >= n) break
    }
    return out
  }
  const three = pickFrom(main, 3).map(x => ({ ...x, odd: false }))
  const usedE = new Set(three.map(t => t.emoji))
  const odd = pickFrom(other, 4).find(x => !usedE.has(x.emoji))
  return {
    theme: main,
    label: THEMES[main].label,
    oddLabel: THEMES[other].label,
    options: shuffle([...three, { ...odd, odd: true }], seed * 3 + 1)
  }
}
