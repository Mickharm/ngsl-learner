<script setup>
import { ref, computed, watch } from 'vue'
import AudioButton from './AudioButton.vue'
import { matchesAnswer, worthJudging } from '@/lib/answer'
import { judgeSentence } from '@/lib/gemini'
import { useSettings } from '@/stores/settings'

/**
 * Runs a list of drills and reports the result.
 *
 * Shared by grammar, essentials and generated practice so a question behaves
 * identically wherever it came from — including the two-stage marking for
 * free-text answers: strict local match first, model only for a near miss.
 */

const props = defineProps({
  drills: { type: Array, required: true },
  /** Shown above the question, e.g. the unit title. */
  label: { type: String, default: '' }
})
const emit = defineEmits(['done', 'exit'])

const settings = useSettings()

const index = ref(0)
const settled = ref(false)
const picked = ref(null)
const verdict = ref(null)
const judging = ref(false)
const results = ref([])

const drill = computed(() => props.drills[index.value] || null)
const correctCount = computed(() => results.value.filter(Boolean).length)

/* ---- order ---- */
const built = ref([])
const bank = ref([])
const builtSentence = computed(() => built.value.map(b => b.t).join(' '))

/* ---- correct ---- */
const typed = ref('')

/* ---- sort ---- */
const placed = ref({})          // itemIndex -> bucket

function reset () {
  settled.value = false
  picked.value = null
  verdict.value = null
  judging.value = false
  typed.value = ''
  built.value = []
  placed.value = {}
  const d = drill.value
  bank.value = d?.type === 'order'
    ? [...d.tokens].map((t, i) => ({ t, i }))
        .sort((a, b) => ((a.i * 2654435761) % 997) - ((b.i * 2654435761) % 997))
    : []
}
watch(drill, reset, { immediate: true })

function record (ok) {
  settled.value = true
  results.value[index.value] = ok
}

/* ---- choice ---- */
function choose (i) {
  if (settled.value) return
  picked.value = i
  record(i === drill.value.answer)
}

/* ---- order ---- */
function pushToken (item, idx) {
  if (settled.value) return
  built.value = [...built.value, item]
  bank.value = bank.value.filter((_, i) => i !== idx)
}
function popToken (idx) {
  if (settled.value) return
  const item = built.value[idx]
  built.value = built.value.filter((_, i) => i !== idx)
  bank.value = [...bank.value, item]
}

/* ---- sort ---- */
function place (itemIdx, bucket) {
  if (settled.value) return
  placed.value = { ...placed.value, [itemIdx]: bucket }
}
const sortComplete = computed(() =>
  drill.value?.type === 'sort' &&
  drill.value.items.every((_, i) => placed.value[i])
)
function checkSort () {
  if (settled.value) return
  const d = drill.value
  record(d.items.every((it, i) => placed.value[i] === it.b))
}

/* ---- free text, two-stage ---- */
async function settleFreeText (learner, { task, targetError = '' }) {
  if (settled.value) return
  const reference = drill.value.answer

  if (matchesAnswer(learner, reference)) {
    verdict.value = { correct: true, source: 'local' }
    record(true)
    return
  }

  if (!(settings.hasGeminiKey && worthJudging(learner, reference))) {
    verdict.value = { correct: false, source: 'local' }
    record(false)
    return
  }

  judging.value = true
  try {
    const r = await judgeSentence({
      learner, reference, task, targetError,
      key: settings.state.geminiKey, model: settings.state.geminiModel
    })
    verdict.value = {
      correct: !!r.correct, source: 'ai',
      explain: r.explain_zh || '', corrected: r.corrected || ''
    }
    record(!!r.correct)
  } catch (e) {
    verdict.value = { correct: false, source: 'local', explain: `AI 批改連線失敗（${e.message}），改用嚴格比對。` }
    record(false)
  } finally {
    judging.value = false
  }
}

const checkOrder = () => settleFreeText(builtSentence.value, { task: '把中文翻成正確英文語序（句子重組）' })
const checkCorrection = () => settleFreeText(typed.value, {
  task: '找出並修正句子中的一個文法錯誤',
  targetError: drill.value.wrong || ''
})

function reveal () {
  if (settled.value) return
  verdict.value = { correct: false, source: 'revealed' }
  record(false)
}

function next () {
  if (index.value + 1 < props.drills.length) index.value++
  else emit('done', { correct: correctCount.value, total: props.drills.length, results: results.value })
}

const TYPE_LABEL = { choice: '選擇題', correct: '找出錯誤', order: '句子重組', sort: '分類' }
</script>

