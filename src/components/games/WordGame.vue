<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import AudioButton from '@/components/AudioButton.vue'
import PictureTile from '@/components/PictureTile.vue'
import WordChunks from '@/components/WordChunks.vue'
import { meaningOptions, wordOptions, letterTiles, glossOf, sameWord } from '@/lib/game'
import { clozeSentence, LADDER } from '@/lib/wordsrs'
import { speak } from '@/lib/tts'
import { useSettings } from '@/stores/settings'

/**
 * One retrieval task for one word, in one of the five ladder modes.
 *
 *   meaning  word + sound → pick the meaning (each option is a picture + 中文)
 *   listen   sound only   → pick the meaning
 *   recall   picture + 中文 → pick the English word among look-alikes
 *   spell    picture + 中文 + sound → build it from letter tiles
 *   cloze    a real sentence with the word missing → type it
 *
 * One attempt, measured: the component reports { correct, elapsedMs, hinted }
 * and the parent turns that into a grade. After answering, the word is shown
 * whole — picture, chunks, sound, meaning — whether the answer was right or
 * wrong, because the moment after a retrieval attempt is when feedback sticks.
 */
const props = defineProps({
  word: { type: Object, required: true },
  mode: { type: String, required: true },
  pool: { type: Array, default: () => [] },
  seed: { type: Number, default: 1 },
  /** Advance automatically after a correct answer. */
  autoNext: { type: Boolean, default: true }
})
const emit = defineEmits(['answer', 'next'])

const settings = useSettings()
const shownAt = ref(Date.now())
const settled = ref(false)
const result = ref(null)          // { correct, hinted }
const picked = ref(null)

/* --- choice modes --- */
const mOptions = computed(() => meaningOptions(props.word, props.pool, props.seed))
const wOptions = computed(() => wordOptions(props.word, props.pool, props.seed))

/* --- spell --- */
const tiles = ref([])
const slots = ref([])             // tile objects or null
const hinted = ref(false)
const target = computed(() => String(props.word.headword).toLowerCase())

/* --- cloze --- */
const cz = computed(() => clozeSentence(props.word))
const typed = ref('')
const input = ref(null)

const label = computed(() => LADDER.find(l => l.key === props.mode)?.label || '')
const gloss = computed(() => glossOf(props.word))
const pos = computed(() => props.word.meanings?.[0]?.pos || '')

let timer = null

function reset () {
  clearTimeout(timer)
  shownAt.value = Date.now()
  settled.value = false
  result.value = null
  picked.value = null
  hinted.value = false
  typed.value = ''
  if (props.mode === 'spell') {
    tiles.value = letterTiles(props.word.headword, props.seed)
    slots.value = target.value.split('').map(() => null)
  }
  if (props.mode === 'listen' || props.mode === 'meaning') {
    nextTick(() => say(props.word.headword))
  }
  if (props.mode === 'cloze') nextTick(() => input.value?.focus())
}

function say (text) {
  if (!settings.state.autoPlayAudio && props.mode !== 'listen') return
  speak(text, {
    rate: settings.state.ttsRate,
    voiceURI: settings.state.ttsVoiceURI,
    leadIn: settings.state.ttsLeadIn
  })
}

function settle (correct, extra = {}) {
  if (settled.value) return
  settled.value = true
  result.value = { correct, hinted: !!extra.hinted }
  emit('answer', {
    correct,
    hinted: !!extra.hinted,
    elapsedMs: Date.now() - shownAt.value,
    mode: props.mode,
    given: extra.given ?? null
  })
  // Hear the word once more on the reveal — sound + spelling + meaning together.
  if (props.mode !== 'meaning' && props.mode !== 'listen') say(props.word.headword)
  if (correct && props.autoNext) timer = setTimeout(() => emit('next'), 1300)
}

function pickMeaning (o, i) {
  if (settled.value) return
  picked.value = i
  settle(o.correct, { given: o.zh })
}
function pickWord (o, i) {
  if (settled.value) return
  picked.value = i
  settle(o.correct, { given: o.text })
}

