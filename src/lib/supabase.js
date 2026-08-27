import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from '@/config'
import { authStorage } from './authStorage'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Nothing here signs in through a URL — no OAuth, no magic links. Leaving
    // it on only gives the client a reason to inspect (and rewrite) the hash
    // that vue-router owns.
    detectSessionInUrl: false,
    flowType: 'implicit',
    storage: authStorage,
    storageKey: 'ngsl.auth'
  }
})

/** Wrap a PostgREST call so callers get `{ data, error }` without throwing. */
export async function safe (promise) {
  try {
    const { data, error } = await promise
    if (error) return { data: null, error }
    return { data, error: null }
  } catch (err) {
    return { data: null, error: err }
  }
}

export function isOnline () {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false
}
