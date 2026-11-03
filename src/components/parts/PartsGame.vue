<script setup>
import AnswerSheet from '@/components/ui/AnswerSheet.vue'
import { ref, computed, watch, onUnmounted } from 'vue'
import { PARTS } from '@/data/morphology'
import { cutsMatch } from '@/lib/partsGames'
import { sfx, buzz } from '@/lib/sfx'
import { speak } from '@/lib/tts'
import { useSettings } from '@/stores/settings'

/**
 * One Word Parts item (see lib/partsGames.js for the five kinds).
 * Emits `answer` once with { correct } and `next` when the learner moves on.
 */
const props = defineProps({ item: { type: Object, required: true } })
const emit = defineEmits(['answer', 'next'])
const settings = useSettings()

const done = ref(false)
const correct = ref(false)
const picked = ref(null)
// build
const slots = ref([])
const used = ref(new Set())
// split
const cuts = ref(new Set())
let timer = null

function reset () {
  clearTimeout(timer)
  done.value = false
  correct.value = false
  picked.value = null
  slots.value = props.item.kind === 'build' ? props.item.answer.map(() => null) : []
  used.value = new Set()
  cuts.value = new Set()
}
watch(() => props.item, reset, { immediate: true })
onUnmounted(() => clearTimeout(timer))

function say (w) {
  speak(w, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
}

function settle (ok) {
  if (done.value) return
  done.value = true
  correct.value = ok
  sfx(ok ? 'good' : 'bad')
  if (!ok) buzz(40)
  say(props.item.word)
  emit('answer', { correct: ok })
}

function choose (o) {
  if (done.value) return
  picked.value = o
  settle(o === props.item.answer)
}

/* build */
function kindOf (text) { return props.item.kinds?.[text] || 'base' }
function place (text, i) {
  if (done.value || used.value.has(i)) return
  const at = slots.value.indexOf(null)
  if (at < 0) return
  sfx('tap')
  slots.value[at] = { text, i }
  used.value = new Set([...used.value, i])
  if (!slots.value.includes(null)) settle(slots.value.map(s => s.text).join('') === props.item.word)
}
function unplace (at) {
  if (done.value || !slots.value[at]) return
  const u = new Set(used.value); u.delete(slots.value[at].i); used.value = u
  slots.value[at] = null
}

/* split */
const letters = computed(() => props.item.kind === 'split' ? props.item.word.split('') : [])
function toggleCut (i) {
  if (done.value) return
  sfx('tap')
  const c = new Set(cuts.value)
  c.has(i) ? c.delete(i) : c.add(i)
  cuts.value = c
}
function checkSplit () { settle(cutsMatch(props.item, [...cuts.value])) }
const splitPieces = computed(() => {
  if (props.item.kind !== 'split') return []
  return props.item.tiles
})

const KIND_ZH = { prefix: '字首', root: '字根', base: '原本的字', suffix: '字尾' }
const legendKinds = computed(() => {
  const have = new Set(Object.values(props.item.kinds || {}))
  return ['prefix', 'root', 'base', 'suffix'].filter(k => have.has(k))
})

const label = computed(() => ({
  choice: props.item.variant === 'part' ? '零件意思' : '字義算式',
  build: '拼零件',
  split: '切切看',
  trap: '真假零件',
  pos: '看字尾猜詞性'
})[props.item.kind])
</script>

<template>
  <section class="pg" :class="done && (correct ? 'pg--right' : 'pg--wrong')">
    <div class="pg__tag">
      <span class="chip chip--violet zh">{{ label }}</span>
    </div>

    <div class="pg__prompt card">
      <p class="pg__q zh">{{ item.prompt }}</p>

      <!-- tiles shown for choice / pos / real-trap items -->
      <div v-if="item.tiles && (item.kind === 'choice' || item.kind === 'pos' || (item.kind === 'trap' && done))" class="pg__tiles">
        <span
          v-for="(t, i) in item.tiles" :key="i"
          class="lt" :class="[`lt--${t.kind}`, { 'pg__focus': item.focus && t.ref === item.focus }]"
        >{{ t.text }}</span>
      </div>
      <div v-else-if="item.kind === 'trap'" class="pg__tiles"><span class="lt">{{ item.word }}</span></div>

      <!-- build: slots -->
      <div v-if="item.kind === 'build'" class="pg__slots" :class="{ shake: done && !correct }">
        <button
          v-for="(s, i) in slots" :key="i"
          class="slot"
          :class="s ? ['lt', `lt--${kindOf(s.text)}`] : 'slot--empty'"
          @click="unplace(i)"
        >{{ s?.text || '' }}</button>
      </div>

      <!-- split: letters with gaps -->
      <div v-if="item.kind === 'split'" class="split" :class="{ shake: done && !correct }">
        <template v-for="(ch, i) in letters" :key="i">
          <span class="split__ch">{{ ch }}</span>
          <button
            v-if="i < letters.length - 1"
            class="split__gap" :class="{ 'split__gap--on': cuts.has(i + 1) }"
            :aria-label="`在 ${ch} 後面切`"
            @click="toggleCut(i + 1)"
          ><span /></button>
        </template>
      </div>
    </div>

    <!-- answers -->
    <div v-if="item.options" class="pg__opts" :class="{ 'pg__opts--two': item.options.length === 2 }">
      <button
        v-for="o in item.options" :key="o"
        class="popt zh"
        :class="{ 'popt--right': done && o === item.answer, 'popt--wrong': done && picked === o && o !== item.answer, 'popt--mute': done && picked !== o && o !== item.answer }"
        :disabled="done"
        @click="choose(o)"
      >{{ o }}</button>
    </div>

    <div v-if="item.kind === 'build' && !done" class="bank">
      <button
        v-for="(t, i) in item.bank" :key="t + i"
        class="lt" :class="`lt--${kindOf(t)}`"
        :disabled="used.has(i)"
        @click="place(t, i)"
      >{{ t }}</button>
    </div>
    <div v-if="item.kind === 'build' && !done && legendKinds.length > 1" class="legend pg__legend">
      <span v-for="k in legendKinds" :key="k" class="legend__k"><span class="legend__sw" :class="`lt--${k}`" />{{ KIND_ZH[k] }}</span>
    </div>

    <button v-if="item.kind === 'split' && !done" class="btn btn--primary btn--block zh" :disabled="!cuts.size" @click="checkSplit">切好了</button>
    <p v-if="item.kind === 'split' && !done" class="pg__hint zh">點字母之間的空隙切開，再點一次取消</p>

    <AnswerSheet v-if="done" :right="correct" :chars="(item.explain || '').length + 10" @next="emit('next')">
      <div v-if="item.tiles" class="pg__tiles pg__tiles--fb">
        <span v-for="(t, i) in item.tiles" :key="i" class="lt" :class="`lt--${t.kind}`">{{ t.text }}</span>
      </div>
      <p class="fb__explain zh">{{ item.explain }}</p>
    </AnswerSheet>
  </section>
</template>

<style scoped>
.pg { display: flex; flex-direction: column; gap: var(--sp-4); }
.pg__tag { display: flex; align-items: center; justify-content: space-between; min-height: 24px; }
.pg__verdict { font-size: var(--step--1); font-weight: 800; }
.pg__verdict.ok { color: var(--jade); }
.pg__verdict.no { color: var(--rose); }

.pg__prompt { padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-4); text-align: center; border-top: 0; }
.pg__q { font-size: var(--step-1); font-weight: 700; line-height: 1.45; }
.pg__tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.pg__tiles .lt { font-size: var(--step-2); }
.pg__focus { outline: 2.5px solid var(--focus); outline-offset: 3px; }

