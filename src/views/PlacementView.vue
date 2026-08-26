<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useToast } from '@/stores/toast'
import AudioButton from '@/components/AudioButton.vue'

/**
 * Placement test.
 *
 * NGSL rank 1-100 is `be, and, of, to, a, in…`. Starting a learner who already
 * knows ~450 words at rank 1 wastes weeks. This binary-searches the frequency
 * list for the point where recognition falls off, in six rounds of eight words
 * — about four minutes — and then offers three ways to use the result.
 */

const ROUNDS = 6
const PER_ROUND = 8
const KNOWN_THRESHOLD = 0.7

const words = useWords()
const progress = useProgress()
const router = useRouter()
const toast = useToast()

const stage = ref('intro')       // intro | testing | result
const round = ref(0)
const lo = ref(1)
const hi = ref(2801)
const queue = ref([])
const index = ref(0)
const answers = ref([])          // { id, known }
const applying = ref(false)

const probe = computed(() => Math.round((lo.value + hi.value) / 2))
const current = computed(() => queue.value[index.value] || null)
const totalAsked = computed(() => round.value * PER_ROUND + index.value)
const totalPlanned = ROUNDS * PER_ROUND

function sampleAround (center, n) {
  const span = 140
  const from = Math.max(1, center - span)
  const to = Math.min(2801, center + span)
  const picked = new Set()
  const out = []
  let guard = 0
  while (out.length < n && guard++ < 400) {
    const id = from + Math.floor(Math.random() * (to - from + 1))
    if (picked.has(id)) continue
    const w = words.get(id)
    // Function words are recognised by everyone and tell us nothing.
    if (!w || w.headword.length < 3) continue
    picked.add(id)
    out.push(w)
  }
  return out
}

function beginRound () {
  queue.value = sampleAround(probe.value, PER_ROUND)
  index.value = 0
}

function start () {
  stage.value = 'testing'
  round.value = 0
  lo.value = 1
  hi.value = 2801
  answers.value = []
  beginRound()
}

function answer (known) {
  const w = current.value
  if (!w) return
  answers.value.push({ id: w.id, known })

  if (index.value + 1 < queue.value.length) {
    index.value++
    return
  }

  // Round complete — narrow the range.
  const roundAnswers = answers.value.slice(-PER_ROUND)
  const ratio = roundAnswers.filter(a => a.known).length / roundAnswers.length
  if (ratio >= KNOWN_THRESHOLD) lo.value = probe.value
  else hi.value = probe.value

  round.value++
  if (round.value >= ROUNDS || hi.value - lo.value < 60) {
    stage.value = 'result'
  } else {
    beginRound()
  }
}

const frontier = computed(() => Math.max(50, Math.min(2600, lo.value)))
const knownCount = computed(() => answers.value.filter(a => a.known).length)

const options = computed(() => [
  {
    key: 'safe',
    title: '從第 1 個字開始',
    desc: '完全不跳過。最紮實，但前兩週會複習到 be / and / the 這類你早就會的字。',
    startAt: 1,
    prefill: 0
  },
  {
    key: 'balanced',
    title: `從第 ${frontier.value} 個字開始，前面排入快速驗證`,
    desc: `第 1-${frontier.value} 字直接標記為已學，但會在未來 3-10 天內陸續出現一次做確認。忘記的會自動掉回正常複習。`,
    startAt: frontier.value,
    prefill: frontier.value,
    recommended: true
  },
  {
    key: 'fast',
    title: `完全跳過前 ${frontier.value} 個字`,
    desc: '前面的字排到 30 天後才驗證。省時間，但如果測驗高估了你的程度，這些洞要更久才會被發現。',
    startAt: frontier.value,
    prefill: frontier.value,
    interval: 30
  }
])

async function apply (opt) {
  applying.value = true
  try {
    if (opt.prefill > 0) {
      const ids = []
      for (let id = 1; id <= opt.prefill; id++) ids.push(id)
      // Stagger the verification dates so they do not all land on one day.
      const base = opt.interval ?? 3
      const spread = opt.interval ? 14 : 7
      const chunk = Math.ceil(ids.length / spread)
      for (let d = 0; d < spread; d++) {
        const slice = ids.slice(d * chunk, (d + 1) * chunk)
        if (slice.length) progress.markKnown(slice, { intervalDays: base + d })
      }
    }
    // Words the test proved unknown go back in the normal queue regardless.
    const missed = answers.value.filter(a => !a.known).map(a => a.id)
    if (missed.length) {
      const next = new Map(progress.cards)
      for (const id of missed) next.delete(id)
      progress.cards = next
    }
    localStorage.setItem('ngsl.placed', '1')
    await progress.flush()
    toast.info('分級完成，開始今天的第一關')
    router.push('/')
  } finally {
    applying.value = false
  }
}

function skip () {
  localStorage.setItem('ngsl.placed', '1')
  router.push('/')
}

onMounted(() => { if (!words.enriched.size) words.hydrate() })
</script>

