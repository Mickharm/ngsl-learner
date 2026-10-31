/**
 * 字力 (word power) — the one number the dashboard shows as a level.
 *
 * Derived from what the learner actually knows, never from time spent or
 * buttons pressed: each met word is worth 10 points per ladder rung it has
 * reached (recognised 10 … used in a sentence 50), plus 20 once mastered.
 * So it cannot be farmed by grinding easy reviews, it drops when words are
 * forgotten, and it reads the same on both devices because it is computed
 * from the synced cards. Gamification helps learning most when the points
 * are the learning itself (Sailer & Homner 2020: the cognitive effect was the
 * one that survived their high-rigour subset).
 */
import { STATE } from './srs.js'
import { ladderOf, isMasteredV2 } from './wordsrs.js'

export function wordPower (cards) {
  let xp = 0
  for (const c of cards) {
    if (!c || c.state === STATE.NEW) continue
    xp += (ladderOf(c) + 1) * 10
    if (isMasteredV2(c)) xp += 20
  }
  return xp
}

const STEP = 40

/** Level curve: level n starts at 40·(n−1)². */
export function levelOf (xp) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / STEP)) + 1
  const base = STEP * (level - 1) ** 2
  const next = STEP * level ** 2
  return { level, xp, base, next, pct: Math.round(((xp - base) / (next - base)) * 100) }
}

export const TITLES = [
  [1, '新手'], [5, '單字學徒'], [10, '句子工匠'], [15, '閱讀者'],
  [20, '旅人'], [26, '溝通者'], [33, '說書人'], [40, '大師']
]

export function titleOf (level) {
  let t = TITLES[0][1]
  for (const [lv, name] of TITLES) if (level >= lv) t = name
  return t
}
