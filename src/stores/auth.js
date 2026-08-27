import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { persistenceAvailable, requestDurableStorage } from '@/lib/authStorage'
import { vaultSupported, vaultSave, vaultRead, vaultMeta, vaultClear, vaultDestroy } from '@/lib/vault'

const LAST_USER_KEY = 'ngsl.lastUser'

/**
 * Session handling has three layers, tried in order on every launch:
 *
 *   1. the Supabase session already in storage (instant),
 *   2. a refresh with the stored refresh token (a second, needs network),
 *   3. the remembered credentials from the device vault (silent re-login).
 *
 * Layers 1 and 2 are what a browser is supposed to give you for free. They
 * fail often enough on a phone — storage eviction, a refresh token
 * invalidated elsewhere, a PWA that does not inherit the Safari tab's
 * storage — that "remember me" cannot be built on them alone. Layer 3 is the
 * one the learner actually asked for and the only one that never fails
 * quietly.
 */

export const useAuth = defineStore('auth', () => {
  const session = ref(null)
  const ready = ref(false)
  const busy = ref(false)
  const restoring = ref(false)     // silently signing back in
  const remembered = ref(null)     // { email, name, savedAt } | null
  const canRemember = ref(vaultSupported())
  const canPersist = ref(persistenceAvailable())

  const user = computed(() => session.value?.user ?? null)
  const userId = computed(() => user.value?.id ?? null)
  const signedIn = computed(() => !!user.value)
  const displayName = computed(() => {
    const u = user.value
    if (!u) return ''
    return u.user_metadata?.display_name || (u.email || '').split('@')[0] || '學習者'
  })

  /** The email this device saw last, so the picker can open on the right person. */
  const lastEmail = computed(() => {
    if (remembered.value?.email) return remembered.value.email
    try { return localStorage.getItem(LAST_USER_KEY) || '' } catch { return '' }
  })

  function noteUser (email) {
    try { localStorage.setItem(LAST_USER_KEY, email) } catch { /* ignore */ }
  }

  /* ---------------- boot ---------------- */

  let initPromise = null

  async function init () {
    if (initPromise) return initPromise
    initPromise = (async () => {
      remembered.value = await vaultMeta()

      const { data } = await supabase.auth.getSession()
      session.value = data.session ?? null

      supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'SIGNED_OUT' && restoring.value) return
        session.value = s ?? null
      })

      if (session.value) await ensureFresh()
      if (!session.value) await restore()

      ready.value = true
      attachResumeHandlers()
      if (session.value) requestDurableStorage()
    })()
    return initPromise
  }

  /**
   * An access token expires in an hour; a phone that has been in a pocket
   * since yesterday wakes up holding a dead one. Renew before anything tries
   * to use it, so the first query of the day does not 401 into a logout.
   */
  async function ensureFresh (marginMs = 120000) {
    const s = session.value
    if (!s) return false
    const expMs = (s.expires_at || 0) * 1000
    if (expMs - Date.now() > marginMs) return true
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data?.session) { session.value = data.session; return true }
      if (isNetworkError(error)) return true   // offline: keep what we have
      session.value = null
      return false
    } catch (err) {
      if (isNetworkError(err)) return true
      session.value = null
      return false
    }
  }

  /** Silent re-login from the device vault. */
  async function restore () {
    const creds = await vaultRead()
    if (!creds) return false
    restoring.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword(creds)
      if (error) {
        // A wrong password will never start working; anything else (offline,
        // rate limit) might, so only a rejected credential clears the vault.
        if (/invalid login|invalid credentials|not found/i.test(error.message || '')) {
          await vaultClear()
          remembered.value = null
        }
        return false
      }
      session.value = data.session
      noteUser(creds.email)
      return true
    } catch { return false } finally { restoring.value = false }
  }

  /* ---------------- resume ---------------- */

  let resumeAttached = false

  function attachResumeHandlers () {
    if (resumeAttached || typeof document === 'undefined') return
    resumeAttached = true
    const wake = async () => {
      if (document.visibilityState !== 'visible') return
      if (session.value) { await ensureFresh() }
      if (!session.value) await restore()
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    window.addEventListener('pageshow', e => { if (e.persisted) wake() })
  }

  /* ---------------- credentials ---------------- */

  async function signIn (email, password, { remember = true } = {}) {
    busy.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(translateAuthError(error.message))
      session.value = data.session
      noteUser(email)
      if (remember) await rememberThisDevice(email, password)
      else { await vaultClear(); remembered.value = null }
      requestDurableStorage()
      return data
    } finally { busy.value = false }
  }

  async function signUp (email, password, name, { remember = true } = {}) {
    busy.value = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name || email.split('@')[0] } }
      })
      if (error) throw new Error(translateAuthError(error.message))
      session.value = data.session
      noteUser(email)
      if (remember && data.session) await rememberThisDevice(email, password, name)
      return data
    } finally { busy.value = false }
  }

  async function rememberThisDevice (email, password, name) {
    const ok = await vaultSave({ email, password, name: name || email.split('@')[0] })
    canRemember.value = ok
    remembered.value = ok ? await vaultMeta() : null
    return ok
  }

  /** Explicit logout: forget the device too, or the next launch walks back in. */
  async function signOut () {
    await forgetDevice()
    await supabase.auth.signOut()
    session.value = null
  }

  async function forgetDevice () {
    await vaultClear()
    remembered.value = null
  }

  /** Used by the hard reset — drops the key itself, not just the blob. */
  async function wipeDevice () {
    await vaultDestroy()
    remembered.value = null
  }

  return {
    session, ready, busy, restoring, remembered, canRemember, canPersist,
    user, userId, signedIn, displayName, lastEmail,
    init, restore, ensureFresh, signIn, signUp, signOut, forgetDevice, wipeDevice, rememberThisDevice
  }
})

function isNetworkError (err) {
  if (!err) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const m = `${err.name || ''} ${err.message || ''}`.toLowerCase()
  return /fetch|network|retryable|timeout|failed to/.test(m)
}

function translateAuthError (msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Email 或密碼不正確'
  if (m.includes('already registered') || m.includes('already been registered')) return '這個 Email 已經註冊過了，請直接登入'
  if (m.includes('password should be at least')) return '密碼至少需要 6 個字元'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Email 格式不正確'
  if (m.includes('email not confirmed')) return '請先到信箱點擊確認信，或到 Supabase 後台關閉 Email 驗證'
  if (m.includes('rate limit') || m.includes('too many')) return '嘗試次數過多，請稍後再試'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return '這個 App 已關閉註冊，請用既有的帳號登入'
  if (m.includes('fetch')) return '無法連線到伺服器，請檢查網路'
  return msg || '登入失敗'
}
