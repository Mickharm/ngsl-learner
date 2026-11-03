<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import STORIES, { LEVEL_LABEL } from '@/data/stories'
import { shuffle, scramble } from '@/lib/game'
import { speak, stopSpeaking } from '@/lib/tts'
import SessionHeader from '@/components/SessionHeader.vue'
import AudioButton from '@/components/AudioButton.vue'
import TappableText from '@/components/TappableText.vue'
import WordPopover from '@/components/WordPopover.vue'

/**
 * Story Time — read a short illustrated story at your level, then play with it.
 *
 *   READ      one page at a time: a picture scene, English lines (Chinese
 *             hidden until asked for — read first, check second), tap any
 *             word for its meaning, "讀給我聽" reads the page aloud line by
 *             line (repeated, listening-while-reading is how fluency starts).
 *   SEQUENCE  the pages' scenes shuffled — put the story back in order.
 *   QUIZ      three questions: a detail, a reason, an inference.
 *   HUNT      tap the five target words in the story text.
 *
 * Progress (stars per story) is kept on the device; the phase only needs to
 * know that a story was finished today.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const auth = useAuth()
const router = useRouter()
const route = useRoute()

const LS = () => `ngsl.stories.${auth.userId || 'anon'}`
function readDone () { try { return JSON.parse(localStorage.getItem(LS()) || '{}') } catch { return {} } }
const done = ref(readDone())
function saveDone () { try { localStorage.setItem(LS(), JSON.stringify(done.value)) } catch { /* ignore */ } }

const inPhase = computed(() => route.query.phase === '1')

/** The learner's level by how many words they have met. */
const myLevel = computed(() => {
  const seen = progress.stats.seen
  return seen >= 1800 ? 3 : seen >= 900 ? 2 : 1
})
const recommended = computed(() =>
  STORIES.find(s => s.level <= myLevel.value && !done.value[s.id]) ||
  STORIES.find(s => !done.value[s.id]) || STORIES[0]
)

const story = ref(null)
const stage = ref('hub')        // hub | read | seq | quiz | hunt | result
const page = ref(0)
const showZh = ref(new Set())
const readingLine = ref(-1)

/* sequence */
const seqBank = ref([])
const seqBuilt = ref([])
const seqDone = ref(false)
const seqMistakes = ref(0)

/* quiz */
const qIdx = ref(0)
const qPicked = ref(null)
const qRight = ref(0)
const qOrder = ref([])

/* hunt */
const huntFound = ref(new Set())
const huntWrong = ref(0)

/* popover */
const popWord = ref(null)
const popRect = ref(null)
const popLoading = ref(false)
const popError = ref('')

const pageObj = computed(() => story.value?.pages[page.value] || null)

function open (s) {
  story.value = s
  page.value = 0
  showZh.value = new Set()
  stage.value = 'read'
}

function toggleZh (i) {
  const k = `${page.value}:${i}`
  const n = new Set(showZh.value)
  n.has(k) ? n.delete(k) : n.add(k)
  showZh.value = n
}

