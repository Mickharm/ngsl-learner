<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { testConnection } from '@/lib/gemini'
import AudioButton from '@/components/AudioButton.vue'

/**
 * Placement test.
 *
 * NGSL rank 1-100 is `be, and, of, to, a, in…`. Starting a learner who already
 * knows ~450 words at rank 1 wastes weeks. This binary-searches the frequency
 * list for the point where recognition falls off, in six rounds of eight words.
 *
 * Every answer is followed by the Chinese meaning. Self-assessment without
 * feedback is worthless here — a learner who *thinks* they know a word and is
 * wrong would push the estimated frontier too high and skip words they need.
 * Seeing the answer lets them correct themselves, and the correction is the
 * one that counts.
 */

const ROUNDS = 6
const PER_ROUND = 8
const KNOWN_THRESHOLD = 0.7

const words = useWords()
const progress = useProgress()
const settings = useSettings()
const router = useRouter()
const toast = useToast()

const stage = ref('intro')       // intro | testing | result
const round = ref(0)
const lo = ref(1)
const hi = ref(2801)
const queue = ref([])
const index = ref(0)
const answers = ref([])          // { id, known, corrected }
const applying = ref(false)
const revealed = ref(false)
const claimed = ref(null)        // what they pressed before seeing the answer
const loadingRound = ref(false)
const roundError = ref('')

/* ---- Gemini key, collected here so the test can show meanings ---- */
const keyInput = ref('')
const keyBusy = ref(false)
const keyError = ref('')

const probe = computed(() => Math.round((lo.value + hi.value) / 2))
const current = computed(() => queue.value[index.value] || null)
const totalAsked = computed(() => round.value * PER_ROUND + index.value)
const totalPlanned = ROUNDS * PER_ROUND

const meaning = computed(() => current.value?.meanings?.[0]?.zh || '')
const example = computed(() => current.value?.examples?.[0] || null)

async function saveKey () {
  keyBusy.value = true
  keyError.value = ''
  try {
    await testConnection({ key: keyInput.value.trim(), model: settings.state.geminiModel })
    settings.set({ geminiKey: keyInput.value.trim() })
    toast.info('API Key 已儲存')
  } catch (e) {
    keyError.value = e.message
  } finally {
    keyBusy.value = false
  }
}

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

/** Fetch translations for this round's words so the answer can be shown. */
async function beginRound () {
  loadingRound.value = true
  roundError.value = ''
  const picks = sampleAround(probe.value, PER_ROUND)
  try {
    if (settings.hasGeminiKey) {
      await words.ensureEnriched(picks.map(w => w.id))
    }
  } catch (e) {
    roundError.value = e?.message || '無法取得中文解釋，這一輪只能靠自我判斷。'
  } finally {
    // re-read so the enriched fields are attached
    queue.value = picks.map(w => words.get(w.id))
    index.value = 0
    revealed.value = false
    claimed.value = null
    loadingRound.value = false
  }
}

async function start () {
  stage.value = 'testing'
  round.value = 0
  lo.value = 1
  hi.value = 2801
  answers.value = []
  await beginRound()
}

/** First tap: record the claim, then show the meaning. */
function claim (known) {
  if (revealed.value) return
  claimed.value = known
  revealed.value = true
}

/** Second tap: commit, optionally overriding the claim after seeing the answer. */
async function commit (known = claimed.value) {
  const w = current.value
  if (!w) return
  answers.value.push({ id: w.id, known, corrected: known !== claimed.value })

  if (index.value + 1 < queue.value.length) {
    index.value++
    revealed.value = false
    claimed.value = null
    return
  }

  const roundAnswers = answers.value.slice(-PER_ROUND)
  const ratio = roundAnswers.filter(a => a.known).length / roundAnswers.length
  if (ratio >= KNOWN_THRESHOLD) lo.value = probe.value
  else hi.value = probe.value

  round.value++
  if (round.value >= ROUNDS || hi.value - lo.value < 60) stage.value = 'result'
  else await beginRound()
}

const frontier = computed(() => Math.max(50, Math.min(2600, lo.value)))
const knownCount = computed(() => answers.value.filter(a => a.known).length)
const correctedCount = computed(() => answers.value.filter(a => a.corrected).length)

