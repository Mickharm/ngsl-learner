<script setup>
import { ref, computed, watch } from 'vue'
import { useWords } from '@/stores/words'
import { EXAMPLES, PARTS, familyOf } from '@/data/morphology'

/**
 * How a word is built, shown as tiles — and always with a legend, because
 * colour that is not explained is decoration (v2's syllable colouring was
 * exactly that).
 *
 *   parts      un | happy | ness   each tile coloured by job, its meaning
 *              underneath, a formula line, tap a part to see other words
 *              that use it
 *   syllables  beau | ti | ful     neutral tiles; the stressed one carries a
 *              dot and is set heavier, and the legend says what the dot is
 *   whole      one-syllable words: the word, nothing else
 */
const props = defineProps({
  word: { type: String, required: true },
  size: { type: String, default: 'lg' },      // lg | md | sm
  legend: { type: Boolean, default: true },
  /** tap a part to list other words that use it */
  explore: { type: Boolean, default: true }
})

const words = useWords()
const an = computed(() => words.anatomy(props.word))
const picked = ref(null)
watch(() => props.word, () => { picked.value = null })

const KIND_ZH = { prefix: '字首', root: '字根', suffix: '字尾', base: '原本的字' }
const kindsShown = computed(() => {
  if (an.value?.mode !== 'parts') return []
  const order = ['prefix', 'root', 'base', 'suffix']
  const present = new Set(an.value.tiles.map(t => t.kind))
  return order.filter(k => present.has(k))
})

const formula = computed(() => {
  const a = an.value
  if (a?.mode !== 'parts') return ''
  const left = a.tiles.filter(t => t.kind !== 'link' && t.gloss).map(t => t.gloss.split(/[、；]/)[0]).join(' ＋ ')
  return a.zh ? `${left} → ${a.zh}` : left
})

const pickedInfo = computed(() => {
  const t = picked.value
  if (!t || t.kind === 'base' || t.kind === 'link') return null
  const p = PARTS[t.ref]
  const fam = familyOf(t.ref)
  const others = EXAMPLES.filter(e => e.w !== props.word.toLowerCase() && e.tiles.some(x => x.ref && familyOf(x.ref) === fam))
  const seen = new Set()
  const list = others.filter(e => (seen.has(e.w) ? false : seen.add(e.w))).slice(0, 4)
  return { label: p?.label, zh: p?.zh, more: p?.more, pos: p?.pos, list }
})

function pick (t) {
  if (!props.explore || t.kind === 'base' || t.kind === 'link') return
  picked.value = picked.value === t ? null : t
}
</script>