let reading = false
async function readPage () {
  if (reading) { stopSpeaking(); reading = false; readingLine.value = -1; return }
  reading = true
  for (let i = 0; i < pageObj.value.lines.length && reading; i++) {
    readingLine.value = i
    await speak(pageObj.value.lines[i].en, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
  }
  reading = false
  readingLine.value = -1
}

function nextPage () {
  stopSpeaking(); reading = false; readingLine.value = -1
  if (page.value + 1 < story.value.pages.length) page.value++
  else startSeq()
}
function prevPage () { if (page.value > 0) page.value-- }

/* ---- word taps ---- */
function glossFor (surface) {
  const k = String(surface).toLowerCase()
  const g = Object.entries(story.value?.gloss || {}).find(([w]) => k.startsWith(w))
  return g ? { headword: g[0], meanings: [{ pos: '', zh: g[1] }], examples: [], adhoc: true } : null
}
async function openWord ({ id, surface, context, rect }) {
  if (stage.value === 'hunt') return hunt(id, surface)
  popRect.value = rect
  popError.value = ''
  const g = glossFor(surface)
  if (g) { popWord.value = g; return }
  if (id) {
    popWord.value = words.get(id)
    if (popWord.value?.enriched || !settings.hasGeminiKey) return
    popLoading.value = true
    try { await words.ensureEnriched([id]); popWord.value = words.get(id) } catch { /* card says it is missing */ } finally { popLoading.value = false }
    return
  }
  const cached = words.glossOf(surface)
  if (cached) { popWord.value = cached; return }
  popWord.value = { headword: surface, meanings: [], examples: [], adhoc: true }
  popLoading.value = true
  try { const e = await words.gloss(surface, context); if (e) popWord.value = e } catch (e) { popError.value = e?.message || '查不到這個字' } finally { popLoading.value = false }
}
function closePop () { popWord.value = null }

/* ---- sequence ---- */
function startSeq () {
  const pages = story.value.pages.map((p, i) => ({ i, scene: p.scene, first: p.lines[0].en }))
  seqBank.value = scramble(pages, story.value.id.length * 17 + Date.now() % 997, p => p.i)
  seqBuilt.value = []
  seqDone.value = false
  seqMistakes.value = 0
  stage.value = 'seq'
}
const seqBad = ref(null)
function seqPick (p) {
  if (seqDone.value) return
  if (p.i === seqBuilt.value.length) {
    seqBuilt.value = [...seqBuilt.value, p]
    seqBank.value = seqBank.value.filter(x => x.i !== p.i)
    if (!seqBank.value.length) seqDone.value = true
  } else {
    seqMistakes.value++
    seqBad.value = p.i
    setTimeout(() => { seqBad.value = null }, 450)
  }
}

/* ---- quiz ---- */
function startQuiz () {
  qIdx.value = 0; qPicked.value = null; qRight.value = 0
  buildQ()
  stage.value = 'quiz'
}
function buildQ () {
  const q = story.value.quiz[qIdx.value]
  qOrder.value = shuffle(q.options.map((_, i) => i), qIdx.value * 13 + story.value.id.charCodeAt(2))
}
const quizQ = computed(() => story.value?.quiz[qIdx.value] || null)
function qPick (k) {
  if (qPicked.value !== null) return
  qPicked.value = k
  if (qOrder.value[k] === quizQ.value.answer) qRight.value++
}
function qNext () {
  if (qIdx.value + 1 < story.value.quiz.length) { qIdx.value++; qPicked.value = null; buildQ() } else startHunt()
}

/* ---- hunt ---- */
const fullText = computed(() => story.value ? story.value.pages.flatMap(p => p.lines.map(l => l.en)).join(' ') : '')
const targetIds = computed(() => (story.value?.words || []).map(w => words.lookup(w) || w))
function startHunt () {
  huntFound.value = new Set()
  huntWrong.value = 0
  stage.value = 'hunt'
}
function hunt (id, surface) {
  const key = id || String(surface).toLowerCase()
  const glossKey = Object.keys(story.value.gloss || {}).find(g => String(surface).toLowerCase().startsWith(g))
  const hit = targetIds.value.find(t => t === key || (glossKey && t === glossKey))
  if (hit !== undefined) {
    huntFound.value = new Set([...huntFound.value, hit])
    if (huntFound.value.size === targetIds.value.length) setTimeout(finish, 600)
  } else {
    huntWrong.value++
  }
}
const huntHighlight = computed(() => [...huntFound.value].filter(x => typeof x === 'number'))

/* ---- result ---- */
const stars = ref(0)
function finish () {
  const quizPart = qRight.value / story.value.quiz.length
  let s = 1
  if (seqMistakes.value <= 1) s++
  if (quizPart >= 0.99 && huntWrong.value <= 2) s++
  stars.value = s
  done.value = { ...done.value, [story.value.id]: Math.max(done.value[story.value.id] || 0, s) }
  saveDone()
  stage.value = 'result'
  if (inPhase.value) session.markDone('read')
}

function leave () {
  if (inPhase.value) router.push(session.nextRoute('read'))
  else { stage.value = 'hub'; story.value = null }
}
function skipPhase () { session.markDone('read'); router.push(session.nextRoute('read')) }

onMounted(() => {
  session.startClock()
  if (inPhase.value && recommended.value) open(recommended.value)
})
onUnmounted(() => { session.stopClock(); stopSpeaking() })
</script>

<template>
  <div class="view">
    <SessionHeader
      :title="story ? story.title : '故事屋'"
      :current="stage === 'read' ? page + 1 : 0"
      :total="stage === 'read' && story ? story.pages.length : 0"
      :exit-to="inPhase ? '/' : '/story'"
    />

    <main class="shell story">
      <!-- ================= HUB ================= -->
      <template v-if="stage === 'hub'">
        <p class="hub__lead zh">短短的圖文故事，<b>幾乎每個字你都學過</b>——讀完玩三個小遊戲。</p>
        <button v-if="recommended" class="rec card" @click="open(recommended)">
          <span class="rec__cover" aria-hidden="true">{{ recommended.cover }}</span>
          <span class="rec__body">
            <span class="eyebrow">推薦你讀</span>
            <span class="rec__title">{{ recommended.title }}</span>
            <span class="rec__zh zh">{{ recommended.title_zh }} · {{ LEVEL_LABEL[recommended.level] }}</span>
          </span>
        </button>
        <div v-for="lvl in [1, 2, 3]" :key="lvl" class="shelf">
          <div class="shelf__head"><span class="chip" :class="lvl === 1 ? 'chip--jade' : lvl === 2 ? 'chip--violet' : 'chip--amber'">{{ LEVEL_LABEL[lvl] }}</span></div>
          <div class="shelf__row">
            <button v-for="s in STORIES.filter(x => x.level === lvl)" :key="s.id" class="book" @click="open(s)">
              <span class="book__cover" aria-hidden="true">{{ s.cover }}</span>
              <span class="book__title">{{ s.title }}</span>
              <span class="book__stars">{{ '★'.repeat(done[s.id] || 0) }}<span class="dim">{{ '☆'.repeat(3 - (done[s.id] || 0)) }}</span></span>
            </button>
          </div>
        </div>
        <RouterLink v-if="settings.hasGeminiKey" to="/article" class="btn btn--ghost btn--block zh">讀今天的 AI 短文（用今天的單字生成）</RouterLink>
      </template>

      <!-- ================= READ ================= -->
      <template v-else-if="stage === 'read' && pageObj">
        <div class="scene card" aria-hidden="true">{{ pageObj.scene }}</div>
        <div class="lines">
          <div v-for="(l, i) in pageObj.lines" :key="i" class="line" :class="{ 'line--on': readingLine === i }">
            <div class="line__row">
              <TappableText :text="l.en" @word="openWord" />
              <AudioButton :text="l.en" size="sm" />
            </div>
            <button class="line__zh zh" @click="toggleZh(i)">{{ showZh.has(`${page}:${i}`) ? l.zh : '中文' }}</button>
          </div>
        </div>
        <div class="readbar">
          <button class="btn btn--ghost btn--sm zh" :disabled="page === 0" @click="prevPage">上一頁</button>
          <button class="btn btn--ghost btn--sm zh" @click="readPage">🔊 讀給我聽</button>
          <button class="btn btn--primary btn--sm zh" @click="nextPage">{{ page + 1 < story.pages.length ? '下一頁' : '讀完了！' }}</button>
        </div>
        <p class="hint zh">點任何一個英文字可以看意思。先讀英文，看不懂再點「中文」。</p>
        <button v-if="inPhase" class="btn btn--quiet btn--sm story__skip zh" @click="skipPhase">跳過這個階段</button>
      </template>

      <!-- ================= SEQUENCE ================= -->
      <template v-else-if="stage === 'seq'">
        <div class="phase"><span class="chip chip--amber zh">🧩 排順序</span><span class="dim zh">照故事發生的順序點圖</span></div>
        <div class="seqbuilt">
          <div v-for="(p, k) in seqBuilt" :key="p.i" class="seqcard seqcard--on">
            <span class="seqcard__n num">{{ k + 1 }}</span><span class="seqcard__scene">{{ p.scene }}</span><span class="seqcard__line">{{ p.first }}</span>
          </div>
        </div>
        <div class="seqbank">
          <button v-for="p in seqBank" :key="p.i" class="seqcard" :class="{ 'seqcard--bad': seqBad === p.i }" @click="seqPick(p)">
            <span class="seqcard__scene">{{ p.scene }}</span><span class="seqcard__line">{{ p.first }}</span>
          </button>
        </div>
        <button v-if="seqDone" class="btn btn--primary btn--block zh" @click="startQuiz">排好了！下一個遊戲</button>
      </template>

      <!-- ================= QUIZ ================= -->
      <template v-else-if="stage === 'quiz' && quizQ">
        <div class="phase"><span class="chip chip--violet zh">❓ 理解題</span><span class="dim num">{{ qIdx + 1 }}/{{ story.quiz.length }}</span></div>
        <section class="card qcard">
          <p class="qcard__q">{{ quizQ.q }}</p>
          <p class="qcard__zh zh">{{ quizQ.q_zh }}</p>
        </section>
        <div class="qopts">
          <button
            v-for="(oi, k) in qOrder" :key="oi"
            class="qopt"
            :class="{ 'qopt--right': qPicked !== null && oi === quizQ.answer, 'qopt--wrong': qPicked === k && oi !== quizQ.answer, 'qopt--mute': qPicked !== null && qPicked !== k && oi !== quizQ.answer }"
            :disabled="qPicked !== null"
            @click="qPick(k)"
          >{{ quizQ.options[oi] }}</button>
        </div>
        <div v-if="qPicked !== null" class="card qfb">
          <p class="zh">{{ quizQ.explain_zh }}</p>
          <button class="btn btn--primary btn--block zh" @click="qNext">繼續</button>
        </div>
      </template>

      <!-- ================= HUNT ================= -->
      <template v-else-if="stage === 'hunt'">
        <div class="phase"><span class="chip chip--jade zh">🔎 找單字</span><span class="dim zh">在故事裡點出下面這些字</span></div>
        <div class="targets">
          <span v-for="(w, k) in story.words" :key="w" class="target" :class="{ 'target--found': huntFound.has(targetIds[k]) }">{{ w }}</span>
        </div>
        <section class="card huntbox">
          <TappableText :text="fullText" :highlight-ids="huntHighlight" @word="openWord" />
        </section>
        <p class="hint zh">變化形也算（went 算 go）。點錯 <span class="num">{{ huntWrong }}</span> 次</p>
        <button class="btn btn--quiet btn--sm story__skip zh" @click="finish">找不到，直接結算</button>
      </template>

      <!-- ================= RESULT ================= -->
      <section v-else-if="stage === 'result'" class="res">
        <div class="res__cover" aria-hidden="true">{{ story.cover }}</div>
        <div class="res__stars">{{ '★'.repeat(stars) }}<span class="dim">{{ '☆'.repeat(3 - stars) }}</span></div>
        <h2 class="res__title">{{ story.title }}</h2>
        <p class="res__line zh">排順序錯 {{ seqMistakes }} 次 · 理解題 {{ qRight }}/{{ story.quiz.length }} · 找字錯 {{ huntWrong }} 次</p>
        <p class="res__note zh">同一篇故事隔幾天再讀一次，會比讀新的更有效——第二次讀得懂的地方，就是你真的學會的地方。</p>
        <button class="btn btn--primary btn--block zh" @click="leave">{{ inPhase ? '下一關' : '回故事屋' }}</button>
      </section>
    </main>

    <WordPopover :word="popWord" :rect="popRect" :loading="popLoading" :error="popError" @close="closePop" />
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.story { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6)); }
.story__skip { align-self: center; }
.phase { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2); font-size: var(--step--2); }
.hint { font-size: var(--step--2); color: var(--ink-3); text-align: center; }

