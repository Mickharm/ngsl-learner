/**
 * 一日山水 — the scene behind every page (v6).
 *
 * One landscape, one light. Five ridgelines stand in mist under a sky, and the
 * only light in the app is the sun (light theme) or the moon (dark theme)
 * that travels an arc across it. The arc is the day's timetable: with nothing
 * done the sun is just clearing the far peaks on the left, each finished
 * period moves it one station along, and the last one sets it on the right in
 * a gold dusk. At night the same arc carries a moon that waxes from a thin
 * crescent to full. So the picture is not decoration: it is the progress
 * indicator, and every glass panel in front of it is lit from where it is.
 *
 * Why Canvas 2D and not a shader: the scene is redrawn only when something
 * changes (progress, route, theme, size), so there is no frame budget to win,
 * and a 2D context draws the same thing on every device — no mediump banding
 * on one phone and not another, no context loss when the home-screen app is
 * resumed. Gradients are dithered by a grain tile laid over the canvas in
 * CSS, which is also the paper's tooth.
 *
 * Everything that decides *where* things are is a pure function exported from
 * here (sunAt, moonLit, ridge, paletteAt) and is pinned by
 * scripts/test-scene.mjs; drawScene only paints.
 */

/* ------------------------------------------------------------------ *
 * small maths
 * ------------------------------------------------------------------ */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export const easeOut = t => 1 - Math.pow(1 - t, 3)

/** mulberry32: a tiny seeded generator, so each learner's range is stable. */
export function rng (seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function hash (n, seed) {
  let h = Math.imul(n | 0, 374761393) + Math.imul(seed | 0, 668265263)
  h = (h ^ h >>> 13) * 1274126177
  return ((h ^ h >>> 16) >>> 0) / 4294967296
}
/** 1-D value noise, smooth, 0..1 */
function vnoise (x, seed) {
  const i = Math.floor(x), f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i, seed), hash(i + 1, seed), u)
}

/* ------------------------------------------------------------------ *
 * colour
 * ------------------------------------------------------------------ */
