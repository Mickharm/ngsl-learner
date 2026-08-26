import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SETTINGS } from '@/config'
import { useAuth } from './auth'

const LOCAL_KEY = 'ngsl.settings'

function readLocal () {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
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

  watch(() => auth.userId, id => { if (id) load() })

  const hasGeminiKey = computed(() => !!state.value.geminiKey?.trim())

  return { state, loaded, saving, hasGeminiKey, load, set, reset, applyTheme, persist }
})
