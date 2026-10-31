<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useGamePool } from '@/composables/useGamePool'
import { wordOptions, shuffle, glossOf } from '@/lib/game'
import { readBest, saveBest } from '@/lib/arcade'
import { speak } from '@/lib/tts'
import { sfx, buzz } from '@/lib/sfx'
import GameShell from './GameShell.vue'

/**
 * 泡泡聽力 — hear a word, pop the bubble that carries it. The other bubbles
 * are its look-alikes (same first letter, close spelling, its confusables),
 * so the game trains telling words apart by sound, not reading speed.
 */
const auth = useAuth()
const settings = useSettings()
const { pool } = useGamePool(12)

const deck = ref([])
const n = ref(0)
const lives = ref(3)
const score = ref(0)
const combo = ref(0)
const rise = ref(0)
const state = ref('play')      // play | hit | miss
const popped = ref(new Set())
const over = ref(false)
const newBest = ref(false)
const best = ref(readBest(auth.userId).bubbles ?? null)
const missed = ref([])
let raf = 0, t0 = 0, dur = 7000, timer = 0

const word = computed(() => deck.value[n.value % Math.max(1, deck.value.length)] || null)
const bubbles = computed(() => {
  if (!word.value) return []
  const opts = wordOptions(word.value, pool.value, n.value * 7 + 3)
  return opts.map((o, i) => ({ ...o, lane: i, lag: [0, 0.18, 0.08, 0.26][i % 4], wobble: (i % 2 ? 1 : -1) }))
})

function say () {
  if (word.value) speak(word.value.headword, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
}

function spawn () {
  state.value = 'play'; popped.value = new Set(); rise.value = 0
  dur = Math.max(3800, 7500 - n.value * 150)
  t0 = performance.now()
  say()
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(tick)
}
function tick (t) {
  if (state.value !== 'play') return
  rise.value = (t - t0) / dur
  if (rise.value >= 1.3) { miss(); return }
  raf = requestAnimationFrame(tick)
}

function miss () {
  state.value = 'miss'; combo.value = 0; lives.value--
  sfx('bad'); buzz(60)
  if (word.value && !missed.value.some(w => w.id === word.value.id)) missed.value.push(word.value)
  timer = setTimeout(advance, 1300)
}

function pop (b) {
  if (state.value !== 'play' || popped.value.has(b.text)) return
  popped.value = new Set([...popped.value, b.text])
  if (b.correct) {
    cancelAnimationFrame(raf)
    state.value = 'hit'; combo.value++
    const speed = Math.max(0, 1 - rise.value)
    score.value += Math.round((10 + 20 * speed) * (combo.value >= 5 ? 2 : 1))
    sfx(combo.value % 5 === 0 ? 'combo' : 'pop')
    timer = setTimeout(advance, 450)
  } else {
    cancelAnimationFrame(raf)
    miss()
  }
}

function advance () {
  if (lives.value <= 0) return finish()
  n.value++; spawn()
}
function finish () {
  over.value = true
  newBest.value = saveBest(auth.userId, 'bubbles', score.value)
  best.value = readBest(auth.userId).bubbles
  sfx(newBest.value ? 'win' : 'lose')
}
const stars = computed(() => score.value >= 350 ? 3 : score.value >= 150 ? 2 : score.value >= 50 ? 1 : 0)

function start () {
  clearTimeout(timer); cancelAnimationFrame(raf)
  deck.value = shuffle(pool.value, Date.now())
  n.value = 0; lives.value = 3; score.value = 0; combo.value = 0
  missed.value = []; over.value = false; newBest.value = false
  spawn()
}
onMounted(start)
onUnmounted(() => { cancelAnimationFrame(raf); clearTimeout(timer) })
</script>

<template>
  <GameShell
    title="泡泡聽力" :over="over" :score="score" :lives="lives" :combo="combo"
    :best="best" :new-best="newBest" :stars="stars" :missed="missed" @again="start"
  >
    <div class="tank">
      <button
        v-for="b in bubbles" :key="n + b.text"
        class="bub"
        :class="{ 'bub--pop': popped.has(b.text) && b.correct, 'bub--bad': popped.has(b.text) && !b.correct, 'bub--show': state === 'miss' && b.correct }"
        :style="{
          left: `${6 + b.lane * 23.5}%`,
          bottom: `calc(${Math.max(0, rise - b.lag) * 100}% - 70px)`,
          transform: `translateX(${Math.sin((rise + b.lag) * 9) * 6 * b.wobble}px)`
        }"
        @click="pop(b)"
      >{{ b.text }}</button>
      <p v-if="state === 'miss' && word" class="tank__ans zh">是 <b class="en">{{ word.headword }}</b>：{{ glossOf(word) }}</p>
    </div>
    <button class="again zh" @click="say">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
      再聽一次
    </button>
  </GameShell>
</template>

<style scoped>
.tank { position: relative; height: min(58dvh, 470px); border-radius: var(--radius-lg); background: linear-gradient(180deg, var(--surface-2), var(--surface)); border: 1px solid var(--rule); overflow: hidden; }
.bub {
  position: absolute; width: 22%; aspect-ratio: 1; border-radius: 50%;
  display: grid; place-items: center; padding: 4px;
  font-family: var(--font-word); font-weight: 600; font-size: clamp(0.78rem, 3.6vw, 1rem); color: var(--ink);
  background: radial-gradient(circle at 32% 28%, #ffffffcc 0 12%, transparent 13%), color-mix(in srgb, var(--t-prefix-bg) 80%, transparent);
  border: 2px solid var(--t-prefix-edge);
  word-break: break-word; line-height: 1.1;
}
.bub--pop { animation: popout 0.3s forwards; border-color: var(--jade); background: var(--jade-wash); }
.bub--bad { animation: shake 0.3s; border-color: var(--rose); background: var(--rose-wash); color: var(--rose); }
.bub--show { border-color: var(--jade); border-width: 3px; }
@keyframes popout { to { transform: scale(1.5); opacity: 0; } }
.tank__ans { position: absolute; left: 0; right: 0; top: 40%; text-align: center; font-weight: 700; background: var(--surface); padding: 8px; }
.en { font-family: var(--font-word); }
.again { align-self: center; margin-top: var(--sp-4); display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--radius-pill); background: var(--slab); color: var(--slab-ink); font-weight: 700; }
.again svg { width: 20px; height: 20px; }
</style>
