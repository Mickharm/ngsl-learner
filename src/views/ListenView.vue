<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useWords } from '@/stores/words'
import { useProgress, todayKey } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import SessionHeader from '@/components/SessionHeader.vue'
import { speak, stopSpeaking, ttsSupported } from '@/lib/tts'
import { buildListenRound, LISTEN_LABEL } from '@/lib/listening'
import { matchesAnswer } from '@/lib/answer'

/**
 * Listening phase.
 *
 * The English is hidden until the answer is in — that is the whole point.
 * Every other screen in the app puts the word on the page next to a play
 * button, which trains reading with an audio garnish. Here the sound is the
 * only evidence.
 *
 * Built from data already on the device, so it runs offline and costs no quota.
 */

const words = useWords()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const toast = useToast()
const router = useRouter()

const stage = ref('intro')        // intro | run | result
const index = ref(0)
const picked = ref(null)
const settled = ref(false)
const typed = ref('')
const plays = ref(0)
const results = ref([])           // { wordId, type, correct }

const dayWords = computed(() => words.getMany(session.dayWordIds).filter(w => w.enriched))
/** A cold load must not be mistaken for an empty day. */
const booting = computed(() => words.hydrating || !progress.loaded)
const pool = computed(() =>
  words.getMany([...progress.cards.keys()]).filter(w => w.enriched && w.meanings.length)
)

const items = ref([])
const item = computed(() => items.value[index.value] || null)
const correctCount = computed(() => results.value.filter(r => r.correct).length)

function build () {
  const seed = Number(todayKey().replace(/-/g, '')) % 100000
  items.value = buildListenRound(dayWords.value, pool.value, {
    count: session.listenCount,
    seed
  })
}

