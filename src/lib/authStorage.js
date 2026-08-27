import { STORE, idbGet, idbPut, idbDelete } from './idb'

/**
 * Storage for the Supabase session, mirrored across localStorage and
 * IndexedDB.
 *
 * localStorage alone is the default and it is the flakiest thing in the
 * stack: it throws outright in private windows, it is the first thing an
 * iPhone drops when the origin looks idle, and a quota error inside a
 * try-less write takes the session with it. When the mirror still has the
 * row we hand it back and repair localStorage on the way out, so losing one
 * store no longer means losing the login.
 *
 * Reads are async, which the Supabase storage contract allows.
 */

const MEM = new Map()

function local () {
  try {
    const ls = globalThis.localStorage
    // Safari throws on *access* in some configurations, not just on write.
    ls?.getItem('ngsl.probe')
    return ls || null
  } catch { return null }
}

export const authStorage = {
  async getItem (key) {
    const ls = local()
    try {
      const hit = ls?.getItem(key)
      if (hit != null) return hit
    } catch { /* fall through to the mirror */ }

    if (MEM.has(key)) return MEM.get(key)

    const mirrored = await idbGet(STORE.META, `auth.mirror:${key}`)
    if (typeof mirrored === 'string') {
      MEM.set(key, mirrored)
      try { ls?.setItem(key, mirrored) } catch { /* mirror is enough */ }
      return mirrored
    }
    return null
  },

  async setItem (key, value) {
    MEM.set(key, value)
    try { local()?.setItem(key, value) } catch { /* mirror is enough */ }
    await idbPut(STORE.META, value, `auth.mirror:${key}`)
  },

  async removeItem (key) {
    MEM.delete(key)
    try { local()?.removeItem(key) } catch { /* ignore */ }
    await idbDelete(STORE.META, `auth.mirror:${key}`)
  }
}

/** True when this browser can hold a session across launches at all. */
export function persistenceAvailable () {
  return !!local() || typeof indexedDB !== 'undefined'
}

/**
 * Ask the browser to exempt this origin from routine storage eviction.
 * Granted silently on an installed PWA; ignored where unsupported.
 */
export async function requestDurableStorage () {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch { return false }
}