const options = computed(() => [
  {
    key: 'safe',
    title: '從第 1 個字開始',
    desc: '完全不跳過。最紮實，但前兩週會複習到 be / and / the 這類你早就會的字。',
    prefill: 0
  },
  {
    key: 'balanced',
    title: `從第 ${frontier.value} 個字開始，前面排入快速驗證`,
    desc: `第 1-${frontier.value} 字直接標記為已學，但會在未來 3-10 天內陸續出現一次做確認。忘記的會自動掉回正常複習。`,
    prefill: frontier.value,
    recommended: true
  },
  {
    key: 'fast',
    title: `完全跳過前 ${frontier.value} 個字`,
    desc: '前面的字排到 30 天後才驗證。省時間，但如果測驗高估了你的程度，這些洞要更久才會被發現。',
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

onMounted(() => {
  if (!words.enriched.size) words.hydrate()
  keyInput.value = settings.state.geminiKey || ''
})

watch(() => current.value?.id, () => { revealed.value = false; claimed.value = null })
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
        接下來會出現 <strong>48 個字</strong>。每個字先回答「認識 / 不認識」，
        <strong>然後立刻顯示中文答案</strong>——如果你答了認識但其實記錯，可以當場改掉。
        大約 5 分鐘。
      </p>

      <div class="rule-note card card--pad zh">
        <strong>「認識」的標準</strong>：看到這個字，你能立刻說出中文意思。
        不確定、要想很久、或只是「看起來眼熟」——都算不認識。
        測驗會顯示答案讓你核對，誠實作答的結果才有用。
      </div>

      <!-- key setup, inline so the flow is not interrupted -->
      <div v-if="!settings.hasGeminiKey" class="keybox card card--pad">
        <div class="keybox__head zh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8.5v5M12 16.8v.2" /><circle cx="12" cy="12" r="9" /></svg>
          需要 Gemini API Key 才能顯示中文答案
        </div>
        <p class="keybox__desc zh">
          中文翻譯與例句是即時產生的。現在貼上 Key，測驗就能核對答案；
          先跳過的話，測驗只能靠你自己判斷。
        </p>
        <input
          v-model="keyInput" class="input input--mono" type="password"
          autocomplete="off" autocapitalize="none" spellcheck="false"
          placeholder="貼上你的 Gemini API Key"
        >
        <p v-if="keyError" class="keybox__err zh">{{ keyError }}</p>
        <button
          class="btn btn--primary btn--block zh"
          :disabled="!keyInput.trim() || keyBusy"
          @click="saveKey"
        >{{ keyBusy ? '測試中…' : '儲存並測試連線' }}</button>
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

      <div v-if="loadingRound" class="probe__card probe__card--loading">
        <div class="spinner"><span /><span /><span /></div>
        <p class="dim zh">準備下一組單字…</p>
      </div>

      <template v-else-if="current">
        <div class="probe__card" :class="revealed ? (claimed ? 'probe__card--claimed' : 'probe__card--unknown') : ''">
          <span class="chip chip--plain">#{{ current.id }}</span>
          <h2 class="probe__word">{{ current.headword }}</h2>
          <AudioButton :text="current.headword" size="md" />

          <Transition name="slide-up">
            <div v-if="revealed" class="answer">
              <div class="hr" />
              <p v-if="meaning" class="answer__zh zh">{{ meaning }}</p>
              <p v-else class="answer__none zh">
                {{ settings.hasGeminiKey ? '這個字的中文還沒產生出來' : '未設定 API Key，無法顯示中文' }}
              </p>
              <p v-if="current.ipa" class="answer__ipa num">{{ current.ipa }}</p>
              <div v-if="example" class="answer__ex">
                <p class="answer__en">{{ example.en }}</p>
                <p class="answer__exzh zh">{{ example.zh }}</p>
              </div>
            </div>
          </Transition>
        </div>

        <!-- before the reveal -->
        <div v-if="!revealed" class="probe__actions">
          <button class="btn btn--ghost probe__no zh" @click="claim(false)">不認識</button>
          <button class="btn btn--primary probe__yes zh" @click="claim(true)">認識</button>
        </div>

        <!-- after the reveal: confirm, or take it back -->
        <div v-else class="probe__confirm">
          <p class="probe__verdict zh" :class="claimed ? 'probe__verdict--yes' : 'probe__verdict--no'">
            {{ claimed ? '你說認識 — 對照一下，真的記對了嗎？' : '你說不認識 — 這個字會排進學習清單' }}
          </p>
          <button class="btn btn--primary btn--block zh" @click="commit()">
            {{ claimed ? '對，我本來就知道' : '知道了，下一個' }}
          </button>
          <button
            v-if="claimed"
            class="btn btn--ghost btn--block zh"
            @click="commit(false)"
          >其實我記錯了，算不認識</button>
          <button
            v-else
            class="btn btn--quiet btn--sm btn--block zh"
            @click="commit(true)"
          >啊，這個我其實會 — 改成認識</button>
        </div>

        <p v-if="roundError" class="probe__warn zh">{{ roundError }}</p>
      </template>
    </section>

    <!-- ---------------- result ---------------- -->
    <section v-else class="pane">
      <div class="eyebrow">Result</div>
      <h1 class="page-title zh">你的字彙邊界大約在第 {{ frontier }} 名</h1>
      <p class="lead zh">
        48 題中認得 <strong class="num">{{ knownCount }}</strong> 個。
        以 NGSL 的頻率排序來看，第 {{ frontier }} 名之後的字對你來說開始變得陌生。
      </p>
      <p v-if="correctedCount" class="lead zh dim">
        其中 <strong class="num">{{ correctedCount }}</strong> 題在看到中文後被你自己改掉——
        這正是這個測驗要抓的東西。
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
.pane--test { gap: var(--sp-4); }

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

/* key setup */
.keybox { display: flex; flex-direction: column; gap: var(--sp-3); border-color: var(--jade-edge); }
.keybox__head {
  display: flex; align-items: center; gap: 6px;
  font-size: var(--step--1); font-weight: 700; color: var(--jade);
}
.keybox__head svg { width: 16px; height: 16px; flex-shrink: 0; }
.keybox__desc { font-size: var(--step--2); color: var(--ink-2); line-height: 1.7; }
.keybox__err {
  font-size: var(--step--2); color: var(--rose);
  background: var(--rose-wash); border-radius: var(--radius-sm);
  padding: var(--sp-2); line-height: 1.6;
}

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
  border-top: 3px solid var(--rule-strong);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  padding: var(--sp-6) var(--sp-4) var(--sp-5);
  display: flex; flex-direction: column; align-items: center; gap: var(--sp-3);
  min-height: 220px;
  justify-content: center;
  transition: border-top-color 0.25s ease;
}
.probe__card--claimed { border-top-color: var(--jade); }
.probe__card--unknown { border-top-color: var(--amber); }
.probe__card--loading { gap: var(--sp-4); }

.probe__word {
  font-family: var(--font-word);
  font-size: clamp(2rem, 10vw, 2.8rem);
  font-weight: 500;
  line-height: 1.1;
  text-align: center;
  word-break: break-word;
}

/* revealed answer */
.answer { width: 100%; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.answer .hr { width: 100%; margin-bottom: var(--sp-1); }
.answer__zh { font-size: var(--step-2); font-weight: 600; text-align: center; line-height: 1.45; }
.answer__none { font-size: var(--step--1); color: var(--ink-3); text-align: center; }
.answer__ipa { font-size: var(--step--1); color: var(--ink-2); }
.answer__ex {
  width: 100%;
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: 3px;
  margin-top: var(--sp-1);
}
.answer__en { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; }
.answer__exzh { font-size: var(--step--2); color: var(--ink-2); }

.probe__actions { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.probe__no, .probe__yes { min-height: 56px; font-size: var(--step-1); }

.probe__confirm { display: flex; flex-direction: column; gap: var(--sp-2); }
.probe__verdict { font-size: var(--step--1); text-align: center; line-height: 1.6; }
.probe__verdict--yes { color: var(--jade); }
.probe__verdict--no { color: var(--amber); }

.probe__warn {
  font-size: var(--step--2); color: var(--amber);
  background: var(--amber-wash); border-radius: var(--radius-sm);
  padding: var(--sp-2); text-align: center; line-height: 1.6;
}

.spinner { display: flex; gap: 6px; }
.spinner span {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--jade); animation: bounce 1.1s ease-in-out infinite;
}
.spinner span:nth-child(2) { animation-delay: 0.14s; }
.spinner span:nth-child(3) { animation-delay: 0.28s; }
@keyframes bounce {
  0%, 70%, 100% { transform: translateY(0); opacity: 0.4; }
  35% { transform: translateY(-7px); opacity: 1; }
}

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
