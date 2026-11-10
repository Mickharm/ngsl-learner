import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { supabase } from '@/lib/supabase'
import { idbGetAll, idbPutMany, idbPut, idbGet, idbDelete, idbClear, STORE } from '@/lib/idb'
import { newCard, GRADE, STATE } from '@/lib/srs'
import {
  scheduleWord, migrateLegacy, isMasteredV2, retrievabilityV2, dueSoonest,
  ladderOf, isV2, easeToDifficulty, V2_BASE, reviewedToday
} from '@/lib/wordsrs'
import { measuredRetention } from '@/lib/pacing'
import { recordConfusion, topConfusions, settleConfusion, pruneConfusions, contrastRound, isRealConfusion } from '@/lib/confusion'
import { recordPart2, missedPart2 } from '@/lib/part2'
import PART2 from '@/data/part2'
import { useWords } from './words'
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
  const wordStore = useWords()
  const settings = useSettings()

  /** wordId -> card */
  const cards = ref(new Map())
  const today = ref(blankDay(todayKey()))
  const history = ref([])          // recent daily_log rows
  const errors = ref([])           // open error_log rows
  const loaded = ref(false)
  const syncing = ref(false)

  /**
   * The clock the due lists run on.
   *
   * `Date.now()` inside a computed is read once and cached until some other
   * dependency changes. A home-screen app is not reloaded for days, so the
   * morning after, "what is due" was still last night's answer — usually
   * nothing — and the review phase showed as empty until the first new word
   * was graded and invalidated the cache by accident. Everything that asks
   * "is it due / what day is it" reads this ref instead; it ticks every
   * minute and whenever the app comes back to the foreground.
   */
  const now = ref(Date.now())
  const dayKey = computed(() => todayKey(new Date(now.value)))
  function tick () { now.value = Date.now() }

  /** Graded reviews of the last 30 days: what retention is measured on. */
  const reviews = ref([])
  /** target|chosen → { n, last, clean } (lib/confusion.js); this device, this learner. */
  const confusions = ref({})
  /** 應答聽力 record: item id → { right, wrong, last, lastRight } */
  const part2Log = ref({})

  /**
   * Mutations that could not reach Supabase yet. Every item carries the id of
   * the learner who made it (`uid`): the login screen is a profile picker, so
   * one device serves several accounts, and before v6.1 a queue left by one
   * learner (offline, or signed out within a second of answering) was flushed
   * under whoever signed in next.
   */
  let outbox = []
  let flushTimer = null
  const mine = i => !i.uid || i.uid === auth.userId

  // `loaded` means "loaded for the learner who is signed in". The moment that
  // changes, what is in memory is someone else's deck: nothing may plan a day
  // from it (session.js fixes the day's pace on `loaded`).
  watch(() => auth.userId, () => { loaded.value = false }, { flush: 'sync' })

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
    // The card mirror and the queue belong to whoever used this device last.
    // If that is someone else, their mirror is not this learner's deck (it is
    // rebuilt from the server below) and their queued writes stay queued,
    // tagged, until they sign in again.
    const owner = await idbGet(STORE.META, 'owner')
    const sameOwner = !owner || !auth.userId || owner === auth.userId
    // The queue is read from disk once. On a refresh the copy in memory is
    // the newer one: enqueue() does not wait for its own write to land.
    if (!loaded.value) {
      const savedOutbox = await idbGet(STORE.META, 'outbox')
      outbox = Array.isArray(savedOutbox) ? savedOutbox.map(i => (i.uid ? i : { ...i, uid: owner || auth.userId || null })) : []
    }

    const cached = sameOwner ? await idbGetAll(STORE.CARDS) : []
    cards.value = new Map(cached.map(c => [c.wordId, migrateLegacy(c)]))
    if (!sameOwner) {
      today.value = blankDay(todayKey())
      history.value = []
      errors.value = []
      reviews.value = []
      await idbClear(STORE.CARDS)
    }
    if (auth.userId) {
      await idbPut(STORE.META, auth.userId, 'owner')
      confusions.value = pruneConfusions((await idbGet(STORE.META, `confusions:${auth.userId}`)) || {})
      part2Log.value = (await idbGet(STORE.META, `part2:${auth.userId}`)) || {}
    }
    tick()

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
      // Legacy SM-2 rows are converted in memory; they are written back in v2
      // form the next time each word is answered, so there is nothing to run
      // on the database before this version goes live.
      for (const r of rows) next.set(r.word_id, migrateLegacy(rowToCard(r)))
      // Anything still queued locally is newer than what the server returned.
      for (const q of outbox.filter(mine)) {
        if (q.kind === 'card') next.set(q.card.wordId, migrateLegacy(q.card))
        else if (q.kind === 'card-delete') next.delete(q.wordId)
      }
      cards.value = next
      await idbClear(STORE.CARDS)
      await idbPutMany(STORE.CARDS, [...next.values()])

      // a queued 'day' write holds counts the server has not seen yet
      if (!outbox.some(i => mine(i) && i.kind === 'day')) await loadDay()
      await loadHistory()
      await loadErrors()
      await loadReviews()
      flush()
    } catch { /* offline: run from the local mirror */ }
    tick()
    loaded.value = true
  }

  /**
   * Bring the stores up to date without a page reload: the day has changed,
   * or the app was in the background long enough that another device may
   * have been used. Same merge as load() — the server's rows, then whatever
   * is still queued here on top.
   */
  let refreshing = null
  function refresh () {
    if (!auth.userId || !loaded.value) return Promise.resolve()
    if (refreshing) return refreshing
    refreshing = (async () => {
      try { await flush(); await load() } finally { refreshing = null }
    })()
    return refreshing
  }

  let hiddenAt = 0
  const AWAY_MS = 5 * 60_000
  async function wake () {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') { hiddenAt = Date.now(); return }
    const away = hiddenAt ? Date.now() - hiddenAt : 0
    hiddenAt = 0
    const dayChanged = todayKey() !== today.value.day
    tick()
    if (dayChanged) today.value = blankDay(todayKey())
    if (dayChanged || away > AWAY_MS) await refresh()
  }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    setInterval(() => {
      const before = dayKey.value
      tick()
      // midnight passed with the app open on screen
      if (dayKey.value !== before) wake()
    }, 60_000)
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('pageshow', e => { if (e.persisted) wake() })
  }

  async function loadReviews (days = 30) {
    if (!auth.userId) return
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data } = await supabase
      .from('review_log').select('word_id, grade, mode, reviewed_at')
      .eq('user_id', auth.userId)
      .gte('reviewed_at', since)
      .order('reviewed_at', { ascending: false })
      .limit(4000)
    const server = data || []
    // rows still in the queue are not on the server yet
    const pending = outbox.filter(i => mine(i) && i.kind === 'review').map(i => i.row)
    reviews.value = [...pending, ...server]
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
    const rows = data || []
    // Listening misses from before they could be acted on: keep the newest
    // 30 words' worth and close the rest, so they stop crowding the window.
    const keep = new Set()
    const stale = []
    for (const e of rows) {
      if (e.kind !== 'listen') continue
      if (keep.size < 30 || keep.has(e.ref_id)) keep.add(e.ref_id)
      else stale.push(e.id)
    }
    if (stale.length) {
      supabase.from('error_log').update({ resolved_at: new Date().toISOString() }).in('id', stale).then(() => {}, () => {})
    }
    const gone = new Set(stale)
    // rows queued here and not yet on the server are still open mistakes
    const onServer = new Set(rows.map(e => `${e.kind}|${e.ref_id}|${Date.parse(e.created_at)}`))
    const pending = errors.value.filter(e =>
      String(e.id).startsWith('local-') && !onServer.has(`${e.kind}|${e.ref_id}|${Date.parse(e.created_at)}`))
    errors.value = [...pending, ...rows.filter(e => !gone.has(e.id))]
  }

  /* ------------------------------------------------------------------ *
   * outbox — every write goes through here so offline never loses data
   * ------------------------------------------------------------------ */
  function enqueue (item) {
    outbox.push({ ...item, uid: auth.userId || null })
    idbPut(STORE.META, outbox, 'outbox')
    clearTimeout(flushTimer)
    flushTimer = setTimeout(flush, 900)
  }

  async function flush () {
    if (!auth.userId || !outbox.length || syncing.value) return
    // only this learner's writes; anyone else's wait for them to sign in
    const batch = outbox.filter(mine)
    if (!batch.length) return
    syncing.value = true
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

      const sent = new Set(batch)
      outbox = outbox.filter(i => !sent.has(i))
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
    const t = now.value
    return dueSoonest([...cards.value.values()].filter(c => c.dueAt <= t), t)
  })

  /** Words held, weakest memory first — what a short listening day is topped up with. */
  const weakestIds = computed(() => {
    const t = now.value
    return [...cards.value.values()]
      .filter(c => c.state !== STATE.NEW)
      .map(c => ({ id: c.wordId, r: retrievabilityV2(c, t) }))
      .sort((a, b) => a.r - b.r)
      .slice(0, 60)
      .map(x => x.id)
  })

  /** Measured retention: the last 30 days for the picture, the last 7 for pacing. */
  const retention30 = computed(() => measuredRetention(reviews.value, { now: now.value, days: 30 }))
  const retention7 = computed(() => measuredRetention(reviews.value, { now: now.value, days: 7 }))

  const learningCards = computed(() =>
    [...cards.value.values()].filter(c => c.state === STATE.LEARNING || c.state === STATE.RELEARNING)
  )

  const stats = computed(() => {
    let mastered = 0, review = 0, learning = 0, lapsedTotal = 0
    for (const c of cards.value.values()) {
      if (isMasteredV2(c)) mastered++
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
        // Answered correctly at least once after being introduced — a word
        // that was only ever shown does not open the next stage.
        if (c && c.state === STATE.REVIEW && ladderOf(c) >= 1) graduated++
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
  /**
   * One measured review of a word. `level` is the ladder rung the answer was
   * given at (see lib/wordsrs.js); omitted, the card's own rung is assumed.
   * Call this once per word per sitting — repeats inside a sitting are
   * practice and must not reach the scheduler.
   */
  function gradeCard (wordId, grade, { mode = 'card', elapsedMs = null, level } = {}) {
    const existing = cards.value.get(wordId) || newCard(wordId)
    // The word has had today's review already: this answer is practice. It
    // changes nothing in the schedule and nothing in the day's counts.
    if (reviewedToday(existing)) return existing
    const wasNew = existing.state === STATE.NEW
    const updated = scheduleWord(existing, grade, Date.now(), { level })

    const next = new Map(cards.value)
    next.set(wordId, updated)
    cards.value = next
    idbPutMany(STORE.CARDS, [updated])

    enqueue({ kind: 'card', card: updated })
    const row = { word_id: wordId, grade, mode, elapsed_ms: elapsedMs, reviewed_at: new Date().toISOString() }
    enqueue({ kind: 'review', row })
    reviews.value = [row, ...reviews.value]

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
      // Written straight as a v2 card on rung 2: a claimed-known word is first
      // checked by recall (picture → English), not by recognition.
      const c = {
        ...newCard(id, now),
        state: STATE.REVIEW,
        intervalDays,
        ease: 4,
        stepIndex: V2_BASE + 2,
        reps: 1,
        streak: 1,
        lastGrade: GRADE.GOOD,
        lastReviewedAt: now,
        introducedAt: now,
        dueAt: now + Math.min(intervalDays, 14) * 86400000
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
    errors.value.filter(e => e.kind === 'grammar' || e.kind === 'article' || (e.kind === 'write' && e.payload?.better))
  )

  /**
   * Words missed by ear, one entry per word (the newest miss), newest first.
   *
   * These rows were written from the first listening release on, and nothing
   * ever read them: the notebook listed word / grammar / reading / talk
   * mistakes only, so a word the learner could read but not hear was logged
   * and never asked again, and the open rows piled up until they pushed the
   * others out of the 300-row window the notebook loads. Now they are a tab
   * of the notebook, they lead the next listening round (lib/listening.js
   * listenTargets), and getting the word right by ear resolves them.
   */
  const listenErrors = computed(() => {
    const seen = new Set()
    const out = []
    for (const e of errors.value) {
      if (e.kind !== 'listen') continue
      const id = Number(e.ref_id)
      if (!Number.isFinite(id) || seen.has(id)) continue
      // a word whose data is not on this device cannot be played back or asked
      if (!wordStore.get(id)?.meanings?.length) continue
      seen.add(id); out.push({ ...e, wordId: id })
    }
    return out
  })

  /** Units (字首字尾 / 基礎知識) whose last sitting failed and have not been passed since. */
  const unitErrors = computed(() => {
    const seen = new Set()
    return errors.value.filter(e => {
      if (e.kind !== 'parts' && e.kind !== 'essential') return false
      const k = `${e.kind}:${e.ref_id}`
      if (seen.has(k)) return false
      seen.add(k); return true
    })
  })

  /** Resolve every open row of one kind about one thing. */
  function resolveErrorsFor (kind, refId) {
    const open = errors.value.filter(e => e.kind === kind && String(e.ref_id) === String(refId))
    if (!open.length) return 0
    const ids = open.map(e => e.id)
    errors.value = errors.value.filter(e => !ids.includes(e.id))
    const remote = ids.filter(id => !String(id).startsWith('local-'))
    if (auth.userId && remote.length) {
      supabase.from('error_log').update({ resolved_at: new Date().toISOString() }).in('id', remote).then(() => {}, () => {})
    }
    return open.length
  }
  const clearListenErrors = wordId => resolveErrorsFor('listen', wordId)

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

  /** Weakest first: most lapses, then highest difficulty. */
  const troubleWords = computed(() => {
    const out = []
    for (const id of troubleWordIds.value) {
      const c = cards.value.get(id) || newCard(id)
      out.push(c)
    }
    return out.sort((a, b) => (b.lapses - a.lapses) || (hardness(b) - hardness(a))).slice(0, 60)
  })

  /** FSRS difficulty, whichever format the card is in. */
  function hardness (c) {
    if (!c || c.state === STATE.NEW) return 0
    return isV2(c) ? c.ease : easeToDifficulty(c.ease)
  }

  /** What the tab badge shows — must equal what the page can actually list. */
  const mistakeCount = computed(() =>
    troubleWordIds.value.size + questionErrors.value.length + listenErrors.value.length + unitErrors.value.length +
    drillablePairs.value.length + part2Missed.value.length
  )

  /* ---------------- confusions & 應答聽力: this learner, this device ---------------- */

  /**
   * What goes to IndexedDB must be plain data. A ref's value is a reactive
   * proxy, and so is every nested object read through it (so `{ ...ledger }`
   * is a plain shell around proxies); a proxy cannot be structured-cloned and
   * the write fails without a sound. The ledgers are small: copy them.
   */
  const plain = v => JSON.parse(JSON.stringify(v))

  function noteConfusion (targetId, chosenId) {
    const next = recordConfusion(confusions.value, targetId, chosenId)
    if (next === confusions.value) return
    confusions.value = next
    if (auth.userId) idbPut(STORE.META, plain(next), `confusions:${auth.userId}`)
  }
  function settlePair (a, b) {
    const next = settleConfusion(confusions.value, a, b)
    confusions.value = next
    if (auth.userId) idbPut(STORE.META, plain(next), `confusions:${auth.userId}`)
  }
  // every pick is kept in the ledger; only real confusions are listed and counted
  const confusedPairs = computed(() =>
    topConfusions(confusions.value, { now: now.value, limit: 40 })
      .filter(p => isRealConfusion(p, wordStore.get(p.a), wordStore.get(p.b)))
      .slice(0, 12)
  )
  /** The pairs the notebook lists: only ones a fair two-way question can be asked about. */
  const drillablePairs = computed(() =>
    contrastRound(confusedPairs.value, id => wordStore.get(id), { maxPairs: 12, seed: 1 }).map(r => ({ a: r.a, b: r.b, n: r.n }))
  )
  const part2Missed = computed(() => missedPart2(PART2, part2Log.value))

  function notePart2 (id, correct) {
    const next = recordPart2(part2Log.value, id, correct)
    part2Log.value = next
    if (auth.userId) idbPut(STORE.META, plain(next), `part2:${auth.userId}`)
  }

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
    reviews.value = []
    confusions.value = {}
    part2Log.value = {}
    outbox = outbox.filter(i => !mine(i))
    await idbPut(STORE.META, outbox, 'outbox')
    await idbClear(STORE.CARDS)
    await idbDelete(STORE.META, `confusions:${auth.userId}`)
    await idbDelete(STORE.META, `part2:${auth.userId}`)
  }

  return {
    cards, today, history, errors, loaded, syncing,
    now, dayKey, tick, wake, refresh,
    reviews, retention30, retention7, weakestIds,
    listenErrors, unitErrors, resolveErrorsFor, clearListenErrors,
    confusions, confusedPairs, drillablePairs, noteConfusion, settlePair, part2Log, part2Missed, notePart2,
    seenIds, dueCards, learningCards, stats, unlockedStage, streak, dayAccuracy,
    troubleWords, troubleWordIds, questionErrors, mistakeCount, clearWordErrors,
    load, loadDay, loadHistory, loadErrors, flush,
    cardOf, newCandidates, clearUntouchedPrefill, gradeCard, markKnown, bumpDay, setDay,
    logError, resolveError, resetAll,
    retrievability: retrievabilityV2, hardness, daysBetween
  }
})