.hub__lead { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; }
.rec { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4); text-align: left; }
.rec__cover { font-size: 3rem; }
.rec__body { display: flex; flex-direction: column; gap: 2px; }
.rec__title { font-family: var(--font-word); font-size: var(--step-2); font-weight: 600; }
.rec__zh { font-size: var(--step--1); color: var(--ink-3); }
.shelf { display: flex; flex-direction: column; gap: var(--sp-2); }
.shelf__row { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: var(--sp-2); }
.book { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--sp-3) var(--sp-2); background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius); box-shadow: var(--shadow-1); }
.book__cover { font-size: 2.2rem; }
.book__title { font-family: var(--font-word); font-size: var(--step--1); text-align: center; line-height: 1.25; }
.book__stars { font-size: var(--step--1); color: var(--sun-edge); letter-spacing: 1px; }

.scene { font-size: clamp(2.6rem, 14vw, 4rem); text-align: center; padding: var(--sp-5) var(--sp-3); letter-spacing: 0.12em; background: linear-gradient(180deg, var(--surface), var(--surface-2)); }
.lines { display: flex; flex-direction: column; gap: var(--sp-3); }
.line { padding: var(--sp-2) var(--sp-3); border-radius: var(--radius); transition: background 0.2s; }
.line--on { background: var(--amber-wash); }
.line__row { display: flex; align-items: flex-start; gap: var(--sp-2); justify-content: space-between; }
.line__zh { font-size: var(--step--1); color: var(--ink-3); padding: 2px 0; text-align: left; }
.readbar { display: flex; gap: var(--sp-2); justify-content: space-between; }

