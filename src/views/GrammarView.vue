<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useGrammar } from '@/stores/grammar'
import { useSession } from '@/stores/session'
import { useToast } from '@/stores/toast'
import SessionHeader from '@/components/SessionHeader.vue'
import AudioButton from '@/components/AudioButton.vue'
import { inlineMd } from '@/lib/format'
import { matchesAnswer, worthJudging } from '@/lib/answer'
import { judgeSentence, generateDrills } from '@/lib/gemini'
import { useSettings } from '@/stores/settings'

/**
 * Grammar phase: read the point, then drill it. Drills are the same three
 * shapes the learner will meet on TOEIC Part 5 plus a word-order builder,
 * which is the one that actually rewires Mandarin-L1 sentence intuition.
 */

const grammar = useGrammar()
const session = useSession()
const toast = useToast()
const router = useRouter()
const settings = useSettings()

const point = computed(() => grammar.todayPoint)
const stage = ref('teach')            // teach | drill | result
const drillIndex = ref(0)
const answers = ref([])               // { correct }
const picked = ref(null)
const settled = ref(false)

// order-drill state
const built = ref([])
const bank = ref([])

/**
 * How the last free-text answer was judged. Strict local matching decides most
 * of them; the model is consulted only when the answer is close enough to the
 * reference to plausibly be a valid alternative phrasing.
 */
const verdict = ref(null)      // { correct, source: 'local'|'ai'|'revealed', explain }
const judging = ref(false)

const generated = ref(null)
const drills = computed(() => generated.value || point.value?.drills || [])
const drill = computed(() => drills.value[drillIndex.value] || null)
const isNew = computed(() => point.value && !grammar.recOf(point.value.id))

const correctCount = computed(() => answers.value.filter(a => a.correct).length)

function resetDrill () {
  picked.value = null
  settled.value = false
  verdict.value = null
  judging.value = false
  built.value = []
  const d = drill.value
  if (d?.type === 'order') {
    bank.value = [...d.tokens]
      .map((t, i) => ({ t, i }))
      .sort((a, b) => ((a.i * 2654435761) % 997) - ((b.i * 2654435761) % 997))
  } else {
    bank.value = []
  }
}

watch(drill, resetDrill, { immediate: true })

function startDrills () {
  generated.value = null
  stage.value = 'drill'
  drillIndex.value = 0
  answers.value = []
  resetDrill()
}

function next () {
  if (drillIndex.value + 1 < drills.value.length) {
    drillIndex.value++
  } else {
    finishDrills()
  }
}

function chooseOption (i) {
  if (settled.value) return
  picked.value = i
  settled.value = true
  answers.value.push({ correct: i === drill.value.answer })
}

/* ---- order drill ---- */
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
const builtSentence = computed(() => built.value.map(b => b.t).join(' '))

/**
 * Settle a free-text answer. Local matching is authoritative when it says yes;
 * when it says no, the model gets a look, because English gives more than one
 * correct way to say the same thing and marking those wrong teaches the
 * learner to chase the reference wording instead of the grammar.
 */