<template>
  <main class="place">
    <!-- ---------------- intro ---------------- -->
    <section v-if="stage === 'intro'" class="pane">
      <div class="eyebrow">Step 1 of 1</div>
      <h1 class="page-title zh">先測一下你的起點</h1>
      <p class="lead zh">
        NGSL 的第 1 到 100 個字是 <em>be</em>、<em>and</em>、<em>of</em>、<em>to</em> 這類你早就會的字。
        直接從第 1 個開始複習，等於前兩週都在浪費時間。
      </p>
      <p class="lead zh">
        接下來會出現 <strong>48 個字</strong>，每個只要回答「認識 / 不認識」。
        系統會用二分搜尋找出你的字彙邊界，大約 4 分鐘。
      </p>

      <div class="rule-note card card--pad zh">
        <strong>「認識」的標準</strong>：看到這個字，你能立刻說出中文意思。
        不確定、要想很久、或只是「看起來眼熟」——都算不認識。
        誠實作答的結果才有用。
      </div>

      <div class="pane__actions">
        <button class="btn btn--primary btn--block zh" @click="start">開始測驗</button>
        <button class="btn btn--quiet btn--block zh" @click="skip">跳過，從第 1 個字開始</button>
      </div>
    </section>

    <!-- ---------------- testing ---------------- -->
    <section v-else-if="stage === 'testing'" class="pane pane--test">
      <div class="probe">
        <div class="probe__track">
          <div class="probe__fill" :style="{ width: (totalAsked / totalPlanned * 100) + '%' }" />
        </div>
        <div class="probe__meta">
          <span class="num">{{ totalAsked }} / {{ totalPlanned }}</span>
          <span class="dim zh">目前推估：第 {{ probe }} 名附近</span>
        </div>
      </div>

      <div v-if="current" class="probe__card">
        <span class="chip chip--plain">#{{ current.id }}</span>
        <h2 class="probe__word">{{ current.headword }}</h2>
        <AudioButton :text="current.headword" size="md" />
      </div>

      <div class="probe__actions">
        <button class="btn btn--ghost probe__no zh" @click="answer(false)">
          不認識
        </button>
        <button class="btn btn--primary probe__yes zh" @click="answer(true)">
          認識
        </button>
      </div>
      <p class="probe__hint zh">說得出中文意思才算認識</p>
    </section>

    <!-- ---------------- result ---------------- -->
    <section v-else class="pane">
      <div class="eyebrow">Result</div>
      <h1 class="page-title zh">你的字彙邊界大約在第 {{ frontier }} 名</h1>
      <p class="lead zh">
        48 題答對 <strong class="num">{{ knownCount }}</strong> 題。
        以 NGSL 的頻率排序來看，第 {{ frontier }} 名之後的字對你來說開始變得陌生。
      </p>

      <div class="opts">
        <button
          v-for="o in options" :key="o.key"
          class="opt-card"
          :class="{ 'opt-card--rec': o.recommended }"
          :disabled="applying"
          @click="apply(o)"
        >
          <div class="opt-card__top">
            <span class="opt-card__title zh">{{ o.title }}</span>
            <span v-if="o.recommended" class="chip chip--jade">建議</span>
          </div>
          <p class="opt-card__desc zh">{{ o.desc }}</p>
        </button>
      </div>

      <button class="btn btn--quiet btn--block zh" :disabled="applying" @click="start">重測一次</button>
    </section>
  </main>
</template>

<style scoped>
.place {
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: calc(env(safe-area-inset-top) + var(--sp-5)) var(--sp-4) calc(env(safe-area-inset-bottom) + var(--sp-5));
}
.pane {
  width: 100%;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  gap: var(--sp-4);
}
.pane--test { gap: var(--sp-5); }

.lead { font-size: var(--step-0); color: var(--ink-2); line-height: 1.7; }
.lead em { font-family: var(--font-word); font-style: normal; font-weight: 600; color: var(--ink); }
.lead strong { color: var(--ink); font-weight: 700; }

.rule-note {
  font-size: var(--step--1);
  color: var(--ink-2);
  line-height: 1.75;
  border-left: 3px solid var(--amber);
  background: var(--amber-wash);
  border-color: var(--amber-edge);
}
.rule-note strong { color: var(--amber); display: block; margin-bottom: 4px; }

.pane__actions { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); }

/* --- testing --- */
.probe { display: flex; flex-direction: column; gap: var(--sp-2); }
.probe__track { height: 4px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.probe__fill { height: 100%; background: var(--jade); transition: width 0.3s ease; }
.probe__meta {
  display: flex; justify-content: space-between; align-items: baseline;
  font-size: var(--step--2); color: var(--ink-3);
}

.probe__card {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--jade);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  padding: var(--sp-7) var(--sp-4);
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-4);
  min-height: 240px;
  justify-content: center;
}
.probe__word {
  font-family: var(--font-word);
  font-size: clamp(2.2rem, 11vw, 3rem);
  font-weight: 500;
  line-height: 1.1;
  text-align: center;
  word-break: break-word;
}

.probe__actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.probe__no, .probe__yes { min-height: 56px; font-size: var(--step-1); }
.probe__hint { text-align: center; font-size: var(--step--2); color: var(--ink-3); }

/* --- result --- */
.opts { display: flex; flex-direction: column; gap: var(--sp-3); }
.opt-card {
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
  transition: border-color 0.15s, transform 0.1s;
}
.opt-card:active:not(:disabled) { transform: scale(0.99); }
.opt-card--rec { border-color: var(--jade); background: var(--jade-wash); }
.opt-card:disabled { opacity: 0.5; }

.opt-card__top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); }
.opt-card__title { font-size: var(--step-0); font-weight: 700; line-height: 1.35; }
.opt-card__desc { font-size: var(--step--1); color: var(--ink-2); line-height: 1.65; }
</style>
