import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import base from '@/data/words.base.json'
import { supabase } from '@/lib/supabase'
import { idbGet, idbGetAll, idbPut, idbPutMany, STORE } from '@/lib/idb'
import { enrichWords, lookupWord } from '@/lib/gemini'
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

/**
 * Irregular surface forms the NGSL family lists and the suffix rules both miss.
 *
 * The suffix stripper handles -s/-ed/-ing/-ies; it cannot handle "went",
 * "children" or "better". Those are among the most frequent words in any
 * article, so before this table a beginner tapping the commonest words in the
 * text got nothing back at all.
 */
const IRREGULAR = Object.freeze({
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  went: 'go', gone: 'go', goes: 'go',
  said: 'say', made: 'make', took: 'take', taken: 'take',
  came: 'come', saw: 'see', seen: 'see', knew: 'know', known: 'know',
  got: 'get', gotten: 'get', gave: 'give', given: 'give',
  found: 'find', thought: 'think', told: 'tell', became: 'become',
  left: 'leave', felt: 'feel', put: 'put', brought: 'bring',
  began: 'begin', begun: 'begin', kept: 'keep', held: 'hold',
  wrote: 'write', written: 'write', stood: 'stand', heard: 'hear',
  let: 'let', meant: 'mean', met: 'meet', ran: 'run', paid: 'pay',
  sat: 'sit', spoke: 'speak', spoken: 'speak', lay: 'lie', led: 'lead',
  grew: 'grow', grown: 'grow', lost: 'lose', fell: 'fall', fallen: 'fall',
  sent: 'send', built: 'build', understood: 'understand',
  drew: 'draw', drawn: 'draw', broke: 'break', broken: 'break',
  spent: 'spend', cut: 'cut', rose: 'rise', risen: 'rise',
  driven: 'drive', drove: 'drive', bought: 'buy', wore: 'wear', worn: 'wear',
  chose: 'choose', chosen: 'choose', ate: 'eat', eaten: 'eat',
  sold: 'sell', taught: 'teach', caught: 'catch', flew: 'fly', flown: 'fly',
  fought: 'fight', threw: 'throw', thrown: 'throw', slept: 'sleep',
  won: 'win', laid: 'lay', read: 'read', hit: 'hit', set: 'set', cost: 'cost',
  children: 'child', men: 'man', women: 'woman', people: 'person',
  feet: 'foot', teeth: 'tooth', lives: 'life', wives: 'wife',
  knives: 'knife', leaves: 'leaf', halves: 'half', selves: 'self',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
  more: 'much', most: 'much', less: 'little', least: 'little',
  further: 'far', furthest: 'far', farther: 'far', farthest: 'far',
  an: 'a', its: 'it', his: 'he', him: 'he', her: 'she', hers: 'she',
  them: 'they', their: 'they', theirs: 'they', us: 'we', our: 'we', ours: 'we',
  me: 'i', my: 'i', mine: 'i', your: 'you', yours: 'you',
  'won\'t': 'will', 'can\'t': 'can', 'don\'t': 'do', 'didn\'t': 'do',
  'doesn\'t': 'do', 'isn\'t': 'be', 'aren\'t': 'be', 'wasn\'t': 'be'
})

export const useWords = defineStore('words', () => {
  const settings = useSettings()

  /** id -> enriched record */
  const enriched = ref(new Map())
  const hydrating = ref(false)
  const enriching = ref(false)
  const enrichProgress = ref({ done: 0, total: 0 })

  const baseById = new Map(base.map(w => [w.id, w]))

  /**
   * Any inflected surface form → word id, so a word tapped inside an article
   * ("waited", "achieving") resolves to its headword. Built once; the base
   * list already ships every family member the NGSL data knows about.
   */
  const idBySurface = (() => {
    const m = new Map()
    for (const w of base) {
      const key = w.h.toLowerCase()
      if (!m.has(key)) m.set(key, w.id)
      for (const f of w.f || []) {
        const fk = String(f).toLowerCase()
        if (fk && !m.has(fk)) m.set(fk, w.id)
      }
    }
    return m
  })()

  /** Resolve a word as it appears in running text. Returns an id or null. */
  function lookup (surface) {
    if (!surface) return null
    const k = String(surface).toLowerCase().replace(/[^a-z'-]/g, '')
    if (!k) return null
    if (idBySurface.has(k)) return idBySurface.get(k)
    const irr = IRREGULAR[k]
    if (irr && idBySurface.has(irr)) return idBySurface.get(irr)
    // cheap morphology for forms the family list misses
    for (const strip of ['s', 'es', 'ed', 'ing', "'s"]) {
      if (k.endsWith(strip)) {
        const stem = k.slice(0, -strip.length)
        if (idBySurface.has(stem)) return idBySurface.get(stem)
        if (strip === 'ing' || strip === 'ed') {
          if (idBySurface.has(stem + 'e')) return idBySurface.get(stem + 'e')
          // running → run, stopped → stop
          if (stem.length > 2 && stem.at(-1) === stem.at(-2) && idBySurface.has(stem.slice(0, -1))) {
            return idBySurface.get(stem.slice(0, -1))
          }
        }
      }
    }
    if (k.endsWith('ies') && idBySurface.has(k.slice(0, -3) + 'y')) return idBySurface.get(k.slice(0, -3) + 'y')
    return null
  }

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

  /* ---------------- ad-hoc glossary ---------------- *
   *
   * Words an article uses that are not NGSL headwords — proper nouns, forms no
   * rule resolves, anything past rank 2801. They are not study cards and never
   * enter the SRS; they exist so that tapping any word in the text produces an
   * answer instead of nothing. Cached in IndexedDB by surface form, because
   * the same handful recur across articles.
   */
  const glosses = ref(new Map())

  function glossOf (surface) {
    return glosses.value.get(String(surface).toLowerCase()) || null
  }

  async function gloss (surface, context = '') {
    const k = String(surface || '').toLowerCase().trim()
    if (!k) return null
    if (glosses.value.has(k)) return glosses.value.get(k)

    const cacheKey = `gloss:${k}`
    const cached = await idbGet(STORE.META, cacheKey)
    if (cached?.meanings?.length) {
      glosses.value = new Map(glosses.value).set(k, cached)
      return cached
    }

    const key = settings.state.geminiKey?.trim()
    if (!key) {
      const err = new Error('這個字不在 NGSL 2801 字表內，需要 Gemini API Key 才能即時查詢。')
      err.code = 'NO_KEY'
      throw err
    }

    const raw = await lookupWord(surface, {
      context,
      key,
      model: settings.state.geminiModel
    })

    const entry = {
      headword: raw?.headword || surface,
      base: raw?.base || '',
      formZh: raw?.form_zh || '',
      ipa: raw?.ipa || '',
      meanings: Array.isArray(raw?.meanings) ? raw.meanings.slice(0, 2) : [],
      examples: Array.isArray(raw?.examples) ? raw.examples.slice(0, 1) : [],
      confusables: [],
      adhoc: true,
      enriched: true
    }
    glosses.value = new Map(glosses.value).set(k, entry)
    idbPut(STORE.META, entry, cacheKey)
    return entry
  }

  const bandCounts = computed(() => {
    const acc = {}
    for (const w of base) acc[w.b] = (acc[w.b] || 0) + 1
    return acc
  })

  return {
    total, enriched, enrichedCount, hydrating, enriching, enrichProgress, bandCounts,
    get, getMany, range, search, baseOf, lookup, hydrate, ensureEnriched, missing, allBase: base,
    glosses, gloss, glossOf
  }
})
