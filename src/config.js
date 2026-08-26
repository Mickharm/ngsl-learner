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

export const DEFAULT_SETTINGS = Object.freeze({
  newPerDay: 10,
  reviewCap: 60,
  ttsRate: 0.9,
  ttsVoiceURI: '',
  autoPlayAudio: true,
  clozeRatio: 0.35,
  theme: 'system',
  articleTopics: ['daily', 'travel', 'work'],
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  showIntervalHints: true,
  grammarPerDay: 1
})
