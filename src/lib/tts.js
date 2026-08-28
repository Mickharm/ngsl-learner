/**
 * Web Speech synthesis wrapper.
 *
 * ── Why the start of a phrase keeps getting cut off ────────────────────────
 *
 * Four separate causes. Fixing a subset of them still sounds broken, which is
 * why this file has been rewritten several times.
 *
 *  1. `cancel()` is asynchronous in Chromium. Speaking on the next line hands
 *     the engine an utterance while it is still tearing the old one down and
 *     the opening syllable is swallowed. → cancel only when something real is
 *     queued, then wait for the engine to say it is idle.
 *
 *  2. The OS audio stream is opened when speech begins and the first
 *     100-300 ms are lost while it ramps up. This happens on a completely
 *     idle engine, which is why "just don't cancel" did not fix it either.
 *     → give the engine silence to spend the ramp on, queued in the same tick
 *     so the stream never gets a gap to close in.
 *
 *  3. WebKit only reliably starts speech from inside the user gesture that
 *     asked for it. Every `await` before `synth.speak()` leaves that gesture.
 *     → the common case (a tap on a quiet page) calls through synchronously
 *     and awaits nothing.
 *
 *  4. The WebKit unlock utterance collides with the very first tap. This is
 *     the cause behind "only the first play is clipped, after that it is
 *     fine". `primeAudio()` fires on `pointerdown`; the click handler that
 *     calls `speak()` runs a few milliseconds later, while that unlock
 *     utterance is still in flight. The engine therefore does *not* look
 *     idle, `speak()` drops onto the serialised path, and that path
 *     `cancel()`s the engine (cause 1), sleeps, and — being `async` — speaks
 *     from outside the gesture (cause 3). Every later tap finds an idle
 *     engine, takes the fast path and sounds fine: exactly the reported
 *     symptom, and exactly the entry the smoke test used to throw away.
 *     → the unlock is tracked, counted as "free" rather than as busy work,
 *     and never cancelled. The phrase is queued behind it instead.
 *
 * ── On the lead-in silence ────────────────────────────────────────────────
 *
 * It has to be silence the engine cannot voice, and it must not be spliced
 * into the phrase's own text. Both earlier attempts did splice it in and both
 * were audible on-device: leading commas produced a short spurious onset
 * sound (a neural voice handed a pause with zero lexical context in front of
 * it does not necessarily stay silent), and echoing the phrase's own first
 * word made that word audibly double.
 *
 * So the silence is a *separate* utterance at `volume = 0`, on the same voice
 * and queued in the same tick as the phrase. That still answers cause 2 — a
 * queued utterance keeps the stream open, the engine never returns to idle
 * between the two — while being inaudible by construction instead of by
 * assuming some punctuation is silent.
 *
 * It is queued only when the stream is actually cold. Taps within a few
 * seconds of the last one are already warm, which is why rapid taps always
 * sounded fine, and paying the lead-in on those would only add latency.
 *
 * Chromium also halts synthesis at ~15 s unless resume() is pumped, which
 * matters for the "read the whole article" button.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

let voices = []
let primed = false
let voicesReady = null
/** Serialises overlapping taps so they cannot cancel each other mid-start. */
let chain = Promise.resolve()
let queued = 0
/** True while the one-time WebKit unlock utterance is still in flight. */
let unlocking = false
/** Last moment the engine was handed audio; the stream stays open a while. */
let lastAudioAt = 0

/** Engine settle margin after a cancel, in ms. Below ~60 ms Chromium still clips. */
const SETTLE_MS = 150

/** How long the audio stream stays warm after speech, in ms. */
const COLD_MS = 4000

/** Give up waiting on the unlock utterance's end event after this, in ms. */
const UNLOCK_MS = 2000