<template>
  <div v-if="drill" class="dr">
    <div class="dr__top">
      <span class="chip chip--plain">{{ TYPE_LABEL[drill.type] || '練習' }}</span>
      <span v-if="drill.generated" class="chip chip--violet">AI 出題</span>
      <span class="dr__count num">{{ correctCount }} / {{ results.filter(r => r !== undefined).length }}</span>
    </div>

    <!-- choice -->
    <template v-if="drill.type === 'choice'">
      <div class="qbox"><p class="qbox__q">{{ drill.q }}</p></div>
      <div class="opts">
        <button
          v-for="(o, i) in drill.options" :key="i"
          class="opt"
          :class="{
            'opt--right': settled && i === drill.answer,
            'opt--wrong': settled && picked === i && i !== drill.answer,
            'opt--mute': settled && picked !== i && i !== drill.answer
          }"
          :disabled="settled" @click="choose(i)"
        >
          <span class="opt__key num">{{ 'ABCD'[i] }}</span>
          <span class="opt__text">{{ o }}</span>
        </button>
      </div>
    </template>

    <!-- sort -->
    <template v-else-if="drill.type === 'sort'">
      <div class="qbox"><p class="qbox__zh zh">{{ drill.prompt }}</p></div>
      <div class="sort">
        <div v-for="(it, i) in drill.items" :key="i" class="sortrow">
          <span class="sortrow__t">{{ it.t }}</span>
          <div class="sortrow__b">
            <button
              v-for="b in drill.buckets" :key="b"
              class="bkt"
              :class="{
                'bkt--on': placed[i] === b,
                'bkt--right': settled && placed[i] === b && b === it.b,
                'bkt--wrong': settled && placed[i] === b && b !== it.b,
                'bkt--miss': settled && placed[i] !== it.b && b === it.b
              }"
              :disabled="settled" @click="place(i, b)"
            >{{ b }}</button>
          </div>
        </div>
      </div>
      <button v-if="!settled" class="btn btn--primary btn--block zh" :disabled="!sortComplete" @click="checkSort">
        {{ sortComplete ? '檢查答案' : '還有沒分類的' }}
      </button>
    </template>

    <!-- order -->
    <template v-else-if="drill.type === 'order'">
      <div class="qbox">
        <div class="eyebrow">把中文翻成正確的英文語序</div>
        <p class="qbox__zh zh">{{ drill.zh }}</p>
      </div>
      <div class="build" :class="{ 'build--empty': !built.length }">
        <button v-for="(b, i) in built" :key="b.i" class="tok tok--on" :disabled="settled" @click="popToken(i)">{{ b.t }}</button>
        <span v-if="!built.length" class="build__ph zh">點下面的字組成句子</span>
      </div>
      <div class="bank">
        <button v-for="(b, i) in bank" :key="b.i" class="tok" :disabled="settled" @click="pushToken(b, i)">{{ b.t }}</button>
      </div>
      <button v-if="!settled" class="btn btn--primary btn--block zh" :disabled="bank.length > 0 || judging" @click="checkOrder">
        {{ judging ? 'AI 批改中…' : (bank.length ? `還有 ${bank.length} 個字` : '檢查答案') }}
      </button>
    </template>

    <!-- correct -->
    <template v-else-if="drill.type === 'correct'">
      <div class="qbox">
        <div class="eyebrow">下面這句話有一個錯誤，改對它</div>
        <p class="qbox__wrong">{{ drill.wrong }}</p>
      </div>
      <textarea v-model="typed" class="input" rows="2" :disabled="settled"
        placeholder="輸入修正後的句子" autocapitalize="sentences" autocorrect="off" />
      <div v-if="!settled" class="row row-2">
        <button class="btn btn--primary grow zh" :disabled="!typed.trim() || judging" @click="checkCorrection">
          {{ judging ? 'AI 批改中…' : '檢查' }}
        </button>
        <button class="btn btn--ghost zh" :disabled="judging" @click="reveal">看答案</button>
      </div>
    </template>

    <!-- feedback -->
    <Transition name="slide-up">
      <div v-if="settled" class="fb" :class="results[index] ? 'fb--ok' : 'fb--no'">
        <div class="fb__head zh">
          <span>{{ results[index] ? '答對了' : '答錯了' }}</span>
          <span v-if="verdict?.source === 'ai'" class="fb__by">AI 批改</span>
        </div>

        <p v-if="verdict?.source === 'ai' && verdict.correct" class="fb__alt zh">
          你的寫法也對。參考答案是另一種說法：
        </p>
        <p v-if="drill.answer && drill.type !== 'choice'" class="fb__answer">
          {{ drill.answer }}
          <AudioButton :text="drill.answer" size="sm" />
        </p>
        <p v-if="verdict?.corrected && !verdict.correct" class="fb__corrected zh">
          建議改成：<strong>{{ verdict.corrected }}</strong>
        </p>
        <p v-if="verdict?.explain" class="fb__explain zh">{{ verdict.explain }}</p>
        <p v-if="drill.explain" class="fb__explain zh">{{ drill.explain }}</p>

        <button class="btn btn--primary btn--block zh" @click="next">
          {{ index + 1 < drills.length ? '下一題' : '看結果' }}
        </button>
      </div>
    </Transition>

    <button class="btn btn--quiet btn--sm dr__exit zh" @click="emit('exit')">離開</button>
  </div>
