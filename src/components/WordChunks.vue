<script setup>
import { computed } from 'vue'
import CHUNKS from '@/data/chunks.json'

/**
 * A headword drawn in its spoken chunks, stressed chunk in bold:
 * beau·ti·ful → BEAU ti ful. Binding spelling to sound is what makes a word
 * readable and spellable later (orthographic mapping). Words whose print split
 * and syllable count disagree are not in the table and render whole.
 */
const props = defineProps({
  word: { type: String, required: true },
  size: { type: String, default: 'lg' }   // lg | md
})

const entry = computed(() => CHUNKS[String(props.word).toLowerCase()] || null)
</script>

<template>
  <span class="chunks" :class="`chunks--${size}`" :aria-label="word">
    <template v-if="entry">
      <template v-for="(c, i) in entry.c" :key="i">
        <span class="chunk" :class="{ 'chunk--stress': i === entry.s }">{{ c }}</span><span v-if="i < entry.c.length - 1" class="chunk__dot" aria-hidden="true">·</span>
      </template>
    </template>
    <span v-else class="chunk chunk--whole">{{ word }}</span>
  </span>
</template>

<style scoped>
.chunks { font-family: var(--font-word); display: inline-flex; align-items: baseline; flex-wrap: wrap; justify-content: center; line-height: 1.05; }
.chunks--lg { font-size: clamp(2.1rem, 11vw, 3.2rem); }
.chunks--md { font-size: var(--step-3); }
.chunk { font-weight: 400; color: var(--ink); }
.chunk--stress { font-weight: 700; color: var(--jade-ink); }
.chunk--whole { font-weight: 500; }
.chunk__dot { color: var(--ink-3); padding: 0 0.06em; font-weight: 300; }
</style>
