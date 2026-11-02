<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGrammar } from '@/stores/grammar'
import { useSession } from '@/stores/session'
import SessionHeader from '@/components/SessionHeader.vue'
import Stamp from '@/components/ui/Stamp.vue'
import AudioButton from '@/components/AudioButton.vue'
import GrammarGame from '@/components/grammar/GrammarGame.vue'
import TenseTimeline from '@/components/grammar/TenseTimeline.vue'
import SentenceSlots from '@/components/grammar/SentenceSlots.vue'
import STUDIO, { TENSES } from '@/data/grammar-studio'
import { practiceRound, mixRound } from '@/lib/grammarGames'
import { shuffle } from '@/lib/game'
import { inlineMd } from '@/lib/format'

/**
 * Grammar Studio. The old phase was: read a page, then six drills of the same
 * point in the same three shapes — so every answer could be produced by
 * applying the rule just read, which is why it "felt like following the
 * order" and taught little. Now:
 *
 *   DISCOVER  (new points) look at two or three sentences and guess the
 *             pattern before being told — noticing first, rule second.
 *   TEACH     the rule, drawn: tenses on a time line, structures as coloured
 *             slots; explanation, examples, the mistakes Taiwanese learners make.
 *   PRACTICE  this point, but in mixed game types: pictures, timelines,
 *             meaning questions, slot blocks, tap-the-error, ✅/❌.
 *   MIX       items from every point learned so far, shuffled so no two
 *             neighbours share a rule. Each item first asks "which rule is
 *             this?" — the decision blocked practice never trains.
 *
 * Today's point is scheduled from its own answers; a miss on an older point in
 * the mix pulls that point back to tomorrow.
 */

const grammar = useGrammar()
const session = useSession()
const router = useRouter()
const route = useRoute()

/**
 * ?point=g05 opens a point from the course map (a learned one, or today's).
 * Only today's point counts toward the day's quest.
 */
const picked = computed(() => {
  const id = route.query.point
  const p = id && grammar.all.find(x => x.id === id)
  return p && (grammar.recOf(p.id) || p.id === grammar.todayPoint?.id) ? p : null
})
const browsing = computed(() => !!picked.value && picked.value.id !== grammar.todayPoint?.id)
const point = computed(() => picked.value || grammar.todayPoint)
const isNew = computed(() => point.value && !grammar.recOf(point.value.id))
const studio = computed(() => (point.value ? STUDIO[point.value.id] : null))
const daySeed = computed(() => {
  const d = new Date()
  return d.getFullYear() * 400 + (d.getMonth() + 1) * 31 + d.getDate() + (grammar.recOf(point.value?.id)?.reps || 0) * 7
})

const stage = ref('discover')     // discover | teach | practice | mix | result
const showFull = ref(true)

/* discover */
const dPicked = ref(null)
const discover = computed(() => {
  const d = studio.value?.discover
  if (!d) return null
  const order = shuffle(d.options.map((_, i) => i), daySeed.value)
  return { ...d, options: order.map(i => d.options[i]), answer: order.indexOf(d.answer) }
})

/* rounds */
const items = ref([])
const idx = ref(0)
const results = ref([])           // { pointId, correct, round }

const item = computed(() => items.value[idx.value] || null)

const todayResults = computed(() => results.value.filter(r => r.pointId === point.value?.id))
const todayCorrect = computed(() => todayResults.value.filter(r => r.correct).length)
const mixResults = computed(() => results.value.filter(r => r.round === 'mix'))
const mixByPoint = computed(() => {
  const m = new Map()
  for (const r of mixResults.value) {
    const g = grammar.all.find(x => x.id === r.pointId)
    const e = m.get(r.pointId) || { id: r.pointId, title: g?.title.split('：')[0] || r.pointId, right: 0, total: 0 }
    e.total++; if (r.correct) e.right++
    m.set(r.pointId, e)
  }
  return [...m.values()]
})

function startTeach () { stage.value = 'teach' }

function startPractice () {
  items.value = practiceRound(point.value, STUDIO, daySeed.value, isNew.value ? 7 : 5)
  idx.value = 0
  stage.value = 'practice'
}

function startMix () {
  const pool = [...grammar.learned]
  if (!pool.some(p => p.id === point.value.id)) pool.push(point.value)
  if (pool.length < 2) return finish()
  items.value = mixRound(pool, point.value.id, STUDIO, { seed: daySeed.value + 101, n: 8, weakness: grammar.weakness })
  idx.value = 0
  stage.value = 'mix'
}

function onAnswer (a) {
  results.value = [...results.value, { pointId: a.pointId, correct: a.correct, round: stage.value }]
  if (stage.value === 'mix' && a.pointId !== point.value.id) grammar.observe(a.pointId, a.correct)
}

function next () {
  if (idx.value + 1 < items.value.length) { idx.value++; return }
  if (stage.value === 'practice') startMix()
  else finish()
}

const submitted = ref(null)
function finish () {
  submitted.value = grammar.submit(point.value.id, { correct: todayCorrect.value, total: todayResults.value.length || 1 })
  stage.value = 'result'
  if (!browsing.value) session.markDone('grammar')
}