/* spell */
function place (tile) {
  if (settled.value) return
  const i = slots.value.indexOf(null)
  if (i < 0) return
  slots.value[i] = tile
  tiles.value = tiles.value.filter(t => t.key !== tile.key)
  if (!slots.value.includes(null)) checkSpell()
}
function unplace (i) {
  if (settled.value || !slots.value[i] || slots.value[i].locked) return
  tiles.value = [...tiles.value, slots.value[i]]
  slots.value[i] = null
}
function hint () {
  if (settled.value) return
  hinted.value = true
  // Put the right letter in the first empty-or-wrong slot.
  for (let i = 0; i < target.value.length; i++) {
    const want = target.value[i]
    const have = slots.value[i]
    if (have && have.ch === want) continue
    if (have) tiles.value = [...tiles.value, have]
    const t = tiles.value.find(x => x.ch === want)
    if (!t) return
    slots.value[i] = { ...t, locked: true }
    tiles.value = tiles.value.filter(x => x.key !== t.key)
    break
  }
  if (!slots.value.includes(null)) checkSpell()
}
function checkSpell () {
  const spelled = slots.value.map(s => s?.ch || '').join('')
  settle(spelled === target.value, { hinted: hinted.value, given: spelled })
}

/* cloze */
const firstLetter = computed(() => cz.value?.answer?.[0] || '')
function submitCloze () {
  if (settled.value || !typed.value.trim()) return
  const t = typed.value.trim()
  if (sameWord(t, cz.value.answer)) return settle(true, { given: t })
  // Right word, wrong form (arrive for arrived): knew it, not the grammar — HARD.
  if (sameWord(t, props.word.headword)) return settle(true, { hinted: true, given: t })
  settle(false, { given: t })
}
function giveUp () { settle(false, { given: '' }) }

function cont () { clearTimeout(timer); emit('next') }

