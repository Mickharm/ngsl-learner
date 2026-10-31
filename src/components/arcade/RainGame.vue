<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useGamePool } from '@/composables/useGamePool'
import { meaningOptions, shuffle, glossOf } from '@/lib/game'
import { readBest, saveBest, rainPoints, rainDuration } from '@/lib/arcade'
import { speak } from '@/lib/tts'
import { sfx, buzz } from '@/lib/sfx'
import GameShell from './GameShell.vue'

/**
 * 單字雨 — an English word falls; tap its meaning before it lands.
 * Speed rises with every word, streaks multiply points, three misses end
 * the run. The word is also spoken as it appears, so sound and spelling
 * arrive together.
 */
const auth = useAuth()
const settings = useSettings()
const { pool } = useGamePool(12)

const deck = ref([])
const n = ref(0)
const lives = ref(3)
const score = ref(0)
const combo = ref(0)
const y = ref(0)
const phase = ref('fall')       // fall | hit | miss
const picked = ref(null)
const over = ref(false)
const newBest = ref(false)
const best = ref(readBest(auth.userId).rain ?? null)
const missed = ref([])
let raf = 0, t0 = 0, dur = 7000, nextTimer = 0

const word = computed(() => deck.value[n.value % Math.max(1, deck.value.length)] || null)
const options = computed(() => word.value ? meaningOptions(word.value, pool.value, n.value * 13 + 7) : [])

function spawn () {
  phase.value = 'fall'; picked.value = null; y.value = 0
  dur = rainDuration(n.value)
  t0 = performance.now()
  if (settings.state.autoPlayAudio && word.value) speak(word.value.headword, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI })
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}

function tick (t) {
  if (phase.value !== 'fall') return
  y.value = (t - t0) / dur
  if (y.value >= 1) { miss(); return }
  raf = requestAnimationFrame(tick)
}

function miss () {
  phase.value = 'miss'
  combo.value = 0
  lives.value--
  sfx('bad'); buzz(60)
  if (word.value && !missed.value.some(w => w.id === word.value.id)) missed.value.push(word.value)
  nextTimer = setTimeout(advance, 1100)
}

function pick (o) {
  if (phase.value !== 'fall') return
  picked.value = o.id
  cancelAnimationFrame(raf)
  if (o.correct) {
    phase.value = 'hit'
    combo.value++
    score.value += rainPoints(dur * (1 - y.value), dur, combo.value)
    sfx(combo.value > 0 && combo.value % 5 === 0 ? 'combo' : 'good')
    nextTimer = setTimeout(advance, 380)
  } else {
    miss()
  }
}

function advance () {
  if (lives.value <= 0) return finish()
  n.value++
  spawn()
}

function finish () {
  over.value = true
  newBest.value = saveBest(auth.userId, 'rain', score.value)
  best.value = readBest(auth.userId).rain
  sfx(newBest.value ? 'win' : 'lose')
}

const stars = computed(() => score.value >= 400 ? 3 : score.value >= 180 ? 2 : score.value >= 60 ? 1 : 0)

function start () {
  clearTimeout(nextTimer); cancelAnimationFrame(raf)
  deck.value = shuffle(pool.value, Date.now())
  n.value = 0; lives.value = 3; score.value = 0; combo.value = 0
  missed.value = []; over.value = false; newBest.value = false
  spawn()
}

onMounted(start)
onUnmounted(() => { cancelAnimationFrame(raf); clearTimeout(nextTimer) })
</script>

<template>
  <GameShell
    title="單字雨" :over="over" :score="score" :lives="lives" :combo="combo"
    :best="best" :new-best="newBest" :stars="stars" :missed="missed" @again="start"
  >
    <div class="sky" :class="`sky--${phase}`">
      <div v-if="word" class="drop" :style="{ top: `calc(${Math.min(1, y) * 100}% - ${Math.min(1, y) * 64}px)` }">
        <span class="lt drop__lt">{{ word.headword }}</span>
        <span v-if="phase === 'miss'" class="drop__ans zh">{{ glossOf(word) }}</span>
      </div>
      <div class="ground" />
    </div>
    <div class="opts">
      <button
        v-for="o in options" :key="o.id"
        class="opt zh"
        :class="{ 'opt--right': phase !== 'fall' && o.correct, 'opt--wrong': picked === o.id && !o.correct }"
        :disabled="phase !== 'fall'"
        @click="pick(o)"
      >{{ o.zh }}</button>
    </div>
  </GameShell>
</template>

<style scoped>
.sky { position: relative; height: min(46dvh, 380px); border-radius: var(--radius-lg); background: linear-gradient(var(--surface), var(--surface-2)); border: 1px solid var(--rule); overflow: hidden; }
.drop { position: absolute; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.drop__lt { font-size: clamp(1.6rem, 8vw, 2.2rem); padding: 0.3em 0.7em; }
.sky--hit .drop__lt { --tb: var(--jade-wash); --te: var(--jade); --tc: var(--jade-ink); animation: pop-in 0.2s; }
.sky--miss .drop__lt { --tb: var(--rose-wash); --te: var(--rose); --tc: var(--rose); animation: shake 0.3s; }
.drop__ans { font-weight: 800; background: var(--surface); padding: 2px 10px; border-radius: var(--radius-pill); }
.ground { position: absolute; left: 0; right: 0; bottom: 0; height: 8px; background: repeating-linear-gradient(90deg, var(--rule-strong) 0 12px, transparent 12px 20px); }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); margin-top: var(--sp-4); }
.opt { min-height: 68px; padding: 8px; border-radius: var(--radius); background: var(--surface); border: 1.5px solid var(--rule-strong); font-weight: 700; font-size: var(--step-0); line-height: 1.25; }
.opt:active:not(:disabled) { transform: scale(0.97); }
.opt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade-ink); }
.opt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
</style>