/**
 * One unit of lead-in, spoken at volume 0 ahead of the phrase.
 *
 * A real word rather than punctuation: a pause with no lexical context in
 * front of it is what some voices turn into an audible blip. At volume 0 it
 * cannot be heard either way, but the engine is never asked to do the thing
 * that misbehaves.
 */
const WARM_UNIT = 'a '

export const ttsSupported = !!synth

const sleep = ms => new Promise(r => setTimeout(r, ms))

const isSafari = typeof navigator !== 'undefined' &&
  /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

function loadVoices () {
  if (!synth) return []
  voices = synth.getVoices() || []
  return voices
}

export function whenVoicesReady () {
  if (!synth) return Promise.resolve([])
  if (voicesReady) return voicesReady

  voicesReady = new Promise(resolve => {
    const existing = loadVoices()
    if (existing.length) return resolve(existing)

    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve(loadVoices())
    }
    synth.addEventListener('voiceschanged', done, { once: true })
    // Safari sometimes never fires the event; poll as a backstop.
    const poll = setInterval(() => {
      if (loadVoices().length) { clearInterval(poll); done() }
    }, 250)
    setTimeout(() => { clearInterval(poll); done() }, 3000)
  })
  return voicesReady
}

/** English voices, preferring en-US then en-GB, natural voices first. */
export function englishVoices () {
  const en = voices.filter(v => /^en([-_]|$)/i.test(v.lang))
  const score = v => {
    let s = 0
    if (/en[-_]US/i.test(v.lang)) s += 4
    if (/en[-_]GB/i.test(v.lang)) s += 3
    if (v.localService) s += 1
    if (/samantha|ava|alex|siri|natural|enhanced|premium/i.test(v.name)) s += 3
    if (/google/i.test(v.name)) s += 2
    if (/compact|eloquence/i.test(v.name)) s -= 2
    return s
  }
  return en.sort((a, b) => score(b) - score(a))
}

function pickVoice (voiceURI) {
  if (!voices.length) loadVoices()
  if (voiceURI) {
    const exact = voices.find(v => v.voiceURI === voiceURI)
    if (exact) return exact
  }
  return englishVoices()[0] || null
}

/**
 * Unlock the engine on the first user gesture.
 *
 * WebKit will not speak at all until one utterance has been issued from a
 * real gesture, and `ListenView` auto-plays the first item without one, so
 * this cannot be dropped. Chromium needs no such unlock and stutters if one
 * is queued and then cancelled, so it is skipped there.
 *
 * `unlocking` is what keeps this from breaking the very next tap: see cause 4
 * at the top of the file.
 */
export function primeAudio () {
  if (!synth || primed) return
  primed = true
  if (!isSafari) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    const done = () => { unlocking = false }
    u.onend = done
    u.onerror = done
    unlocking = true
    setTimeout(done, UNLOCK_MS)
    synth.speak(u)
  } catch {
    unlocking = false
  }
}

if (typeof window !== 'undefined') {
  const onFirstTouch = () => primeAudio()
  window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true })
  window.addEventListener('pointerdown', onFirstTouch, { once: true })
  whenVoicesReady()
}

/** True when the engine has nothing queued or in flight. */
function engineIdle () {
  return !synth.speaking && !synth.pending
}

/**
 * True when nothing worth waiting for is in flight.
 *
 * The silent unlock utterance counts as free: it is a few milliseconds long,
 * it is inaudible, and a phrase queued behind it plays straight after it on
 * the same audio stream. Cancelling it instead is what clipped the first tap.
 */
function engineFree () {
  return engineIdle() || unlocking
}

/**
 * Bring the engine to a known-idle state before handing it a new utterance.
 * Returns only once the engine says it is idle, or after `maxWait`.
 */
async function quiesce (maxWait = 500) {
  if (engineIdle()) return false
  try { synth.cancel() } catch { /* ignore */ }
  unlocking = false

  const started = Date.now()
  while (!engineIdle() && Date.now() - started < maxWait) {
    await sleep(25)
  }
  await sleep(SETTLE_MS)
  return true
}