watch(() => [props.word.id, props.mode, props.seed].join(':'), reset)
onMounted(reset)
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <section class="wg" :class="[`wg--${mode}`, settled && (result.correct ? 'wg--right' : 'wg--wrong')]">
    <div class="wg__tag">
      <span class="chip chip--violet zh">{{ label }}</span>
      <span v-if="settled" class="wg__verdict zh" :class="result.correct ? 'ok' : 'no'">
        {{ result.correct ? (result.hinted ? '對了（有提示）' : '答對！') : '再記一次' }}
      </span>
    </div>

    <!-- ===== prompt ===== -->
    <div class="wg__prompt card">
      <template v-if="mode === 'meaning'">
        <WordChunks :word="word.headword" />
        <AudioButton :text="word.headword" size="lg" />
      </template>

      <template v-else-if="mode === 'listen'">
        <button class="wg__bigplay" aria-label="再聽一次" @click="speak(word.headword, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
        </button>
        <p class="wg__hintline zh">聽聽看，這是什麼意思？</p>
        <WordChunks v-if="settled" :word="word.headword" size="md" />
      </template>

      <template v-else-if="mode === 'recall' || mode === 'spell'">
        <PictureTile :word-id="word.id" :headword="word.headword" :size="104" />
        <p class="wg__gloss zh"><span class="wg__pos">{{ pos }}</span>{{ gloss }}</p>
        <AudioButton v-if="mode === 'spell'" :text="word.headword" size="md" />
      </template>

      <template v-else-if="mode === 'cloze' && cz">
        <p class="wg__sentence">
          <span>{{ cz.before }}</span>
          <span class="wg__gap" :class="{ 'wg__gap--filled': settled }">{{ settled ? cz.answer : firstLetter + ' _ _ _' }}</span>
          <span>{{ cz.after }}</span>
        </p>
        <p class="wg__zh zh">{{ cz.zh }}</p>
        <p class="wg__hintline zh"><span class="wg__pos">{{ pos }}</span>{{ gloss }}</p>
      </template>
    </div>

    <!-- ===== answer area ===== -->
    <div v-if="mode === 'meaning' || mode === 'listen'" class="wg__grid">
      <button
        v-for="(o, i) in mOptions" :key="o.id"
        class="opt"
        :class="{ 'opt--right': settled && o.correct, 'opt--wrong': settled && picked === i && !o.correct, 'opt--mute': settled && picked !== i && !o.correct }"
        :disabled="settled"
        @click="pickMeaning(o, i)"
      >
        <span v-if="o.pic" class="opt__pic" aria-hidden="true">{{ o.pic }}</span>
        <span class="opt__zh zh">{{ o.zh }}</span>
      </button>
    </div>

    <div v-else-if="mode === 'recall'" class="wg__list">
      <button
        v-for="(o, i) in wOptions" :key="o.text"
        class="optw"
        :class="{ 'opt--right': settled && o.correct, 'opt--wrong': settled && picked === i && !o.correct, 'opt--mute': settled && picked !== i && !o.correct }"
        :disabled="settled"
        @click="pickWord(o, i)"
      >{{ o.text }}</button>
    </div>

    <div v-else-if="mode === 'spell'" class="wg__spell">
      <div class="slots" :class="{ 'slots--shake': settled && !result.correct }">
        <button
          v-for="(s, i) in slots" :key="i"
          class="slot"
          :class="{ 'slot--on': s, 'slot--lock': s?.locked, 'slot--bad': settled && !result.correct && s && s.ch !== target[i] }"
          @click="unplace(i)"
        >{{ s?.ch || '' }}</button>
      </div>
      <p v-if="settled && !result.correct" class="wg__fix">{{ word.headword }}</p>
      <div v-if="!settled" class="tiles">
        <button v-for="t in tiles" :key="t.key" class="tile" @click="place(t)">{{ t.ch }}</button>
      </div>
      <button v-if="!settled" class="btn btn--quiet btn--sm zh wg__hintbtn" @click="hint">提示一個字母</button>
    </div>

    <form v-else-if="mode === 'cloze'" class="wg__cloze" @submit.prevent="submitCloze">
      <input
        ref="input"
        v-model="typed"
        class="input wg__input"
        :disabled="settled"
        autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false"
        :placeholder="`${firstLetter}…`"
        enterkeyhint="done"
      />
      <div v-if="!settled" class="row row-2">
        <button type="button" class="btn btn--quiet zh" @click="giveUp">不會</button>
        <button type="submit" class="btn btn--primary grow zh" :disabled="!typed.trim()">確定</button>
      </div>
    </form>

    <!-- ===== reveal ===== -->
    <Transition name="slide-up">
      <div v-if="settled" class="reveal card">
        <div class="reveal__top">
          <PictureTile :word-id="word.id" :headword="word.headword" :size="56" />
          <div class="reveal__word">
            <WordChunks :word="word.headword" size="md" />
            <span class="reveal__zh zh"><span class="wg__pos">{{ pos }}</span>{{ word.meanings?.map(m => m.zh).join('；') }}</span>
          </div>
          <AudioButton :text="word.headword" size="md" />
        </div>
        <p v-if="!result.correct && word.examples?.[0]" class="reveal__ex">{{ word.examples[0].en }}<br><span class="zh dim">{{ word.examples[0].zh }}</span></p>
        <button class="btn btn--block zh" :class="result.correct ? 'btn--ghost' : 'btn--primary'" @click="cont">繼續</button>
      </div>
    </Transition>
  </section>
</template>

<style scoped>
.wg { display: flex; flex-direction: column; gap: var(--sp-4); }
.wg__tag { display: flex; align-items: center; justify-content: space-between; min-height: 24px; }
.wg__verdict { font-size: var(--step--1); font-weight: 700; }
.wg__verdict.ok { color: var(--jade); }
.wg__verdict.no { color: var(--rose); }

.wg__prompt {
  padding: var(--sp-5) var(--sp-4);
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
  text-align: center;
  border-top: 3px solid var(--violet);
  min-height: 180px; justify-content: center;
}
.wg--right .wg__prompt { border-top-color: var(--jade); }
.wg--wrong .wg__prompt { border-top-color: var(--rose); }

