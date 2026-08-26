<script setup>
import { ref, computed, watch } from 'vue'
import AudioButton from './AudioButton.vue'

/**
 * Fill-in-the-blank on the word's own example sentence.
 *
 * Distractors are chosen to be *plausible*: the word's own confusables first
 * (that is the whole point — force the discrimination), then words that look
 * or sound similar, and only then random fillers. A quiz whose wrong answers
 * are obviously wrong teaches nothing.
 */

const props = defineProps({
  word: { type: Object, required: true },
  pool: { type: Array, default: () => [] }   // other words available as distractors
})
const emit = defineEmits(['answer'])

const picked = ref(null)
const settled = computed(() => picked.value !== null)

const example = computed(() => props.word.examples?.[0] || null)

/** The inflected form actually used in the sentence, so the blank is honest. */
const surface = computed(() => {
  if (!example.value) return props.word.headword
  const forms = [props.word.headword, ...(props.word.family || [])]
    .sort((a, b) => b.length - a.length)
  for (const f of forms) {
    const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const m = example.value.en.match(re)
    if (m) return m[0]
  }
  return props.word.headword
})

const blanked = computed(() => {
  if (!example.value) return ''
  const re = new RegExp(`\\b${surface.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
  return example.value.en.replace(re, '___________')
})

function similarity (a, b) {
  a = a.toLowerCase(); b = b.toLowerCase()
  if (a === b) return 0
  let score = 0
  if (a[0] === b[0]) score += 3
  if (a.slice(-2) === b.slice(-2)) score += 2
  if (Math.abs(a.length - b.length) <= 2) score += 2
  const setB = new Set(b)
  score += [...new Set(a)].filter(ch => setB.has(ch)).length * 0.4
  return score
}

const options = computed(() => {
  const answer = surface.value
  const taken = new Set([answer.toLowerCase()])
  const picks = []

  for (const c of props.word.confusables || []) {
    if (c.word && !taken.has(c.word.toLowerCase())) {
      picks.push(c.word); taken.add(c.word.toLowerCase())
    }
  }

  const ranked = props.pool
    .filter(w => w && w.id !== props.word.id && !taken.has(w.headword.toLowerCase()))
    .map(w => ({ w, s: similarity(answer, w.headword) }))
    .sort((a, b) => b.s - a.s)

  for (const { w } of ranked) {
    if (picks.length >= 3) break
    picks.push(w.headword); taken.add(w.headword.toLowerCase())
  }

  const all = [answer, ...picks.slice(0, 3)]
  // Deterministic shuffle keyed on the word id — stable across re-renders.
  let seed = props.word.id * 9301 + 49297
  const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[all[i], all[j]] = [all[j], all[i]]
  }
  return all
})

const correctIndex = computed(() =>
  options.value.findIndex(o => o.toLowerCase() === surface.value.toLowerCase())
)

function choose (i) {
  if (settled.value) return
  picked.value = i
  emit('answer', { correct: i === correctIndex.value, picked: options.value[i], answer: surface.value })
}

watch(() => props.word.id, () => { picked.value = null })
</script>

<template>
  <div v-if="example" class="cloze">
    <div class="cloze__prompt">
      <div class="eyebrow">選出正確的字</div>
      <p class="cloze__sentence">{{ blanked }}</p>
      <p class="cloze__zh zh">{{ example.zh }}</p>
    </div>

    <div class="cloze__options">
      <button
        v-for="(o, i) in options"
        :key="o + i"
        class="opt"
        :class="{
          'opt--right': settled && i === correctIndex,
          'opt--wrong': settled && picked === i && i !== correctIndex,
          'opt--mute': settled && picked !== i && i !== correctIndex
        }"
        :disabled="settled"
        @click="choose(i)"
      >
        <span class="opt__key num">{{ 'ABCD'[i] }}</span>
        <span class="opt__text">{{ o }}</span>
        <svg v-if="settled && i === correctIndex" class="opt__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        <svg v-else-if="settled && picked === i" class="opt__mark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </div>

    <Transition name="slide-up">
      <div v-if="settled" class="cloze__after">
        <div class="cloze__full">
          <p class="cloze__fullen">{{ example.en }}</p>
          <AudioButton :text="example.en" size="sm" />
        </div>
        <div v-if="word.confusables?.length" class="cloze__note zh">
          <strong>{{ word.headword }}</strong> vs <strong>{{ word.confusables[0].word }}</strong>：{{ word.confusables[0].diff }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.cloze { display: flex; flex-direction: column; gap: var(--sp-4); }

.cloze__prompt {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-lg);
  padding: var(--sp-5) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
  box-shadow: var(--shadow-1);
}

.cloze__sentence {
  font-family: var(--font-word);
  font-size: var(--step-2);
  line-height: 1.55;
  letter-spacing: -0.005em;
}
.cloze__zh { font-size: var(--step--1); color: var(--ink-2); }

.cloze__options { display: flex; flex-direction: column; gap: var(--sp-2); }

.opt {
  display: flex;
  align-items: center;
  gap: var(--sp-3);
  min-height: 52px;
  padding: 0 var(--sp-3);
  border-radius: var(--radius);
  border: 1px solid var(--rule-strong);
  background: var(--surface);
  text-align: left;
  transition: background 0.14s, border-color 0.14s, opacity 0.2s, transform 0.1s;
}
.opt:active:not(:disabled) { transform: scale(0.99); background: var(--surface-2); }

.opt__key {
  width: 24px; height: 24px;
  display: grid; place-items: center;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--ink-3);
  font-size: var(--step--2);
  flex-shrink: 0;
}
.opt__text {
  flex: 1;
  font-family: var(--font-word);
  font-size: var(--step-1);
  font-weight: 500;
}
.opt__mark { width: 20px; height: 20px; flex-shrink: 0; }

.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade); }
.opt--right .opt__key { background: var(--jade); color: var(--surface); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.opt--wrong .opt__key { background: var(--rose); color: #fff; }
.opt--mute { opacity: 0.45; }

.cloze__after { display: flex; flex-direction: column; gap: var(--sp-2); }
.cloze__full {
  display: flex; align-items: center; gap: var(--sp-2);
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3);
}
.cloze__fullen { flex: 1; font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; }
.cloze__note {
  font-size: var(--step--1);
  color: var(--amber);
  background: var(--amber-wash);
  border: 1px solid var(--amber-edge);
  border-radius: var(--radius);
  padding: var(--sp-3);
  line-height: 1.6;
}
.cloze__note strong { font-family: var(--font-word); font-weight: 600; }
</style>
