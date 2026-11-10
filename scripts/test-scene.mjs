/**
 * The scene (src/lib/scene.js) is the app's progress indicator, so where the
 * light is, how full the moon is and what colour the paper is are behaviour,
 * not decoration. This pins the pure parts, paints every state into a
 * recording context to catch a NaN or a malformed colour before a phone
 * does, and drives the tween loop with a fake clock.
 *
 *   node scripts/test-scene.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  sunAt, moonLit, ridge, paletteAt, frame, seedOf, drawScene, createScene, rgbToHex, hexToRgb
} from '../src/lib/scene.js'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
let pass = 0, fail = 0
const ok = (cond, label, detail = '') => {
  if (cond) pass++
  else { fail++; console.log(`FAIL ${label}${detail ? '  → ' + detail : ''}`) }
}

const SIZES = [[320, 568], [390, 844], [430, 932], [768, 1024], [1440, 900]]
const LEARNERS = [null, 'pink', 'blue', 'yellow']

/* ---- the light travels left to right, up and down again ---- */
for (const [w, h] of SIZES) {
  for (const calm of [0, 0.5, 1]) {
    const f = frame(w, h, calm)
    let prevX = -Infinity
    let minY = Infinity, minAt = 0
    for (let i = 0; i <= 80; i++) {
      const p = i / 80
      const s = sunAt(p, w, h, calm)
      ok(s.x > prevX, 'sun x increases with progress', `${w}x${h} calm=${calm} p=${p}`)
      prevX = s.x
      ok(s.x >= f.x0 && s.x <= f.x0 + f.cw, 'sun stays over the content column', `${w}x${h} p=${p} x=${s.x}`)
      ok(s.y >= f.peak - 0.5 && s.y < f.horizon, 'sun is between the top of the arc and the range', `${w}x${h} calm=${calm} p=${p} y=${s.y}`)
      if (s.y < minY) { minY = s.y; minAt = p }
    }
    ok(Math.abs(minAt - 0.5) < 0.03, 'the arc tops out at mid-day', `${w}x${h} top at p=${minAt}`)
    const a = sunAt(0, w, h, calm), b = sunAt(1, w, h, calm)
    ok(Math.abs(a.y - b.y) < 0.5, 'dawn and dusk are at the same height')
    // the arc is only drawn on the open views (calm 0); receded, the light just needs to rise at all
    ok(a.y - minY > h * (calm === 0 ? 0.06 : 0.02), 'the arc has real height', `calm=${calm}: ${a.y - minY}px on ${h}`)
  }
}
// out-of-range progress is clamped, not extrapolated off the screen
ok(sunAt(-3, 390, 844).x === sunAt(0, 390, 844).x && sunAt(9, 390, 844).x === sunAt(1, 390, 844).x, 'progress is clamped')

/* ---- every station of an 8-period day is a distinct place ---- */
{
  const xs = Array.from({ length: 9 }, (_, k) => sunAt(k / 8, 390, 844).x)
  ok(xs.every((x, i) => i === 0 || x - xs[i - 1] > 20), 'stations are at least 20px apart on a phone', xs.map(Math.round).join(','))
}

/* ---- the moon waxes; never new ---- */
{
  let prev = 0
  for (let i = 0; i <= 20; i++) {
    const l = moonLit(i / 20)
    ok(l > prev, 'moon waxes with progress')
    prev = l
  }
  ok(moonLit(0) > 0.08 && moonLit(0) < 0.3, 'nothing done is a thin crescent, not a new moon', String(moonLit(0)))
  ok(moonLit(1) === 1, 'everything done is a full moon')
}

/* ---- ridges ---- */
for (const learner of LEARNERS) {
  const seed = seedOf(learner)
  for (let L = 0; L < 5; L++) {
    let lo = 1, hi = 0
    for (let i = 0; i < 600; i++) {
      const v = ridge(L, i / 60, seed)
      ok(v >= 0 && v <= 1 && Number.isFinite(v), 'ridge height is within 0..1', `layer ${L} v=${v}`)
      lo = Math.min(lo, v); hi = Math.max(hi, v)
      ok(v === ridge(L, i / 60, seed), 'ridge is deterministic')
    }
    ok(hi - lo > 0.25, 'a ridge has relief', `layer ${L} learner ${learner}: ${lo.toFixed(2)}..${hi.toFixed(2)}`)
  }
}
{
  const diff = (a, b) => Array.from({ length: 50 }, (_, i) => Math.abs(ridge(0, i / 10, seedOf(a)) - ridge(0, i / 10, seedOf(b)))).reduce((x, y) => x + y) / 50
  ok(diff('pink', 'blue') > 0.05 && diff('blue', 'yellow') > 0.05 && diff('pink', 'yellow') > 0.05, 'each learner has their own range')
}

