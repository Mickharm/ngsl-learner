<script setup>
/**
 * The verdict glyph: a filled disc with a check for right, a cross for wrong,
 * the stroke drawn on as you watch. Shape carries the meaning, so it reads
 * without relying on green vs red.
 */
defineProps({
  kind: { type: String, default: 'right' },   // right | wrong
  size: { type: Number, default: 40 }
})
</script>

<template>
  <svg class="pm" :class="`pm--${kind}`" :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true">
    <circle class="pm__disc" cx="24" cy="24" r="22" />
    <path v-if="kind === 'right'" pathLength="1" d="M14.5 24.8l6.4 6.4L34 17.6" />
    <template v-else>
      <path pathLength="1" d="M16.5 16.5l15 15" />
      <path pathLength="1" class="pm__2" d="M31.5 16.5l-15 15" />
    </template>
  </svg>
</template>

<style scoped>
.pm { flex-shrink: 0; overflow: visible; animation: spring-in 0.42s cubic-bezier(0.3, 1.4, 0.5, 1) both; }
.pm__disc { fill: var(--green); }
.pm--wrong .pm__disc { fill: var(--red-fill); }
.pm path { fill: none; stroke: #fff; stroke-width: 4.2; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 0.34s 0.12s cubic-bezier(0.5, 0, 0.3, 1) forwards; }
.pm__2 { animation-delay: 0.26s !important; }
@media (prefers-reduced-motion: reduce) { .pm, .pm path { animation: none; stroke-dashoffset: 0; } }
</style>