async function settleFreeText (learner, { task, targetError = '' }) {
  if (settled.value) return
  const reference = drill.value.answer

  if (matchesAnswer(learner, reference)) {
    settled.value = true
    verdict.value = { correct: true, source: 'local', explain: '' }
    answers.value.push({ correct: true })
    return
  }

  const canAsk = settings.hasGeminiKey && worthJudging(learner, reference)
  if (!canAsk) {
    settled.value = true
    verdict.value = { correct: false, source: 'local', explain: '' }
    answers.value.push({ correct: false })
    return
  }

  judging.value = true
  try {
    const r = await judgeSentence({
      learner, reference, task, targetError,
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    settled.value = true
    verdict.value = {
      correct: !!r.correct,
      source: 'ai',
      explain: r.explain_zh || '',
      corrected: r.corrected || ''
    }
    answers.value.push({ correct: !!r.correct })
  } catch (e) {
    // The model is an appeal court, not the only court. If it cannot be
    // reached, fall back to the strict result rather than blocking the drill.
    settled.value = true
    verdict.value = { correct: false, source: 'local', explain: `無法連線 AI 批改（${e.message}），改用嚴格比對。` }
    answers.value.push({ correct: false })
  } finally {
    judging.value = false
  }
}

function checkOrder () {
  settleFreeText(builtSentence.value, { task: '把中文翻成正確英文語序（句子重組）' })
}

/* ---- correction drill ---- */
const typed = ref('')
watch(drill, () => { typed.value = '' })

function checkCorrection () {
  settleFreeText(typed.value, {
    task: '找出並修正句子中的一個文法錯誤',
    targetError: drill.value.wrong || ''
  })
}

function revealCorrection () {
  if (settled.value) return
  settled.value = true
  verdict.value = { correct: false, source: 'revealed', explain: '' }
  answers.value.push({ correct: false })
}

function finishDrills () {
  const res = grammar.submit(point.value.id, {
    correct: correctCount.value,
    total: drills.value.length
  })
  stage.value = 'result'
  if (res) {
    const pct = Math.round((correctCount.value / drills.value.length) * 100)
    toast.info(`文法練習 ${pct}%`)
  }
}

const extraLoading = ref(false)

/**
 * Six fixed questions per point is one sitting. With a paid quota there is no
 * reason to stop there — generate more on the same rule, aimed at the mistakes
 * this point is known for.
 */
async function moreDrills (count = 6) {
  if (!settings.hasGeminiKey) { toast.error('需要 Gemini API Key 才能出新題目'); return }
  extraLoading.value = true
  try {
    const seen = point.value.drills.map(d => d.answer || d.q || d.wrong).filter(Boolean)
    const fresh = await generateDrills({
      topic: point.value.title,
      focus: `${point.value.pattern} — ${point.value.summary}`,
      count,
      avoid: seen,
      weak: point.value.pitfalls.slice(0, 3),
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    if (!fresh.length) { toast.error('這次沒有產生出可用的題目，再試一次'); return }
    generated.value = fresh
    drillIndex.value = 0
    answers.value = []
    stage.value = 'drill'
    resetDrill()
  } catch (e) {
    toast.error(e.message)
  } finally {
    extraLoading.value = false
  }
}

function done () {
  session.markDone('grammar')
  router.push('/essentials')
}

function skipPhase () {
  session.markDone('grammar')
  router.push('/essentials')
}

onMounted(() => {
  session.startClock()
  if (!point.value) {
    session.markDone('grammar')
    router.replace('/essentials')
  }
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader
      title="文法"
      :current="stage === 'drill' ? drillIndex + 1 : (stage === 'result' ? drills.length : 0)"
      :total="drills.length"
    />

    <main v-if="point" class="shell gram">
      <!-- ---------------- teach ---------------- -->
      <template v-if="stage === 'teach'">
        <div class="phase-tag">
          <span class="chip" :class="point.band === 'B1' ? 'chip--jade' : point.band === 'B2' ? 'chip--violet' : 'chip--amber'">
            {{ point.band }}
          </span>
          <span class="chip chip--plain">{{ isNew ? '新文法點' : '複習' }}</span>
          <span class="dim num">#{{ point.order }}/30</span>
        </div>

        <header class="gram__head">
          <h1 class="gram__title zh">{{ point.title }}</h1>
          <div class="gram__pattern">{{ point.pattern }}</div>
          <p class="gram__summary zh">{{ point.summary }}</p>
        </header>

        <section class="card card--pad gram__explain">
          <p v-for="(p, i) in point.explain" :key="i" class="zh" v-html="inlineMd(p)" />
        </section>

        <section class="stack stack-3">
          <div class="eyebrow">Examples</div>
          <div v-for="(ex, i) in point.examples" :key="i" class="gex">
            <div class="gex__row">
              <p class="gex__en">{{ ex.en }}</p>
              <AudioButton :text="ex.en" size="sm" />
            </div>
            <p class="gex__zh zh">{{ ex.zh }}</p>
            <p v-if="ex.note" class="gex__note zh">{{ ex.note }}</p>
          </div>
        </section>

        <section class="pit">
          <div class="pit__head zh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8.5v5M12 16.8v.2" /><circle cx="12" cy="12" r="9" /></svg>
            台灣人最常錯的地方
          </div>
          <ul class="pit__list">
            <li v-for="(p, i) in point.pitfalls" :key="i" class="zh" v-html="inlineMd(p)" />
          </ul>
        </section>

        <button class="btn btn--primary btn--block zh" @click="startDrills">
          開始練習（{{ drills.length }} 題）
        </button>
        <button class="btn btn--quiet btn--sm gram__skip zh" @click="skipPhase">跳過這個階段</button>
      </template>

      <!-- ---------------- drill ---------------- -->
      <template v-else-if="stage === 'drill' && drill">
        <div class="phase-tag">
          <span class="chip chip--plain">
            {{ drill.type === 'choice' ? '選擇題' : drill.type === 'order' ? '句子重組' : '找出錯誤' }}
          </span>
          <span class="tally num">{{ correctCount }} / {{ answers.length }}</span>
        </div>

        <!-- choice -->
        <template v-if="drill.type === 'choice'">
          <div class="qbox">
            <p class="qbox__q">{{ drill.q }}</p>
          </div>
          <div class="opts">
            <button
              v-for="(o, i) in drill.options" :key="i"
              class="opt"
              :class="{
                'opt--right': settled && i === drill.answer,
                'opt--wrong': settled && picked === i && i !== drill.answer,
                'opt--mute': settled && picked !== i && i !== drill.answer
              }"
              :disabled="settled"
              @click="chooseOption(i)"
            >
              <span class="opt__key num">{{ 'ABCD'[i] }}</span>
              <span class="opt__text">{{ o }}</span>
            </button>
          </div>
        </template>

        <!-- order -->
        <template v-else-if="drill.type === 'order'">
          <div class="qbox">
            <div class="eyebrow">把中文翻成正確的英文語序</div>
            <p class="qbox__zh zh">{{ drill.zh }}</p>
          </div>

          <div class="build" :class="{ 'build--empty': !built.length }">
            <button v-for="(b, i) in built" :key="b.i" class="tok tok--on" :disabled="settled" @click="popToken(i)">
              {{ b.t }}
            </button>
            <span v-if="!built.length" class="build__ph zh">點下面的字組成句子</span>
          </div>

          <div class="bank">
            <button v-for="(b, i) in bank" :key="b.i" class="tok" :disabled="settled" @click="pushToken(b, i)">
              {{ b.t }}
            </button>
          </div>

          <button
            v-if="!settled"
            class="btn btn--primary btn--block zh"
            :disabled="bank.length > 0 || judging"
            @click="checkOrder"
          >{{ judging ? 'AI 批改中…' : (bank.length ? `還有 ${bank.length} 個字` : '檢查答案') }}</button>
        </template>

        <!-- correction -->
        <template v-else>
          <div class="qbox">
            <div class="eyebrow">下面這句話有一個錯誤，改對它</div>
            <p class="qbox__wrong">{{ drill.wrong }}</p>
          </div>
          <textarea
            v-model="typed"
            class="input"
            rows="2"
            :disabled="settled"
            placeholder="輸入修正後的句子"
            autocapitalize="sentences"
            autocorrect="off"
          />
          <div v-if="!settled" class="row row-2">
            <button class="btn btn--primary grow zh" :disabled="!typed.trim() || judging" @click="checkCorrection">
              {{ judging ? 'AI 批改中…' : '檢查' }}
            </button>
            <button class="btn btn--ghost zh" :disabled="judging" @click="revealCorrection">看答案</button>
          </div>
        </template>

        <!-- feedback -->
        <Transition name="slide-up">
          <div v-if="settled" class="fb" :class="answers.at(-1)?.correct ? 'fb--ok' : 'fb--no'">
            <div class="fb__head zh">
              <span>{{ answers.at(-1)?.correct ? '答對了' : '答錯了' }}</span>
              <span v-if="verdict?.source === 'ai'" class="fb__by zh">AI 批改</span>
            </div>

            <!-- when the model accepted a wording that differs from the reference,
                 say so explicitly instead of just showing the reference -->
            <p v-if="verdict?.source === 'ai' && verdict.correct" class="fb__alt zh">
              你的寫法也對。參考答案是另一種說法：
            </p>

            <p v-if="drill.type !== 'choice'" class="fb__answer">
              {{ drill.answer }}
              <AudioButton :text="drill.answer" size="sm" />
            </p>

            <p v-if="verdict?.corrected && !verdict.correct" class="fb__corrected zh">
              建議改成：<strong>{{ verdict.corrected }}</strong>
            </p>

            <p v-if="verdict?.explain" class="fb__explain zh">{{ verdict.explain }}</p>
            <p v-if="drill.explain || drill.zh" class="fb__explain zh">{{ drill.explain || drill.zh }}</p>

            <button class="btn btn--primary btn--block zh" @click="next">
              {{ drillIndex + 1 < drills.length ? '下一題' : '看結果' }}
            </button>
          </div>
        </Transition>
      </template>

      <!-- ---------------- result ---------------- -->
      <template v-else>
        <div class="res">
          <div class="res__ring" :style="{ '--pct': (correctCount / drills.length) * 100 }">
            <span class="res__pct num">{{ Math.round((correctCount / drills.length) * 100) }}<small>%</small></span>
          </div>
          <h2 class="res__title zh">{{ point.title }}</h2>
          <p class="res__line zh">
            答對 <strong class="num">{{ correctCount }}</strong> / {{ drills.length }} 題
          </p>
          <p class="res__note zh">
            <template v-if="correctCount / drills.length >= 0.75">
              這個文法點會在幾天後再出現一次確認。
            </template>
            <template v-else>
              正確率偏低，這個文法點明天就會再出現。答錯的題目已進錯題本。
            </template>
          </p>
        </div>

        <button class="btn btn--ghost btn--block zh" :disabled="extraLoading" @click="moreDrills(6)">
          {{ extraLoading ? '出題中…' : '再來 6 題（AI 出新題）' }}
        </button>
        <button class="btn btn--primary btn--block zh" @click="done">繼續，進入基礎知識</button>
        <button class="btn btn--quiet btn--sm btn--block zh" @click="stage = 'teach'">再看一次說明</button>
      </template>
    </main>
  </div>
</template>


<style scoped>
.view { min-height: 100dvh; }
.gram {
  display: flex; flex-direction: column; gap: var(--sp-4);
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6));
}

.phase-tag { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--step--2); }
.phase-tag .dim { margin-left: auto; }
.tally { margin-left: auto; font-size: var(--step--1); color: var(--ink-2); }

/* teach */
.gram__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.gram__title {
  font-size: var(--step-2);
  font-weight: 800;
  letter-spacing: -0.015em;
  line-height: 1.35;
  text-wrap: balance;
  line-break: strict;           /* keep CJK punctuation off line starts */
}
@media (min-width: 420px) { .gram__title { font-size: var(--step-3); } }
.gram__pattern {
  font-family: var(--font-mono);
  font-size: var(--step-0);
  color: var(--jade);
  background: var(--jade-wash);
  border: 1px solid var(--jade-edge);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
  align-self: flex-start;
}
.gram__summary { font-size: var(--step-0); color: var(--ink-2); line-height: 1.7; }

.gram__explain { display: flex; flex-direction: column; gap: var(--sp-3); }
.gram__explain p { font-size: var(--step--1); line-height: 1.85; color: var(--ink-2); }
.gram__explain :deep(strong) { color: var(--ink); font-weight: 700; }
.gram__explain :deep(code) {
  font-family: var(--font-word);
  font-size: var(--step-0);
  color: var(--ink);
  background: var(--surface-2);
  padding: 1px 5px;
  border-radius: 4px;
}

.gex {
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: 3px;
}
.gex__row { display: flex; align-items: flex-start; gap: var(--sp-2); }
.gex__en { flex: 1; font-family: var(--font-word); font-size: var(--step-1); line-height: 1.45; }
.gex__zh { font-size: var(--step--1); color: var(--ink-2); }
.gex__note { font-size: var(--step--2); color: var(--ink-3); font-style: italic; }

.pit {
  border: 1px solid var(--rose-edge);
  background: var(--rose-wash);
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
}
.pit__head {
  display: flex; align-items: center; gap: 6px;
  color: var(--rose); font-weight: 700; font-size: var(--step--1);
}
.pit__head svg { width: 16px; height: 16px; }
.pit__list { display: flex; flex-direction: column; gap: var(--sp-2); }
.pit__list li { font-size: var(--step--1); line-height: 1.7; color: var(--ink-2); }
.pit__list :deep(code) {
  font-family: var(--font-word);
  background: var(--surface);
  padding: 1px 5px; border-radius: 4px; color: var(--ink);
}
.pit__list :deep(strong) { color: var(--ink); }

.gram__skip { align-self: center; }

/* drills */
.qbox {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius-lg);
  padding: var(--sp-5) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
  box-shadow: var(--shadow-1);
}
.qbox__q { font-family: var(--font-word); font-size: var(--step-2); line-height: 1.5; }
.qbox__zh { font-size: var(--step-1); font-weight: 500; line-height: 1.5; }
.qbox__wrong {
  font-family: var(--font-word);
  font-size: var(--step-1);
  line-height: 1.5;
  color: var(--rose);
  text-decoration: underline wavy var(--rose-edge) 1.5px;
  text-underline-offset: 4px;
}

.opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.opt {
  display: flex; align-items: center; gap: var(--sp-3);
  min-height: 50px; padding: 0 var(--sp-3);
  border-radius: var(--radius);
  border: 1px solid var(--rule-strong);
  background: var(--surface);
  text-align: left;
  transition: background 0.14s, border-color 0.14s, opacity 0.2s;
}
.opt:active:not(:disabled) { background: var(--surface-2); }
.opt__key {
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: var(--radius-sm); background: var(--surface-2);
  color: var(--ink-3); font-size: var(--step--2); flex-shrink: 0;
}
.opt__text { font-family: var(--font-word); font-size: var(--step-1); }
.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade); }
.opt--right .opt__key { background: var(--jade); color: var(--surface); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.opt--mute { opacity: 0.42; }

/* order builder */
.build {
  min-height: 68px;
  border: 1.5px dashed var(--rule-strong);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-wrap: wrap; gap: var(--sp-2);
  align-items: center;
  background: var(--surface);
}
.build--empty { justify-content: center; }
.build__ph { color: var(--ink-3); font-size: var(--step--1); }

.bank { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.tok {
  font-family: var(--font-word);
  font-size: var(--step-0);
  padding: 9px 13px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--rule-strong);
  background: var(--surface-2);
  transition: transform 0.1s, background 0.14s;
}
.tok:active:not(:disabled) { transform: scale(0.95); }
.tok--on { background: var(--jade-wash); border-color: var(--jade-edge); color: var(--jade); }

/* feedback */
.fb {
  border-radius: var(--radius);
  padding: var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-3);
  border: 1px solid;
}
.fb--ok { background: var(--jade-wash); border-color: var(--jade-edge); }
.fb--no { background: var(--rose-wash); border-color: var(--rose-edge); }
.fb__head {
  font-weight: 700; font-size: var(--step-0);
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2);
}
.fb__by {
  font-family: var(--font-mono);
  font-size: var(--step--2);
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--violet-wash);
  color: var(--violet);
}
.fb__alt { font-size: var(--step--1); color: var(--ink-2); }
.fb__corrected {
  font-size: var(--step--1);
  background: var(--surface);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-3);
}
.fb__corrected strong { font-family: var(--font-word); font-weight: 600; }
.fb--ok .fb__head { color: var(--jade); }
.fb--no .fb__head { color: var(--rose); }
.fb__answer {
  display: flex; align-items: center; gap: var(--sp-2);
  font-family: var(--font-word); font-size: var(--step-1);
  background: var(--surface); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3);
}
.fb__explain { font-size: var(--step--1); line-height: 1.75; color: var(--ink-2); }

/* result */
.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-6) 0 var(--sp-4); text-align: center; }
.res__ring {
  width: 118px; height: 118px; border-radius: 50%;
  display: grid; place-items: center;
  background: conic-gradient(var(--jade) calc(var(--pct) * 1%), var(--surface-3) 0);
  position: relative;
}
.res__ring::after {
  content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--paper);
}
.res__pct { position: relative; z-index: 1; font-size: var(--step-3); font-weight: 600; }
.res__pct small { font-size: var(--step-0); color: var(--ink-3); }
.res__title { font-size: var(--step-1); font-weight: 700; }
.res__line { font-size: var(--step-0); color: var(--ink-2); }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.7; max-width: 32ch; }
</style>