.seqbuilt, .seqbank { display: flex; flex-direction: column; gap: var(--sp-2); }
.seqbuilt:empty { display: none; }
.seqcard { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3); border-radius: var(--radius); border: 1.5px solid var(--rule-strong); background: var(--surface); text-align: left; }
.seqcard--on { border-color: var(--jade-edge); background: var(--jade-wash); }
.seqcard--bad { border-color: var(--rose); background: var(--rose-wash); animation: shake 0.35s; }
.seqcard__n { width: 24px; height: 24px; border-radius: 50%; background: var(--jade); color: var(--paper); display: grid; place-items: center; font-size: var(--step--2); flex-shrink: 0; }
.seqcard__scene { font-size: 1.6rem; flex-shrink: 0; letter-spacing: 0.05em; }
.seqcard__line { font-family: var(--font-word); font-size: var(--step--1); line-height: 1.35; color: var(--ink-2); }

.qcard { padding: var(--sp-5) var(--sp-4); text-align: center; }
.qcard__q { font-family: var(--font-word); font-size: var(--step-2); }
.qcard__zh { font-size: var(--step--1); color: var(--ink-3); margin-top: 4px; }
.qopts { display: flex; flex-direction: column; gap: var(--sp-2); }
.qopt { min-height: 52px; padding: var(--sp-2) var(--sp-4); border-radius: var(--radius); border: 1.5px solid var(--rule-strong); background: var(--surface); text-align: left; font-family: var(--font-word); font-size: var(--step-1); }
.qopt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade-ink); }
.qopt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.qopt--mute { opacity: 0.4; }
.qfb { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); font-size: var(--step--1); color: var(--ink-2); }

.targets { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.target { padding: 4px 12px; border-radius: 999px; border: 1.5px dashed var(--rule-strong); font-family: var(--font-word); }
.target--found { border-style: solid; border-color: var(--jade); background: var(--jade-wash); color: var(--jade-ink); text-decoration: line-through; }
.huntbox { padding: var(--sp-4); }

.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding-top: var(--sp-6); }
.res__cover { font-size: 4rem; }
.res__stars { font-size: var(--step-4); color: var(--sun-edge); letter-spacing: 4px; }
.res__title { font-family: var(--font-word); font-size: var(--step-2); }
.res__line { font-size: var(--step--1); color: var(--ink-2); }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.7; max-width: 34ch; }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
</style>
