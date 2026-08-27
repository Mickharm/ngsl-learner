import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import GRAMMAR, { GRAMMAR_BY_ID } from '@/data/grammar'
import { newCard, schedule, GRADE, STATE, isMastered, gradeFromRatio } from '@/lib/srs'
import { useAuth } from './auth'
import { useProgress } from './progress'

/**
 * Grammar points run on the same SRS engine as vocabulary, but the "card" is a
 * concept rather than a word, and a review means re-doing its drills. A point
 * is only introduced once the learner's vocabulary has reached its band, so
 * grammar never runs ahead of the words needed to practise it.
 */

const BAND_GATE = { B1: 0, B2: 400, B3: 1100 }

export const useGrammar = defineStore('grammar', () => {
  const auth = useAuth()
  const progress = useProgress()

  const rows = ref(new Map())    // grammarId -> record
  const loaded = ref(false)

  async function load () {
    if (!auth.userId) { loaded.value = true; return }
    // The essentials store shares this table; ids are g01… vs e01… so each
    // side filters by its own prefix rather than needing a second table.
    const { data } = await supabase
      .from('grammar_progress').select('*')
      .eq('user_id', auth.userId)
      .like('grammar_id', 'g%')
    const next = new Map()
    for (const r of data || []) {
      next.set(r.grammar_id, {
        grammarId: r.grammar_id,
        state: r.state,
        ease: r.ease,
        intervalDays: r.interval_days,
        stepIndex: r.step_index,
        dueAt: new Date(r.due_at).getTime(),
        reps: r.reps,
        lapses: r.lapses,
        streak: r.streak,
        correct: r.correct,
        attempts: r.attempts,
        lastReviewedAt: null,
        introducedAt: null,
        wordId: r.grammar_id
      })
    }
    rows.value = next
    loaded.value = true
  }

  async function persist (rec) {
    if (!auth.userId) return
    await supabase.from('grammar_progress').upsert({
      user_id: auth.userId,
      grammar_id: rec.grammarId,
      state: rec.state,
      ease: rec.ease,
      interval_days: rec.intervalDays,
      step_index: rec.stepIndex,
      due_at: new Date(rec.dueAt).toISOString(),
      reps: rec.reps,
      lapses: rec.lapses,
      streak: rec.streak,
      correct: rec.correct,
      attempts: rec.attempts
    }, { onConflict: 'user_id,grammar_id' }).then(() => {}, () => {})
  }

  function recOf (id) { return rows.value.get(id) || null }

  /** Grammar points whose band the learner's vocabulary has reached. */
  const available = computed(() => {
    const seen = progress.stats.seen
    return GRAMMAR.filter(g => seen >= (BAND_GATE[g.band] ?? 0))
  })

  const dueList = computed(() => {
    const now = Date.now()
    return available.value.filter(g => {
      const r = rows.value.get(g.id)
      return r && r.dueAt <= now
    })
  })

  /** The next unseen point in study order. */
  const nextNew = computed(() => available.value.find(g => !rows.value.has(g.id)) || null)

  /** What today's grammar slot should be: a due review, else a new point. */
  const todayPoint = computed(() => dueList.value[0] || nextNew.value || null)

  const stats = computed(() => {
    let started = 0, mastered = 0, correct = 0, attempts = 0
    for (const r of rows.value.values()) {
      started++
      if (isMastered(r)) mastered++
      correct += r.correct
      attempts += r.attempts
    }
    return { total: GRAMMAR.length, started, mastered, correct, attempts, accuracy: attempts ? correct / attempts : null }
  })

  /**
   * Record a completed drill set. `ratio` is the share answered correctly,
   * which maps onto the same four-grade scale the vocabulary cards use.
   */
  function submit (grammarId, { correct, total }) {
    const g = GRAMMAR_BY_ID[grammarId]
    if (!g) return null

    const grade = gradeFromRatio(correct, total)

    const base = rows.value.get(grammarId) || { ...newCard(grammarId), grammarId, correct: 0, attempts: 0 }
    const scheduled = schedule(base, grade, Date.now())
    const rec = {
      ...scheduled,
      grammarId,
      correct: base.correct + correct,
      attempts: base.attempts + total
    }

    const next = new Map(rows.value)
    next.set(grammarId, rec)
    rows.value = next
    persist(rec)

    progress.bumpDay({ grammar_correct: correct, grammar_total: total })
    if (grade === GRADE.AGAIN) progress.logError('grammar', grammarId, { correct, total })

    return { rec, grade }
  }

  return { rows, loaded, load, recOf, available, dueList, nextNew, todayPoint, stats, submit, all: GRAMMAR, STATE }
})