</template>

<style scoped>
.dr { display: flex; flex-direction: column; gap: var(--sp-4); }
.dr__top { display: flex; align-items: center; gap: var(--sp-2); }
.dr__count { margin-left: auto; font-size: var(--step--1); color: var(--ink-2); }
.dr__exit { align-self: center; }

.qbox {
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius-lg); padding: var(--sp-5) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2); box-shadow: var(--shadow-1);
}
.qbox__q { font-family: var(--font-word); font-size: var(--step-2); line-height: 1.5; }
.qbox__zh { font-size: var(--step-1); font-weight: 500; line-height: 1.5; }
.qbox__wrong {
  font-family: var(--font-word); font-size: var(--step-1); line-height: 1.5; color: var(--rose);
  text-decoration: underline wavy var(--rose-edge) 1.5px; text-underline-offset: 4px;
}

.opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.opt {
  display: flex; align-items: center; gap: var(--sp-3);
  min-height: 50px; padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius); border: 1px solid var(--rule-strong);
  background: var(--surface); text-align: left;
  transition: background 0.14s, border-color 0.14s, opacity 0.2s;
}
.opt__key {
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: var(--radius-sm); background: var(--surface-2);
  color: var(--ink-3); font-size: var(--step--2); flex-shrink: 0;
}
.opt__text { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.45; }
.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade); }
.opt--right .opt__key { background: var(--jade); color: var(--surface); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.opt--mute { opacity: 0.42; }

/* sort */
.sort { display: flex; flex-direction: column; gap: var(--sp-2); }
.sortrow {
  display: flex; align-items: center; gap: var(--sp-3);
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius); padding: var(--sp-2) var(--sp-3);
}
.sortrow__t { flex: 1; font-family: var(--font-word); font-size: var(--step-0); min-width: 0; }
.sortrow__b { display: flex; gap: 4px; flex-shrink: 0; }
.bkt {
  font-family: var(--font-mono); font-size: var(--step--2);
  padding: 6px 10px; border-radius: var(--radius-sm);
  border: 1px solid var(--rule-strong); background: var(--surface-2); color: var(--ink-2);
  transition: background 0.14s, color 0.14s, border-color 0.14s;
}
.bkt--on { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.bkt--right { background: var(--jade); border-color: var(--jade); color: var(--surface); }
.bkt--wrong { background: var(--rose); border-color: var(--rose); color: #fff; }
.bkt--miss { border-color: var(--jade); color: var(--jade); background: var(--jade-wash); }

/* order */
.build {
  min-height: 68px; border: 1.5px dashed var(--rule-strong); border-radius: var(--radius);
  padding: var(--sp-3); display: flex; flex-wrap: wrap; gap: var(--sp-2);
  align-items: center; background: var(--surface);
}
.build--empty { justify-content: center; }
.build__ph { color: var(--ink-3); font-size: var(--step--1); }
.bank { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.tok {
  font-family: var(--font-word); font-size: var(--step-0);
  padding: 9px 13px; border-radius: var(--radius-sm);
  border: 1px solid var(--rule-strong); background: var(--surface-2);
  transition: transform 0.1s, background 0.14s;
}
.tok:active:not(:disabled) { transform: scale(0.95); }
.tok--on { background: var(--jade-wash); border-color: var(--jade-edge); color: var(--jade); }

/* feedback */
.fb { border-radius: var(--radius); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); border: 1px solid; }
.fb--ok { background: var(--jade-wash); border-color: var(--jade-edge); }
.fb--no { background: var(--rose-wash); border-color: var(--rose-edge); }
.fb__head {
  font-weight: 700; font-size: var(--step-0);
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2);
}
.fb--ok .fb__head > span:first-child { color: var(--jade); }
.fb--no .fb__head > span:first-child { color: var(--rose); }
.fb__by {
  font-family: var(--font-mono); font-size: var(--step--2); font-weight: 500;
  padding: 2px 8px; border-radius: var(--radius-pill);
  background: var(--violet-wash); color: var(--violet);
}
.fb__alt { font-size: var(--step--1); color: var(--ink-2); }
.fb__answer {
  display: flex; align-items: center; gap: var(--sp-2);
  font-family: var(--font-word); font-size: var(--step-1);
  background: var(--surface); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3);
}
.fb__corrected {
  font-size: var(--step--1); background: var(--surface);
  border-radius: var(--radius); padding: var(--sp-2) var(--sp-3);
}
.fb__corrected strong { font-family: var(--font-word); font-weight: 600; }
.fb__explain { font-size: var(--step--1); line-height: 1.75; color: var(--ink-2); }
</style>
