/**
 * Tiny IndexedDB helper — no dependency, promise-based.
 *
 * Role in this app: an *offline mirror*, never the source of truth. Supabase
 * holds the canonical progress so both devices and both users stay in sync;
 * this cache exists so a subway ride with no signal still works, and so the
 * enriched word data (which is expensive to regenerate) survives a reload.
 */

const DB_NAME = 'ngsl-learner'
const DB_VERSION = 2

export const STORE = Object.freeze({
  WORDS: 'words',       // enriched word data, keyed by word id
  CARDS: 'cards',       // srs card state, keyed by word id
  META: 'meta',         // misc key/value (settings mirror, sync stamps)
  OUTBOX: 'outbox',     // mutations awaiting upload
  ARTICLES: 'articles'  // generated articles, keyed by `${date}`
})

let dbPromise = null

function open () {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'))
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE.WORDS)) db.createObjectStore(STORE.WORDS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(STORE.CARDS)) db.createObjectStore(STORE.CARDS, { keyPath: 'wordId' })
      if (!db.objectStoreNames.contains(STORE.META)) db.createObjectStore(STORE.META)
      if (!db.objectStoreNames.contains(STORE.OUTBOX)) db.createObjectStore(STORE.OUTBOX, { keyPath: 'id', autoIncrement: true })
      if (!db.objectStoreNames.contains(STORE.ARTICLES)) db.createObjectStore(STORE.ARTICLES, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }).catch(err => { dbPromise = null; throw err })
  return dbPromise
}

async function tx (store, mode, fn) {
  const db = await open()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode)
    const s = t.objectStore(store)
    let result
    try { result = fn(s) } catch (err) { return reject(err) }
    t.oncomplete = () => resolve(result?.__req ? result.__req.result : result)
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

const wrap = req => ({ __req: req })

export async function idbGet (store, key) {
  try { return await tx(store, 'readonly', s => wrap(s.get(key))) } catch { return undefined }
}

export async function idbGetAll (store) {
  try { return (await tx(store, 'readonly', s => wrap(s.getAll()))) || [] } catch { return [] }
}

export async function idbPut (store, value, key) {
  try { return await tx(store, 'readwrite', s => wrap(key === undefined ? s.put(value) : s.put(value, key))) } catch { return null }
}

export async function idbPutMany (store, values) {
  if (!values?.length) return
  try { await tx(store, 'readwrite', s => { for (const v of values) s.put(v) }) } catch { /* offline cache is best-effort */ }
}

export async function idbDelete (store, key) {
  try { await tx(store, 'readwrite', s => s.delete(key)) } catch { /* ignore */ }
}

export async function idbClear (store) {
  try { await tx(store, 'readwrite', s => s.clear()) } catch { /* ignore */ }
}

export async function idbCount (store) {
  try { return (await tx(store, 'readonly', s => wrap(s.count()))) || 0 } catch { return 0 }
}
