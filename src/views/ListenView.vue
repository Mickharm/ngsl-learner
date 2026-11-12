<script setup>
import AnswerSheet from '@/components/ui/AnswerSheet.vue'
import Stamp from '@/components/ui/Stamp.vue'
import AudioButton from '@/components/AudioButton.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress, todayKey } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import SessionHeader from '@/components/SessionHeader.vue'
import { speak, stopSpeaking, ttsSupported } from '@/lib/tts'
import { buildListenRound, LISTEN_LABEL } from '@/lib/listening'
import { matchesAnswer } from '@/lib/answer'
import PART2, { KIND_LABEL } from '@/data/part2'
import { selectPart2, layoutPart2, lineOf } from '@/lib/part2'

/**
 * Listening phase, in two parts.
 *
 *   1. 聽單字與句子 — hear a word or a sentence, say what it means, fill the
 *      gap, spell it. The English is hidden until the answer is in — that is
 *      the whole point. Every other screen in the app puts the word on the
 *      page next to a play button, which trains reading with an audio
 *      garnish. Here the sound is the only evidence.
 *
 *   2. 應答聽力 (v6.1) — the shape of TOEIC Part 2: a spoken question or
 *      statement, then three spoken responses lettered A B C, and nothing on
 *      the screen but three letters. Part 1 asks "what did that mean"; this
 *      asks the learner to answer, and its wrong options are built from the
 *      traps the real test uses (an answer to a different question, a word
 *      that only sounds the same). After the answer the whole exchange is
 *      shown with each trap named.
 *
 * What the words round is about is decided by session.listenWordIds: words
 * missed by ear before, today's words, then the weakest in the deck. A word
 * got right here clears its listening mistakes.
 *
 * Opened as /listen?part2=1 (from 課程) it is a free 應答 round and does not
 * touch the day's phase.
 *
 * Built from data already on the device, so it runs offline and costs no quota.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const router = useRouter()
const route = useRoute()

const free = computed(() => route.query.part2 === '1')

const stage = ref('intro')        // intro | run | p2 | result
const index = ref(0)
const picked = ref(null)
const settled = ref(false)
const typed = ref('')
const plays = ref(0)
const results = ref([])           // { wordId, type, correct }

const dayWords = computed(() => words.getMany(session.listenWordIds).filter(w => w.enriched))
/** A cold load must not be mistaken for an empty day. */
const booting = computed(() => words.hydrating || !progress.loaded)
const pool = computed(() =>
  words.getMany([...progress.cards.keys()]).filter(w => w.enriched && w.meanings.length)
)

const items = ref([])
const item = computed(() => items.value[index.value] || null)
const correctCount = computed(() => results.value.filter(r => r.correct).length)

const daySeed = () => Number(todayKey().replace(/-/g, '')) % 100000
const wordCount = computed(() => (free.value || dayWords.value.length < 2 ? 0 : session.listenCount))
const p2Count = computed(() => (free.value ? 8 : session.part2Count))

function build () {
  items.value = wordCount.value
    ? buildListenRound(dayWords.value, pool.value, { count: wordCount.value, seed: daySeed() })
    : []
}

/** Play the item's audio. Slow mode drops the rate rather than the pitch. */
async function play (slow = false) {
  if (!item.value) return
  plays.value++
  await speak(item.value.audio, {
    rate: slow ? 0.62 : settings.state.ttsRate,
    voiceURI: settings.state.ttsVoiceURI,
    leadIn: settings.state.ttsLeadIn
  })
}

function reset () {
  picked.value = null
  settled.value = false
  typed.value = ''
  plays.value = 0
  if (settings.state.autoPlayAudio) play()
}

function start () {
  build()
  buildP2()
  results.value = []
  p2Results.value = []
  index.value = 0
  p2Index.value = 0
  if (items.value.length) {
    stage.value = 'run'
    reset()
  } else if (p2Items.value.length) {
    startP2()
  } else {
    session.markDone('listen')
    router.replace(session.nextRoute('listen'))
  }
}

function record (correct) {
  results.value.push({ wordId: item.value.wordId, type: item.value.type, correct })
  if (correct) {
    // heard it right: the earlier misses of this word by ear are settled
    progress.clearListenErrors(item.value.wordId)
  } else {
    progress.logError('listen', String(item.value.wordId), {
      type: item.value.type,
      audio: item.value.audio,
      answer: item.value.type === 'spell' ? item.value.answer : item.value.options[item.value.answer]
    })
  }
}

