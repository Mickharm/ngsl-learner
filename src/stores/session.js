import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useProgress, todayKey } from './progress'
import { useSettings } from './settings'
import { useWords } from './words'
import { useGrammar } from './grammar'
import { useEssentials } from './essentials'
import { useParts } from './parts'
import { useAuth } from './auth'
import { STATE } from '@/lib/srs'
import { paceToday } from '@/lib/pacing'
import { listenTargets } from '@/lib/listening'
import { scoped, adopt } from '@/lib/userScope'

/**
 * The day's quest. Seven phases, each unlocked by the one before it, so the
 * learner cannot binge new words while a review backlog rots — the single
 * failure mode that kills vocabulary apps.
 *
 * Phase state lives in localStorage keyed by date: it is UI position, not
 * learning data, and does not deserve a round trip to the database.
 */

/**
 * The dashboard itself is the day's briefing, so it is not a step in its own
 * list — the quest is the things the learner actually has to do.
 *
 * `track` decides which days a phase runs on. Words come every day; the four
 * taught phases alternate, because running all of them daily cost 54 minutes
 * before a single card was reviewed, which by itself overran a 60-minute
 * budget. Alternating halves that to 27-30 and hands the difference back to
 * review, which is the part that actually decides whether anything sticks.
 *
 *   A 日：文法 + 閱讀      B 日：基礎知識 + 主題對話
 *
 * Both tracks keep a reading or production task, so no day is recognition-only.
 */
export const TRACK = Object.freeze({ BOTH: 'both', A: 'A', B: 'B' })

/*
 * v2 order: review BEFORE new words. Retrieving yesterday's words first is
 * the warm-up, and it keeps a new batch from crowding out the words that are
 * about to be forgotten. Reading is now the bundled Story Time (levelled and
 * coverage-checked); the AI article stays reachable from inside it.
 */
export const PHASES = [
  { key: 'review',     label: '複習挑戰',   route: '/review',          minutes: 15, track: TRACK.BOTH },
  { key: 'learn',      label: '新單字',     route: '/learn',           minutes: 15, track: TRACK.BOTH },
  // v3: word parts every day, short. US classrooms run word study as a daily
  // strand of 10-15 minutes rather than a unit taught once; here one unit is
  // a guess, a short teach and an 8-item game round.
  { key: 'parts',      label: '字首字尾',   route: '/parts?phase=1',   minutes: 7,  track: TRACK.BOTH },
  { key: 'grammar',    label: '文法',       route: '/grammar',   minutes: 14, track: TRACK.A },
  { key: 'essentials', label: '基礎知識',   route: '/essentials',      minutes: 12, track: TRACK.B },
  // v5: a bounded role-play with the AI instead of one sentence per word
  { key: 'write',      label: '主題對話',   route: '/talk',            minutes: 12, track: TRACK.B },
  { key: 'read',       label: '讀故事',     route: '/story?phase=1',   minutes: 12, track: TRACK.A },
  // v4: a game on today's words, near the end of the day so it is a spaced
  // second retrieval rather than more of the same minute. The game rotates
  // daily; the route is filled in by todayPhases.
  { key: 'play',       label: '遊戲時間',   route: '/games',           minutes: 4,  track: TRACK.BOTH },
  // Listening runs every day and is the phase that flexes: it takes whatever
  // minutes the rest of the day did not use, so a light day is not a short
  // day and a heavy one does not overrun. Half a TOEIC score is listening and
  // the app had none of it.
  { key: 'listen',     label: '聽力',     route: '/listen',     minutes: 10, track: TRACK.BOTH, elastic: true },
  { key: 'summary',    label: '結算',     route: '/summary',    minutes: 3,  track: TRACK.BOTH }
]

/** Minutes one listening item costs a beginner: play twice, answer, read the fix. */
const LISTEN_ITEM_MINUTES = 0.6
const LISTEN_MIN_MINUTES = 6
const LISTEN_MAX_MINUTES = 20

/**
 * Which track a date falls on. Keyed off the date itself rather than a stored
 * counter so a skipped day cannot desync the two, and so the same day always
 * resolves the same way on both devices.
 */
export function trackFor (dayKey = todayKey()) {
  const days = Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86400000)
  return days % 2 === 0 ? TRACK.A : TRACK.B
}

const LS_KEY = 'ngsl.session'