<template>
  <div v-if="an" class="ana" :class="`ana--${size}`">
    <!-- parts -->
    <template v-if="an.mode === 'parts'">
      <div class="ana__row" :aria-label="word">
        <component
          :is="explore && t.kind !== 'base' && t.kind !== 'link' ? 'button' : 'span'"
          v-for="(t, i) in an.tiles" :key="i"
          class="ana__col"
          :class="{ 'ana__col--on': picked === t }"
          type="button"
          @click="pick(t)"
        >
          <span class="lt" :class="`lt--${t.kind}`">{{ t.text }}</span>
          <span v-if="t.kind !== 'link'" class="ana__gloss zh">{{ t.gloss || ' ' }}</span>
          <span v-if="t.base" class="ana__base">= {{ t.base }}</span>
        </component>
      </div>
      <p v-if="formula && size !== 'sm'" class="ana__formula zh">{{ formula }}</p>
      <div v-if="pickedInfo" class="ana__more zh">
        <b>{{ pickedInfo.label }}</b> {{ pickedInfo.zh }}<template v-if="pickedInfo.pos">，做出{{ { 'n.': '名詞', 'v.': '動詞', 'adj.': '形容詞', 'adv.': '副詞' }[pickedInfo.pos] }}</template>
        <span v-if="pickedInfo.more" class="ana__moretext">{{ pickedInfo.more }}</span>
        <span v-if="pickedInfo.list.length" class="ana__also">
          一樣有它的字：<span v-for="e in pickedInfo.list" :key="e.w" class="ana__alsow"><b class="en">{{ e.w }}</b> {{ e.zh }}</span>
        </span>
      </div>
      <div v-if="legend" class="legend">
        <span v-for="k in kindsShown" :key="k" class="legend__k"><span class="legend__sw" :class="`lt--${k}`" />{{ KIND_ZH[k] }}</span>
        <span v-if="explore" class="legend__k">點零件看更多</span>
      </div>
    </template>

    <!-- syllables -->
    <template v-else-if="an.mode === 'syllables'">
      <div class="ana__row ana__row--syl" :aria-label="word">
        <span v-for="(t, i) in an.tiles" :key="i" class="ana__syl" :class="{ 'ana__syl--stress': t.stress }">
          <span class="ana__dot" aria-hidden="true">{{ t.stress ? '●' : '' }}</span>
          <span class="lt lt--syl">{{ t.text }}</span>
        </span>
      </div>
      <div v-if="legend" class="legend">
        <span class="legend__k">分 {{ an.tiles.length }} 段念</span>
        <span class="legend__k"><span class="ana__dot ana__dot--key">●</span>重音：這一段念最大聲、最長</span>
      </div>
    </template>

    <!-- one syllable -->
    <template v-else>
      <div class="ana__whole">{{ word }}</div>
    </template>
  </div>
</template>

<style scoped>
.ana { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; }
.ana--lg { --fs: clamp(1.6rem, 8.5vw, 2.4rem); }
.ana--md { --fs: 1.35rem; }
.ana--sm { --fs: 1rem; gap: 4px; }

.ana__row { display: flex; align-items: flex-start; justify-content: center; flex-wrap: wrap; gap: 6px; }
.ana__col { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 0; background: none; border: 0; border-radius: 12px; }
button.ana__col { cursor: pointer; }
.ana__col .lt { font-size: var(--fs); }
.ana__col--on .lt { outline: 2.5px solid var(--focus); outline-offset: 2px; }
.ana__gloss { font-size: calc(var(--fs) * 0.42); min-height: 1.2em; color: var(--ink-2); max-width: 7em; line-height: 1.25; font-weight: 500; }
.ana--sm .ana__gloss { font-size: 0.68rem; }
.ana__base { font-size: calc(var(--fs) * 0.36); color: var(--ink-3); font-family: var(--font-word); margin-top: -4px; }
.ana--sm .ana__base { font-size: 0.62rem; }
.ana__formula { font-size: var(--step--1); color: var(--ink); font-weight: 600; background: var(--surface-2); padding: 6px 12px; border-radius: var(--radius-pill); }
.ana__more { font-size: var(--step--1); line-height: 1.6; text-align: left; background: var(--surface-2); border-radius: var(--radius); padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; animation: rise 0.18s ease-out; align-self: stretch; }
.ana__moretext { color: var(--ink-2); }
.ana__also { color: var(--ink-2); }
.ana__alsow { display: inline-block; margin-right: 10px; }
.en { font-family: var(--font-word); color: var(--ink); }

.ana__row--syl { gap: 4px; }
.ana__syl { display: flex; flex-direction: column; align-items: center; }
.ana__syl .lt { font-size: var(--fs); font-weight: 400; }
.ana__syl--stress .lt { font-weight: 700; --te: var(--ink-3); }
.ana__dot { height: 1em; font-size: calc(var(--fs) * 0.36); color: var(--ink); line-height: 1; }
.ana__dot--key { height: auto; font-size: 0.8em; margin-right: 2px; }
.ana--sm .ana__dot { font-size: 0.5rem; }
.ana__whole { font-family: var(--font-word); font-weight: 600; font-size: calc(var(--fs) * 1.15); line-height: 1.1; }
</style>