function choose (i) {
  if (settled.value) return
  picked.value = i
  settled.value = true
  record(i === item.value.answer)
}

function checkSpelling () {
  if (settled.value) return
  settled.value = true
  record(matchesAnswer(typed.value, item.value.answer))
}

function revealSpelling () {
  if (settled.value) return
  settled.value = true
  record(false)
}

function next () {
  stopSpeaking()
  if (index.value + 1 < items.value.length) {
    index.value++
    reset()
  } else if (p2Items.value.length) {
    startP2()
  } else {
    finish()
  }
}

/* ---------------- 應答聽力 ---------------- */

const p2Items = ref([])           // laid-out items
const p2Index = ref(0)
const p2Picked = ref(null)
const p2Settled = ref(false)
const p2Plays = ref(0)
const p2Speaking = ref(-1)        // which line is being spoken: 0 question, 1-3 options
const p2Heard = ref([])           // lines played at least once: 'q', 0, 1, 2
const p2Slow = ref(false)
const p2Results = ref([])         // { id, correct }
const p2 = computed(() => p2Items.value[p2Index.value] || null)
const p2Correct = computed(() => p2Results.value.filter(r => r.correct).length)
let p2Run = 0                     // cancels a script that is still playing

function buildP2 () {
  const picked = selectPart2(PART2, {
    log: progress.part2Log,
    known: new Set(progress.cards.keys()),
    lookup: words.lookup,
    n: p2Count.value,
    seed: daySeed() + (free.value ? Object.keys(progress.part2Log).length * 7 + 1 : 0)
  })
  p2Items.value = picked.map((it, i) => layoutPart2(it, daySeed() + i * 13 + (progress.part2Log[it.id]?.right || 0) + (progress.part2Log[it.id]?.wrong || 0)))
}

/**
 * Speak one line: the question ('q') or response 0–2. The learner plays each
 * one when they want it, as often as they want — never the whole set in a
 * row. A new call or an answer cuts off whatever is playing.
 */
async function playP2 (which = 'q') {
  if (!p2.value) return
  const line = lineOf(p2.value, which)
  if (!line) return
  const run = ++p2Run
  stopSpeaking()
  p2Plays.value++
  if (!p2Heard.value.includes(which)) p2Heard.value = [...p2Heard.value, which]
  p2Speaking.value = which === 'q' ? 0 : which + 1
  await speak(line.text, {
    rate: p2Slow.value ? 0.7 : settings.state.ttsRate,
    pitch: line.pitch,
    voiceURI: settings.state.ttsVoiceURI,
    leadIn: settings.state.ttsLeadIn
  })
  if (run === p2Run) p2Speaking.value = -1
}

function resetP2 () {
  p2Picked.value = null
  p2Settled.value = false
  p2Plays.value = 0
  p2Speaking.value = -1
  p2Heard.value = []
  if (settings.state.autoPlayAudio) playP2('q')
}

function startP2 () {
  stage.value = 'p2'
  p2Index.value = 0
  resetP2()
}

function chooseP2 (i) {
  if (p2Settled.value || !p2.value) return
  p2Run++
  stopSpeaking()
  p2Speaking.value = -1
  p2Picked.value = i
  p2Settled.value = true
  const correct = i === p2.value.answer
  p2Results.value.push({ id: p2.value.id, correct })
  progress.notePart2(p2.value.id, correct)
}

function nextP2 () {
  p2Run++
  stopSpeaking()
  if (p2Index.value + 1 < p2Items.value.length) {
    p2Index.value++
    resetP2()
  } else {
    finish()
  }
}

/* ---------------- result ---------------- */

const totalItems = computed(() => items.value.length + p2Items.value.length)
const totalCorrect = computed(() => correctCount.value + p2Correct.value)

function finish () {
  stage.value = 'result'
  if (!free.value) {
    session.setListenResult({
      correct: totalCorrect.value, total: totalItems.value,
      words: { correct: correctCount.value, total: items.value.length },
      part2: { correct: p2Correct.value, total: p2Items.value.length }
    })
  }
}

