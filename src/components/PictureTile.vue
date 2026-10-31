<script setup>
import { computed } from 'vue'
import { pictureOf } from '@/data/pictures'

/**
 * A picture for a word — only when the word *is* something you can point
 * at (dog, bus, rain, run). v2 tried to picture everything and the symbols
 * stopped matching the words; v3 keeps 320 literal depictions and renders
 * nothing for the rest. The word's parts and sentence carry those.
 */
const props = defineProps({
  wordId: { type: Number, default: 0 },
  headword: { type: String, default: '' },
  size: { type: Number, default: 96 }
})
const emoji = computed(() => pictureOf(props.headword))
</script>

<template>
  <div v-if="emoji" class="pic" :style="{ '--sz': size + 'px' }">
    <span class="pic__emoji" aria-hidden="true">{{ emoji }}</span>
  </div>
</template>

<style scoped>
.pic { width: var(--sz); height: var(--sz); display: grid; place-items: center; flex-shrink: 0; }
.pic__emoji { font-size: calc(var(--sz) * 0.72); line-height: 1; }
</style>
