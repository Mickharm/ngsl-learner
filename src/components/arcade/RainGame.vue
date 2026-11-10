<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useGamePool } from '@/composables/useGamePool'
import { meaningOptions, glossOf } from '@/lib/game'
import { readBest, saveBest, rainPoints, rainDuration, dealDeck, QUEST_GOAL } from '@/lib/arcade'
import { speak } from '@/lib/tts'
import { sfx, buzz } from '@/lib/sfx'
import GameShell from './GameShell.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * 單字雨 — an English word falls; tap its meaning before it lands.
 * Speed rises with every word, streaks multiply points, three misses end
 * the run. In the quest the round is 15 words, today's first.
 *
 * v4: the fall is a transform written straight to the element each frame
 * (no Vue re-render per frame — that was the stutter on phones), and a miss
 * stops the game until 繼續, with the word, its meaning and its sound.
 */
const auth = useAuth()
const settings = useSettings()
const { pool, todayIds, inPhase } = useGamePool(12)

const deck = ref([])
const n = ref(0)
const lives = ref(3)
const score = ref(0)
const combo = ref(0)
const phase = ref('fall')       // fall | hit | miss
const picked = ref(null)
const over = ref(false)
const newBest = ref(false)
const best = ref(readBest(auth.userId).rain ?? null)
const missed = ref([])
const answered = ref(0)
const sky = ref(null)
const drop = ref(null)
let raf = 0, t0 = 0, dur = 7000, travel = 300, progress = 0, nextTimer = 0

const goal = computed(() => inPhase.value ? QUEST_GOAL.rain : null)
const word = computed(() => deck.value[n.value % Math.max(1, deck.value.length)] || null)
const options = computed(() => word.value ? meaningOptions(word.value, pool.value, n.value * 13 + 7) : [])

async function spawn () {
  phase.value = 'fall'; picked.value = null; progress = 0
  await nextTick()
  travel = Math.max(120, (sky.value?.clientHeight || 360) - (drop.value?.offsetHeight || 60) - 10)
  if (drop.value) drop.value.style.transform = 'translate3d(0,0,0)'
  dur = rainDuration(n.value)
  t0 = performance.now()
  if (settings.state.autoPlayAudio && word.value) speak(word.value.headword, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI })
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}

function tick (t) {
  if (phase.value !== 'fall') return
  progress = (t - t0) / dur
  if (drop.value) drop.value.style.transform = `translate3d(0,${Math.min(1, progress) * travel}px,0)`
  if (progress >= 1) { miss(); return }
  raf = requestAnimationFrame(tick)
}

function miss () {
  cancelAnimationFrame(raf)
  phase.value = 'miss'
  combo.value = 0
  lives.value--
  answered.value++
  sfx('bad'); buzz(60)
  if (word.value && !missed.value.some(w => w.id === word.value.id)) missed.value.push(word.value)
  if (word.value) speak(word.value.headword, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI })
}

function pick (o) {
  if (phase.value !== 'fall') return
  picked.value = o.id
  if (o.correct) {
    cancelAnimationFrame(raf)
    phase.value = 'hit'
    combo.value++
    answered.value++
    score.value += rainPoints(dur * (1 - progress), dur, combo.value)
    sfx(combo.value % 5 === 0 ? 'combo' : 'good')
    nextTimer = setTimeout(advance, 420)
  } else {
    miss()
  }
}

function advance () {
  if (lives.value <= 0 || (goal.value && answered.value >= goal.value)) return finish()
  n.value++
  spawn()
}

function finish () {
  cancelAnimationFrame(raf)
  over.value = true
  newBest.value = saveBest(auth.userId, 'rain', score.value)
  best.value = readBest(auth.userId).rain
  sfx(newBest.value || lives.value > 0 ? 'win' : 'lose')
}

const stars = computed(() => score.value >= 400 ? 3 : score.value >= 180 ? 2 : score.value >= 60 ? 1 : 0)

function start () {
  clearTimeout(nextTimer); cancelAnimationFrame(raf)
  deck.value = dealDeck(pool.value, inPhase.value ? todayIds.value : null)
  n.value = 0; lives.value = 3; score.value = 0; combo.value = 0; answered.value = 0
  missed.value = []; over.value = false; newBest.value = false
  spawn()
}

onMounted(start)
onUnmounted(() => { cancelAnimationFrame(raf); clearTimeout(nextTimer) })
</script>

<template>
  <GameShell
    title="單字雨" :over="over" :score="score" :lives="lives" :combo="combo"
    :best="best" :new-best="newBest" :stars="stars" :missed="missed"
    :goal="goal ? { done: answered, total: goal } : null" @again="start"
  >
    <div ref="sky" class="sky" :class="`sky--${phase}`">
      <div v-if="word" ref="drop" class="drop">
        <span class="drop__w">{{ word.headword }}</span>
      </div>
      <div class="ground" />
    </div>

    <div v-if="phase === 'miss' && word" class="missbox">
      <p class="missbox__w"><b>{{ word.headword }}</b><AudioButton :text="word.headword" size="sm" /></p>
      <p class="missbox__zh">{{ glossOf(word) }}</p>
      <button class="btn btn--block btn--ink zh" @click="advance">{{ lives > 0 ? '記住了，繼續' : '看結果' }}</button>
    </div>
    <div v-else class="opts">
      <button
        v-for="o in options" :key="o.id"
        class="opt"
        :class="{ 'opt--right': phase !== 'fall' && o.correct, 'opt--wrong': picked === o.id && !o.correct }"
        :disabled="phase !== 'fall'"
        @click="pick(o)"
      >{{ o.zh }}</button>
    </div>
  </GameShell>
</template>

<style scoped>
.sky {
  position: relative; height: min(44dvh, 360px); overflow: hidden;
  border-radius: var(--radius-xl);
  /* a pane of glass the words fall down; the ground is the bottom edge */
  background: var(--surface); -webkit-backdrop-filter: blur(20px) saturate(140%); backdrop-filter: blur(20px) saturate(140%);
  box-shadow: var(--rim), var(--shadow-1);
}
.drop { position: absolute; left: 0; right: 0; top: 6px; display: flex; justify-content: center; will-change: transform; }
.drop__w {
  font-family: var(--font-word); font-weight: 700; font-size: clamp(1.7rem, 8vw, 2.2rem);
  padding: 0.15em 0.7em; background: var(--surface-solid); border-radius: 18px;
  box-shadow: var(--rim), 0 10px 24px -10px rgba(30, 30, 70, 0.35);
}
.sky--hit .drop__w { border-color: var(--jade); box-shadow: 3px 3px 0 var(--jade); color: var(--jade-ink); }
.sky--miss .drop__w { border-color: var(--redpen); box-shadow: 3px 3px 0 var(--redpen); color: var(--redpen); animation: shake 0.3s; }
.ground { position: absolute; left: 0; right: 0; bottom: 0; height: 5px; background: var(--line-base); opacity: 0.7; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); margin-top: var(--sp-4); }
.opt { min-height: 68px; padding: 8px; font-weight: 700; font-size: var(--step-1); line-height: 1.25; }
.missbox { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4); animation: rise 0.18s ease-out; }
.missbox__w { display: flex; align-items: center; gap: var(--sp-2); font-family: var(--font-word); font-size: var(--step-2); }
.missbox__zh { font-size: var(--step-1); color: var(--ink-2); }
</style>
