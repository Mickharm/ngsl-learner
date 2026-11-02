import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { useAuth } from './auth'
import { todayKey } from './progress'

/**
 * 家人聯絡簿 — the three learners can see each other's day: how many periods
 * of today's timetable are done, the streak, the word power. Seeing that the
 * others have already studied today is the cheapest motivation there is.
 *
 * One row per learner in `family_board`, readable by every signed-in member
 * and writable only by its owner (supabase/family.sql). If the table has not
 * been created yet the feature stays hidden — nothing else depends on it.
 */
export const useFamily = defineStore('family', () => {
  const auth = useAuth()
  const rows = ref([])
  const available = ref(false)
  let last = ''

  async function load () {
    if (!auth.userId) return
    const { data, error } = await supabase.from('family_board').select('*').order('xp', { ascending: false })
    if (error) { available.value = false; return }
    available.value = true
    rows.value = data || []
  }

  /** Publish this learner's line. Skipped when nothing changed since the last write. */
  async function publish (line) {
    if (!auth.userId || !available.value) return
    const row = { user_id: auth.userId, name: auth.displayName, day: todayKey(), ...line, updated_at: new Date().toISOString() }
    const sig = JSON.stringify({ ...row, updated_at: 0 })
    if (sig === last) return
    last = sig
    const { error } = await supabase.from('family_board').upsert(row, { onConflict: 'user_id' })
    if (!error) {
      const others = rows.value.filter(r => r.user_id !== auth.userId)
      rows.value = [...others, row].sort((a, b) => (b.xp || 0) - (a.xp || 0))
    }
  }

  /** Members with today's line; anyone whose row is from an earlier day shows as not started. */
  const board = computed(() => rows.value.map(r => {
    const fresh = r.day === todayKey()
    return {
      ...r,
      me: r.user_id === auth.userId,
      doneSteps: fresh ? r.done_steps : 0,
      minutes: fresh ? r.minutes : 0,
      finished: fresh && r.total_steps > 0 && r.done_steps >= r.total_steps
    }
  }))

  return { rows, available, board, load, publish }
})
