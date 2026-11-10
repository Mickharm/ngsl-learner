import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { UNITS, UNIT_BY_ID } from '@/data/morphology'
import { newCard, schedule, GRADE, isMastered, gradeFromRatio, CONCEPT_SRS } from '@/lib/srs'
import { useAuth } from './auth'
import { useProgress } from './progress'

/**
 * Word Parts units on the concept scheduler.
 *
 * Same table and row shape as grammar (g01…) and essentials (e01…); these
 * are p01…p15, so the three stores never read each other's rows and the
 * database needs no migration.
 */
const PREFIX = 'p'

export const useParts = defineStore('parts', () => {
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
      if (!String(r.grammar_id).startsWith(PREFIX)) continue
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

  const dueList = computed(() => {
    const now = progress.now
    return UNITS.filter(u => { const r = rows.value.get(u.id); return r && r.dueAt <= now })
  })
  const nextNew = computed(() => UNITS.find(u => !rows.value.has(u.id)) || null)

  /** A due unit first once two have piled up; otherwise keep the course moving. */
  const todayUnit = computed(() => {
    if (nextNew.value && dueList.value.length < 2) return nextNew.value
    return dueList.value[0] || nextNew.value || null
  })

  const stats = computed(() => {
    let started = 0, mastered = 0
    for (const r of rows.value.values()) { started++; if (isMastered(r)) mastered++ }
    return { total: UNITS.length, started, mastered }
  })

  function submit (unitId, { correct, total }) {
    const unit = UNIT_BY_ID[unitId]
    if (!unit || !total) return null
    const grade = gradeFromRatio(correct, total)
    const baseRec = rows.value.get(unitId) || { ...newCard(unitId), unitId, correct: 0, attempts: 0 }
    const scheduled = schedule(baseRec, grade, Date.now(), CONCEPT_SRS)
    const rec = { ...scheduled, unitId, correct: baseRec.correct + correct, attempts: baseRec.attempts + total }
    const next = new Map(rows.value)
    next.set(unitId, rec)
    rows.value = next
    persist(rec)
    progress.bumpDay({ grammar_correct: correct, grammar_total: total })
    if (grade === GRADE.AGAIN) progress.logError('parts', unitId, { correct, total, title: unit.title })
    else progress.resolveErrorsFor('parts', unitId)     // passed since: no longer an open mistake
    return { rec, grade }
  }

  return { rows, loaded, load, recOf, dueList, nextNew, todayUnit, stats, submit }
})