function done () {
  if (free.value) return router.push('/courses')
  session.markDone('listen')
  router.push(session.nextRoute('listen'))
}

function skipPhase () {
  p2Run++
  stopSpeaking()
  if (free.value) return router.push('/courses')
  session.markDone('listen')
  router.push(session.nextRoute('listen'))
}

/**
 * 應答 by keyboard: Space / Q plays the question, 1 / 2 / 3 play a response,
 * A / B / C answer, Enter moves on.
 */
function onP2Key (e) {
  if (stage.value !== 'p2' || !p2.value || e.metaKey || e.ctrlKey || e.altKey) return
  if (/input|textarea/i.test(document.activeElement?.tagName || '')) return
  if (p2Settled.value) {
    // a focused button answers Enter by itself
    if (e.key === 'Enter' && !/button|a/i.test(document.activeElement?.tagName || '')) { e.preventDefault(); nextP2() }
    return
  }
  if (/button/i.test(document.activeElement?.tagName || '') && (e.key === ' ' || e.key === 'Enter')) return
  const k = e.key.length === 1 ? e.key.toLowerCase() : ''
  if (k === ' ' || k === 'q') { e.preventDefault(); playP2('q'); return }
  const n = k ? '123'.indexOf(k) : -1
  if (n >= 0 && n < p2.value.options.length) { e.preventDefault(); playP2(n); return }
  const i = k ? 'abc'.indexOf(k) : -1
  if (i >= 0 && i < p2.value.options.length) { e.preventDefault(); chooseP2(i) }
}

onMounted(() => { session.startClock(); window.addEventListener('keydown', onP2Key) })
onUnmounted(() => { p2Run++; session.stopClock(); stopSpeaking(); window.removeEventListener('keydown', onP2Key) })
</script>