/** The quest's game for a given day: one of the four that run on today's words. */
export const QUEST_GAMES = ['rain', 'memory', 'bubbles', 'match']
export function questGame (dayKey = todayKey()) {
  const days = Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / 86400000)
  return QUEST_GAMES[((days % QUEST_GAMES.length) + QUEST_GAMES.length) % QUEST_GAMES.length]
}

/** The day's phase state, per learner (see lib/userScope.js for why). */
function readPhaseState (uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(scoped(LS_KEY, uid)) || 'null')
    if (raw?.day === todayKey()) return raw
  } catch { /* ignore */ }
  return { day: todayKey(), done: {}, startedAt: null, seconds: 0 }
}

export const useSession = defineStore('session', () => {
  const progress = useProgress()
  const settings = useSettings()
  const words = useWords()
  const grammar = useGrammar()
  const essentials = useEssentials()
  const parts = useParts()
  const auth = useAuth()

  adopt(LS_KEY, auth.userId, auth.user?.email)
  const phase = ref(readPhaseState(auth.userId))
  const activeTimer = ref(null)

  function save () {
    try { localStorage.setItem(scoped(LS_KEY, auth.userId), JSON.stringify(phase.value)) } catch { /* ignore */ }
  }

  // another learner signed in on this device: their day, not the last one's
  watch(() => auth.userId, uid => {
    adopt(LS_KEY, uid, auth.user?.email)
    phase.value = readPhaseState(uid)
  })
  // the day changed while the app stayed open (progress.now is the clock)
  watch(() => progress.dayKey, () => rollIfNewDay())

  function rollIfNewDay () {
    if (phase.value.day !== todayKey()) {
      phase.value = { day: todayKey(), done: {}, startedAt: null, seconds: 0 }
      save()
    }
  }

  /* ---------------- the day's plan ---------------- */

  /**
   * Today's list is frozen only once the learner has actually answered a new
   * card. Freezing on mere arrival at the screen made the daily-count setting
   * look broken: change it, and the dashboard kept showing the old number with
   * no way to tell why.
   */
  const learnStarted = computed(() => (progress.today.new_count || 0) > 0)

  /**
   * How many new words today can afford (lib/pacing.js): the setting, lowered
   * when the review queue does not fit in a day or recent reviews are being
   * missed. Decided once, on the day's first look at the queue — if it were
   * live, clearing sixty reviews would bring the new words straight back and
   * the point of holding them would be lost.
   */
  const livePace = computed(() => paceToday({
    newPerDay: settings.state.newPerDay,
    dueCount: progress.dueCards.length,
    reviewCap: settings.state.reviewCap,
    retention: progress.retention7.retention,
    sample: progress.retention7.n,
    auto: settings.state.autoPace !== false
  }))
  const pace = computed(() => {
    const p = phase.value.pace
    if (p && p.base === settings.state.newPerDay && p.auto === (settings.state.autoPace !== false)) return p
    return { ...livePace.value, auto: settings.state.autoPace !== false }
  })
  function fixPace () {
    rollIfNewDay()
    if (!progress.loaded || !auth.userId) return
    const auto = settings.state.autoPace !== false
    const p = phase.value.pace
    if (p && p.base === settings.state.newPerDay && p.auto === auto) return
    phase.value = { ...phase.value, pace: { ...livePace.value, auto } }
    save()
  }
  watch(() => [progress.loaded, progress.dayKey, auth.userId, settings.state.newPerDay, settings.state.autoPace], fixPace, { immediate: true })

  /** New word ids to introduce today. */
  const newIds = computed(() => {
    rollIfNewDay()
    if (phase.value.newIds?.length) return phase.value.newIds
    return progress.newCandidates(pace.value.count, settings.target)
  })

  /** True when the setting cannot change today's plan any more. */
  const newCountLocked = computed(() =>
    learnStarted.value || !!phase.value.done?.learn
  )

  // Re-plan today when the target changes and nothing has been answered yet.
  watch(() => [settings.state.newPerDay, settings.state.autoPace], () => {
    if (newCountLocked.value) return
    if (!phase.value.newIds?.length) return
    const next = { ...phase.value }
    delete next.newIds
    phase.value = next
    save()
  })

  /** Cards due for review, capped, weakest first. Learning-step cards always come. */
  const reviewCards = computed(() => {
    const cap = settings.state.reviewCap
    const due = progress.dueCards
    const urgent = due.filter(c => c.state === STATE.LEARNING || c.state === STATE.RELEARNING)
    const rest = due.filter(c => c.state !== STATE.LEARNING && c.state !== STATE.RELEARNING)
    return [...urgent, ...rest.slice(0, Math.max(0, cap - urgent.length))]
  })

  const reviewIds = computed(() => reviewCards.value.map(c => c.wordId))

  /** Every word the day touches — what the article is built from. */
  const dayWordIds = computed(() => [...new Set([...newIds.value, ...reviewIds.value])])

  /** Today's track, and the phases that belong to it. */
  const track = computed(() => { rollIfNewDay(); return trackFor(phase.value.day) })
  const todayPhases = computed(() =>
    PHASES.filter(p => p.track === TRACK.BOTH || p.track === track.value)
      .map(p => p.key === 'play' ? { ...p, route: `/games/${questGame(phase.value.day)}?phase=1`, game: questGame(phase.value.day) } : p)
  )
  function runsToday (key) {
    return todayPhases.value.some(p => p.key === key)
  }

  const grammarPoint = computed(() => runsToday('grammar') ? grammar.todayPoint : null)
  const essentialUnit = computed(() => runsToday('essentials') ? essentials.todayUnit : null)
  const partsUnit = computed(() => runsToday('parts') ? parts.todayUnit : null)

  /**
   * Everything except the elastic phase.
   *
   * Per-item costs are deliberately higher than the first pass used. 0.35 min
   * per review card assumed a reader who can take in an English example
   * sentence at a glance; this learner reads one in 10-20 seconds.
   */
  const fixedMinutes = computed(() =>
    newIds.value.length * 1.4 +
    reviewCards.value.length * 0.7 +
    todayPhases.value
      .filter(p => p.key !== 'learn' && p.key !== 'review' && !p.elastic)
      .reduce((a, p) => a + p.minutes, 0)
  )

  /**
   * The listening phase absorbs the shortfall against the daily target.
   *
   * Early on the deck is empty, so the fixed phases finish in half the time
   * the learner set aside; months later the review queue alone fills an hour.
   * A fixed phase list cannot be right at both ends, so one phase flexes and
   * the rest stay predictable.
   */
  const listenMinutes = computed(() => {
    if (!runsToday('listen')) return 0
    const target = settings.state.dailyMinutes || 60
    const spare = target - fixedMinutes.value
    return Math.max(LISTEN_MIN_MINUTES, Math.min(LISTEN_MAX_MINUTES, Math.round(spare)))
  })

  /**
   * Listening is two parts since v6.1: the word/sentence round, and a short
   * 應答聽力 round (question → pick the response). The second takes about
   * three tenths of the phase's minutes, at roughly a minute an item with
   * its explanation.
   */
  const part2Count = computed(() => Math.max(3, Math.min(8, Math.round(listenMinutes.value * 0.3))))
  const listenCount = computed(() =>
    Math.max(6, Math.min(24, Math.round((listenMinutes.value * 0.7) / LISTEN_ITEM_MINUTES)))
  )

  /** The words today's listening is about: old misses, today's words, the weakest (lib/listening.js). */
  const listenWordIds = computed(() => listenTargets({
    missedIds: progress.listenErrors.map(e => e.wordId),
    dayIds: dayWordIds.value,
    weakIds: progress.weakestIds,
    want: 10,
    usable: id => !!words.get(id)?.meanings?.length
  }))

  const plan = computed(() => ({
    newCount: newIds.value.length,
    reviewCount: reviewCards.value.length,
    grammar: grammarPoint.value,
    essential: essentialUnit.value,
    parts: partsUnit.value,
    listenCount: listenCount.value,
    part2Count: part2Count.value,
    pace: pace.value,
    track: track.value,
    estimatedMinutes: Math.round(fixedMinutes.value + listenMinutes.value)
  }))

  /* ---------------- phase gating ---------------- */

  function isDone (key) { rollIfNewDay(); return !!phase.value.done[key] }

  function markDone (key) {
    rollIfNewDay()
    phase.value = { ...phase.value, done: { ...phase.value.done, [key]: true } }
    save()
  }

  /**
   * Freeze the new-word selection so a mid-session grade cannot shuffle it.
   * Until the first answer lands, the list is re-planned on every entry, so
   * opening the screen and backing out does not commit the learner to a count
   * they have since changed.
   */
  function lockNewIds () {
    rollIfNewDay()
    if (!phase.value.newIds?.length || !newCountLocked.value) {
      phase.value = { ...phase.value, newIds: progress.newCandidates(pace.value.count, settings.target) }
      save()
    }
    return phase.value.newIds
  }

  /**
   * A phase opens only when every phase before it is finished — or is empty,
   * which counts as finished. Gating each phase on its immediate predecessor
   * alone let a later phase unlock while an earlier one still showed a lock,
   * which reads as a broken chain.
   */
  const phaseStatus = computed(() => {
    rollIfNewDay()
    const empty = {
      learn: newIds.value.length === 0,
      review: reviewCards.value.length === 0,
      grammar: !grammarPoint.value,
      essentials: !essentialUnit.value,
      parts: !partsUnit.value,
      play: (progress.stats.seen || 0) < 6,
      // 應答聽力 needs no deck, but is only worth it once some words are known
      listen: listenWordIds.value.length < 2 && (progress.stats.seen || 0) < 30,
      write: false,
      read: false,
      summary: false
    }

    let chainOpen = true
    let currentTaken = false

    return todayPhases.value.map(p => {
      const done = !!phase.value.done[p.key]
      const unlocked = chainOpen
      // An empty phase (nothing due, no grammar left) counts as satisfied and
      // does not block the phases behind it.
      if (!(done || empty[p.key])) chainOpen = false

      const current = unlocked && !done && !empty[p.key] && !currentTaken
      if (current) currentTaken = true

      return { ...p, done, unlocked, current, empty: !!empty[p.key] }
    })
  })

  const currentPhase = computed(() => phaseStatus.value.find(p => p.current) || phaseStatus.value.at(-1))

  /**
   * Where a phase hands off to. Views used to hardcode the next route, which
   * meant the chain had to be edited in six files whenever the day's shape
   * changed — and silently broke the moment a phase stopped running daily.
   */
  function nextRoute (key) {
    const list = todayPhases.value
    const i = list.findIndex(p => p.key === key)
    if (i < 0 || i === list.length - 1) return '/'
    return list[i + 1].route
  }

  const completedCount = computed(() => phaseStatus.value.filter(p => p.done).length)
  const allDone = computed(() => phaseStatus.value.every(p => p.done))

  /* ---------------- time on task ---------------- */

  function startClock () {
    rollIfNewDay()
    if (activeTimer.value) return
    if (!phase.value.startedAt) {
      phase.value = { ...phase.value, startedAt: Date.now() }
      save()
    }
    activeTimer.value = setInterval(() => {
      // time with the app in the background is not study time
      if (typeof document !== 'undefined' && document.hidden) return
      phase.value = { ...phase.value, seconds: (phase.value.seconds || 0) + 10 }
      save()
      progress.setDay({ seconds: phase.value.seconds })
    }, 10000)
  }

  function stopClock () {
    if (activeTimer.value) { clearInterval(activeTimer.value); activeTimer.value = null }
  }

  const minutesToday = computed(() => Math.round((phase.value.seconds || 0) / 60))

  /**
   * Today's listening score.
   *
   * Kept in the local phase state rather than daily_log: that table has no
   * listen columns yet, and a failed upsert would take the whole day's row
   * down with it. Wrong answers still reach the error book, which is where
   * they are actually acted on.
   */
  function setListenResult (r) {
    rollIfNewDay()
    phase.value = { ...phase.value, listen: r }
    save()
  }
  const listenResult = computed(() => { rollIfNewDay(); return phase.value.listen || null })

  /** Make sure every word the day needs has translations/examples ready. */
  async function prepareData (onProgress) {
    const ids = dayWordIds.value
    const missing = words.missing(ids)
    if (!missing.length) return 0
    return words.ensureEnriched(missing, { onProgress })
  }

  function resetToday () {
    phase.value = { day: todayKey(), done: {}, startedAt: null, seconds: 0 }
    save()
  }

  return {
    PHASES, TRACK, phase, newIds, reviewCards, reviewIds, dayWordIds, grammarPoint, essentialUnit, partsUnit, plan,
    learnStarted, newCountLocked, track, todayPhases, runsToday, nextRoute,
    phaseStatus, currentPhase, completedCount, allDone, minutesToday,
    fixedMinutes, listenMinutes, listenCount, part2Count, listenWordIds, pace, listenResult, setListenResult,
    isDone, markDone, lockNewIds, startClock, stopClock, prepareData, resetToday, rollIfNewDay
  }
})
