<script setup>
import { ROLES } from '@/data/grammar-studio'

/**
 * A sentence pattern as coloured slots: [主詞][動詞][受詞]. With `fill`, each
 * slot shows the block placed in it.
 */
defineProps({
  slots: { type: Array, required: true },       // [[role, label]]
  fill: { type: Array, default: null },         // [{ text, role } | null]
  wrongAt: { type: Array, default: () => [] }
})
</script>

<template>
  <div class="slots">
    <div
      v-for="([role, label], i) in slots" :key="i"
      class="slot" :class="[`role--${role}`, { 'slot--filled': fill && fill[i], 'slot--wrong': wrongAt.includes(i) }]"
    >
      <span class="slot__role zh">{{ ROLES[role]?.label || role }}</span>
      <span class="slot__body">{{ fill && fill[i] ? fill[i].text : label }}</span>
    </div>
  </div>
</template>

<style scoped>
.slots { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.slot {
  display: flex; flex-direction: column; align-items: center;
  min-width: 70px; padding: 6px 10px 8px;
  border-radius: 10px;
  border: 2px solid var(--rc);
  background: var(--rw);
}
.slot__role { font-size: var(--step--2); color: var(--rc); font-weight: 700; letter-spacing: 0.04em; }
.slot__body { font-size: var(--step--1); color: var(--ink-2); margin-top: 2px; white-space: nowrap; }
.slot--filled .slot__body { font-family: var(--font-word); font-size: var(--step-0); color: var(--ink); font-weight: 600; }
.slot--wrong { border-style: dashed; animation: shake 0.35s; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
</style>