export function hexToRgb (hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`
export const rgbToHex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('')

/**
 * Three moments of the day per theme; progress interpolates between them.
 *   top / mid / low   the sky, zenith to horizon
 *   glow              the colour light takes in the haze around its source
 *   far / near        the farthest and nearest ridge (aerial perspective
 *                     interpolates the ones between)
 *   mist              what pools between the ridges
 *   paper             the field the content rests on (matches --bg)
 */
const KEYS = {
  light: {
    paper: '#f0eee9',
    stops: [
      { top: '#9fb0cf', mid: '#d6cfdc', low: '#f6d8c6', glow: '#ffcf9e', far: '#a9b3cc', near: '#2f4563', mist: '#fbf3ee' },   // 曙
      { top: '#7fb0d6', mid: '#bcd8e8', low: '#e6f1f1', glow: '#fff0cc', far: '#93b6cb', near: '#24506b', mist: '#f7fbfa' },   // 昼
      { top: '#5f74a8', mid: '#c79fb0', low: '#f9c593', glow: '#ffa862', far: '#b596ac', near: '#332f55', mist: '#fdecdc' }    // 暮
    ],
    tint: { pink: '#eaa9b8', blue: '#8fcfd2', yellow: '#f2cb72' },
    tintAmount: 0.18
  },
  dark: {
    paper: '#0c1118',
    stops: [
      { top: '#050912', mid: '#0d1830', low: '#213556', glow: '#8ea9dc', far: '#1c2b48', near: '#080c13', mist: '#7f9ccf' },   // 朔
      { top: '#060b16', mid: '#101d38', low: '#294066', glow: '#a9c0ea', far: '#20304f', near: '#090d15', mist: '#8fa9d8' },   // 弦
      { top: '#070d1a', mid: '#152542', low: '#345079', glow: '#d2dff8', far: '#263a5d', near: '#0a0e16', mist: '#a5bbe4' }    // 望
    ],
    tint: { pink: '#7a4a6c', blue: '#2c6878', yellow: '#75603a' },
    tintAmount: 0.22
  }
}

/** The palette at day progress p (0..1) for a theme and learner, as rgb triples. */
export function paletteAt (theme, learner, p) {
  const K = KEYS[theme === 'dark' ? 'dark' : 'light']
  const x = clamp(p) * 2
  const i = Math.min(1, Math.floor(x))
  const t = x - i
  const a = K.stops[i], b = K.stops[i + 1]
  const out = {}
  for (const k of Object.keys(a)) out[k] = mix(hexToRgb(a[k]), hexToRgb(b[k]), t)
  out.paper = hexToRgb(K.paper)
  const tint = K.tint[learner]
  if (tint) {
    const c = hexToRgb(tint)
    out.low = mix(out.low, c, K.tintAmount)
    out.mid = mix(out.mid, c, K.tintAmount * 0.8)
    out.far = mix(out.far, c, K.tintAmount * 0.7)
    out.mist = mix(out.mist, c, K.tintAmount * 0.25)
  }
  return out
}

/* ------------------------------------------------------------------ *
 * geometry
 * ------------------------------------------------------------------ */
/**
 * The frame the scene is composed in: the centre column of the page (content
 * is at most 600 px wide), so on a wide window the arc still spans the
 * content and the mountains simply continue to both sides.
 */
export function frame (w, h, calm = 0) {
  const cw = Math.min(w, 600)
  const x0 = (w - cw) / 2
  const horizon = h * lerp(0.4, 0.2, calm)           // where the ridges stand
  const peak = Math.max(lerp(72, 40, calm), h * lerp(0.145, 0.06, calm))  // top of the arc
  return { cw, x0, horizon, peak }
}

/**
 * Where the light is at day progress p. It rises behind the far peaks on the
 * left, tops out over the middle and goes down on the right. Returns CSS px.
 */
export function sunAt (p, w, h, calm = 0) {
  const f = frame(w, h, calm)
  const t = clamp(p)
  const low = f.horizon - h * lerp(0.15, 0.085, calm)   // among the far peaks
  const x = f.x0 + f.cw * lerp(0.1, 0.9, t)
  const y = low - (low - f.peak) * Math.pow(Math.sin(Math.PI * lerp(0.035, 0.965, t)), 0.8)
  return { x, y }
}

/** Lit fraction of the moon at day progress p: a thin crescent, never none. */
export const moonLit = p => lerp(0.14, 1, clamp(p))

const LAYERS = 5
/**
 * Height of ridge `layer` (0 far … 4 near) at horizontal position x, as a
 * fraction 0..1 of that layer's amplitude. Far ranges are peaked (ridged
 * noise), near hills roll. x is in units of 400 px so wide screens show more
 * mountains, not wider ones.
 */
export function ridge (layer, x, seed = 1) {
  const s = seed * 97 + layer * 131
  const far = 1 - layer / (LAYERS - 1)
  const f = lerp(1.15, 1.9, far)
  const base = vnoise(x * f, s)
  const ridged = 1 - Math.abs(2 * vnoise(x * f * 1.7 + 11.3, s + 7) - 1)
  const detail = vnoise(x * f * 4.3, s + 19) * 0.5 + vnoise(x * f * 9.1, s + 31) * 0.25
  const v = base * 0.58 + Math.pow(ridged, 1.6) * lerp(0.12, 0.42, far) + detail * lerp(0.07, 0.16, far)
  return clamp(v / 1.02)
}

const SEEDS = { pink: 11, blue: 29, yellow: 47 }
export const seedOf = learner => SEEDS[learner] || 5

/* ------------------------------------------------------------------ *
 * painting
 * ------------------------------------------------------------------ */
/**
 * Paper tooth: sparse dark and light specks on a transparent ground, as a
 * 192 px tile. It is laid over the scene by CSS (Backdrop.vue), not painted
 * into the canvas — so it stays at device pixels on any screen, covers the
 * paper below the canvas too, and dithers every gradient under it.
 */
let grainURL = null
export function grainDataURL () {
  if (grainURL || typeof document === 'undefined') return grainURL
  const c = document.createElement('canvas')
  c.width = c.height = 192
  const g = c.getContext('2d')
  const img = g.createImageData(192, 192)
  const r = rng(20261110)
  for (let i = 0; i < img.data.length; i += 4) {
    const on = r() < 0.5
    img.data[i] = img.data[i + 1] = img.data[i + 2] = on ? 0 : 255
    img.data[i + 3] = Math.floor(r() * (on ? 22 : 26))
  }
  g.putImageData(img, 0, 0)
  grainURL = c.toDataURL('image/png')
  return grainURL
}

function softEllipse (ctx, cx, cy, rx, ry, color, alpha) {
  if (alpha <= 0.002 || rx <= 0 || ry <= 0) return
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  g.addColorStop(0, css(color, alpha))
  g.addColorStop(0.45, css(color, alpha * 0.55))
  g.addColorStop(1, css(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/**
 * Paint the scene. `s` is the scene state:
 *   theme 'light'|'dark' · learner · p day progress 0..1 · calm 0..1 (0 =
 *   the open view on 今天, 1 = receded behind a lesson) · rise 0..1 (the
 *   opening: light comes up, mist thins) · arc 0..1 (opacity of the day's arc
 *   and its stations) · done / total (stations passed) · lift (SkyOrb's
 *   medallion frames the range lower)
 * Coordinates are CSS px; the caller has already scaled the context by dpr.
 */
export function drawScene (ctx, w, h, s) {
  const dark = s.theme === 'dark'
  const pal = paletteAt(s.theme, s.learner, s.p)
  const calm = clamp(s.calm)
  const rise = clamp(s.rise ?? 1)
  const f = frame(w, h, calm)
  const seed = seedOf(s.learner)
  const sun = sunAt(s.p, w, h, calm)
  // a medallion (SkyOrb) frames the scene lower: more sky above the range
  if (s.lift) { f.horizon += h * s.lift; sun.y += h * s.lift * 0.6 }
  sun.y += (1 - rise) * h * 0.09
  const lightA = lerp(0.25, 1, rise)

  /* sky */
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  const skyEnd = f.horizon + h * 0.02
  const sky = ctx.createLinearGradient(0, 0, 0, skyEnd)
  sky.addColorStop(0, css(pal.top))
  sky.addColorStop(0.55, css(pal.mid))
  sky.addColorStop(1, css(pal.low))
  ctx.fillStyle = css(pal.paper)
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, skyEnd)

  /* stars: few, and none near the moon */
  if (dark) {
    const r = rng(seed * 13 + 3)
    const n = Math.round(46 * Math.max(1, w / 400))
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * f.horizon * 0.86, m = r()
      const d = Math.hypot(x - sun.x, y - sun.y)
      const a = (0.25 + m * 0.6) * clamp((d - 46) / 90) * lerp(1, 0.55, calm) * (1 - (y / f.horizon) * 0.6)
      if (a <= 0.02) continue
      ctx.fillStyle = `rgba(222,232,255,${a})`
      const sz = m > 0.9 ? 1.5 : m > 0.6 ? 1.1 : 0.8
      ctx.beginPath(); ctx.arc(x, y, sz * 0.7, 0, Math.PI * 2); ctx.fill()
    }
  }

  /* the light's halo in the air, behind everything that stands */
  const haloR = Math.max(w, h) * (dark ? 0.42 : 0.55)
  softEllipse(ctx, sun.x, sun.y, haloR, haloR, pal.glow, (dark ? 0.26 : 0.5) * lightA * lerp(1, 0.75, calm))
  softEllipse(ctx, sun.x, sun.y, 92, 92, dark ? pal.glow : [255, 250, 238], (dark ? 0.26 : 0.62) * lightA)

  /* the day's arc and its stations (今天 only) */
  const arcA = clamp(s.arc ?? 0) * rise
  if (arcA > 0.01 && s.total > 0) {
    ctx.save()
    ctx.lineWidth = 1
    ctx.strokeStyle = dark ? `rgba(200,216,246,${0.2 * arcA})` : `rgba(255,255,255,${0.75 * arcA})`
    ctx.beginPath()
    for (let i = 0; i <= 64; i++) {
      const q = sunAt(i / 64, w, h, calm)
      if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y)
    }
    ctx.stroke()
    for (let k = 0; k <= s.total; k++) {
      const q = sunAt(k / s.total, w, h, calm)
      const passed = k <= s.done
      ctx.beginPath()
      ctx.arc(q.x, q.y, passed ? 2.6 : 2.1, 0, Math.PI * 2)
      if (passed) {
        ctx.fillStyle = dark ? `rgba(226,235,255,${0.85 * arcA})` : `rgba(255,255,255,${0.98 * arcA})`
        ctx.fill()
      } else {
        ctx.fillStyle = css(pal.mid, 0.9 * arcA)
        ctx.fill()
        ctx.strokeStyle = dark ? `rgba(200,216,246,${0.38 * arcA})` : `rgba(255,255,255,${0.9 * arcA})`
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  /* the light itself. Inside a lesson only its glow is left: a disc half
     hidden behind a header reads as a mistake, a glow reads as light. */
  const discA = lightA * (1 - calm)
  if (discA > 0.01 && dark) {
    const R = 21
    const lit = moonLit(s.p)
    ctx.save()
    ctx.translate(sun.x, sun.y)
    ctx.rotate(-0.42)
    // the unlit disc, by earthshine
    ctx.fillStyle = css(mix(pal.low, pal.glow, 0.16), 0.96 * discA)
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill()
    // the lit part: right limb plus the terminator ellipse
    const g = ctx.createRadialGradient(R * 0.35, -R * 0.3, 1, 0, 0, R * 1.15)
    g.addColorStop(0, `rgba(252,250,240,${discA})`)
    g.addColorStop(1, `rgba(214,224,244,${discA})`)
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, R, -Math.PI / 2, Math.PI / 2)
    ctx.ellipse(0, 0, Math.max(0.01, R * Math.abs(1 - 2 * lit)), R, 0, Math.PI / 2, lit < 0.5 ? -Math.PI / 2 : Math.PI * 1.5, lit < 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  } else if (discA > 0.01) {
    const R = 17
    const g = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, R * 2.4)
    g.addColorStop(0, `rgba(255,255,250,${discA})`)
    g.addColorStop(0.4, `rgba(255,252,240,${discA})`)
    g.addColorStop(0.46, css(mix(pal.glow, [255, 255, 255], 0.55), 0.55 * discA))
    g.addColorStop(1, css(pal.glow, 0))
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(sun.x, sun.y, R * 2.4, 0, Math.PI * 2); ctx.fill()
  }

  /* ridges, far to near. Each is crisp along its top and dissolves into the
     mist at its foot, and the next one stands up out of that mist; the
     nearest sinks into the paper the content rests on. */
  const contrast = lerp(1, 0.7, calm)
  const amp = [0.2, 0.165, 0.128, 0.096, 0.07].map(a => a * h * lerp(1, 0.55, calm))
  const DEPTH = [0, 0.22, 0.47, 0.74, 1]
  const mr = rng(seed * 7 + 1)
  const step = 3
  for (let L = 0; L < LAYERS; L++) {
    const depth = DEPTH[L]
    const body = mix(pal.far, pal.near, depth * contrast)
    const last = L === LAYERS - 1
    const base = f.horizon + L * h * 0.012
    let top = base
    ctx.beginPath()
    ctx.moveTo(-2, h + 2)
    for (let x = -2; x <= w + step; x += step) {
      const y = base - amp[L] * ridge(L, (x - f.x0) / 400 + L * 3.7, seed)
      if (y < top) top = y
      ctx.lineTo(x, y)
    }
    ctx.lineTo(w + 2, h + 2)
    ctx.closePath()
    const foot = base + h * 0.045
    const veil = dark ? mix(body, pal.mist, last ? 0.22 : 0.3) : mix(body, pal.mist, 0.82)
    const g = ctx.createLinearGradient(0, top, 0, foot)
    g.addColorStop(0, css(body))
    g.addColorStop(0.4, css(mix(body, veil, 0.22)))
    g.addColorStop(0.86, css(mix(body, veil, 0.9)))
    g.addColorStop(1, css(veil))
    ctx.fillStyle = g
    ctx.fill()

    // a long band of mist lying in front of this ridge, behind the next
    if (!last) {
      for (let k = 0; k < 2; k++) {
        const cx = f.x0 + f.cw * (mr() * 1.2 - 0.1) + (1 - rise) * (k % 2 ? 70 : -70)
        const cy = base - amp[L] * 0.1 + mr() * h * 0.012
        const rx = f.cw * (0.4 + mr() * 0.42)
        softEllipse(ctx, cx, cy, rx, h * (0.012 + mr() * 0.012), pal.mist, (dark ? 0.1 : 0.5) * lerp(1, 1.5, 1 - rise) * lerp(1, 0.8, calm))
      }
    }
  }

  /* light spilling into the haze in front of the range */
  ctx.globalCompositeOperation = dark ? 'screen' : 'soft-light'
  softEllipse(ctx, sun.x, Math.max(sun.y, f.horizon - h * 0.12), f.cw * 0.6, h * 0.16, pal.glow, (dark ? 0.2 : 0.55) * lightA * contrast)
  ctx.globalCompositeOperation = 'source-over'

  /* 雲海: the range stands in a sea of cloud, and the cloud thins into the
     paper the content rests on. Its top is uneven, a few long soft swells. */
  const seaTop = f.horizon + h * lerp(0.012, 0.004, calm)
  const sea = dark ? mix(pal.paper, pal.mist, 0.2) : pal.mist
  const cr = rng(seed * 5 + 9)
  for (let k = 0; k < 7; k++) {
    const cx = f.x0 + f.cw * (k / 6 * 1.3 - 0.15) + (cr() - 0.5) * 60 + (1 - rise) * (k % 2 ? 50 : -50)
    softEllipse(ctx, cx, seaTop + h * 0.018 + cr() * h * 0.012, f.cw * (0.26 + cr() * 0.2), h * (0.02 + cr() * 0.016), sea, dark ? 0.55 : 0.95)
  }
  const bank = ctx.createLinearGradient(0, seaTop, 0, seaTop + h * 0.12)
  bank.addColorStop(0, css(sea, 0))
  bank.addColorStop(0.28, css(sea, dark ? 0.8 : 0.96))
  bank.addColorStop(0.5, css(mix(sea, pal.paper, 0.4), 1))
  bank.addColorStop(1, css(pal.paper, 1))
  ctx.fillStyle = bank
  ctx.fillRect(0, seaTop, w, h * 0.12)
  ctx.fillStyle = css(pal.paper)
  ctx.fillRect(0, seaTop + h * 0.12 - 0.5, w, h)
  // the light lies on the cloud under its source
  softEllipse(ctx, sun.x, seaTop + h * 0.03, f.cw * 0.42, h * 0.035, pal.glow, (dark ? 0.1 : 0.4) * lightA * contrast)

  /* inside a lesson the whole view is seen through more air */
  if (calm > 0.01) {
    ctx.fillStyle = css(pal.paper, (dark ? 0.42 : 0.5) * calm)
    ctx.fillRect(0, 0, w, seaTop + h * 0.12)
  }

  return { sun, pal, frame: f }
}

/* ------------------------------------------------------------------ *
 * the running scene: owns a canvas, tweens between states, redraws only
 * while something is moving
 * ------------------------------------------------------------------ */
export function createScene (canvas, { onPaint } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false })
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const cur = { theme: 'light', learner: null, p: 0, calm: 0, rise: reduce ? 1 : 0, arc: 0, done: 0, total: 0 }
  const tweens = new Map()        // key -> { from, to, t0, ms, ease }
  let w = 0, h = 0, dpr = 1, raf = 0, alive = true, started = false

  function resize () {
    const cw = canvas.clientWidth || window.innerWidth
    const ch = canvas.clientHeight || window.innerHeight
    const d = Math.min(2, window.devicePixelRatio || 1)
    // iOS collapses its toolbar while scrolling and fires a stream of small
    // height changes; a canvas a little taller than the viewport is fine
    if (cw === w && Math.abs(ch - h) < 2 && d === dpr) return
    w = cw; h = ch; dpr = d
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    paint()
  }

  function paint () {
    if (!alive || !w || !h) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const info = drawScene(ctx, w, h, cur)
    onPaint?.({ ...info, w, h, state: cur })
  }

  function tick (now) {
    raf = 0
    let moving = false
    for (const [k, tw] of tweens) {
      const t = clamp((now - tw.t0) / tw.ms)
      cur[k] = lerp(tw.from, tw.to, tw.ease(t))
      if (t >= 1) tweens.delete(k); else moving = true
    }
    paint()
    if (moving && alive) raf = requestAnimationFrame(tick)
  }
  const kick = () => { if (!raf && alive) raf = requestAnimationFrame(tick) }

  function to (key, value, ms, ease = easeInOut) {
    if (reduce || !started || ms <= 0) { tweens.delete(key); cur[key] = value; return }
    const target = tweens.get(key)?.to ?? cur[key]
    if (Math.abs(target - value) < 1e-4) return
    tweens.set(key, { from: cur[key], to: value, t0: performance.now(), ms, ease })
  }

  /**
   * Move the scene to a new state. Discrete things (theme, learner, station
   * counts) switch at once; continuous ones glide.
   */
  function set (next) {
    if (next.theme != null) cur.theme = next.theme
    if ('learner' in next) cur.learner = next.learner
    if (next.total != null) cur.total = next.total
    if (next.done != null) cur.done = next.done
    if (next.p != null) to('p', clamp(next.p), next.jump ? 0 : 1500)
    if (next.calm != null) to('calm', clamp(next.calm), next.jump ? 0 : 720, easeOut)
    if (next.arc != null) to('arc', clamp(next.arc), next.jump ? 0 : 520, easeOut)
    kick()
  }

  /** The opening: the light comes up once, when the app is first shown. */
  function open () {
    if (started) return
    started = true
    if (!reduce) tweens.set('rise', { from: 0, to: 1, t0: performance.now() + 120, ms: 1700, ease: easeOut })
    else cur.rise = 1
    kick()
  }

  function destroy () { alive = false; cancelAnimationFrame(raf) }

  return { set, open, resize, paint, destroy, get state () { return cur } }
}
