import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_KEY } from '@/config'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
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
