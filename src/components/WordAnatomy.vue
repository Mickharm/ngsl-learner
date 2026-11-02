<script setup>
import { ref, computed, watch } from 'vue'
import { useWords } from '@/stores/words'
import { EXAMPLES, PARTS, familyOf } from '@/data/morphology'

/**
 * A headword written on the four-line staff (英文四線格), the way it was
 * first written in a Taiwanese exercise book — and marked up the way a
 * student marks a word to remember it:
 *
 *   parts      highlighter over each part (pink 字首, yellow 字根, blue 字尾,
 *              nothing on the plain base word), its meaning written under it
 *              in textbook Kai, a formula line, and a legend
 *   syllables  the word split by dictionary dots, a dot over the stressed
 *              syllable, and a legend saying what the dot means
 *   whole      one syllable: just the word on the staff
 *
 * Colour is never shown without its legend (the v2 complaint).
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
  const present = new Set(an.value.tiles.map(t => t.kind))
  return ['prefix', 'root', 'base', 'suffix'].filter(k => present.has(k))
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
  const seen = new Set()
  const list = EXAMPLES
    .filter(e => e.w !== props.word.toLowerCase() && e.tiles.some(x => x.ref && familyOf(x.ref) === fam))
    .filter(e => (seen.has(e.w) ? false : seen.add(e.w)))
    .slice(0, 4)
  return { label: p?.label, zh: p?.zh, more: p?.more, pos: p?.pos, list }
})
const POS_ZH = { 'n.': '名詞', 'v.': '動詞', 'adj.': '形容詞', 'adv.': '副詞' }

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
          :class="{ 'ana__col--on': picked === t, 'ana__col--first': i === 0, 'ana__col--last': i === an.tiles.length - 1 }"
          type="button"
          @click="pick(t)"
        >
          <span class="staff ana__staff"><span class="mark" :class="`mark--${t.kind}`">{{ t.text }}</span></span>
          <span v-if="t.kind !== 'link'" class="ana__gloss kai">{{ t.gloss || ' ' }}</span>
          <span v-if="t.base" class="ana__base">{{ t.base }}</span>
        </component>
      </div>
      <p v-if="formula && size !== 'sm'" class="ana__formula kai">{{ formula }}</p>
      <div v-if="pickedInfo" class="ana__more zh">
        <p><b class="en">{{ pickedInfo.label }}</b>　{{ pickedInfo.zh }}<template v-if="pickedInfo.pos">，做出{{ POS_ZH[pickedInfo.pos] }}</template></p>
        <p v-if="pickedInfo.more" class="ana__moretext">{{ pickedInfo.more }}</p>
        <p v-if="pickedInfo.list.length" class="ana__also">
          一樣有它的字：<span v-for="e in pickedInfo.list" :key="e.w" class="ana__alsow"><b class="en">{{ e.w }}</b> {{ e.zh }}</span>
        </p>
      </div>
      <div v-if="legend" class="legend ana__legend">
        <span v-for="k in kindsShown" :key="k" class="legend__k"><span class="legend__sw" :class="`lt--${k}`" />{{ KIND_ZH[k] }}</span>
        <span v-if="explore && kindsShown.some(k => k !== 'base')" class="legend__k">點螢光筆的部分看更多</span>
      </div>
    </template>

    <!-- syllables -->
    <template v-else-if="an.mode === 'syllables'">
      <div class="ana__syls" :aria-label="word">
        <span class="staff ana__staff ana__staff--whole"><template v-for="(t, i) in an.tiles" :key="i"><span v-if="i" class="syl__dot" aria-hidden="true">·</span><span class="syl" :class="{ 'syl--stress': t.stress }">{{ t.text }}</span></template></span>
      </div>
      <div v-if="legend" class="legend ana__legend">
        <span class="legend__k">分 {{ an.tiles.length }} 段念</span>
        <span class="legend__k"><span class="ana__key" aria-hidden="true">•</span>上面有點的那段是重音：念最大聲、最長</span>
      </div>
    </template>

    <!-- one syllable -->
    <template v-else>
      <span class="staff ana__staff ana__staff--whole ana__whole">{{ word }}</span>
    </template>
  </div>
</template>

<style scoped>
.ana { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); text-align: center; max-width: 100%; }
.ana--lg { --fs: clamp(2.3rem, 11.5vw, 3.3rem); }
.ana--md { --fs: 1.85rem; }
.ana--sm { --fs: 1.3rem; gap: 4px; }

.ana__row { display: flex; align-items: flex-start; justify-content: center; flex-wrap: wrap; max-width: 100%; }
.ana__col { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0; background: none; border: 0; }
button.ana__col { cursor: pointer; }
.ana__staff { font-size: var(--fs); font-weight: 700; color: var(--ink); padding: 0; }
.ana__col--first .ana__staff { padding-left: 0.3em; }
.ana__col--last .ana__staff { padding-right: 0.3em; }
.ana__staff--whole { padding: 0 0.3em; }

/* the highlighter, inside the staff: covers the x-height band only */
.mark { position: relative; z-index: 0; }
.mark::before {
  content: ''; position: absolute; z-index: -1;
  left: -0.03em; right: -0.03em; top: 0.6em; bottom: 0.3em;
  border-radius: 0.12em 0.3em 0.16em 0.34em / 0.3em 0.14em 0.3em 0.18em;
  transform: skewX(-5deg) rotate(-0.8deg);
  background: transparent;
}
.mark--prefix::before { background: var(--hl-pink); }
.mark--root::before { background: var(--hl-yellow); }
.mark--suffix::before { background: var(--hl-blue); }
.mark--link { color: var(--ink-3); font-weight: 400; }
.ana__col--on .mark::before { box-shadow: 0 0 0 2px var(--focus); }

.ana__gloss { font-size: max(0.82rem, calc(var(--fs) * 0.36)); min-height: 1.3em; color: var(--ink-2); max-width: 7em; line-height: 1.25; padding: 0 4px; }
.ana--sm .ana__gloss { font-size: 0.7rem; }
.ana__base { font-size: max(0.7rem, calc(var(--fs) * 0.26)); color: var(--ink-3); font-family: var(--font-word); }
.ana__formula { font-size: var(--step-0); color: var(--ink); padding: 2px 0 0; }
.ana__more { font-size: var(--step--1); line-height: 1.65; text-align: left; border-left: 3px solid var(--hl-yellow); padding: 4px 0 4px 12px; display: flex; flex-direction: column; gap: 2px; animation: rise 0.18s ease-out; align-self: stretch; }
.ana__moretext, .ana__also { color: var(--ink-2); }
.ana__alsow { display: inline-block; margin-right: 10px; }
.en { font-family: var(--font-word); color: var(--ink); }
.ana__legend { justify-content: center; }

.ana__syls { max-width: 100%; }
.syl { position: relative; font-weight: 400; }
.syl--stress { font-weight: 700; }
.syl--stress::before {
  content: ''; position: absolute; left: 50%; top: 0.16em;
  width: 0.16em; height: 0.16em; border-radius: 50%; background: var(--redpen);
  transform: translateX(-50%);
}
.syl__dot { color: var(--ink-3); font-weight: 400; padding: 0 0.02em; }
.ana__key { color: var(--redpen); font-size: 1.4em; line-height: 0; vertical-align: -0.1em; margin-right: 2px; }
.ana__whole { font-size: calc(var(--fs) * 1.05); font-weight: 700; }
</style>