/* ---- palette ---- */
const cssText = readFileSync(resolve(ROOT, 'src/styles/main.css'), 'utf8')
const lightBg = /:root \{[\s\S]*?--bg:\s*(#[0-9a-f]{6})/i.exec(cssText)?.[1]
const darkBg = /:root\[data-theme="dark"\] \{[\s\S]*?--bg:\s*(#[0-9a-f]{6})/i.exec(cssText)?.[1]
for (const theme of ['light', 'dark']) {
  for (const learner of LEARNERS) {
    for (let i = 0; i <= 16; i++) {
      const pal = paletteAt(theme, learner, i / 16)
      for (const [k, c] of Object.entries(pal)) {
        ok(c.length === 3 && c.every(v => Number.isFinite(v) && v >= 0 && v <= 255), 'palette channels are valid', `${theme} ${learner} ${k}`)
      }
      // the canvas ends in the same colour the page is: no seam under the range
      ok(rgbToHex(pal.paper) === (theme === 'dark' ? darkBg : lightBg), 'scene paper equals the CSS --bg', `${theme}: ${rgbToHex(pal.paper)} vs ${theme === 'dark' ? darkBg : lightBg}`)
    }
    // near ridges are darker than far ones in both themes (aerial perspective)
    const pal = paletteAt(theme, learner, 0.5)
    const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    ok(lum(pal.near) < lum(pal.far), 'the near ridge is darker than the far one', `${theme} ${learner}`)
    if (theme === 'light') ok(lum(pal.paper) > 225, 'light paper is light enough for 墨 text')
    else ok(lum(pal.paper) < 26, 'dark paper is dark enough for light text')
  }
}
ok(rgbToHex(hexToRgb('#165e83')) === '#165e83', 'hex round trip')
// the day changes the sky: dawn, noon and dusk are different colours
{
  const a = paletteAt('light', null, 0).low, b = paletteAt('light', null, 0.5).low, c = paletteAt('light', null, 1).low
  const d = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
  ok(d(a, b) > 12 && d(b, c) > 12 && d(a, c) > 8, 'dawn, noon and dusk have different skies')
}

/* ---- paint every state into a recording context ---- */
const COLOR = /^rgba\((\d{1,3}),(\d{1,3}),(\d{1,3}),(-?\d*\.?\d+(e-?\d+)?)\)$/
function recorder () {
  const bad = []
  const check = (v, where) => {
    if (typeof v !== 'string') return
    const m = COLOR.exec(v)
    if (!m || [m[1], m[2], m[3]].some(n => +n > 255) || !(+m[4] >= 0 && +m[4] <= 1)) bad.push(`${where}: ${v}`)
  }
  const num = (args, where) => { for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) bad.push(`${where}: non-finite argument`) }
  const grad = where => ({ addColorStop (o, c) { if (!(o >= 0 && o <= 1)) bad.push(`${where}: stop offset ${o}`); check(c, where) } })
  let calls = 0
  const ctx = new Proxy({}, {
    get (t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a) => { num(a, k); calls++; return grad(k) }
      if (k in t) return t[k]
      return (...a) => { num(a, String(k)); calls++ }
    },
    set (t, k, v) {
      if (k === 'fillStyle' || k === 'strokeStyle') check(v, String(k))
      if (k === 'globalAlpha' && !(v >= 0 && v <= 1)) bad.push(`globalAlpha ${v}`)
      t[k] = v
      return true
    }
  })
  return { ctx, bad, get calls () { return calls } }
}
let painted = 0
for (const [w, h] of SIZES) {
  for (const theme of ['light', 'dark']) {
    for (const learner of LEARNERS) {
      for (const p of [0, 0.125, 0.5, 0.875, 1]) {
        for (const calm of [0, 0.4, 1]) {
          for (const rise of [0, 0.5, 1]) {
            const r = recorder()
            let info, err = null
            try { info = drawScene(r.ctx, w, h, { theme, learner, p, calm, rise, arc: 1, done: Math.round(p * 8), total: 8 }) } catch (e) { err = e }
            ok(!err, 'drawScene does not throw', `${w}x${h} ${theme} ${learner} p=${p} calm=${calm} rise=${rise}: ${err?.message}`)
            ok(r.bad.length === 0, 'every colour and coordinate painted is valid', r.bad.slice(0, 3).join(' | '))
            ok(r.calls > 30, 'the scene actually paints')
            if (info) ok(Number.isFinite(info.sun.x) && Number.isFinite(info.sun.y), 'drawScene reports where the light is')
            painted++
          }
        }
      }
    }
  }
}
// the medallion variant (SkyOrb)
{
  const r = recorder()
  drawScene(r.ctx, 300, 300, { theme: 'light', learner: 'pink', p: 0.3, calm: 0, rise: 1, arc: 0, done: 0, total: 0, lift: 0.32 })
  ok(r.bad.length === 0, 'the medallion paints cleanly', r.bad[0])
}

/* ---- the running scene: tweens, and stops when it arrives ---- */
{
  let now = 0
  const queue = []
  globalThis.performance = { now: () => now }
  globalThis.requestAnimationFrame = fn => { queue.push(fn); return queue.length }
  globalThis.cancelAnimationFrame = () => {}
  globalThis.window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 }
  globalThis.matchMedia = () => ({ matches: false })
  const r = recorder()
  const canvas = { clientWidth: 390, clientHeight: 844, width: 0, height: 0, getContext: () => r.ctx }
  const frames = (n, dt = 16) => { for (let i = 0; i < n; i++) { now += dt; const q = queue.splice(0); for (const fn of q) fn(now) } }
  let paints = 0
  const scene = createScene(canvas, { onPaint: () => paints++ })
  scene.set({ theme: 'light', p: 0.25, done: 2, total: 8, calm: 0, arc: 1, jump: true })
  scene.resize()
  ok(canvas.width === 780 && canvas.height === 1688, 'canvas is sized at device pixels', `${canvas.width}x${canvas.height}`)
  ok(scene.state.p === 0.25 && scene.state.rise === 0, 'state set before opening applies at once; the light has not risen yet')
  scene.open()
  frames(200)
  ok(Math.abs(scene.state.rise - 1) < 1e-6, 'the opening finishes', String(scene.state.rise))
  ok(queue.length === 0, 'no frame is requested once the scene is still')
  const before = paints
  frames(30)
  ok(paints === before, 'a still scene does not repaint')

  scene.set({ p: 0.375, done: 3 })
  frames(10)
  ok(scene.state.p > 0.25 && scene.state.p < 0.375, 'finishing a period moves the light gradually', String(scene.state.p))
  ok(scene.state.done === 3, 'the station count switches at once')
  frames(200)
  ok(Math.abs(scene.state.p - 0.375) < 1e-6 && queue.length === 0, 'and it arrives and stops')

  scene.set({ calm: 1, arc: 0 })
  frames(200)
  ok(scene.state.calm === 1 && scene.state.arc === 0, 'entering a lesson calms the scene')

  // resizing by a pixel (iOS toolbar) does not reallocate the canvas
  const wBefore = canvas.width
  canvas.clientHeight = 845
  scene.resize()
  ok(canvas.width === wBefore && canvas.height === 1688, 'a 1px height change is ignored')
  canvas.clientHeight = 700
  scene.resize()
  ok(canvas.height === 1400, 'a real resize is followed')

  // reduced motion: everything is immediate
  globalThis.matchMedia = () => ({ matches: true })
  const still = createScene({ ...canvas, getContext: () => recorder().ctx })
  ok(still.state.rise === 1, 'reduced motion starts with the light already up')
  still.open()
  still.set({ p: 1 })
  ok(still.state.p === 1, 'reduced motion moves the light at once')
}

console.log(`scene: ${pass} passed, ${fail} failed (${painted} states painted)`)
process.exit(fail ? 1 : 0)
