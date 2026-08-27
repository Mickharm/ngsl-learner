/**
 * Web Speech synthesis wrapper.
 *
 * iOS Safari specifics this works around:
 *  - getVoices() is empty until the `voiceschanged` event fires;
 *  - the very first utterance must originate from a user gesture, so we prime
 *    the engine with a silent utterance on the first tap anywhere.
 *
 * Chromium specifics this works around:
 *  - `cancel()` is ASYNCHRONOUS. Calling speak() on the very next line —
 *    which this file used to do on every single play — hands the engine a new
 *    utterance while it is still tearing the old one down, and the engine
 *    swallows the first syllable or two. That is the "開頭被切掉" bug: it
 *    fires on every button because every button cancelled first.
 *    Fix: only cancel when something is actually queued, then wait for the
 *    engine to report idle before speaking, plus a short settle margin.
 *  - speech stops dead at ~15 s unless resume() is pumped. Long text (a whole
 *    article) needs a keepalive.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

let voices = []
let primed = false
let voicesReady = null
/** Serialises overlapping play() taps so they cannot cancel each other mid-start. */
let chain = Promise.resolve()

/** Engine settle margin after a cancel, in ms. Below ~60 ms Chromium still clips. */
const SETTLE_MS = 90

export const ttsSupported = !!synth

const sleep = ms => new Promise(r => setTimeout(r, ms))

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

/** Unlock the engine on the first user gesture (iOS requirement). */
export function primeAudio () {
  if (!synth || primed) return
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    synth.speak(u)
    primed = true
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
 *
 * The unconditional cancel() this replaces is the whole reason playback lost
 * its opening syllable: cancel() returns immediately but the engine keeps
 * unwinding for tens of milliseconds, and audio started inside that window is
 * cut at the front.
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
 * Speak a phrase. Resolves when speech ends (or immediately if unsupported).
 * Calls are serialised: a second tap waits for the first to be cleanly torn
 * down instead of racing it.
 *
 * @param {string} text
 * @param {{rate?:number, voiceURI?:string, pitch?:number}} opts
 */
export function speak (text, { rate = 0.9, voiceURI = '', pitch = 1 } = {}) {
  if (!synth || !text) return Promise.resolve(false)

  const run = async () => {
    // Voices decide both the voice and the lang tag; starting before the list
    // exists silently drops the user's chosen voice on the first play.
    await whenVoicesReady()
    await quiesce()

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
        const u = new SpeechSynthesisUtterance(String(text))
        const v = pickVoice(voiceURI)
        if (v) { u.voice = v; u.lang = v.lang }
        else u.lang = 'en-US'
        u.rate = Math.min(2, Math.max(0.5, rate))
        u.pitch = pitch

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

  // Serialise, but never let one failed play poison the chain.
  const result = chain.then(run, run)
  chain = result.then(() => {}, () => {})
  return result
}

export function stopSpeaking () {
  try { synth?.cancel() } catch { /* ignore */ }
}
