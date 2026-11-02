<script setup>
import { computed } from 'vue'

/**
 * A teacher's ink stamp — the reward at the end of a round. 甲上 / 甲 / 乙 /
 * 加油 by accuracy, with the date on the ring, pressed on with a thump.
 * Rougher than a vector circle on purpose: a displacement filter wobbles the
 * edge and a noise mask drops ink like a real rubber stamp.
 */
const props = defineProps({
  ratio: { type: Number, default: 1 },
  text: { type: String, default: '' },
  size: { type: Number, default: 116 }
})
const grade = computed(() => props.text || (props.ratio >= 0.9 ? '甲上' : props.ratio >= 0.75 ? '甲' : props.ratio >= 0.55 ? '乙' : '加油'))
const date = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`
})
const uid = Math.random().toString(36).slice(2, 8)
</script>

<template>
  <svg class="stamp" :width="size" :height="size" viewBox="0 0 120 120" role="img" :aria-label="`評等：${grade}`">
    <defs>
      <filter :id="`rough-${uid}`" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n" />
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
      </filter>
      <mask :id="`ink-${uid}`">
        <rect width="120" height="120" fill="#fff" />
        <filter :id="`speck-${uid}`"><feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="1" seed="9" /><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25" /></filter>
        <rect width="120" height="120" :filter="`url(#speck-${uid})`" />
      </mask>
    </defs>
    <g :filter="`url(#rough-${uid})`" :mask="`url(#ink-${uid})`" class="stamp__ink">
      <circle cx="60" cy="60" r="54" fill="none" stroke-width="5" />
      <circle cx="60" cy="60" r="45" fill="none" stroke-width="1.6" />
      <text x="60" :y="grade.length > 1 ? 72 : 76" text-anchor="middle" class="stamp__g" :class="{ 'stamp__g--long': grade.length > 1 }">{{ grade }}</text>
      <text x="60" y="33" text-anchor="middle" class="stamp__d">{{ date }}</text>
    </g>
  </svg>
</template>

<style scoped>
.stamp { animation: stamp 0.42s cubic-bezier(0.3, 1.4, 0.6, 1) both; transform: rotate(-9deg); }
.stamp__ink { stroke: var(--redpen); fill: var(--redpen); }
.stamp__g { font-family: var(--font-kai); font-weight: 700; font-size: 40px; stroke: none; letter-spacing: 1px; }
.stamp__g--long { font-size: 32px; }
.stamp__d { font-family: var(--font-word); font-weight: 700; font-size: 11px; stroke: none; letter-spacing: 1px; }
@media (prefers-reduced-motion: reduce) { .stamp { animation: none; } }
</style>