/** Play the item's audio. Slow mode drops the rate rather than the pitch. */
async function play (slow = false) {
  if (!item.value) return
  plays.value++
  await speak(item.value.audio, {
    rate: slow ? 0.62 : settings.state.ttsRate,
    voiceURI: settings.state.ttsVoiceURI
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
  if (!items.value.length) {
    session.markDone('listen')
    router.replace(session.nextRoute('listen'))
    return
  }
  stage.value = 'run'
  index.value = 0
  results.value = []
  reset()
}

function record (correct) {
  results.value.push({ wordId: item.value.wordId, type: item.value.type, correct })
  if (!correct) {
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
  } else {
    finish()
  }
}

function finish () {
  stage.value = 'result'
  session.setListenResult({ correct: correctCount.value, total: items.value.length })
}

function done () {
  session.markDone('listen')
  router.push(session.nextRoute('listen'))
}

function skipPhase () {
  stopSpeaking()
  session.markDone('listen')
  router.push(session.nextRoute('listen'))
}

onMounted(() => session.startClock())
onUnmounted(() => { session.stopClock(); stopSpeaking() })
</script>

<template>
  <div class="view">
    <SessionHeader
      title="聽力"
      :current="stage === 'run' ? index + 1 : (stage === 'result' ? items.length : 0)"
      :total="items.length"
    />

    <main class="shell lis">
      <!-- still loading; an empty store is not an empty day -->
      <template v-if="stage === 'intro' && booting && !dayWords.length">
        <div class="lis__intro">
          <div class="gate__spinner"><span /><span /><span /></div>
          <p class="lis__desc zh">正在載入今天的單字…</p>
        </div>
      </template>

      <!-- nothing to build a round from yet -->
      <template v-else-if="stage === 'intro' && !dayWords.length">
        <div class="lis__intro">
          <div class="lis__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 18 0" /><path d="M3 12v4a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /><path d="M21 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />
            </svg>
          </div>
          <h1 class="lis__title zh">還沒有可以聽的字</h1>
          <p class="lis__desc zh">聽力題是用今天學過與複習過的單字出的。先完成前面的關卡再回來。</p>
        </div>
        <button class="btn btn--primary btn--block zh" @click="skipPhase">回到今天的關卡</button>
      </template>

      <!-- intro -->
      <template v-else-if="stage === 'intro'">
        <div class="lis__intro">
          <div class="lis__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 12a9 9 0 0 1 18 0" /><path d="M3 12v4a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2Z" /><path d="M21 12v4a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2Z" />
            </svg>
          </div>
          <h1 class="lis__title zh">聽力練習</h1>
          <p class="lis__desc zh">
            用今天的 {{ dayWords.length }} 個單字出 {{ session.listenCount }} 題。
            <strong>英文不會顯示在畫面上</strong>，答完才看得到——看得到字就不是在練聽力。
          </p>
          <p v-if="!ttsSupported" class="lis__warn zh">這個瀏覽器不支援語音合成，聽力關卡無法運作。</p>
        </div>
        <button class="btn btn--primary btn--block zh" :disabled="!ttsSupported" @click="start">開始</button>
        <button class="btn btn--quiet btn--sm zh lis__skip" @click="skipPhase">跳過這個階段</button>
      </template>

      <!-- run -->
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

        <Transition name="slide-up">
          <div v-if="settled" class="fb" :class="results.at(-1)?.correct ? 'fb--ok' : 'fb--no'">
            <div class="fb__head zh">{{ results.at(-1)?.correct ? '答對了' : '答錯了' }}</div>
            <p class="fb__answer">
              {{ item.reveal }}
              <span v-if="item.ipa" class="fb__ipa num">{{ item.ipa }}</span>
            </p>
            <p v-if="item.zh" class="fb__zh zh">{{ item.zh }}</p>
            <button class="btn btn--primary btn--block zh" @click="next">
              {{ index + 1 < items.length ? '下一題' : '看結果' }}
            </button>
          </div>
        </Transition>

        <button class="btn btn--quiet btn--sm lis__skip zh" @click="skipPhase">跳過這個階段</button>
      </template>

      <!-- result -->
      <template v-else>
        <div class="res">
          <div class="res__ring" :style="{ '--pct': items.length ? (correctCount / items.length) * 100 : 0 }">
            <span class="res__pct num">{{ correctCount }}<small>/{{ items.length }}</small></span>
          </div>
          <h2 class="res__title zh">聽力練習完成</h2>
          <p class="res__note zh">
            <template v-if="items.length && correctCount / items.length >= 0.8">
              聽得出來了。之後題目會慢慢從單字換成整句。
            </template>
            <template v-else>
              聽錯的字已進錯題本。聽不出來通常不是耳朵的問題，是那個字的發音還沒進腦子——複習時多按幾次播放。
            </template>
          </p>
        </div>
        <button class="btn btn--primary btn--block zh" @click="done">繼續</button>
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

.qbox {
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius-lg); padding: var(--sp-4);
  box-shadow: var(--shadow-1);
}
.qbox__q { font-family: var(--font-word); font-size: var(--step-1); line-height: 1.6; text-align: center; }

.opts { display: flex; flex-direction: column; gap: var(--sp-2); }
.opt {
  display: flex; align-items: center; gap: var(--sp-3);
  min-height: 52px; padding: var(--sp-2) var(--sp-3);
  border-radius: var(--radius); border: 1px solid var(--rule-strong);
  background: var(--surface); text-align: left;
  transition: background 0.14s, border-color 0.14s, opacity 0.2s;
}
.opt:active:not(:disabled) { background: var(--surface-2); }
.opt__key {
  width: 24px; height: 24px; display: grid; place-items: center;
  border-radius: var(--radius-sm); background: var(--surface-2);
  color: var(--ink-3); font-size: var(--step--2); flex-shrink: 0;
}
.opt__text { font-size: var(--step-0); line-height: 1.5; }
.opt__text:not(.zh) { font-family: var(--font-word); }
.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade); }
.opt--right .opt__key { background: var(--jade); color: var(--surface); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.opt--mute { opacity: 0.42; }

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
.fb__zh { font-size: var(--step--1); color: var(--ink-2); }

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
</style>
