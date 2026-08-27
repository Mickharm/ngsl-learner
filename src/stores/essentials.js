import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import ESSENTIALS, { ESSENTIAL_BY_ID } from '@/data/essentials'
import { newCard, schedule, GRADE, isMastered, gradeFromRatio } from '@/lib/srs'
import { useAuth } from './auth'
import { useProgress } from './progress'

/**
 * Foundation units, on the same SRS engine as everything else.
 *
 * Storage reuses the grammar_progress table: the row shape is identical (a
 * taught point with a schedule) and the ids cannot collide — grammar points
 * are g01…g30, essentials are e01…e12 — so this needs no migration. Each
 * store filters the table by its own prefix.
 */

const PREFIX = 'e'

export const useEssentials = defineStore('essentials', () => {
  const auth = useAuth()
  const progress = useProgress()

  const rows = ref(new Map())
  const loaded = ref(false)

  async function load () {
    if (!auth.userId) { loaded.value = true; return }
    const { data } = await supabase
      .from('grammar_progress').select('*')
      .eq('user_id', auth.userId)
      .like('grammar_id', `${PREFIX}%`)

    const next = new Map()
    for (const r of data || []) {
      next.set(r.grammar_id, {
        wordId: r.grammar_id,
        unitId: r.grammar_id,
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
        introducedAt: null
      })
    }
    rows.value = next
    loaded.value = true
  }

  async function persist (rec) {
    if (!auth.userId) return
    await supabase.from('grammar_progress').upsert({
      user_id: auth.userId,
      grammar_id: rec.unitId,
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

  /**
   * Essentials are not gated by vocabulary size. They are what a beginner
   * needs on day one — telling someone they must learn 400 words before they
   * can find out how to say a date would be backwards.
   */
  const all = computed(() => ESSENTIALS)

  const dueList = computed(() => {
    const now = Date.now()
    return ESSENTIALS.filter(u => {
      const r = rows.value.get(u.id)
      return r && r.dueAt <= now
    })
  })

  const nextNew = computed(() => ESSENTIALS.find(u => !rows.value.has(u.id)) || null)

  /** Today's unit: a due review first, otherwise the next unseen one. */
  const todayUnit = computed(() => dueList.value[0] || nextNew.value || null)

  const stats = computed(() => {
    let started = 0, mastered = 0, correct = 0, attempts = 0
    for (const r of rows.value.values()) {
      started++
      if (isMastered(r)) mastered++
      correct += r.correct
      attempts += r.attempts
    }
    return {
      total: ESSENTIALS.length, started, mastered, correct, attempts,
      accuracy: attempts ? correct / attempts : null
    }
  })

  /** Units the learner keeps getting wrong — fed to the drill generator. */
  const weakUnits = computed(() =>
    [...rows.value.values()]
      .filter(r => r.attempts >= 4 && r.correct / r.attempts < 0.75)
      .map(r => ESSENTIAL_BY_ID[r.unitId])
      .filter(Boolean)
  )

  function submit (unitId, { correct, total }) {
    const unit = ESSENTIAL_BY_ID[unitId]
    if (!unit || !total) return null

    const grade = gradeFromRatio(correct, total)

    const base = rows.value.get(unitId) || { ...newCard(unitId), unitId, correct: 0, attempts: 0 }
    const scheduled = schedule(base, grade, Date.now())
    const rec = {
      ...scheduled,
      unitId,
      correct: base.correct + correct,
      attempts: base.attempts + total
    }

    const next = new Map(rows.value)
    next.set(unitId, rec)
    rows.value = next
    persist(rec)

    progress.bumpDay({ grammar_correct: correct, grammar_total: total })
    if (grade === GRADE.AGAIN) progress.logError('essential', unitId, { correct, total, title: unit.title })

    return { rec, grade }
  }

  return { rows, loaded, load, recOf, all, dueList, nextNew, todayUnit, stats, weakUnits, submit }
})
