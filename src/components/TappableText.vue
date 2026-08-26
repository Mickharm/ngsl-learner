<script setup>
import { computed } from 'vue'
import { useWords } from '@/stores/words'

/**
 * Renders running English text with every NGSL word turned into a tap target.
 *
 * The glossary used to live in a strip below the article, which meant reading
 * a sentence, losing your place, scrolling down, scrolling back. Tapping the
 * word itself keeps the eye where the meaning is needed.
 */

const props = defineProps({
  text: { type: String, required: true },
  /** Only these ids get highlighted as "today's words"; others stay tappable but plain. */
  highlightIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['word'])

const words = useWords()
const highlight = computed(() => new Set(props.highlightIds))

/**
 * Split into word / non-word runs so punctuation and spacing survive exactly.
 * Apostrophes and hyphens stay inside a token ("don't", "well-known").
 */
const tokens = computed(() => {
  const out = []
  const re = /[A-Za-z]+(?:['’-][A-Za-z]+)*/g
  let last = 0
  let m
  while ((m = re.exec(props.text)) !== null) {
    if (m.index > last) out.push({ t: props.text.slice(last, m.index), w: false })
    const id = words.lookup(m[0])
    out.push({ t: m[0], w: !!id, id })
    last = m.index + m[0].length
  }
  if (last < props.text.length) out.push({ t: props.text.slice(last), w: false })
  return out
})

function tap (tok, ev) {
  if (!tok.id) return
  const r = ev.currentTarget.getBoundingClientRect()
  emit('word', { id: tok.id, rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right } })
}
</script>

<template>
  <p class="tt">
    <template v-for="(tok, i) in tokens" :key="i">
      <button
        v-if="tok.w"
        class="tt__w"
        :class="{ 'tt__w--today': highlight.has(tok.id) }"
        type="button"
        @click="tap(tok, $event)"
      >{{ tok.t }}</button>
      <span v-else>{{ tok.t }}</span>
    </template>
  </p>
</template>

<style scoped>
.tt {
  font-family: var(--font-word);
  font-size: var(--step-1);
  line-height: 1.9;
  letter-spacing: 0.002em;
}

/* Every word is tappable, but only today's words are marked. Underlining all
   of them turned the article into a page of dotted lines and made the prose
   hard to read — the hint line above already says taps work everywhere. */
.tt__w {
  font: inherit;
  color: inherit;
  padding: 0;
  border-radius: 3px;
  transition: background 0.12s;
}
.tt__w:active { background: var(--jade-wash); }

.tt__w--today {
  color: var(--jade);
  font-weight: 600;
  border-bottom: 2px solid var(--jade-edge);
}
</style>
