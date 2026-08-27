import { STORE, idbGet, idbPut, idbDelete } from './idb'

/**
 * "Remember me" on this device.
 *
 * Supabase already persists a session, but that session is not eternal: iOS
 * evicts script-writable storage from sites it considers idle, a rotated
 * refresh token can be invalidated from another context, and a home-screen
 * PWA does not share storage with the Safari tab it was added from. Any of
 * those drops the learner back on the password screen on a device they have
 * used every day — which is exactly the complaint this file answers.
 *
 * So the session is the fast path and this is the fallback: with the box
 * ticked, the credentials are kept locally and replayed silently whenever the
 * session is gone, so the login form is never shown twice on one device.
 *
 * Storing a password locally is a real trade-off, so it is made as small as
 * possible. The password is encrypted with AES-GCM under a 256-bit key that
 * is generated *non-extractable* and lives only inside IndexedDB: the browser
 * will use it to decrypt but will not hand its bytes to any script, this one
 * included. A device backup, a copied profile directory or a glance at
 * DevTools' storage pane therefore yields ciphertext, not a password. It is
 * not protection against code running on this origin — nothing in a browser
 * is — and if the platform offers no WebCrypto or no IndexedDB we decline
 * rather than quietly falling back to plaintext.
 */

const KEY_ID = 'auth.deviceKey'
const BLOB_ID = 'auth.remembered'

export function vaultSupported () {
  return typeof indexedDB !== 'undefined' &&
    typeof crypto !== 'undefined' && !!crypto.subtle && !!crypto.getRandomValues
}

async function deviceKey (create) {
  if (!vaultSupported()) return null
  const existing = await idbGet(STORE.META, KEY_ID)
  if (existing) return existing
  if (!create) return null
  try {
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
    await idbPut(STORE.META, key, KEY_ID)
    // A key we failed to store would encrypt a blob nobody can ever read.
    const back = await idbGet(STORE.META, KEY_ID)
    return back || null
  } catch { return null }
}

const enc = new TextEncoder()
const dec = new TextDecoder()

/** Save credentials for silent re-login. Returns true only if really stored. */
export async function vaultSave ({ email, password, name }) {
  const key = await deviceKey(true)
  if (!key) return false
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const data = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify({ email, password }))
    )
    await idbPut(STORE.META, { iv, data, email, name: name || '', savedAt: Date.now() }, BLOB_ID)
    return !!(await idbGet(STORE.META, BLOB_ID))
  } catch { return false }
}

/** Who this device remembers, without decrypting anything. */
export async function vaultMeta () {
  try {
    const row = await idbGet(STORE.META, BLOB_ID)
    if (!row?.data) return null
    return { email: row.email, name: row.name, savedAt: row.savedAt }
  } catch { return null }
}

/** The stored credentials, or null. */
export async function vaultRead () {
  const key = await deviceKey(false)
  if (!key) return null
  try {
    const row = await idbGet(STORE.META, BLOB_ID)
    if (!row?.data) return null
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: row.iv }, key, row.data)
    const creds = JSON.parse(dec.decode(plain))
    if (!creds?.email || !creds?.password) return null
    return creds
  } catch {
    // Undecryptable — a wiped key, a corrupt row. Drop it rather than retry.
    await vaultClear()
    return null
  }
}

export async function vaultClear () {
  await idbDelete(STORE.META, BLOB_ID)
}

/** Forget the device key too. Used by the hard reset. */
export async function vaultDestroy () {
  await idbDelete(STORE.META, BLOB_ID)
  await idbDelete(STORE.META, KEY_ID)
}