const pct = computed(() => todayResults.value.length ? Math.round((todayCorrect.value / todayResults.value.length) * 100) : 0)

function done () { router.push(browsing.value ? '/courses' : session.nextRoute('grammar')) }
function skipPhase () { session.markDone('grammar'); router.push(session.nextRoute('grammar')) }

const headerCur = computed(() => (stage.value === 'practice' || stage.value === 'mix') ? idx.value + 1 : 0)
const headerTot = computed(() => (stage.value === 'practice' || stage.value === 'mix') ? items.value.length : 0)

onMounted(() => {
  session.startClock()
  if (!point.value) {
    if (!browsing.value) session.markDone('grammar')
    router.replace(session.nextRoute('grammar'))
    return
  }
  if (!isNew.value || !studio.value?.discover) { stage.value = 'teach'; showFull.value = false }
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader title="文法" :current="headerCur" :total="headerTot" />

    <main v-if="point" class="shell gram">
      <!-- ================= DISCOVER ================= -->
      <template v-if="stage === 'discover' && discover">
        <div class="phase">
          <span class="chip chip--amber zh">🔍 找規律</span>
          <span class="dim zh">先猜，再看答案——自己發現的規則最難忘</span>
        </div>
        <section class="card disc">
          <div v-for="(s, i) in discover.shown" :key="i" class="disc__s">
            <p class="disc__en">{{ s }}</p>
            <AudioButton v-if="/[a-z]{2}/i.test(s)" :text="s.replace(/^✗\s*/, '').replace(/\(.*?\)/g, '')" size="sm" />
          </div>
        </section>
        <p class="disc__q zh">{{ discover.q }}</p>
        <div class="disc__opts">
          <button
            v-for="(o, i) in discover.options" :key="o"
            class="dopt zh"
            :class="{ 'dopt--right': dPicked !== null && i === discover.answer, 'dopt--wrong': dPicked === i && i !== discover.answer, 'dopt--mute': dPicked !== null && dPicked !== i && i !== discover.answer }"
            :disabled="dPicked !== null"
            @click="dPicked = i"
          >{{ o }}</button>
        </div>
        <Transition name="slide-up">
          <div v-if="dPicked !== null" class="disc__why card">
            <p class="zh"><b>{{ dPicked === discover.answer ? '你發現了！' : '其實是這樣：' }}</b>{{ discover.why }}</p>
            <button class="btn btn--primary btn--block zh" @click="startTeach">看完整規則</button>
          </div>
        </Transition>
      </template>

      <!-- ================= TEACH ================= -->
      <template v-else-if="stage === 'teach'">
        <div class="phase">
          <span class="chip" :class="point.band === 'B1' ? 'chip--jade' : point.band === 'B2' ? 'chip--violet' : 'chip--amber'">{{ point.band }}</span>
          <span class="chip chip--plain zh">{{ isNew ? '新文法點' : '複習' }}</span>
          <span class="dim num">#{{ point.order }}/30</span>
        </div>

        <header class="gram__head">
          <h1 class="gram__title zh">{{ point.title }}</h1>
          <div class="gram__pattern">{{ point.pattern }}</div>
        </header>

        <section v-if="studio?.model" class="card model">
          <template v-if="studio.model.kind === 'timeline'">
            <TenseTimeline :tense="studio.model.tense" />
            <p class="model__cap zh"><b>{{ TENSES[studio.model.tense].label }}</b> — {{ TENSES[studio.model.tense].hint }}</p>
          </template>
          <SentenceSlots v-else :slots="studio.model.slots" />
        </section>

        <p class="gram__summary zh">{{ point.summary }}</p>

        <template v-if="showFull">
          <section class="card card--pad gram__explain">
            <p v-for="(p, i) in point.explain" :key="i" class="zh" v-html="inlineMd(p)" />
          </section>

          <section class="stack stack-3">
            <div class="eyebrow">例句</div>
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
            <div class="pit__head zh">⚠️ 台灣人最常錯的地方</div>
            <ul class="pit__list">
              <li v-for="(p, i) in point.pitfalls" :key="i" class="zh" v-html="inlineMd(p)" />
            </ul>
          </section>
        </template>
        <button v-else class="btn btn--ghost btn--sm zh" @click="showFull = true">看完整說明</button>

        <button class="btn btn--primary btn--block zh" @click="startPractice">{{ isNew ? '開始練習' : '開始複習' }}</button>
        <button class="btn btn--quiet btn--sm gram__skip zh" @click="skipPhase">跳過這個階段</button>
      </template>

      <!-- ================= PRACTICE / MIX ================= -->
      <template v-else-if="(stage === 'practice' || stage === 'mix') && item">
        <div class="phase">
          <span class="chip zh" :class="stage === 'mix' ? 'chip--rose' : 'chip--violet'">{{ stage === 'mix' ? '🎲 混合挑戰' : '練習' }}</span>
          <span class="dim zh">{{ stage === 'mix' ? '每題可能考不同的文法，先想「這題考什麼」' : point.title.split('：')[0] }}</span>
        </div>
        <GrammarGame :key="stage + idx" :item="item" :seed="daySeed + idx" :show-point="stage === 'mix'" @answer="onAnswer" @next="next" />
      </template>

      <!-- ================= RESULT ================= -->
      <section v-else-if="stage === 'result'" class="res">
        <Stamp :ratio="pct / 100" :size="124" />
        <div class="res__title kai">{{ point.title.split('：')[0] }}</div>
        <p class="res__line zh">今天這個文法點：{{ todayCorrect }} / {{ todayResults.length }}</p>
        <div v-if="mixByPoint.length" class="mixres">
          <div class="eyebrow">混合挑戰</div>
          <div v-for="m in mixByPoint" :key="m.id" class="mixres__row" :class="{ 'mixres__row--bad': m.right < m.total }">
            <span class="zh">{{ m.title }}</span>
            <span class="num">{{ m.right }}/{{ m.total }}</span>
          </div>
          <p class="res__note zh">紅色的文法點被你和別的規則搞混了，明天會先回來。</p>
        </div>
        <button class="btn btn--primary btn--block zh" @click="done">下一關</button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.gram { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6)); }
