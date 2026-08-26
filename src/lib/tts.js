/**
 * Web Speech synthesis wrapper.
 *
 * iOS Safari specifics this works around:
 *  - getVoices() is empty until the `voiceschanged` event fires;
 *  - the very first utterance must originate from a user gesture, so we prime
 *    the engine with a silent utterance on the first tap anywhere;
 *  - a queued utterance can wedge the engine, so we always cancel() first.
 */

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null

let voices = []
let primed = false
let voicesReady = null

export const ttsSupported = !!synth

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

/**
 * Speak a phrase. Resolves when speech ends (or immediately if unsupported).
 * @param {string} text
 * @param {{rate?:number, voiceURI?:string, pitch?:number}} opts
 */
export function speak (text, { rate = 0.9, voiceURI = '', pitch = 1 } = {}) {
  if (!synth || !text) return Promise.resolve(false)

  return new Promise(resolve => {
    try {
      synth.cancel()
      const u = new SpeechSynthesisUtterance(String(text))
      const v = pickVoice(voiceURI)
      if (v) { u.voice = v; u.lang = v.lang }
      else u.lang = 'en-US'
      u.rate = Math.min(2, Math.max(0.5, rate))
      u.pitch = pitch

      let settled = false
      const finish = ok => { if (!settled) { settled = true; resolve(ok) } }
      u.onend = () => finish(true)
      u.onerror = () => finish(false)
      // Safari occasionally drops onend; bound the wait by a length estimate.
      const budget = 1200 + (String(text).length / Math.max(0.5, rate)) * 90
      setTimeout(() => finish(true), budget)

      synth.speak(u)
    } catch {
      resolve(false)
    }
  })
}

export function stopSpeaking () {
  try { synth?.cancel() } catch { /* ignore */ }
}
