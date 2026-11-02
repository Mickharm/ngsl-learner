<script setup>
import { computed } from 'vue'
import CHUNKS from '@/data/chunks.json'

/**
 * A headword on the four-line staff with its stress marked — a red dot over
 * the loud syllable, dictionary dots between syllables. Used where a word is
 * the prompt of a game; WordAnatomy is the full, labelled version.
 */
const props = defineProps({
  word: { type: String, required: true },
  size: { type: String, default: 'lg' }   // lg | md
})
const entry = computed(() => CHUNKS[String(props.word).toLowerCase()] || null)
const label = computed(() => entry.value ? `${props.word}，重音在 ${entry.value.c[entry.value.s]}` : props.word)
</script>

<template>
  <span class="chunks staff" :class="`chunks--${size}`" :aria-label="label">
    <template v-if="entry"><template v-for="(c, i) in entry.c" :key="i"><span v-if="i" class="chunk__dot" aria-hidden="true">·</span><span class="chunk" :class="{ 'chunk--stress': i === entry.s }">{{ c }}</span></template></template>
    <span v-else class="chunk chunk--whole">{{ word }}</span>
  </span>
</template>

<style scoped>
.chunks { color: var(--ink); }
.chunks--lg { font-size: clamp(2.2rem, 11vw, 3.1rem); }
.chunks--md { font-size: 1.8rem; }
.chunk { position: relative; font-weight: 400; }
.chunk--stress, .chunk--whole { font-weight: 700; }
.chunk--stress::before {
  content: ''; position: absolute; left: 50%; top: 0.16em;
  width: 0.16em; height: 0.16em; border-radius: 50%; background: var(--redpen);
  transform: translateX(-50%);
}
.chunk__dot { color: var(--ink-3); }
</style>
