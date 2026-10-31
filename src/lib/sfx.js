/**
 * Game sounds, synthesised — no audio files to download or cache.
 *
 * Short, quiet, and distinct by pitch contour: rising = right, falling =
 * wrong, a little arpeggio = streak or win. Feedback that arrives through a
 * second channel is felt before it is read, which is most of what makes a
 * game feel responsive.
 *
 * A muted switch lives in Settings; the state is read from localStorage so
 * this module needs no store. WebAudio must be unlocked by a user gesture,
 * so the context is created lazily on the first sound (always inside a tap).
 */
const LS = 'ngsl.sound'
let ctx = null
let enabled = (() => { try { return localStorage.getItem(LS) !== 'off' } catch { return true } })()

export function soundEnabled () { return enabled }
export function setSoundEnabled (on) {
  enabled = !!on
  try { localStorage.setItem(LS, on ? 'on' : 'off') } catch { /* ignore */ }
}

function ac () {
  if (ctx) return ctx
  const C = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!C) return null
  try { ctx = new C() } catch { ctx = null }
  return ctx
}

function tone (c, { f0, f1 = f0, t = 0, dur = 0.12, type = 'sine', gain = 0.12 }) {
  const o = c.createOscillator()
  const g = c.createGain()
  const start = c.currentTime + t
  o.type = type
  o.frequency.setValueAtTime(f0, start)
  o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), start + dur)
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  o.connect(g).connect(c.destination)
  o.start(start)
  o.stop(start + dur + 0.02)
}

const SOUNDS = {
  tap:   c => tone(c, { f0: 660, dur: 0.05, type: 'triangle', gain: 0.06 }),
  pop:   c => tone(c, { f0: 520, f1: 900, dur: 0.08, type: 'triangle', gain: 0.1 }),
  good:  c => { tone(c, { f0: 660, dur: 0.09, type: 'triangle' }); tone(c, { f0: 990, t: 0.08, dur: 0.14, type: 'triangle' }) },
  soft:  c => tone(c, { f0: 440, f1: 370, dur: 0.16, type: 'sine', gain: 0.08 }),
  bad:   c => { tone(c, { f0: 300, f1: 180, dur: 0.22, type: 'square', gain: 0.05 }) },
  combo: c => [784, 988, 1175].forEach((f, i) => tone(c, { f0: f, t: i * 0.06, dur: 0.1, type: 'triangle', gain: 0.09 })),
  win:   c => [523, 659, 784, 1047].forEach((f, i) => tone(c, { f0: f, t: i * 0.09, dur: 0.18, type: 'triangle', gain: 0.1 })),
  lose:  c => [392, 330, 262].forEach((f, i) => tone(c, { f0: f, t: i * 0.12, dur: 0.2, type: 'sine', gain: 0.09 })),
  tick:  c => tone(c, { f0: 1200, dur: 0.03, type: 'square', gain: 0.03 })
}

export function sfx (name) {
  if (!enabled) return
  const c = ac()
  if (!c || !SOUNDS[name]) return
  try {
    if (c.state === 'suspended') c.resume()
    SOUNDS[name](c)
  } catch { /* audio is a garnish — never let it throw into a game */ }
}

/** A short vibration where the platform has one (Android). */
export function buzz (ms = 30) {
  if (!enabled) return
  try { navigator.vibrate?.(ms) } catch { /* ignore */ }
}
