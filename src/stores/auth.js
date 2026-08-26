import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export const useAuth = defineStore('auth', () => {
  const session = ref(null)
  const ready = ref(false)
  const busy = ref(false)

  const user = computed(() => session.value?.user ?? null)
  const userId = computed(() => user.value?.id ?? null)
  const signedIn = computed(() => !!user.value)
  const displayName = computed(() => {
    const u = user.value
    if (!u) return ''
    return u.user_metadata?.display_name || (u.email || '').split('@')[0] || '學習者'
  })

  async function init () {
    const { data } = await supabase.auth.getSession()
    session.value = data.session ?? null
    supabase.auth.onAuthStateChange((_event, s) => { session.value = s })
    ready.value = true
  }

  async function signIn (email, password) {
    busy.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw new Error(translateAuthError(error.message))
      session.value = data.session
      return data
    } finally { busy.value = false }
  }

  async function signUp (email, password, name) {
    busy.value = true
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: name || email.split('@')[0] } }
      })
      if (error) throw new Error(translateAuthError(error.message))
      session.value = data.session
      return data
    } finally { busy.value = false }
  }

  async function signOut () {
    await supabase.auth.signOut()
    session.value = null
  }

  return { session, ready, busy, user, userId, signedIn, displayName, init, signIn, signUp, signOut }
})

function translateAuthError (msg = '') {
  const m = msg.toLowerCase()
  if (m.includes('invalid login')) return 'Email 或密碼不正確'
  if (m.includes('already registered') || m.includes('already been registered')) return '這個 Email 已經註冊過了，請直接登入'
  if (m.includes('password should be at least')) return '密碼至少需要 6 個字元'
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'Email 格式不正確'
  if (m.includes('email not confirmed')) return '請先到信箱點擊確認信，或到 Supabase 後台關閉 Email 驗證'
  if (m.includes('rate limit') || m.includes('too many')) return '嘗試次數過多，請稍後再試'
  if (m.includes('fetch')) return '無法連線到伺服器，請檢查網路'
  return msg || '登入失敗'
}