.phase { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--step--2); justify-content: space-between; }

.disc { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); border-top: 3px solid var(--amber); }
.disc__s { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); padding: var(--sp-2) 0; border-bottom: 1px dashed var(--rule); }
.disc__s:last-child { border-bottom: none; }
.disc__en { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.45; }
.disc__q { font-size: var(--step-1); font-weight: 700; line-height: 1.5; }
.disc__opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.dopt { min-height: 52px; padding: var(--sp-2) var(--sp-4); border-radius: var(--radius); border: 1.5px solid var(--rule-strong); background: var(--surface); text-align: left; font-size: var(--step-0); line-height: 1.45; }
.dopt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade-ink); }
.dopt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.dopt--mute { opacity: 0.4; }
.disc__why { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); line-height: 1.7; font-size: var(--step--1); }

.gram__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.gram__title { font-size: var(--step-2); font-weight: 800; line-height: 1.35; text-wrap: balance; line-break: strict; }
.gram__pattern { font-family: var(--font-mono); font-size: var(--step--1); color: var(--jade); background: var(--jade-wash); border: 1px solid var(--jade-edge); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3); align-self: flex-start; }
.gram__summary { font-size: var(--step-0); color: var(--ink-2); line-height: 1.7; }
.model { padding: var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.model__cap { font-size: var(--step--1); color: var(--ink-2); }

.gram__explain { display: flex; flex-direction: column; gap: var(--sp-3); }
.gram__explain p { font-size: var(--step--1); line-height: 1.85; color: var(--ink-2); }
.gram__explain :deep(strong) { color: var(--ink); font-weight: 700; }
.gram__explain :deep(code) { font-family: var(--font-word); font-size: var(--step-0); color: var(--ink); background: var(--surface-2); padding: 1px 5px; border-radius: 4px; }
.gex { background: var(--surface-2); border-radius: var(--radius); padding: var(--sp-3); display: flex; flex-direction: column; gap: 3px; }
.gex__row { display: flex; align-items: flex-start; gap: var(--sp-2); }
.gex__en { flex: 1; font-family: var(--font-word); font-size: var(--step-1); line-height: 1.45; }
.gex__zh { font-size: var(--step--1); color: var(--ink-2); }
.gex__note { font-size: var(--step--2); color: var(--ink-3); font-style: italic; }
.pit { border: 1px solid var(--rose-edge); background: var(--rose-wash); border-radius: var(--radius); padding: var(--sp-3) var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); }
.pit__head { color: var(--rose); font-weight: 700; font-size: var(--step--1); }
.pit__list { display: flex; flex-direction: column; gap: var(--sp-2); }
.pit__list li { font-size: var(--step--1); line-height: 1.7; color: var(--ink-2); }
.pit__list :deep(code) { font-family: var(--font-word); background: var(--surface); padding: 1px 5px; border-radius: 4px; color: var(--ink); }
.gram__skip { align-self: center; }

.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-6) 0 var(--sp-4); text-align: center; }
.res__ring { width: 118px; height: 118px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--jade) calc(var(--pct) * 1%), var(--surface-3) 0); position: relative; }
.res__ring::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--paper); }
.res__pct { position: relative; z-index: 1; font-size: var(--step-3); font-weight: 600; }
.res__pct small { font-size: var(--step-0); color: var(--ink-3); }
.res__title { font-size: var(--step-1); font-weight: 700; }
.res__line { font-size: var(--step-0); color: var(--ink-2); }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.7; }
.mixres { width: 100%; display: flex; flex-direction: column; gap: 6px; text-align: left; margin: var(--sp-2) 0; }
.mixres__row { display: flex; justify-content: space-between; padding: var(--sp-2) var(--sp-3); border-radius: var(--radius-sm); background: var(--jade-wash); font-size: var(--step--1); }
.mixres__row--bad { background: var(--rose-wash); color: var(--rose); }
</style>