<template>
  <div class="view">
    <SessionHeader
      :title="free ? '應答聽力' : '聽力'"
      :current="stage === 'run' ? index + 1 : stage === 'p2' ? items.length + p2Index + 1 : (stage === 'result' ? totalItems : 0)"
      :total="stage === 'intro' ? wordCount + p2Count : totalItems"
      :exit-to="free ? '/courses' : '/'"
    />

    <main class="shell lis">
      <!-- still loading; an empty store is not an empty day -->
      <template v-if="stage === 'intro' && booting && !dayWords.length && !free">
        <div class="lis__intro">
          <div class="gate__spinner"><span /><span /><span /></div>
          <p class="lis__desc zh">正在載入今天的單字…</p>
        </div>
      </template>

      <!-- intro -->
      <template v-else-if="stage === 'intro'">
        <div class="lis__intro">
          <div class="lis__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 18 0" /><path d="M3 12v4a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /><path d="M21 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />
            </svg>
          </div>
          <h1 class="lis__title zh">{{ free ? '應答聽力' : '聽力練習' }}</h1>
          <p v-if="free" class="lis__desc zh">
            一共出 {{ p2Count }} 題。先播放問題，再自己點 A、B、C 分別聽三個回應（哪個不確定就再點一次），選出接得上的那一個。
            <strong>畫面上只有三個字母</strong>，英文答完才會顯示。
          </p>
          <p v-else class="lis__desc zh">
            一共出 {{ wordCount + p2Count }} 題。
            <template v-if="wordCount">先用 {{ dayWords.length }} 個單字出 {{ wordCount }} 題，再做</template>
            <template v-else>今天做</template>
            {{ p2Count }} 題應答：聽問題，選回應。
            <strong>英文不會顯示在畫面上</strong>，答完才看得到——看得到字就不是在練聽力。
          </p>
          <ul v-if="!free && wordCount" class="lis__plan zh">
            <li><b class="fig">1</b><span>聽單字與句子<small>聽錯過的字會先出現</small></span></li>
            <li><b class="fig">2</b><span>應答聽力<small>多益 Part 2 的題型</small></span></li>
          </ul>
          <p v-if="!ttsSupported" class="lis__warn zh">這個瀏覽器不支援語音合成，聽力關卡無法運作。</p>
        </div>
        <button class="btn btn--primary btn--block zh" :disabled="!ttsSupported" @click="start">開始</button>
        <button class="btn btn--quiet btn--sm zh lis__skip" @click="skipPhase">{{ free ? '回課程' : '跳過這個階段' }}</button>
      </template>

      <!-- part 1: words and sentences -->
      <template v-else-if="stage === 'run' && item">
        <div class="phase-tag">
          <span class="chip chip--violet">{{ LISTEN_LABEL[item.type] }}</span>
          <span class="tally num">{{ correctCount }} / {{ results.length }}</span>
        </div>

        <div class="player">
          <button class="player__big" :aria-label="'播放'" @click="play(false)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </button>
          <div class="player__row">
            <button class="btn btn--ghost btn--sm zh" @click="play(false)">再聽一次</button>
            <button class="btn btn--ghost btn--sm zh" @click="play(true)">放慢</button>
          </div>
          <p class="player__count zh">已播放 {{ plays }} 次</p>
        </div>

        <!-- gap: the sentence with the target word removed is on screen; the
             word itself is not, so the ear has to supply it -->
        <div v-if="item.type === 'gap'" class="qbox">
          <p class="qbox__q">{{ item.prompt }}</p>
        </div>

        <!-- multiple choice -->
        <div v-if="item.type !== 'spell'" class="opts">
          <button
            v-for="(o, i) in item.options" :key="i"
            class="opt"
            :class="{
              'opt--right': settled && i === item.answer,
              'opt--wrong': settled && picked === i && i !== item.answer,
              'opt--mute': settled && picked !== i && i !== item.answer
            }"
            :disabled="settled"
            @click="choose(i)"
          >
            <span class="opt__key num">{{ 'ABCD'[i] }}</span>
            <span class="opt__text" :class="{ zh: item.type !== 'gap' }">{{ o }}</span>
          </button>
        </div>

        <!-- spelling -->
        <template v-else>
          <p class="lis__hint zh">意思：{{ item.hint }}</p>
          <input
            v-model="typed"
            class="input lis__input"
            :disabled="settled"
            placeholder="把聽到的字拼出來"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            @keyup.enter="checkSpelling"
          >
          <div v-if="!settled" class="row row-2">
            <button class="btn btn--primary grow zh" :disabled="!typed.trim()" @click="checkSpelling">檢查</button>
            <button class="btn btn--ghost zh" @click="revealSpelling">看答案</button>
          </div>
        </template>

        <AnswerSheet
          v-if="settled" :key="'fb' + index"
          :right="!!results.at(-1)?.correct"
          :chars="(item.reveal || '').length + (item.zh || '').length"
          :next-label="index + 1 < items.length ? '下一題' : (p2Items.length ? '接著做應答' : '看結果')"
          @next="next"
        >
          <p class="fb__answer">
            {{ item.reveal }}
            <span v-if="item.ipa" class="fb__ipa">{{ item.ipa }}</span>
            <AudioButton v-if="item.reveal" :text="item.reveal" size="sm" />
          </p>
          <p v-if="item.zh" class="fb__zh">{{ item.zh }}</p>
        </AnswerSheet>

        <button class="btn btn--quiet btn--sm lis__skip zh" @click="skipPhase">跳過這個階段</button>
      </template>

      <!-- part 2: question → response -->
      <template v-else-if="stage === 'p2' && p2">
        <div class="phase-tag">
          <span class="chip chip--violet zh">應答聽力</span>
          <span v-if="p2Settled" class="chip zh">{{ KIND_LABEL[p2.kind] }}</span>
          <span class="tally num">{{ p2Correct }} / {{ p2Results.length }}</span>
        </div>

        <div v-if="!p2Settled" class="player">
          <button class="player__big" :class="{ 'player__big--on': p2Speaking === 0 }" aria-label="播放問題" @click="playP2('q')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          </button>
          <p class="player__label zh">{{ p2Speaking === 0 ? '正在唸問題…' : p2Heard.includes('q') ? '再聽一次問題' : '播放問題' }}</p>
          <button class="chip chip--toggle zh" :class="{ 'chip--on': p2Slow }" :aria-pressed="p2Slow" @click="p2Slow = !p2Slow">放慢</button>
        </div>

        <!-- before the answer: three letters, each played on its own and picked on its own -->
        <div v-if="!p2Settled" class="abc">
          <div v-for="(o, i) in p2.options" :key="o.letter" class="abc__opt">
            <button
              class="abc__play" :class="{ 'abc__play--on': p2Speaking === i + 1, 'abc__play--heard': p2Heard.includes(i) }"
              :aria-label="`播放回應 ${o.letter}`"
              @click="playP2(i)"
            >
              <span class="abc__letter fig">{{ o.letter }}</span>
              <span class="abc__hint zh">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></svg>
                {{ p2Speaking === i + 1 ? '播放中' : p2Heard.includes(i) ? '再聽' : '聽' }}
              </span>
            </button>
            <button class="abc__btn zh" :aria-label="`選 ${o.letter}`" @click="chooseP2(i)">選 {{ o.letter }}</button>
          </div>
        </div>
        <p v-if="!p2Settled" class="abc__keys zh">鍵盤：空白鍵 問題 · 1 2 3 聽回應 · A B C 作答</p>

        <!-- after: the whole exchange, with each trap named -->
        <div v-else class="tx">
          <p class="tx__verdict zh" :class="{ 'tx__verdict--right': p2Picked === p2.answer }" role="status">
            {{ p2Picked === p2.answer ? '接得上' : `接不上，正解是 ${p2.options[p2.answer].letter}` }}
          </p>
          <div class="tx__q">
            <p class="tx__en">{{ p2.q }} <AudioButton :text="p2.q" size="sm" /></p>
            <p class="tx__zh zh">{{ p2.zh }}</p>
          </div>
          <div
            v-for="(o, i) in p2.options" :key="o.letter"
            class="tx__o"
            :class="{ 'tx__o--right': o.correct, 'tx__o--picked': p2Picked === i && !o.correct }"
          >
            <span class="tx__l fig">{{ o.letter }}</span>
            <div class="tx__body">
              <p class="tx__en">{{ o.en }} <AudioButton :text="o.en" size="sm" /></p>
              <p class="tx__zh zh">{{ o.zh }}</p>
              <p v-if="!o.correct" class="tx__why zh">{{ o.why }}</p>
            </div>
            <span v-if="o.correct" class="tx__mark zh">正解</span>
            <span v-else-if="p2Picked === i" class="tx__mark tx__mark--no zh">你選的</span>
          </div>
          <p class="tx__tip zh">{{ p2.tip }}</p>
          <!-- in the flow, not a sheet: a sheet over three long responses hides the one that was right -->
          <button class="btn btn--primary btn--block tx__next zh" @click="nextP2">{{ p2Index + 1 < p2Items.length ? '下一題' : '看結果' }}</button>
        </div>

        <button class="btn btn--quiet btn--sm lis__skip zh" @click="skipPhase">{{ free ? '結束' : '跳過這個階段' }}</button>
      </template>

      <!-- result -->
      <template v-else>
        <div class="res">
          <Stamp :ratio="totalItems ? totalCorrect / totalItems : 0" :size="120" />
          <h2 class="res__title kai">聽力練習完成，答對 {{ totalCorrect }} / {{ totalItems }}</h2>
          <div v-if="items.length && p2Items.length" class="res__split zh">
            <span>單字與句子 <b class="fig">{{ correctCount }}/{{ items.length }}</b></span>
            <span>應答 <b class="fig">{{ p2Correct }}/{{ p2Items.length }}</b></span>
          </div>
          <p class="res__note zh">
            <template v-if="totalItems && totalCorrect / totalItems >= 0.8">
              聽得出來了。答對的應答題不會再出，會換新的題型上來。
            </template>
            <template v-else>
              聽錯的字明天的聽力會先出現，錯的應答題也會再來一次；錯題本的「聽力」分頁可以先看。聽不出來通常不是耳朵的問題，是那個字的聲音還沒進腦子。
            </template>
          </p>
        </div>
        <button class="btn btn--primary btn--block zh" @click="done">{{ free ? '回課程' : '繼續' }}</button>
        <button class="btn btn--ghost btn--block zh" @click="start">再練一輪</button>
      </template>
    </main>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.lis {
  display: flex; flex-direction: column; gap: var(--sp-4);
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6));
}

