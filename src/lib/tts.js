/**
 * Web Speech synthesis wrapper.
 *
 * ── Why the start of every phrase kept getting cut off ──────────────────────
 *
 * Three separate causes, and fixing only some of them still sounds broken:
 *
 *  1. `cancel()` is asynchronous in Chromium. Speaking on the next line hands
 *     the engine an utterance while it is still tearing the old one down, and
 *     the opening syllable is swallowed. Fixed by cancelling only when
 *     something is actually queued, then waiting for the engine to go idle.
 *
 *  2. The OS audio stream is opened when speech begins, and the first
 *     100-300 ms are lost while it ramps up. This one is not about cancel at
 *     all: it happens on a completely idle engine, which is why "just don't
 *     cancel" did not fix it either. A *separate* silent warm-up utterance
 *     does not fix it either — the engine goes idle again the moment the
 *     warm-up ends, so the real utterance pays the ramp a second time.
 *
 *     What does fix it: put the padding INSIDE the same utterance. A few
 *     leading commas render as a pause, so the ramp eats silence instead of
 *     the first syllable. One utterance, one audio stream, no gap to lose —
 *     and commas are silent in every English voice, so it cannot be heard
 *     even if an engine ignores `volume`.
 *
 *  3. WebKit only reliably starts speech from inside the user gesture that
 *     asked for it. Every `await` before `synth.speak()` leaves that gesture.
 *     So when the engine is already idle and the voice list is loaded —
 *     the common case, a tap on a quiet page — `speak()` calls through
 *     synchronously and awaits nothing.
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

/** Engine settle margin after a cancel, in ms. Below ~60 ms Chromium still clips. */
const SETTLE_MS = 150

/**
 * One unit of lead-in silence, prepended to the utterance text.
 *
 * A comma is rendered as a pause and voiced as nothing, so this is inaudible
 * by construction rather than by relying on `volume = 0`.
 */
const LEAD_UNIT = ', '

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
 * real gesture. Chromium needs no such unlock and stutters if one is queued
 * and then cancelled, so it is skipped there.
 */
export function primeAudio () {
  if (!synth || primed) return
  primed = true
  if (!isSafari) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
  } catch { /* non-fatal */ }
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
 * Bring the engine to a known-idle state before handing it a new utterance.
 * Returns only once the engine says it is idle, or after `maxWait`.
 */
async function quiesce (maxWait = 500) {
  if (engineIdle()) return false
  try { synth.cancel() } catch { /* ignore */ }

  const started = Date.now()
  while (!engineIdle() && Date.now() - started < maxWait) {
    await sleep(25)
  }
  await sleep(SETTLE_MS)
  return true
}

/**
 * Build the text actually handed to the engine.
 *
 * Exported so the smoke test can assert the lead-in is really there: it is
 * the part of this file that cannot be checked by listening to a headless
 * browser.
 */
export function padded (text, leadIn = 2) {
  const n = Math.max(0, Math.min(4, Math.round(leadIn)))
  return LEAD_UNIT.repeat(n) + String(text)
}

/** Queue one utterance and resolve when it finishes. Never awaits first. */
function utter (text, { rate, voiceURI, pitch, volume, leadIn }) {
  return new Promise(resolve => {
    let keepalive = null
    let settled = false
    const finish = ok => {
      if (settled) return
      settled = true
      if (keepalive) clearInterval(keepalive)
      resolve(ok)
    }

    try {
      const u = new SpeechSynthesisUtterance(padded(text, leadIn))
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

  // Fast path — the common one. Nothing is queued and the voice list is
  // loaded, so speak inside the gesture that asked for it. WebKit needs that;
  // every await below would leave the gesture behind.
  if (!queued && voices.length && engineIdle()) {
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
  try { synth?.cancel() } catch { /* ignore */ }
}