.pg__slots { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; min-height: 52px; }
.slot { font-size: var(--step-2); min-width: 64px; min-height: 48px; }
.slot--empty { border: 2px dashed var(--rule-strong); border-radius: 10px; background: transparent; }

.bank { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 8px; }
.bank .lt { font-size: var(--step-2); min-height: 50px; padding: 0 14px; }
.pg__legend { justify-content: center; }

.split { display: flex; align-items: stretch; justify-content: center; flex-wrap: wrap; font-family: var(--font-word); font-size: clamp(1.6rem, 8vw, 2.2rem); font-weight: 600; }
.split__ch { padding: 6px 1px; }
.split__gap { width: 18px; display: grid; place-items: center; border-radius: 6px; }
.split__gap span { width: 2px; height: 70%; background: var(--rule); border-radius: 2px; transition: all 0.12s; }
.split__gap--on span { width: 4px; height: 100%; background: var(--rose); }
.pg__hint { text-align: center; font-size: var(--step--1); color: var(--ink-3); margin-top: -8px; }

.pg__opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.popt { min-height: 60px; padding: 8px 10px; font-weight: 600; line-height: 1.3; }
.popt--right { animation: pop-in 0.25s; }
.popt--wrong { animation: shake 0.3s; }

.fb { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.fb__explain { font-size: var(--step-0); line-height: 1.6; }
.shake { animation: shake 0.35s; }
</style>
