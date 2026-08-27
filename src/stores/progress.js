import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import { idbGetAll, idbPutMany, idbPut, idbGet, idbDelete, STORE } from '@/lib/idb'
import {
  newCard, schedule, GRADE, STATE, isMastered, sortReviewQueue, retrievability
} from '@/lib/srs'
import { STAGE_SIZE, STAGE_UNLOCK_RATIO } from '@/config'
import AFFIX from '@/data/affix.json'
const AFFIX_FAMILIES = AFFIX.families
import { useAuth } from './auth'
import { useSettings } from './settings'

/* ---------- date helpers (all in the learner's local day) ---------- */
export function todayKey (d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function daysBetween (aKey, bKey) {
  return Math.round((new Date(bKey + 'T00:00:00') - new Date(aKey + 'T00:00:00')) / 86400000)
}

/* ---------- row <-> card mapping ---------- */
function rowToCard (r) {
  return {
    wordId: r.word_id,
    state: r.state,
    ease: r.ease,
    intervalDays: r.interval_days,
    stepIndex: r.step_index,
    dueAt: new Date(r.due_at).getTime(),
    reps: r.reps,
    lapses: r.lapses,
    streak: r.streak,
    lastGrade: r.last_grade,
    lastReviewedAt: r.last_reviewed_at ? new Date(r.last_reviewed_at).getTime() : null,
    introducedAt: r.introduced_at ? new Date(r.introduced_at).getTime() : null
  }
}
function cardToRow (c, userId) {
  return {
    user_id: userId,
    word_id: c.wordId,
    state: c.state,
    ease: c.ease,
    interval_days: c.intervalDays,
    step_index: c.stepIndex,
    due_at: new Date(c.dueAt).toISOString(),
    reps: c.reps,
    lapses: c.lapses,
    streak: c.streak,
    last_grade: c.lastGrade,
    last_reviewed_at: c.lastReviewedAt ? new Date(c.lastReviewedAt).toISOString() : null,
    introduced_at: c.introducedAt ? new Date(c.introducedAt).toISOString() : null
  }
}

export const useProgress = defineStore('progress', () => {
  const auth = useAuth()
  const settings = useSettings()

  /** wordId -> card */
  const cards = ref(new Map())
  const today = ref(blankDay(todayKey()))
  const history = ref([])          // recent daily_log rows
  const errors = ref([])           // open error_log rows
  const loaded = ref(false)
  const syncing = ref(false)

  /** Mutations that could not reach Supabase yet. */
  let outbox = []
  let flushTimer = null

  function blankDay (day) {
    return {
      day,
      new_count: 0,
      review_count: 0,
      correct_count: 0,
      total_count: 0,
      grammar_correct: 0,
      grammar_total: 0,
      article_done: false,
      article_correct: 0,
      article_total: 0,
      seconds: 0,
      completed: false
    }
  }

  /* ------------------------------------------------------------------ *
   * load
   * ------------------------------------------------------------------ */
  async function load () {
    const cached = await idbGetAll(STORE.CARDS)
    if (cached.length) cards.value = new Map(cached.map(c => [c.wordId, c]))

    const savedOutbox = await idbGet(STORE.META, 'outbox')
    if (Array.isArray(savedOutbox)) outbox = savedOutbox

    if (!auth.userId) { loaded.value = true; return }

    try {
      const rows = []
      let from = 0
      const page = 1000
      for (;;) {
        const { data, error } = await supabase
          .from('card_progress')
          .select('*')
          .eq('user_id', auth.userId)
          .order('word_id')
          .range(from, from + page - 1)
        if (error) throw error
        if (!data?.length) break
        rows.push(...data)
        if (data.length < page) break
        from += page
      }
      const next = new Map()
      for (const r of rows) next.set(r.word_id, rowToCard(r))
      // Anything still queued locally is newer than what the server returned.
      for (const q of outbox) {
        if (q.kind === 'card') next.set(q.card.wordId, q.card)
        else if (q.kind === 'card-delete') next.delete(q.wordId)
      }
      cards.value = next
      await idbPutMany(STORE.CARDS, [...next.values()])

      await loadDay()
      await loadHistory()
      await loadErrors()
      flush()
    } catch { /* offline: run from the local mirror */ }
    loaded.value = true
  }

  async function loadDay () {
    if (!auth.userId) return
    const key = todayKey()
    const { data } = await supabase
      .from('daily_log').select('*')
      .eq('user_id', auth.userId).eq('day', key).maybeSingle()
    today.value = data ? { ...blankDay(key), ...data } : blankDay(key)
  }

  async function loadHistory (days = 120) {
    if (!auth.userId) return
    const since = new Date(Date.now() - days * 86400000)
    const { data } = await supabase
      .from('daily_log').select('*')
      .eq('user_id', auth.userId)
      .gte('day', todayKey(since))
      .order('day')
    history.value = data || []
  }

  async function loadErrors () {
    if (!auth.userId) return
    const { data } = await supabase
      .from('error_log').select('*')
      .eq('user_id', auth.userId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(300)
    errors.value = data || []
  }

  /* ------------------------------------------------------------------ *
   * outbox — every write goes through here so offline never loses data
   * ------------------------------------------------------------------ */
  function enqueue (item) {
    outbox.push(item)
    idbPut(STORE.META, outbox, 'outbox')
    clearTimeout(flushTimer)
    flushTimer = setTimeout(flush, 900)
  }

  async function flush () {
    if (!auth.userId || !outbox.length || syncing.value) return
    syncing.value = true
    const batch = outbox.slice()
    try {
      const cardRows = batch.filter(i => i.kind === 'card').map(i => cardToRow(i.card, auth.userId))
      const logRows = batch.filter(i => i.kind === 'review').map(i => ({ ...i.row, user_id: auth.userId }))
      const errRows = batch.filter(i => i.kind === 'error').map(i => ({ ...i.row, user_id: auth.userId }))
      const deletedIds = batch.filter(i => i.kind === 'card-delete').map(i => i.wordId)

      if (deletedIds.length) {
        const { error } = await supabase.from('card_progress')
          .delete().eq('user_id', auth.userId).in('word_id', deletedIds)
        if (error) throw error
      }

      if (cardRows.length) {
        // Keep only the latest row per word — upsert cannot take duplicates.
        const byWord = new Map()
        for (const r of cardRows) byWord.set(r.word_id, r)
        const { error } = await supabase.from('card_progress')
          .upsert([...byWord.values()], { onConflict: 'user_id,word_id' })
        if (error) throw error
      }
      if (logRows.length) {
        const { error } = await supabase.from('review_log').insert(logRows)
        if (error) throw error
      }
      if (errRows.length) {
        const { error } = await supabase.from('error_log').insert(errRows)
        if (error) throw error
      }

      const dayItem = batch.filter(i => i.kind === 'day').pop()
      if (dayItem) {
        const { error } = await supabase.from('daily_log')
          .upsert({ ...today.value, user_id: auth.userId }, { onConflict: 'user_id,day' })
        if (error) throw error
      }

      outbox = outbox.slice(batch.length)
      await idbPut(STORE.META, outbox, 'outbox')
    } catch {
      // Leave the queue intact and retry on the next write or app start.
    } finally {
      syncing.value = false
    }
  }

  /* ------------------------------------------------------------------ *
   * queries
   * ------------------------------------------------------------------ */
  function cardOf (wordId) {
    return cards.value.get(wordId) || null
  }

  const seenIds = computed(() => new Set(cards.value.keys()))

  const dueCards = computed(() => {
    const now = Date.now()
    return sortReviewQueue([...cards.value.values()].filter(c => c.dueAt <= now), now)
  })

  const learningCards = computed(() =>
    [...cards.value.values()].filter(c => c.state === STATE.LEARNING || c.state === STATE.RELEARNING)
  )

  const stats = computed(() => {
    let mastered = 0, review = 0, learning = 0, lapsedTotal = 0
    for (const c of cards.value.values()) {
      if (isMastered(c)) mastered++
      else if (c.state === STATE.REVIEW) review++
      else learning++
      lapsedTotal += c.lapses
    }
    return { seen: cards.value.size, mastered, review, learning, lapses: lapsedTotal }
  })

  /** The furthest stage the learner has unlocked (0-based). */
  const unlockedStage = computed(() => {
    let stage = 0
    for (;;) {
      const from = stage * STAGE_SIZE + 1
      const to = from + STAGE_SIZE - 1
      let graduated = 0
      for (let id = from; id <= to; id++) {
        const c = cards.value.get(id)
        if (c && (c.state === STATE.REVIEW || isMastered(c))) graduated++
      }
      if (graduated / STAGE_SIZE >= STAGE_UNLOCK_RATIO && to < 2801) stage++
      else break
      if (stage > 56) break
    }
    return stage
  })

  /**
   * Next words to introduce. Walks forward from rank 1, skipping anything
   * already seen, and refuses to run more than one stage ahead of what the
   * learner has actually consolidated.
   */
  /**
   * Today's new words: the rank spine, plus words built on stems the learner
   * already holds.
   *
   * Pure rank order put achieve (#745) and achievement (#1998) 1,253 ranks —
   * about 125 days — apart, so the second one arrived as an unrelated word to
   * be memorised from scratch. A derived word whose stem is already known is
   * nearly free to learn and is the single biggest scoring block in TOEIC
   * Part 5, so it is worth taking out of rank order. Capped at a third of the
   * day, because the rank list is still what sets the pace.
   */
  function newCandidates (n, maxRank = 2801) {
    if (n <= 0) return []
    const hardCap = Math.min(2801, maxRank || 2801)
    const limit = Math.min(hardCap, (unlockedStage.value + 1) * STAGE_SIZE + STAGE_SIZE)

    const seen = new Set()
    const eligible = id => id <= hardCap && !cards.value.has(id) && !seen.has(id)

    const derivedCap = Math.min(n, Math.max(1, Math.floor(n / 3)))

    const spine = []
    for (let id = 1; id <= limit && spine.length < n - derivedCap; id++) {
      if (!eligible(id)) continue
      seen.add(id); spine.push(id)
    }

    // Stems already held, plus the ones about to be introduced today.
    const stems = [...new Set([...cards.value.keys(), ...spine])].sort((a, b) => a - b)
    const derived = []
    for (const stem of stems) {
      if (derived.length >= derivedCap) break
      for (const id of AFFIX_FAMILIES[stem] || []) {
        if (derived.length >= derivedCap) break
        if (!eligible(id)) continue
        seen.add(id); derived.push(id)
      }
    }

    const out = [...spine, ...derived]
    // Derivations ran short (early days, or the stems have none) — top up from
    // the rank list so the learner never gets a short day.
    for (let id = 1; id <= limit && out.length < n; id++) {
      if (!eligible(id)) continue
      seen.add(id); out.push(id)
    }
    return out.slice(0, n).sort((a, b) => a - b)
  }

  /**
   * Drop cards the placement test created but the learner never actually
   * studied, so re-taking the test genuinely re-places them.
   *
   * markKnown skips ids already present, so without this a second placement
   * could only ever add words — a frontier set too low the first time stayed
   * too low for ever. Anything with a real review behind it is left alone.
   */
  function clearUntouchedPrefill () {
    const next = new Map()
    const gone = []
    for (const [id, c] of cards.value) {
      const untouched = c.reps <= 1 && c.lapses === 0 && c.streak <= 1 &&
        c.state === STATE.REVIEW && c.lastReviewedAt === c.introducedAt
      if (untouched) gone.push(id)
      else next.set(id, c)
    }
    if (!gone.length) return 0
    cards.value = next
    for (const id of gone) enqueue({ kind: 'card-delete', wordId: id })
    for (const id of gone) idbDelete(STORE.CARDS, id)
    return gone.length
  }

  /* ------------------------------------------------------------------ *
   * mutations
   * ------------------------------------------------------------------ */
  function gradeCard (wordId, grade, { mode = 'card', elapsedMs = null } = {}) {
    const existing = cards.value.get(wordId) || newCard(wordId)
    const wasNew = existing.state === STATE.NEW
    const updated = schedule(existing, grade, Date.now())

    const next = new Map(cards.value)
    next.set(wordId, updated)
    cards.value = next
    idbPutMany(STORE.CARDS, [updated])

    enqueue({ kind: 'card', card: updated })
    enqueue({
      kind: 'review',
      row: { word_id: wordId, grade, mode, elapsed_ms: elapsedMs, reviewed_at: new Date().toISOString() }
    })

    bumpDay({
      new_count: wasNew ? 1 : 0,
      review_count: wasNew ? 0 : 1,
      total_count: 1,
      correct_count: grade >= GRADE.GOOD ? 1 : 0
    })

    if (grade === GRADE.AGAIN) {
      logError('word', String(wordId), { mode })
    }
    return updated
  }

  /**
   * Placement test result. A word marked "already known" still enters the
   * rotation — just far out — so a wrong self-assessment surfaces within a
   * fortnight instead of never.
   */
  function markKnown (wordIds, { intervalDays = 12 } = {}) {
    const now = Date.now()
    const next = new Map(cards.value)
    const rows = []
    for (const id of wordIds) {
      if (next.has(id)) continue
      const c = {
        ...newCard(id, now),
        state: STATE.REVIEW,
        intervalDays,
        ease: 2.5,
        reps: 1,
        streak: 1,
        lastGrade: GRADE.GOOD,
        lastReviewedAt: now,
        introducedAt: now,
        dueAt: now + intervalDays * 86400000
      }
      next.set(id, c)
      rows.push(c)
      enqueue({ kind: 'card', card: c })
    }
    cards.value = next
    idbPutMany(STORE.CARDS, rows)
    return rows.length
  }

  function bumpDay (patch) {
    const key = todayKey()
    if (today.value.day !== key) today.value = blankDay(key)
    const d = { ...today.value }
    for (const [k, v] of Object.entries(patch)) {
      if (typeof v === 'number') d[k] = (d[k] || 0) + v
      else d[k] = v
    }
    today.value = d
    enqueue({ kind: 'day' })
  }

  function setDay (patch) {
    const key = todayKey()
    if (today.value.day !== key) today.value = blankDay(key)
    today.value = { ...today.value, ...patch }
    enqueue({ kind: 'day' })
  }

  function logError (kind, refId, payload = {}) {
    const row = { kind, ref_id: String(refId), payload, created_at: new Date().toISOString() }
    errors.value = [{ ...row, id: `local-${Date.now()}-${Math.random()}` }, ...errors.value]
    enqueue({ kind: 'error', row })
  }

  async function resolveError (id) {
    errors.value = errors.value.filter(e => e.id !== id)
    if (!auth.userId || String(id).startsWith('local-')) return
    await supabase.from('error_log').update({ resolved_at: new Date().toISOString() }).eq('id', id)
  }

  /** Open mistakes that are questions rather than words. */
  const questionErrors = computed(() =>
    errors.value.filter(e => e.kind === 'grammar' || e.kind === 'article')
  )

  /**
   * Words that are currently weak.
   *
   * Two signals feed this, and using only one of them was a bug: `lapses` is
   * incremented only when a card fails from the REVIEW state, so pressing
   * 忘記 on a brand-new word logged an error (and bumped the tab badge) while
   * leaving lapses at 0 — the notebook showed a count with nothing in it.
   *
   * A word leaves the list once it has been answered correctly twice running
   * and has no unresolved error rows, so the notebook reflects what still
   * needs work rather than growing forever.
   */
  const troubleWordIds = computed(() => {
    const ids = new Set()

    for (const e of errors.value) {
      if (e.kind !== 'word' && e.kind !== 'cloze') continue
      const id = Number(e.ref_id)
      if (Number.isFinite(id)) ids.add(id)
    }
    for (const c of cards.value.values()) {
      if (c.lapses > 0 && c.streak < 2) ids.add(c.wordId)
    }

    // Anything already relearned drops out, whichever signal put it there.
    for (const id of [...ids]) {
      const c = cards.value.get(id)
      if (c && c.streak >= 2 && c.lastGrade >= GRADE.GOOD && !hasOpenError(id)) ids.delete(id)
    }
    return ids
  })

  function hasOpenError (wordId) {
    return errors.value.some(
      e => (e.kind === 'word' || e.kind === 'cloze') && Number(e.ref_id) === wordId
    )
  }

  /** Weakest first: most lapses, then lowest ease. */
  const troubleWords = computed(() => {
    const out = []
    for (const id of troubleWordIds.value) {
      const c = cards.value.get(id) || newCard(id)
      out.push(c)
    }
    return out.sort((a, b) => (b.lapses - a.lapses) || (a.ease - b.ease)).slice(0, 60)
  })

  /** What the tab badge shows — must equal what the page can actually list. */
  const mistakeCount = computed(() => troubleWordIds.value.size + questionErrors.value.length)

  /** Clear the open word-level errors once a word is answered well again. */
  function clearWordErrors (wordId) {
    const open = errors.value.filter(
      e => (e.kind === 'word' || e.kind === 'cloze') && Number(e.ref_id) === wordId
    )
    for (const e of open) resolveError(e.id)
  }

  const streak = computed(() => {
    const done = new Set(history.value.filter(h => h.total_count > 0).map(h => h.day))
    if (today.value.total_count > 0) done.add(today.value.day)
    let n = 0
    let cursor = todayKey()
    // Today not started yet should not break yesterday's streak.
    if (!done.has(cursor)) {
      cursor = todayKey(new Date(Date.now() - 86400000))
      if (!done.has(cursor)) return 0
    }
    while (done.has(cursor)) {
      n++
      cursor = todayKey(new Date(new Date(cursor + 'T00:00:00').getTime() - 86400000))
    }
    return n
  })

  const dayAccuracy = computed(() => {
    const t = today.value
    return t.total_count ? t.correct_count / t.total_count : null
  })

  async function resetAll () {
    if (!auth.userId) return
    await supabase.from('card_progress').delete().eq('user_id', auth.userId)
    await supabase.from('review_log').delete().eq('user_id', auth.userId)
    await supabase.from('daily_log').delete().eq('user_id', auth.userId)
    await supabase.from('error_log').delete().eq('user_id', auth.userId)
    await supabase.from('grammar_progress').delete().eq('user_id', auth.userId)
    cards.value = new Map()
    today.value = blankDay(todayKey())
    history.value = []
    errors.value = []
    outbox = []
    await idbPut(STORE.META, [], 'outbox')
    await idbPutMany(STORE.CARDS, [])
  }

  return {
    cards, today, history, errors, loaded, syncing,
    seenIds, dueCards, learningCards, stats, unlockedStage, streak, dayAccuracy,
    troubleWords, troubleWordIds, questionErrors, mistakeCount, clearWordErrors,
    load, loadDay, loadHistory, loadErrors, flush,
    cardOf, newCandidates, clearUntouchedPrefill, gradeCard, markKnown, bumpDay, setDay,
    logError, resolveError, resetAll,
    retrievability, daysBetween
  }
})
