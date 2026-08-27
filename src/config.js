/**
 * Public runtime configuration.
 *
 * The Supabase URL and publishable key are safe in a client bundle by design —
 * every table is guarded by Row Level Security, so this key alone grants
 * nothing. The *secret* key must never appear in this repository.
 *
 * Values can be overridden at build time with VITE_ env vars if you ever move
 * to a different Supabase project.
 */

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://hlwmqtbgpconoclmxwll.supabase.co'

export const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_XkY-88x21b4zaC-thoAIiw_YJErlg2k'

/**
 * The two people this instance is for. Public signup is turned off in
 * Supabase, so the login screen can present names instead of asking anyone to
 * remember an email address — the address is an implementation detail.
 */
export const PROFILES = Object.freeze([
  { name: 'Dai', email: 'dai@ngsl.app', accent: 'jade' },
  { name: 'Xin', email: 'xin@ngsl.app', accent: 'violet' }
])

export const APP_NAME = 'NGSL Learner'
export const TOTAL_WORDS = 2801

export const BANDS = Object.freeze({
  B1: { key: 'B1', label: 'B1', range: [1, 1000], desc: '最高頻 1000 字' },
  B2: { key: 'B2', label: 'B2', range: [1001, 2000], desc: '次高頻 1000 字' },
  B3: { key: 'B3', label: 'B3', range: [2001, 2801], desc: '進階 801 字' }
})

/** Words per unlockable stage. */
export const STAGE_SIZE = 50

/** A stage unlocks the next one once this share of its cards has graduated. */
export const STAGE_UNLOCK_RATIO = 0.8

/**
 * How many words past the placement frontier the learner takes on.
 *
 * Not a preference — a capacity ceiling. Simulating the real scheduler shows a
 * learner who forgets a quarter of the time can hold roughly 1,200-1,500 cards
 * in active rotation at 60 reviews a day; past that the queue accrues a
 * backlog that never clears. Words below the frontier are cheap (they sit on
 * long verification intervals), so the budget is spent on what comes after it.
 */
export const WORDS_PER_PHASE = 1500

/**
 * How long a day should take, in minutes.
 *
 * The five fixed phases converge on roughly an hour once the review queue
 * fills, but on day 2 — with an empty deck — the same five phases took 24
 * minutes, less than half the time the learner had set aside. A fixed phase
 * list cannot be right at both ends. The listening phase therefore sizes
 * itself to whatever the rest of the day did not use.
 */
export const DEFAULT_DAILY_MINUTES = 60

export const DEFAULT_SETTINGS = Object.freeze({
  // 8/day finishes 1,500 words in about six months and keeps the review queue
  // convergent. 20/day - what both learners had set - does not.
  newPerDay: 8,
  reviewCap: 60,
  ttsRate: 0.9,
  ttsVoiceURI: '',
  // Units of leading silence inside each utterance. The OS audio stream loses
  // its first 100-300 ms while it opens, so without this the ramp eats the
  // first syllable instead of a pause. Device-dependent, hence a setting.
  ttsLeadIn: 2,
  autoPlayAudio: true,
  clozeRatio: 0.35,
  theme: 'system',
  articleTopics: ['daily', 'travel', 'work'],
  geminiKey: '',
  geminiModel: 'gemini-3.5-flash',
  showIntervalHints: true,
  grammarPerDay: 1,
  dailyMinutes: DEFAULT_DAILY_MINUTES,
  // Highest NGSL rank this phase covers. 0 means "no ceiling", which is what
  // an account that has not been placed yet gets.
  targetWords: 0
})
