<script setup>
import { computed } from 'vue'

/**
 * The end-of-round medal: a ring that fills to the round's accuracy, the way
 * an Activity ring closes, with the grade in the middle (甲上 / 甲 / 乙 / 加油 —
 * the marks a Taiwanese classroom gives). The ring filling is the one
 * orchestrated moment of a result screen; everything around it stays still.
 * Kept under its v4 name so every result page picks it up.
 */
const props = defineProps({
  ratio: { type: Number, default: 1 },
  text: { type: String, default: '' },
  size: { type: Number, default: 116 }
})
const grade = computed(() => props.text || (props.ratio >= 0.9 ? '甲上' : props.ratio >= 0.75 ? '甲' : props.ratio >= 0.55 ? '乙' : '加油'))
const date = computed(() => {
  const d = new Date()
  return `${d.getMonth() + 1}/${d.getDate()}`
})
const R = 50
const C = 2 * Math.PI * R
const fill = computed(() => Math.max(0.04, Math.min(1, props.ratio)))
const uid = Math.random().toString(36).slice(2, 8)
</script>

<template>
  <svg class="medal" :width="size" :height="size" viewBox="0 0 120 120" role="img" :aria-label="`評等：${grade}`">
    <defs>
      <linearGradient :id="`ring-${uid}`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" class="medal__s1" />
        <stop offset="1" class="medal__s2" />
      </linearGradient>
    </defs>
    <circle class="medal__disc" cx="60" cy="60" r="58" />
    <circle class="medal__track" cx="60" cy="60" :r="R" />
    <circle
      class="medal__arc" cx="60" cy="60" :r="R"
      :stroke="`url(#ring-${uid})`"
      :style="{ '--c': C, '--off': C * (1 - fill) }"
      transform="rotate(-90 60 60)"
    />
    <text x="60" :y="grade.length > 1 ? 66 : 70" text-anchor="middle" class="medal__g" :class="{ 'medal__g--long': grade.length > 1, 'medal__g--xl': grade.length > 3 }">{{ grade }}</text>
    <text x="60" y="86" text-anchor="middle" class="medal__d">{{ date }}</text>
  </svg>
</template>

<style scoped>
.medal { overflow: visible; filter: drop-shadow(0 12px 24px rgba(30, 44, 70, 0.26)); animation: spring-in 0.5s cubic-bezier(0.3, 1.4, 0.5, 1) both; }
.medal__disc { fill: var(--surface-solid); stroke: rgba(255, 255, 255, 0.5); stroke-width: 0.75; }
.medal__track { fill: none; stroke: var(--surface-3); stroke-width: 7; }
.medal__arc {
  fill: none; stroke-width: 7; stroke-linecap: round;
  stroke-dasharray: var(--c); stroke-dashoffset: var(--c);
  animation: ring-fill 1.1s 0.2s cubic-bezier(0.3, 0.9, 0.3, 1) forwards;
}
.medal__s1 { stop-color: var(--gold-fill); }
.medal__s2 { stop-color: var(--pen); }
.medal__g { font-family: var(--font-kai); font-weight: 700; font-size: 30px; fill: var(--ink); letter-spacing: 0; }
.medal__g--long { font-size: 26px; }
.medal__g--xl { font-size: 19px; }
.medal__d { font-family: var(--font-fig); font-weight: 500; font-size: 11px; fill: var(--ink-3); }
@keyframes ring-fill { to { stroke-dashoffset: var(--off); } }
@media (prefers-reduced-motion: reduce) { .medal { animation: none; } .medal__arc { animation: none; stroke-dashoffset: var(--off); } }
</style>