/**
 * The lead-in actually handed to the engine, as its own silent utterance.
 *
 * Exported so it can be asserted on: whether the padding is there is the part
 * of this file a headless browser cannot check by listening.
 */
export function warmUpText (leadIn = 2) {
  const n = Math.max(0, Math.min(4, Math.round(leadIn)))
  return n ? WARM_UNIT.repeat(n).trim() : ''
}

/** Queue one utterance and resolve when it finishes. Never awaits first. */
function utter (text, { rate, voiceURI, pitch, volume, leadIn }) {
  return new Promise(resolve => {
    let keepalive = null
    let settled = false
    const finish = ok => {
      if (settled) return
      settled = true
      lastAudioAt = Date.now()
      if (keepalive) clearInterval(keepalive)
      resolve(ok)
    }

    try {
      const u = new SpeechSynthesisUtterance(String(text))
      const v = pickVoice(voiceURI)
      if (v) { u.voice = v; u.lang = v.lang }
      else u.lang = 'en-US'
      u.rate = Math.min(2, Math.max(0.5, rate))
      u.pitch = pitch
      u.volume = volume

      u.onend = () => finish(true)
      u.onerror = () => finish(false)

      // Safari occasionally drops onend; bound the wait by a length estimate.
      const budget = 1600 + (String(text).length / Math.max(0.5, rate)) * 90
      setTimeout(() => finish(true), budget)

      // Chromium halts synthesis at ~15 s. Pumping pause/resume keeps a long
      // passage (the "朗讀全文" button) running to the end.
      if (String(text).length > 180) {
        keepalive = setInterval(() => {
          if (!synth.speaking) return
          try { synth.pause(); synth.resume() } catch { /* ignore */ }
        }, 10000)
      }

      // Cause 2: pay the audio-stream ramp with silence, but only when the
      // stream is actually cold. Same voice and same tick as the phrase, so
      // the engine runs straight from one into the other without going idle.
      const warm = warmUpText(leadIn)
      if (warm && Date.now() - lastAudioAt > COLD_MS) {
        const w = new SpeechSynthesisUtterance(warm)
        if (v) { w.voice = v; w.lang = v.lang }
        else w.lang = 'en-US'
        w.rate = 1
        w.pitch = 1
        w.volume = 0
        synth.speak(w)
      }

      lastAudioAt = Date.now()
      synth.speak(u)
    } catch {
      finish(false)
    }
  })
}

/**
 * Speak a phrase. Resolves when speech ends (or immediately if unsupported).
 *
 * @param {string} text
 * @param {{rate?:number, voiceURI?:string, pitch?:number, volume?:number, leadIn?:number}} opts
 */
export function speak (text, opts = {}) {
  if (!synth || !text) return Promise.resolve(false)

  const settings = {
    rate: opts.rate ?? 0.9,
    voiceURI: opts.voiceURI ?? '',
    pitch: opts.pitch ?? 1,
    volume: opts.volume ?? 1,
    leadIn: opts.leadIn ?? 2
  }

  // Fast path — the common one, and the one the first tap has to stay on.
  // Nothing real is queued and the voice list is loaded, so speak inside the
  // gesture that asked for it. WebKit needs that; every await below would
  // leave the gesture behind. `getVoices()` is synchronous, so filling an
  // empty list here costs nothing and keeps a cold first tap on this path.
  if (!queued && (voices.length || loadVoices().length) && engineFree()) {
    return utter(text, settings)
  }

  queued++
  const run = async () => {
    await whenVoicesReady()
    await quiesce()
    return utter(text, settings)
  }
  const result = chain.then(run, run).finally(() => { queued-- })
  // Never let one failed play poison the chain.
  chain = result.then(() => {}, () => {})
  return result
}

export function stopSpeaking () {
  unlocking = false
  try { synth?.cancel() } catch { /* ignore */ }
}