.lis__intro { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding: var(--sp-6) 0 var(--sp-2); }
.lis__mark { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 50%; background: var(--violet-wash); color: var(--violet); }
.lis__mark svg { width: 32px; height: 32px; }
.lis__title { font-size: var(--step-2); font-weight: 800; }
.lis__desc { font-size: var(--step--1); color: var(--ink-2); line-height: 1.8; max-width: 34ch; }
.lis__desc strong { color: var(--ink); }
.lis__warn { font-size: var(--step--1); color: var(--rose); }
.gate__spinner { display: flex; gap: 6px; }
.gate__spinner span { width: 8px; height: 8px; border-radius: 50%; background: var(--violet); animation: lbounce 1.1s ease-in-out infinite; }
.gate__spinner span:nth-child(2) { animation-delay: 0.14s; }
.gate__spinner span:nth-child(3) { animation-delay: 0.28s; }
@keyframes lbounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.45; } 40% { transform: translateY(-6px); opacity: 1; } }
.lis__skip { align-self: center; }

.phase-tag { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--step--2); }
.tally { margin-left: auto; font-size: var(--step--1); color: var(--ink-2); }

.player { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding: var(--sp-5) 0 var(--sp-2); }
.player__big {
  width: 96px; height: 96px; border-radius: 50%;
  display: grid; place-items: center;
  background: var(--violet-wash); color: var(--violet);
  border: 1px solid var(--violet-edge);
  transition: transform 0.12s;
}
.player__big:active { transform: scale(0.94); }
.player__big svg { width: 42px; height: 42px; }
.player__row { display: flex; gap: var(--sp-2); }
.player__count { font-size: var(--step--2); color: var(--ink-3); }