.wg__bigplay {
  width: 96px; height: 96px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--violet-wash); color: var(--violet);
  border: 2px solid var(--violet);
}
.wg__bigplay svg { width: 44px; height: 44px; }
.wg__hintline { font-size: var(--step--1); color: var(--ink-2); }
.wg__gloss { font-size: var(--step-2); font-weight: 600; }
.wg__pos { font-family: var(--font-mono); font-size: 0.7em; color: var(--ink-3); margin-right: 6px; font-weight: 400; }

.wg__sentence { font-family: var(--font-word); font-size: var(--step-2); line-height: 1.5; }
.wg__gap {
  display: inline-block; min-width: 4.5em;
  border-bottom: 2px solid var(--violet);
  color: var(--violet); font-family: var(--font-mono); font-size: 0.8em; padding: 0 4px;
}
.wg__gap--filled { color: var(--jade); border-color: var(--jade); font-family: var(--font-word); font-size: 1em; font-weight: 600; }
.wg__zh { font-size: var(--step--1); color: var(--ink-2); }

/* meaning grid */
.wg__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.opt {
  min-height: 104px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  background: var(--surface); border: 1.5px solid var(--rule-strong); border-radius: var(--radius);
  padding: var(--sp-2);
  transition: transform 0.12s, background 0.15s, border-color 0.15s, opacity 0.2s;
}
.opt:active:not(:disabled) { transform: scale(0.97); }
.opt__pic { font-size: 2.2rem; line-height: 1; }
.opt__zh { font-size: var(--step-0); font-weight: 600; text-align: center; line-height: 1.3; }
.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade-ink); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); animation: shake 0.35s; }
.opt--mute { opacity: 0.38; }

/* recall list */
.wg__list { display: flex; flex-direction: column; gap: var(--sp-2); }
.optw {
  min-height: 54px; border-radius: var(--radius);
  border: 1.5px solid var(--rule-strong); background: var(--surface);
  font-family: var(--font-word); font-size: var(--step-1);
  transition: transform 0.12s, background 0.15s;
}
.optw:active:not(:disabled) { transform: scale(0.98); }

/* spell */
.wg__spell { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
.slots { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.slots--shake { animation: shake 0.35s; }
.slot {
  width: 38px; height: 46px;
  border-bottom: 3px solid var(--rule-strong);
  font-family: var(--font-mono); font-size: var(--step-2); font-weight: 600;
  display: grid; place-items: center;
  border-radius: 6px 6px 0 0;
}
.slot--on { background: var(--violet-wash); border-color: var(--violet); color: var(--ink); }
.slot--lock { background: var(--amber-wash); border-color: var(--amber); }
.slot--bad { background: var(--rose-wash); border-color: var(--rose); color: var(--rose); }
.wg--right .slot--on { background: var(--jade-wash); border-color: var(--jade); }
.wg__fix { font-family: var(--font-word); font-size: var(--step-2); color: var(--jade); font-weight: 600; }
.tiles { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: 340px; }
.tile {
  width: 46px; height: 50px;
  background: var(--surface); border: 1.5px solid var(--rule-strong); border-radius: 10px;
  box-shadow: 0 3px 0 var(--rule-strong);
  font-family: var(--font-mono); font-size: var(--step-2); font-weight: 600;
  transition: transform 0.08s;
}
.tile:active { transform: translateY(2px); box-shadow: 0 1px 0 var(--rule-strong); }
.wg__hintbtn { margin-top: -4px; }

/* cloze */
.wg__cloze { display: flex; flex-direction: column; gap: var(--sp-2); }
.wg__input { font-family: var(--font-word); font-size: var(--step-2); text-align: center; }

/* reveal */
.reveal { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.reveal__top { display: flex; align-items: center; gap: var(--sp-3); }
.reveal__word { flex: 1; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.reveal__zh { font-size: var(--step--1); color: var(--ink-2); }
.reveal__ex { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; padding: var(--sp-2) var(--sp-3); background: var(--surface-2); border-radius: var(--radius-sm); }

@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
</style>
