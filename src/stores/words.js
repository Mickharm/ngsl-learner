import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import base from '@/data/words.base.json'
import { supabase } from '@/lib/supabase'
import { idbGetAll, idbPutMany, STORE } from '@/lib/idb'
import { enrichWords } from '@/lib/gemini'
import { useSettings } from './settings'

/**
 * Word data lives in three layers:
 *
 *   words.base.json  bundled, always present — rank / headword / band / family
 *   word_data table  shared across accounts; enriching a word once benefits
 *                    every user, which is why it is not per-user
 *   IndexedDB        offline mirror so a reload (or the MRT) still works
 *
 * Missing enrichment is filled on demand, in batches, right before the words
 * are needed for study — never all 2801 at once.
 */

const BATCH = 20

export const useWords = defineStore('words', () => {
  const settings = useSettings()

  /** id -> enriched record */
  const enriched = ref(new Map())
  const hydrating = ref(false)
  const enriching = ref(false)
  const enrichProgress = ref({ done: 0, total: 0 })

  const baseById = new Map(base.map(w => [w.id, w]))

  const total = base.length
  const enrichedCount = computed(() => enriched.value.size)

  function baseOf (id) {
    return baseById.get(id) || null
  }

  /** Merged view of a word: base fields always present, enrichment when known. */
  function get (id) {
    const b = baseById.get(id)
    if (!b) return null
    const e = enriched.value.get(id)
    return {
      id: b.id,
      headword: b.h,
      band: b.b,
      family: b.f || [],
      ipa: e?.ipa || '',
      meanings: e?.meanings || [],
      examples: e?.examples || [],
      confusables: e?.confusables || [],
      mnemonic: e?.mnemonic || '',
      enriched: !!e
    }
  }

  function getMany (ids) {
    return ids.map(get).filter(Boolean)
  }

  function range (from, to) {
    return base.filter(w => w.id >= from && w.id <= to).map(w => get(w.id))
  }

  function search (q, limit = 30) {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    const out = []
    for (const w of base) {
      if (w.h.toLowerCase().startsWith(needle)) {
        out.push(get(w.id))
        if (out.length >= limit) break
      }
    }
    if (out.length < limit) {
      for (const w of base) {
        if (out.length >= limit) break
        if (!w.h.toLowerCase().startsWith(needle) && w.h.toLowerCase().includes(needle)) out.push(get(w.id))
      }
    }
    return out
  }

  function absorb (rows) {
    if (!rows?.length) return
    const next = new Map(enriched.value)
    for (const r of rows) {
      next.set(r.id, {
        id: r.id,
        ipa: r.ipa || '',
        meanings: r.meanings || [],
        examples: r.examples || [],
        confusables: r.confusables || [],
        mnemonic: r.mnemonic || ''
      })
    }
    enriched.value = next
  }

  /** Load the offline mirror first (instant), then refresh from Supabase. */
  async function hydrate () {
    if (hydrating.value) return
    hydrating.value = true
    try {
      absorb(await idbGetAll(STORE.WORDS))

      let from = 0
      const page = 1000
      const all = []
      for (;;) {
        const { data, error } = await supabase
          .from('word_data')
          .select('id, ipa, meanings, examples, confusables, mnemonic')
          .order('id')
          .range(from, from + page - 1)
        if (error || !data?.length) break
        all.push(...data)
        if (data.length < page) break
        from += page
      }
      if (all.length) {
        absorb(all)
        await idbPutMany(STORE.WORDS, all)
      }
    } catch { /* offline — the mirror is enough */ }
    finally { hydrating.value = false }
  }

  function missing (ids) {
    return ids.filter(id => !enriched.value.has(id) && baseById.has(id))
  }

  /**
   * Fill in enrichment for the given ids. Returns the number of words added.
   * Safe to call with ids that are already enriched — they are skipped.
   */
  async function ensureEnriched (ids, { onProgress, signal } = {}) {
    const todo = missing([...new Set(ids)])
    if (!todo.length) return 0

    const key = settings.state.geminiKey?.trim()
    if (!key) {
      const err = new Error('尚未設定 Gemini API Key，無法產生單字資料。請到「設定」頁面填入。')
      err.code = 'NO_KEY'
      throw err
    }

    enriching.value = true
    enrichProgress.value = { done: 0, total: todo.length }
    let added = 0

    try {
      for (let i = 0; i < todo.length; i += BATCH) {
        if (signal?.aborted) break
        const chunk = todo.slice(i, i + BATCH)
        const heads = chunk.map(id => baseById.get(id).h)

        const results = await enrichWords(heads, {
          key,
          model: settings.state.geminiModel,
          signal
        })

        const rows = []
        results.forEach((r, n) => {
          if (!r) return
          const b = baseById.get(chunk[n])
          rows.push({
            id: b.id,
            headword: b.h,
            band: b.b,
            ipa: r.ipa || '',
            meanings: Array.isArray(r.meanings) ? r.meanings.slice(0, 3) : [],
            examples: Array.isArray(r.examples) ? r.examples.slice(0, 2) : [],
            confusables: Array.isArray(r.confusables) ? r.confusables.slice(0, 2) : [],
            mnemonic: r.mnemonic || '',
            family: b.f || [],
            source: 'gemini'
          })
        })

        if (rows.length) {
          absorb(rows)
          await idbPutMany(STORE.WORDS, rows)
          // Shared cache — best effort; a failure here costs a repeat call later.
          supabase.from('word_data').upsert(rows, { onConflict: 'id' }).then(() => {}, () => {})
          added += rows.length
        }

        enrichProgress.value = { done: Math.min(i + BATCH, todo.length), total: todo.length }
        onProgress?.(enrichProgress.value)
      }
    } finally {
      enriching.value = false
    }
    return added
  }

  const bandCounts = computed(() => {
    const acc = {}
    for (const w of base) acc[w.b] = (acc[w.b] || 0) + 1
    return acc
  })

  return {
    total, enriched, enrichedCount, hydrating, enriching, enrichProgress, bandCounts,
    get, getMany, range, search, baseOf, hydrate, ensureEnriched, missing, allBase: base
  }
})
