import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useProgress, todayKey } from './progress'
import { useSettings } from './settings'
import { useWords } from './words'
import { useGrammar } from './grammar'
import { STATE } from '@/lib/srs'

/**
 * The day's quest. Five phases, each unlocked by the one before it, so the
 * learner cannot binge new words while a review backlog rots — the single
 * failure mode that kills vocabulary apps.
 *
 * Phase state lives in localStorage keyed by date: it is UI position, not
 * learning data, and does not deserve a round trip to the database.
 */

/**
 * The dashboard itself is the day's briefing, so it is not a step in its own
 * list — the quest is the five things the learner actually has to do.
 */
export const PHASES = [
  { key: 'learn',   label: '新單字', route: '/learn',   minutes: 18 },
  { key: 'review',  label: '複習',   route: '/review',  minutes: 22 },
  { key: 'grammar', label: '文法',   route: '/grammar', minutes: 15 },
  { key: 'article', label: '閱讀',   route: '/article', minutes: 20 },
  { key: 'summary', label: '結算',   route: '/summary', minutes: 3 }
]

const LS_KEY = 'ngsl.session'

function readPhaseState () {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || 'null')
    if (raw?.day === todayKey()) return raw
  } catch { /* ignore */ }
  return { day: todayKey(), done: {}, startedAt: null, seconds: 0 }
}

export const useSession = defineStore('session', () => {
  const progress = useProgress()
  const settings = useSettings()
  const words = useWords()
  const grammar = useGrammar()

  const phase = ref(readPhaseState())
  const activeTimer = ref(null)

  function save () {
    try { localStorage.setItem(LS_KEY, JSON.stringify(phase.value)) } catch { /* ignore */ }
  }

  function rollIfNewDay () {
    if (phase.value.day !== todayKey()) {
      phase.value = { day: todayKey(), done: {}, startedAt: null, seconds: 0 }
      save()
    }
  }

  /* ---------------- the day's plan ---------------- */

  /** New word ids to introduce today (fixed once the phase starts). */
  const newIds = computed(() => {
    rollIfNewDay()
    if (phase.value.newIds?.length) return phase.value.newIds
    return progress.newCandidates(settings.state.newPerDay)
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

  const grammarPoint = computed(() => grammar.todayPoint)

  const plan = computed(() => ({
    newCount: newIds.value.length,
    reviewCount: reviewCards.value.length,
    grammar: grammarPoint.value,
    estimatedMinutes: Math.round(
      newIds.value.length * 1.1 +
      reviewCards.value.length * 0.35 +
      (grammarPoint.value ? 15 : 0) + 20
    )
  }))

  /* ---------------- phase gating ---------------- */

  function isDone (key) { rollIfNewDay(); return !!phase.value.done[key] }

  function markDone (key) {
    rollIfNewDay()
    phase.value = { ...phase.value, done: { ...phase.value.done, [key]: true } }
    save()
  }

  /** Freeze the new-word selection so a mid-session grade cannot shuffle it. */
  function lockNewIds () {
    rollIfNewDay()
    if (!phase.value.newIds?.length) {
      phase.value = { ...phase.value, newIds: progress.newCandidates(settings.state.newPerDay) }
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
      article: false,
      summary: false
    }

    let chainOpen = true
    let currentTaken = false

    return PHASES.map(p => {
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
      phase.value = { ...phase.value, seconds: (phase.value.seconds || 0) + 10 }
      save()
      progress.setDay({ seconds: phase.value.seconds })
    }, 10000)
  }

  function stopClock () {
    if (activeTimer.value) { clearInterval(activeTimer.value); activeTimer.value = null }
  }

  const minutesToday = computed(() => Math.round((phase.value.seconds || 0) / 60))

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
    PHASES, phase, newIds, reviewCards, reviewIds, dayWordIds, grammarPoint, plan,
    phaseStatus, currentPhase, completedCount, allDone, minutesToday,
    isDone, markDone, lockNewIds, startClock, stopClock, prepareData, resetToday, rollIfNewDay
  }
})
