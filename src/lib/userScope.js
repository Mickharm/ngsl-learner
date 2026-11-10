/**
 * Per-learner keys for state kept in this browser.
 *
 * The login screen is a profile picker — one device, several learners — but
 * until v6.1 the day's phase state, the placement flag and the talk history
 * were stored under one key each. The second learner to sign in on a shared
 * tablet found the first one's periods already ticked, was handed the first
 * one's frozen list of new words, and (with an empty deck) was never offered
 * the placement test because someone else had taken it here.
 *
 * `scoped` names the key; `adopt` carries the old unscoped value over once,
 * and only to the learner who was the last to use this device before the
 * update — anyone else starts clean, which is what they should have had.
 */
const LAST_USER_KEY = 'ngsl.lastUser'

export const scoped = (base, uid) => `${base}.${uid || 'anon'}`

export function adopt (base, uid, email, storage = globalThis.localStorage) {
  if (!uid || !storage) return
  try {
    const key = scoped(base, uid)
    const legacy = storage.getItem(base)
    if (legacy === null) return
    if (storage.getItem(key) === null && email && storage.getItem(LAST_USER_KEY) === email) storage.setItem(key, legacy)
    storage.removeItem(base)
  } catch { /* private mode */ }
}
