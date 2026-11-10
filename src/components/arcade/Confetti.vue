<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

/**
 * A one-shot confetti burst for a finished game. Pieces are small letter
 * tiles in the five interface colours — the tile motif again — and the whole
 * thing is skipped when the system asks for reduced motion.
 */
const canvas = ref(null)
let raf = 0

onMounted(() => {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const c = canvas.value
  if (!c) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const W = c.width = window.innerWidth * dpr
  const H = c.height = window.innerHeight * dpr
  const ctx = c.getContext('2d')
  const colors = ['#e2bd62', '#165e83', '#7ebea5', '#c98f9c', '#3f7ea3']
  const letters = 'ABCDEFGHIJKLMNOPRSTUVWY'
  const parts = Array.from({ length: 90 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 22 * dpr,
    vy: (-Math.random() * 20 - 8) * dpr,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    s: (10 + Math.random() * 10) * dpr,
    c: colors[Math.floor(Math.random() * colors.length)],
    ch: letters[Math.floor(Math.random() * letters.length)]
  }))
  const t0 = performance.now()
  const step = t => {
    const age = (t - t0) / 1000
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 1.2) / 0.8)
    for (const p of parts) {
      p.vy += 0.9 * dpr; p.vx *= 0.99
      p.x += p.vx; p.y += p.vy; p.r += p.vr
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r)
      ctx.fillStyle = p.c
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s)
      ctx.fillStyle = '#fff'
      ctx.font = `700 ${p.s * 0.7}px Andika, sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(p.ch, 0, p.s * 0.04)
      ctx.restore()
    }
    if (age < 2) raf = requestAnimationFrame(step)
    else ctx.clearRect(0, 0, W, H)
  }
  raf = requestAnimationFrame(step)
})
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <canvas ref="canvas" class="confetti" aria-hidden="true" />
</template>

<style scoped>
.confetti { position: fixed; inset: 0; width: 100vw; height: 100dvh; pointer-events: none; z-index: 400; }
</style>
