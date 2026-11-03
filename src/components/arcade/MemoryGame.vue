<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useGamePool } from '@/composables/useGamePool'
import { shuffle, glossOf } from '@/lib/game'
import { readBest, saveBest, dealDeck } from '@/lib/arcade'
import { speak } from '@/lib/tts'
import { sfx } from '@/lib/sfx'
import GameShell from './GameShell.vue'

/**
 * 翻牌記憶 — twelve cards face down, six English and six Chinese. Turn two;
 * a pair stays up. Holding where a card was while recalling what it pairs
 * with is retrieval in both directions at once. Fewer turns, more points.
 */
const auth = useAuth()
const settings = useSettings()
const { pool, todayIds, inPhase } = useGamePool(8)

const cards = ref([])
const open = ref([])
const matched = ref(new Set())
const moves = ref(0)
const secs = ref(0)
const over = ref(false)
const newBest = ref(false)
const best = ref(readBest(auth.userId).memory ?? null)
let clock = 0, lock = false

function deal () {
  const ws = []
  const seen = new Set()
  for (const w of dealDeck(pool.value, inPhase.value ? todayIds.value : null)) {
    const g = glossOf(w)
    if (seen.has(g)) continue
    seen.add(g); ws.push(w)
    if (ws.length === 6) break
  }
  cards.value = shuffle(ws.flatMap(w => [
    { key: w.id + 'e', id: w.id, side: 'en', text: w.headword },
    { key: w.id + 'z', id: w.id, side: 'zh', text: glossOf(w) }
  ]), Date.now() + 1)
}

function flip (c) {
  if (lock || over.value || matched.value.has(c.id) || open.value.includes(c)) return
  sfx('tap')
  if (c.side === 'en') speak(c.text, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI })
  open.value = [...open.value, c]
  if (open.value.length < 2) return
  moves.value++
  const [a, b] = open.value
  if (a.id === b.id) {
    matched.value = new Set([...matched.value, a.id])
    open.value = []
    sfx('good')
    if (matched.value.size === 6) finish()
  } else {
    lock = true
    setTimeout(() => { open.value = []; lock = false; sfx('soft') }, 850)
  }
}

const score = computed(() => Math.max(10, 200 - moves.value * 8 - secs.value))
function finish () {
  clearInterval(clock)
  over.value = true
  newBest.value = saveBest(auth.userId, 'memory', score.value)
  best.value = readBest(auth.userId).memory
  sfx('win')
}
const stars = computed(() => moves.value <= 9 ? 3 : moves.value <= 13 ? 2 : 1)

function start () {
  clearInterval(clock)
  deal(); open.value = []; matched.value = new Set(); moves.value = 0; secs.value = 0
  over.value = false; newBest.value = false
  clock = setInterval(() => { secs.value++ }, 1000)
}
onMounted(start)
onUnmounted(() => clearInterval(clock))
</script>

<template>
  <GameShell title="翻牌記憶" :over="over" :score="over ? score : moves" :score-label="over ? '分' : '步'" :best="best" :new-best="newBest" :stars="stars" @again="start">
    <p class="mem__info zh">翻開兩張：英文和它的中文是一對。用了 <b class="num">{{ secs }}</b> 秒</p>
    <div class="grid">
      <button
        v-for="c in cards" :key="c.key"
        class="card3"
        :class="{ 'card3--open': open.includes(c) || matched.has(c.id), 'card3--done': matched.has(c.id) }"
        :aria-label="open.includes(c) || matched.has(c.id) ? c.text : '蓋著的牌'"
        @click="flip(c)"
      >
        <span class="card3__in">
          <span class="card3__back" aria-hidden="true">?</span>
          <span class="card3__face" :class="c.side === 'en' ? 'card3__face--en' : 'zh'">{{ c.text }}</span>
        </span>
      </button>
    </div>
  </GameShell>
</template>

<style scoped>
.mem__info { text-align: center; color: var(--ink-2); font-size: var(--step--1); margin-bottom: var(--sp-3); }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.card3 { aspect-ratio: 3 / 3.4; perspective: 600px; padding: 0; background: none; border: 0; }
.card3__in { position: relative; display: block; width: 100%; height: 100%; transition: transform 0.35s; transform-style: preserve-3d; }
.card3--open .card3__in { transform: rotateY(180deg); }
.card3__back, .card3__face { position: absolute; inset: 0; display: grid; place-items: center; border-radius: var(--radius); backface-visibility: hidden; -webkit-backface-visibility: hidden; padding: 6px; text-align: center; line-height: 1.2; }
.card3__back { background: var(--slab); color: var(--slab-ink); font-family: var(--font-word); font-weight: 700; font-size: 1.6rem; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 8px 18px -10px rgba(0, 0, 0, 0.5); background-color: var(--pen); color: #fff; background-image: radial-gradient(circle at 50% 100%, transparent 9px, rgba(255, 255, 255, 0.1) 10px, transparent 11px, transparent 15px, rgba(255, 255, 255, 0.1) 16px, transparent 17px); background-size: 28px 14px; }
.card3__face { transform: rotateY(180deg); background: var(--surface); font-family: var(--font-kai); font-weight: 700; font-size: clamp(0.95rem, 4.2vw, 1.15rem); box-shadow: var(--shadow-1); }
.card3__face--en { font-family: var(--font-word); font-size: clamp(0.95rem, 4.4vw, 1.2rem); }
.card3--done .card3__face { background: var(--hl-green); }
</style>
