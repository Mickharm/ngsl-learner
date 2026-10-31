<script setup>
import { computed } from 'vue'
import CHUNKS from '@/data/chunks.json'

/**
 * A headword with its stress marked — a dot over the loud syllable, no
 * colour. Colour in v3 means word parts and always comes with a legend
 * (WordAnatomy); a bare word in a game only needs to say where the stress
 * is, and the dot is the convention dictionaries already use.
 */
const props = defineProps({
  word: { type: String, required: true },
  size: { type: String, default: 'lg' }   // lg | md
})

const entry = computed(() => CHUNKS[String(props.word).toLowerCase()] || null)
const label = computed(() => entry.value ? `${props.word}，重音在 ${entry.value.c[entry.value.s]}` : props.word)
</script>

<template>
  <span class="chunks" :class="`chunks--${size}`" :aria-label="label" :title="entry ? '● 是重音' : ''">
    <template v-if="entry">
      <span v-for="(c, i) in entry.c" :key="i" class="chunk" :class="{ 'chunk--stress': i === entry.s }">{{ c }}</span>
    </template>
    <span v-else class="chunk chunk--whole">{{ word }}</span>
  </span>
</template>

<style scoped>
.chunks { font-family: var(--font-word); display: inline-flex; align-items: flex-end; flex-wrap: wrap; justify-content: center; line-height: 1.1; padding-top: 0.32em; }
.chunks--lg { font-size: clamp(2rem, 10vw, 2.9rem); }
.chunks--md { font-size: var(--step-3); }
.chunk { position: relative; font-weight: 500; color: var(--ink); }
.chunk + .chunk { margin-left: 0.04em; }
.chunk--stress { font-weight: 700; }
.chunk--stress::before {
  content: '●'; position: absolute; left: 50%; top: -0.42em; transform: translateX(-50%);
  font-size: 0.3em; color: var(--ink); line-height: 1;
}
.chunk--whole { font-weight: 600; }
</style>
