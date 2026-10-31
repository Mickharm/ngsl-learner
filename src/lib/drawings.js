/**
 * The learner's own drawings, one per word, kept on the device.
 *
 * Stored as small PNG data URLs in the IndexedDB meta store under
 * `draw:<wordId>` — no schema bump, and they never leave the phone: they are
 * a personal memory aid, not learning data anyone else needs.
 */
import { idbGet, idbPut, idbDelete, STORE } from './idb'

const cache = new Map()

export async function loadDrawing (wordId) {
  if (cache.has(wordId)) return cache.get(wordId)
  try {
    const v = await idbGet(STORE.META, `draw:${wordId}`)
    cache.set(wordId, v || '')
    return v || ''
  } catch { return '' }
}

export async function saveDrawing (wordId, dataUrl) {
  cache.set(wordId, dataUrl || '')
  try {
    if (dataUrl) await idbPut(STORE.META, dataUrl, `draw:${wordId}`)
    else await idbDelete(STORE.META, `draw:${wordId}`)
  } catch { /* storage full or private mode — the drawing still shows this session */ }
}

export function hasDrawingCached (wordId) {
  return !!cache.get(wordId)
}

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
