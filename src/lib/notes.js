/**
 * The learner's own sentence for a word, kept on the device.
 *
 * Self-reference makes a word stick better than a textbook example (the
 * self-reference effect), and writing it is a small act of production on the
 * very first encounter. Stored in the IndexedDB meta store as `note:<id>`.
 *
 * (v2 also kept free drawings here. They were dropped in v3: a learner who
 * does not know what to draw for "however" learns nothing from the blank
 * canvas, and that was most words.)
 */
import { idbGet, idbPut, idbDelete, STORE } from './idb'

/* The learner's own sentence for a word — self-reference makes a word stick
 * better than a textbook example (the self-reference effect), and writing it
 * is a small act of production on the very first encounter. */
const notes = new Map()

export async function loadNote (wordId) {
  if (notes.has(wordId)) return notes.get(wordId)
  try {
    const v = await idbGet(STORE.META, `note:${wordId}`)
    notes.set(wordId, v || '')
    return v || ''
  } catch { return '' }
}

export async function saveNote (wordId, text) {
  const t = String(text || '').trim()
  notes.set(wordId, t)
  try {
    if (t) await idbPut(STORE.META, t, `note:${wordId}`)
    else await idbDelete(STORE.META, `note:${wordId}`)
  } catch { /* ignore */ }
}