.qbox { padding: var(--sp-4); }
.qbox__q { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.6; text-align: center; }

.opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.opt { display: flex; align-items: center; gap: var(--sp-3); min-height: 52px; padding: var(--sp-2) var(--sp-3); text-align: left; }
.opt__key {
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: var(--radius-sm); background: var(--surface-2);
  color: var(--ink-3); font-size: var(--step--2); flex-shrink: 0;
}
.opt__text { font-size: var(--step-0); line-height: 1.5; }
.opt__text:not(.zh) { font-family: var(--font-word); }
.opt--right .opt__key { background: var(--jade); color: var(--surface); }

.lis__hint { font-size: var(--step--1); color: var(--ink-2); text-align: center; }
.lis__input { font-family: var(--font-word); font-size: var(--step-1); text-align: center; }

.fb { border-radius: var(--radius); padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); border: 1px solid; }
.fb--ok { background: var(--jade-wash); border-color: var(--jade-edge); }
.fb--no { background: var(--rose-wash); border-color: var(--rose-edge); }
.fb__head { font-weight: 700; font-size: var(--step-0); }
.fb--ok .fb__head { color: var(--jade); }
.fb--no .fb__head { color: var(--rose); }
.fb__answer {
  font-family: var(--font-word); font-size: var(--step-1); line-height: 1.5;
  background: var(--surface); border-radius: var(--radius); padding: var(--sp-2) var(--sp-3);
  display: flex; align-items: baseline; gap: var(--sp-2); flex-wrap: wrap;
}
.fb__ipa { font-size: var(--step--2); color: var(--ink-3); }
.fb__zh { font-size: var(--step-1); color: var(--ink-2); }

.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-6) 0 var(--sp-4); text-align: center; }
.res__ring {
  width: 118px; height: 118px; border-radius: 50%;
  display: grid; place-items: center;
  background: conic-gradient(var(--violet) calc(var(--pct) * 1%), var(--surface-3) 0);
  position: relative;
}
.res__ring::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--paper); }
.res__pct { position: relative; z-index: 1; font-size: var(--step-2); font-weight: 600; }
.res__pct small { font-size: var(--step--1); color: var(--ink-3); }
.res__title { font-size: var(--step-1); font-weight: 700; }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.75; max-width: 34ch; }

/* the day's two parts, as a short list on the intro */
.lis__plan { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 300px; margin-top: var(--sp-2); text-align: left; }
.lis__plan li { display: grid; grid-template-columns: 30px 1fr; gap: 12px; align-items: center; padding: 10px 14px; border-radius: var(--r-control); background: var(--surface); box-shadow: var(--rim); }
.lis__plan b { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--rule-strong); font-size: var(--step-0); color: var(--ink-2); }
.lis__plan span { display: flex; flex-direction: column; font-weight: 600; font-size: var(--step--1); }
.lis__plan small { font-weight: 400; font-size: var(--step--2); color: var(--ink-2); }

