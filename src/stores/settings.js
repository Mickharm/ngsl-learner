import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { TOTAL_WORDS, DEFAULT_SETTINGS } from '@/config'
import { onModelResolved } from '@/lib/gemini'
import { useAuth } from './auth'

const LOCAL_KEY = 'ngsl.settings'

function readLocal () {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const obj = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
    // Migrate away from non-existent 3.5-flash which causes slow 404 fallbacks
    if (obj.geminiModel === 'gemini-3.5-flash') obj.geminiModel = 'gemini-1.5-flash'
    return obj
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function writeLocal (value) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(value)) } catch { /* private mode */ }
}

export const useSettings = defineStore('settings', () => {
  const auth = useAuth()
  const state = ref(readLocal())
  const loaded = ref(false)
  const saving = ref(false)

  let saveTimer = null

  /** Theme is applied to <html> so CSS tokens resolve before first paint. */
  function applyTheme (theme = state.value.theme) {
    const root = document.documentElement
    if (theme === 'light') root.setAttribute('data-theme', 'light')
    else if (theme === 'dark') root.setAttribute('data-theme', 'dark')
    else root.removeAttribute('data-theme')
  }

  async function load () {
    applyTheme()
    if (!auth.userId) { loaded.value = true; return }
    const { data, error } = await supabase
      .from('user_settings')
      .select('payload')
      .eq('user_id', auth.userId)
      .maybeSingle()

    if (!error && data?.payload) {
      // Remote wins on load; local is only the offline mirror.
      state.value = { ...DEFAULT_SETTINGS, ...data.payload }
      if (state.value.geminiModel === 'gemini-3.5-flash') state.value.geminiModel = 'gemini-1.5-flash'
      writeLocal(state.value)
      applyTheme()
    } else if (!error && !data) {
      await persist()
    }
    loaded.value = true
  }

  async function persist () {
    if (!auth.userId) return
    saving.value = true
    try {
      await supabase.from('user_settings').upsert({
        user_id: auth.userId,
        payload: state.value,
        updated_at: new Date().toISOString()
      })
    } catch { /* offline: the local mirror still holds the change */ }
    finally { saving.value = false }
  }

  function set (patch) {
    state.value = { ...state.value, ...patch }
    writeLocal(state.value)
    if ('theme' in patch) applyTheme()
    clearTimeout(saveTimer)
    saveTimer = setTimeout(persist, 700)
  }

  function reset () {
    state.value = { ...DEFAULT_SETTINGS }
    writeLocal(state.value)
    applyTheme()
    persist()
  }

  // gemini.js switches models by itself when the configured one 404s; keep the
  // discovery so the next session does not have to repeat it.
  onModelResolved(model => {
    if (model && model !== state.value.geminiModel) set({ geminiModel: model })
  })

  watch(() => auth.userId, id => { if (id) load() })

  const hasGeminiKey = computed(() => !!state.value.geminiKey?.trim())

  /**
   * Highest NGSL rank this learner is working towards. The whole list until
   * placement sets a ceiling — every progress denominator reads this rather
   * than TOTAL_WORDS, so "剩 400 字" means what is left of *their* phase.
   */
  const target = computed(() => state.value.targetWords || TOTAL_WORDS)

  return { state, loaded, saving, hasGeminiKey, target, load, set, reset, applyTheme, persist }
})
