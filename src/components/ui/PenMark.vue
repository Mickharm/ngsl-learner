<script setup>
/**
 * The teacher's red pen: a loose circle for right, a cross for wrong, drawn
 * on as you watch (stroke-dashoffset). Shape carries the meaning, so it reads
 * without relying on red vs green.
 */
defineProps({
  kind: { type: String, default: 'right' },   // right | wrong
  size: { type: Number, default: 40 }
})
</script>

<template>
  <svg class="pm" :class="`pm--${kind}`" :width="size" :height="size" viewBox="0 0 48 48" aria-hidden="true">
    <path v-if="kind === 'right'" pathLength="1" d="M33.5 9.5C27.4 5.6 16.3 6.8 10.6 13.7 4.5 21.1 6.9 33.4 15.6 38.6c8.7 5.1 21.4 2.6 26-6.4 3.9-7.6.6-17.9-7.8-21.9-3.3-1.6-7.6-2-10.4-1.2" />
    <template v-else>
      <path pathLength="1" d="M12 11.5c8.3 8.6 16.4 17.4 24.6 25.6" />
      <path pathLength="1" class="pm__2" d="M37 10.5C28.2 18.6 19.8 27.5 11.4 37" />
    </template>
  </svg>
</template>

<style scoped>
.pm { flex-shrink: 0; overflow: visible; }
.pm path { fill: none; stroke: var(--redpen); stroke-width: 3.6; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 0.42s cubic-bezier(0.5, 0, 0.3, 1) forwards; }
.pm__2 { animation-delay: 0.18s !important; }
@media (prefers-reduced-motion: reduce) { .pm path { stroke-dashoffset: 0; animation: none; } }
</style>