/* 應答: three letters, nothing to read; each response is played on demand */
.player__big--on { box-shadow: 0 0 0 6px var(--pen-wash); }
.player__label { font-size: var(--step--1); color: var(--ink-2); min-height: 1.4em; }
.chip--toggle { cursor: pointer; }
.chip--toggle.chip--on { background: var(--pen-wash); color: var(--pen); box-shadow: inset 0 0 0 1px var(--pen); }
.abc { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-3); }
.abc__opt { display: flex; flex-direction: column; gap: var(--sp-2); }
.abc__play {
  min-height: 104px; border-radius: var(--r-panel);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  color: var(--ink);
  background: radial-gradient(130% 80px at var(--lx) 0, var(--sheen), transparent 70%), var(--surface);
  box-shadow: var(--rim), var(--shadow-1);
  -webkit-backdrop-filter: blur(22px) saturate(140%); backdrop-filter: blur(22px) saturate(140%);
  transition: transform 0.25s cubic-bezier(0.3, 1.5, 0.5, 1), box-shadow 0.2s;
}
.abc__play:active { transform: scale(0.95); }
.abc__letter { font-family: var(--font-fig); font-size: 2.4rem; font-weight: 500; line-height: 1; }
.abc__hint { display: inline-flex; align-items: center; gap: 4px; font-size: var(--step--2); color: var(--ink-3); }
.abc__hint svg { width: 14px; height: 14px; }
.abc__play--heard .abc__hint { color: var(--ink-2); }
.abc__play--on { box-shadow: var(--rim), inset 0 0 0 2px var(--pen), var(--shadow-1); }
.abc__play--on .abc__hint { color: var(--pen); }
.abc__btn {
  min-height: 44px; border-radius: var(--r-control);
  font-weight: 600; font-size: var(--step--1); color: var(--pen);
  background: var(--surface); box-shadow: var(--rim), inset 0 0 0 1px var(--pen-wash);
  transition: transform 0.15s, background 0.15s;
}
.abc__btn:active { transform: scale(0.96); background: var(--pen-wash); }
.abc__keys { margin-top: var(--sp-2); text-align: center; font-size: var(--step--2); color: var(--ink-3); }
@media (hover: none) { .abc__keys { display: none; } }

.tx { display: flex; flex-direction: column; gap: var(--sp-2); }
.tx__q { padding: var(--sp-3) var(--sp-4); border-radius: var(--r-control); background: var(--surface-2); }
.tx__en { font-family: var(--font-word); font-size: var(--step-0); line-height: 1.5; display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.tx__zh { font-size: var(--step--1); color: var(--ink-2); line-height: 1.5; }
.tx__o { display: grid; grid-template-columns: 30px 1fr auto; gap: 12px; align-items: start; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-control); background: var(--surface); box-shadow: var(--rim); }
.tx__l { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; font-size: var(--step-0); color: var(--ink-2); box-shadow: inset 0 0 0 1px var(--rule-strong); }
.tx__o--right { background: var(--jade-wash); box-shadow: inset 0 0 0 1.5px var(--jade-edge); }
.tx__o--right .tx__l { background: var(--green); color: #fff; box-shadow: none; }
.tx__o--picked { background: var(--rose-wash); box-shadow: inset 0 0 0 1.5px var(--rose-edge); }
.tx__body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tx__why { font-size: var(--step--2); color: var(--ink-2); line-height: 1.5; margin-top: 2px; }
.tx__why::before { content: '✕ '; color: var(--rose); }
.tx__mark { font-size: var(--step--2); font-weight: 700; color: var(--jade); white-space: nowrap; padding-top: 5px; }
.tx__mark--no { color: var(--rose); }
.tx__tip { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; padding: var(--sp-2) 4px 0; }
.tx__verdict { font-size: var(--step-1); font-weight: 700; letter-spacing: -0.01em; color: var(--redpen); padding: 0 4px; }
.tx__verdict--right { color: var(--jade); }
.tx__next { margin-top: var(--sp-2); }
.res__split { display: flex; gap: var(--sp-5); font-size: var(--step--1); color: var(--ink-2); }
.res__split b { font-size: var(--step-1); color: var(--ink); margin-left: 4px; }
</style>
