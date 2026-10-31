/**
 * Game centre plumbing: which words a game may use, best scores, the daily
 * puzzle word. Pure where it can be, so scripts/test-arcade.mjs can pin it.
 *
 * Games are practice the learner chooses, Marzano's step 6. Nothing here
 * reaches the scheduler: a game answer is fast and guessable, and letting it
 * move a word's interval would let play inflate the measurement.
 */
import { rng, shuffle } from './game.js'

export const GAMES = [
  { id: 'rain',    title: '單字雨',   sub: '單字往下掉，落地前點出它的意思', skill: '認得', minWords: 8 },
  { id: 'bubbles', title: '泡泡聽力', sub: '聽到哪個字，就戳哪顆泡泡',       skill: '聽得懂', minWords: 8 },
  { id: 'wordle',  title: '每日猜字', sub: '六次機會猜出今天的五個字母',     skill: '拼得出', minWords: 0 },
  { id: 'builder', title: '零件積木', sub: '60 秒內用字首字尾拼出越多字越好', skill: '字首字尾', minWords: 0 },
  { id: 'memory',  title: '翻牌記憶', sub: '翻開兩張，英文和中文配成一對',   skill: '想得起', minWords: 6 },
  { id: 'match',   title: '極速連連看', sub: '三輪配對，看你多快',            skill: '認得', minWords: 6 }
]
export const GAME_BY_ID = Object.fromEntries(GAMES.map(g => [g.id, g]))

/* ---------------- best scores (per learner, per device) ---------------- */

const key = uid => `ngsl.games.${uid || 'anon'}`
export function readBest (uid) {
  try { return JSON.parse(localStorage.getItem(key(uid)) || '{}') } catch { return {} }
}
/** Store `score` if it beats the record. Returns true on a new record. */
export function saveBest (uid, game, score) {
  const all = readBest(uid)
  if (all[game] != null && all[game] >= score) return false
  all[game] = score
  try { localStorage.setItem(key(uid), JSON.stringify(all)) } catch { /* ignore */ }
  return true
}

/* ---------------- the daily word ---------------- */

/** Day number in Taiwan time, so the puzzle turns over at local midnight. */
export function dayNumber (now = Date.now()) {
  return Math.floor((now + 8 * 3600_000) / 86400_000)
}

/**
 * Five-letter answers: NGSL headwords of exactly five plain letters, from the
 * first 2000 (a puzzle about a word you have never seen is not a puzzle).
 */
export function wordleAnswers (base) {
  return base.filter(w => w.id <= 2000 && /^[a-z]{5}$/.test(w.h)).map(w => w.h)
}

/** Every five-letter string accepted as a guess: headwords and their forms. */
export function wordleAllowed (base) {
  const out = new Set()
  for (const w of base) {
    if (/^[a-z]{5}$/.test(w.h)) out.add(w.h)
    for (const f of w.f || []) if (/^[a-z]{5}$/.test(f)) out.add(f)
  }
  return out
}

export function dailyAnswer (answers, day = dayNumber()) {
  // A fixed shuffle walked one step a day: no repeat until the list runs out.
  const order = shuffle(answers, 20261031)
  return order[((day % order.length) + order.length) % order.length]
}

/**
 * Wordle scoring with duplicate letters handled the standard way: exact hits
 * first, then present letters only while unmatched copies remain.
 * Returns one of 'hit' | 'near' | 'miss' per letter.
 */
export function scoreGuess (guess, answer) {
  const g = guess.split(''); const a = answer.split('')
  const res = Array(g.length).fill('miss')
  const left = {}
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) res[i] = 'hit'
    else left[a[i]] = (left[a[i]] || 0) + 1
  }
  for (let i = 0; i < g.length; i++) {
    if (res[i] === 'hit') continue
    if (left[g[i]] > 0) { res[i] = 'near'; left[g[i]]-- }
  }
  return res
}

/** Points for a falling-word hit: faster answers and longer streaks pay more. */
export function rainPoints (msLeft, msTotal, combo) {
  const speed = Math.max(0, Math.min(1, msLeft / msTotal))
  const mult = combo >= 10 ? 3 : combo >= 5 ? 2 : 1
  return Math.round((10 + 20 * speed) * mult)
}

/** Fall time for the n-th word: starts gentle, tightens, never below a floor. */
export function rainDuration (n) {
  return Math.max(2600, 7500 - n * 180)
}

/** A seeded pick of n items. */
export function sample (arr, n, seed) {
  const r = rng(seed)
  return shuffle(arr, Math.floor(r() * 1e9)).slice(0, n)
}
