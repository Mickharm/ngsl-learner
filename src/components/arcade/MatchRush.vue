<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { useGamePool } from '@/composables/useGamePool'
import { shuffle } from '@/lib/game'
import { readBest, saveBest, dealDeck } from '@/lib/arcade'
import { sfx } from '@/lib/sfx'
import GameShell from './GameShell.vue'
import MatchPairs from '@/components/games/MatchPairs.vue'

/** 極速連連看 — three rounds of five pairs against the clock. */
const auth = useAuth()
const { pool, todayIds, inPhase } = useGamePool(15)
const ROUNDS = 3

const round = ref(0)
const deck = ref([])
const secs = ref(0)
const mistakes = ref(0)
const over = ref(false)
const newBest = ref(false)
const best = ref(readBest(auth.userId).match ?? null)
let clock = 0

const words = computed(() => deck.value.slice(round.value * 5, round.value * 5 + 5))
const score = computed(() => Math.max(10, 300 - secs.value * 3 - mistakes.value * 10))
const stars = computed(() => score.value >= 200 ? 3 : score.value >= 120 ? 2 : 1)

function onDone (r) {
  mistakes.value += r.mistakes || 0
  sfx('combo')
  if (round.value + 1 < ROUNDS) round.value++
  else finish()
}
function finish () {
  clearInterval(clock)
  over.value = true
  newBest.value = saveBest(auth.userId, 'match', score.value)
  best.value = readBest(auth.userId).match
  sfx('win')
}
function start () {
  clearInterval(clock)
  deck.value = dealDeck(pool.value, inPhase.value ? todayIds.value : null).slice(0, ROUNDS * 5)
  round.value = 0; secs.value = 0; mistakes.value = 0; over.value = false; newBest.value = false
  clock = setInterval(() => { secs.value++ }, 1000)
}
onMounted(start)
onUnmounted(() => clearInterval(clock))
</script>

<template>
  <GameShell title="極速連連看" :over="over" :score="over ? score : secs" :score-label="over ? '分' : '秒'" :best="best" :new-best="newBest" :stars="stars" @again="start">
    <p class="mr__info zh">第 <b class="num">{{ round + 1 }}</b> / {{ ROUNDS }} 輪，錯 <b class="num">{{ mistakes }}</b> 次</p>
    <MatchPairs v-if="words.length" :key="round" :words="words" :seed="round + 5" :count="words.length" @done="onDone" />
  </GameShell>
</template>

<style scoped>
.mr__info { text-align: center; color: var(--ink-2); font-size: var(--step--1); margin-bottom: var(--sp-3); }
</style>
