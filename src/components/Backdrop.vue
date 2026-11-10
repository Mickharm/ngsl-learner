<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useSession } from '@/stores/session'
import { PROFILES } from '@/config'
import { createScene, rgbToHex, grainDataURL } from '@/lib/scene'

/**
 * 一日山水 (v6): the scene behind every page, painted by src/lib/scene.js.
 *
 * This component only decides what state the scene is in:
 *
 *   p      how far the light has travelled = periods finished / periods today.
 *          It moves when the learner is looking at it — on 今天 and 結算 — a
 *          moment after the page arrives, so finishing a lesson is answered
 *          by the sun moving one station along its arc.
 *   calm   0 on the open views (今天, login, 結算), 1 inside lessons and
 *          lists, where the range recedes to a pale band behind the header
 *          and text rests on plain paper (the v5.2 lesson: no ridgelines
 *          under a paragraph).
 *   arc    the day's arc and its stations, drawn on 今天 and 結算 only.
 *
 * Painted once per change, never on a timer. The light's position is
 * published as --lx / --ly so the glass in front can be lit from it.
 *
 * Depth: the scene scrolls at half the speed of the page (a compositor
 * transform, no repaint). Panels near the top of a page slide over the range
 * — that is what the glass is for — and by the time the lower sections
 * arrive the range has left the screen, so loose text never ends up on a
 * ridgeline (the v5.2 rule, kept). Off with reduced motion.
 */
const route = useRoute()
const auth = useAuth()
const session = useSession()
const canvas = ref(null)
const grain = ref('')
let scene = null
let mo = null
let mq = null
let moveTimer = 0
let lastTop = ''
let scrollRaf = 0
const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const root = document.documentElement
const themeNow = () => {
  const t = root.getAttribute('data-theme')
  if (t === 'light' || t === 'dark') return t
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
const learnerNow = () => PROFILES.find(p => p.email === auth.user?.email)?.accent || null
const isOpen = () => route.meta.scene === 'open'

function dayState () {
  if (!auth.signedIn) return { p: 0.2, done: 0, total: 0 }
  const total = session.todayPhases.length || 0
  const done = session.completedCount || 0
  return { p: total ? done / total : 0, done, total }
}

function onPaint ({ sun, pal, w, h }) {
  root.style.setProperty('--lx', (sun.x / w * 100).toFixed(1) + '%')
  root.style.setProperty('--ly', Math.round(sun.y) + 'px')
  const top = rgbToHex(pal.top)
  if (top !== lastTop) {
    lastTop = top
    // the status bar takes the colour of the sky above it
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', top))
  }
}

/** Route-level state: glide. */
function syncView ({ jump = false } = {}) {
  if (!scene) return
  const open = isOpen()
  scene.set({ calm: open ? 0 : 1, arc: open && auth.signedIn && route.name !== 'login' ? 1 : 0, jump })
}

/** The light: moves only where it can be seen, a beat after arriving. */
function syncDay ({ jump = false } = {}) {
  if (!scene) return
  clearTimeout(moveTimer)
  const d = dayState()
  if (jump) { scene.set({ ...d, jump: true }); return }
  if (!isOpen()) return
  moveTimer = setTimeout(() => scene?.set(d), 420)
}

function syncLook () {
  scene?.set({ theme: themeNow(), learner: learnerNow() })
}

onMounted(() => {
  scene = createScene(canvas.value, { onPaint })
  scene.set({ theme: themeNow(), learner: learnerNow(), ...dayState(), jump: true })
  syncView({ jump: true })
  scene.resize()
  scene.open()
  const url = grainDataURL()
  if (url) grain.value = `url(${url})`
  window.addEventListener('scroll', onScroll, { passive: true })

  window.addEventListener('resize', scene.resize)
  window.addEventListener('orientationchange', scene.resize)
  // a home-screen app resumed from the background can come back with a blank
  // canvas; repaint when it is shown again
  document.addEventListener('visibilitychange', onVisible)
  mo = new MutationObserver(syncLook)
  mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  if (typeof matchMedia === 'function') {
    mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', syncLook)
  }
})

function onVisible () { if (!document.hidden) scene?.paint() }

function onScroll () {
  if (scrollRaf || still) return
  scrollRaf = requestAnimationFrame(() => {
    scrollRaf = 0
    const c = canvas.value
    if (!c) return
    const y = Math.min(Math.max(0, window.scrollY) * 0.5, c.clientHeight * 0.62)
    c.style.transform = y ? `translate3d(0, ${-y.toFixed(1)}px, 0)` : ''
  })
}

onUnmounted(() => {
  clearTimeout(moveTimer)
  cancelAnimationFrame(scrollRaf)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', scene?.resize)
  window.removeEventListener('orientationchange', scene?.resize)
  document.removeEventListener('visibilitychange', onVisible)
  mo?.disconnect()
  mq?.removeEventListener?.('change', syncLook)
  scene?.destroy()
})

watch(() => [route.name, route.meta.scene], () => { syncView(); syncDay() })
watch(() => auth.user?.email, () => { syncLook(); syncView(); syncDay({ jump: !isOpen() }) })
watch(() => auth.signedIn ? [session.completedCount, session.todayPhases.length] : null, () => syncDay())
</script>

<template>
  <div class="bd" aria-hidden="true">
    <canvas ref="canvas" class="bd__c" />
    <div class="bd__grain" :style="{ backgroundImage: grain }" />
  </div>
</template>

<style scoped>
.bd { position: fixed; inset: 0; z-index: -1; pointer-events: none; background: var(--bg); overflow: hidden; }
/* lvh: the canvas keeps the size of the tallest viewport, so iOS collapsing
   its toolbar mid-scroll neither resizes nor repaints it */
.bd__c { position: absolute; left: 0; top: 0; width: 100%; height: 100vh; height: 100lvh; display: block; will-change: transform; }
/* paper tooth over everything painted, at device pixels (a 192px tile shown
   at 96 CSS px is 1:1 on a 2x screen and close enough on 3x) */
.bd__grain { position: absolute; inset: 0; background-size: 96px 96px; opacity: 0.45; }
</style>
