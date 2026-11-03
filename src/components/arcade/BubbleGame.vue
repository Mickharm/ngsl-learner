<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useAuth } from '@/stores/auth'
import { useSettings } from '@/stores/settings'
import { useGamePool } from '@/composables/useGamePool'
import { wordOptions, glossOf } from '@/lib/game'
import { readBest, saveBest, dealDeck, QUEST_GOAL } from '@/lib/arcade'
import { speak } from '@/lib/tts'
import { sfx, buzz } from '@/lib/sfx'
import GameShell from './GameShell.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * 泡泡聽力 — hear a word, pop the bubble that carries it. The other bubbles
 * are its look-alikes (same first letter, close spelling, its confusables),
 * so the game trains telling words apart by sound.
 *
 * v4: bubbles rise on a CSS animation (compositor-only, no per-frame work in
 * JS); the round is lost when the right bubble's animation ends. A miss stops
 * the game until 繼續, with the word replayed.
 */
const auth = useAuth()
const settings = useSettings()
const { pool, todayIds, inPhase } = useGamePool(12)

const deck = ref([])
const n = ref(0)
const lives = ref(3)
const score = ref(0)
const combo = ref(0)
const state = ref('play')      // play | hit | miss
const popped = ref(new Set())
const over = ref(false)
const newBest = ref(false)
const best = ref(readBest(auth.userId).bubbles ?? null)
const missed = ref([])
const answered = ref(0)
const tank = ref(null)
const rise = ref(500)
const dur = ref(7000)
let t0 = 0, timer = 0

const goal = computed(() => inPhase.value ? QUEST_GOAL.bubbles : null)
const word = computed(() => deck.value[n.value % Math.max(1, deck.value.length)] || null)
const bubbles = computed(() => {
  if (!word.value) return []
  const opts = wordOptions(word.value, pool.value, n.value * 7 + 3)
  const lags = [0, 0.16, 0.07, 0.24]
  return opts.map((o, i) => ({ ...o, lane: i, lag: lags[i % 4], sway: i % 2 ? 'r' : 'l' }))
})

function say () {
  if (word.value) speak(word.value.headword, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
}

async function spawn () {
  state.value = 'play'; popped.value = new Set()
  dur.value = Math.max(4200, 8000 - n.value * 160)
  await nextTick()
  rise.value = (tank.value?.clientHeight || 460) + 110
  t0 = performance.now()
  say()
}

function escaped (b) {
  if (b.correct && state.value === 'play' && !popped.value.has(b.text)) miss()
}

function miss () {
  state.value = 'miss'; combo.value = 0; lives.value--; answered.value++
  sfx('bad'); buzz(60)
  if (word.value && !missed.value.some(w => w.id === word.value.id)) missed.value.push(word.value)
  say()
}

function pop (b) {
  if (state.value !== 'play' || popped.value.has(b.text)) return
  popped.value = new Set([...popped.value, b.text])
  if (b.correct) {
    state.value = 'hit'; combo.value++; answered.value++
    const speed = Math.max(0, 1 - (performance.now() - t0) / dur.value)
    score.value += Math.round((10 + 20 * speed) * (combo.value >= 5 ? 2 : 1))
    sfx(combo.value % 5 === 0 ? 'combo' : 'pop')
    timer = setTimeout(advance, 480)
  } else {
    miss()
  }
}

function advance () {
  if (lives.value <= 0 || (goal.value && answered.value >= goal.value)) return finish()
  n.value++; spawn()
}
function finish () {
  over.value = true
  newBest.value = saveBest(auth.userId, 'bubbles', score.value)
  best.value = readBest(auth.userId).bubbles
  sfx(newBest.value || lives.value > 0 ? 'win' : 'lose')
}
const stars = computed(() => score.value >= 350 ? 3 : score.value >= 150 ? 2 : score.value >= 50 ? 1 : 0)

function start () {
  clearTimeout(timer)
  deck.value = dealDeck(pool.value, inPhase.value ? todayIds.value : null)
  n.value = 0; lives.value = 3; score.value = 0; combo.value = 0; answered.value = 0
  missed.value = []; over.value = false; newBest.value = false
  spawn()
}
onMounted(start)
onUnmounted(() => clearTimeout(timer))
</script>

<template>
  <GameShell
    title="泡泡聽力" :over="over" :score="score" :lives="lives" :combo="combo"
    :best="best" :new-best="newBest" :stars="stars" :missed="missed"
    :goal="goal ? { done: answered, total: goal } : null" @again="start"
  >
    <div ref="tank" class="tank" :style="{ '--rise': `-${rise}px`, '--dur': `${dur}ms` }">
      <template v-if="state !== 'miss'">
        <button
          v-for="b in bubbles" :key="n + ':' + b.text"
          class="bub"
          :class="{ 'bub--pop': popped.has(b.text) && b.correct, 'bub--bad': popped.has(b.text) && !b.correct, 'bub--held': state === 'hit' }"
          :style="{ left: `${4 + b.lane * 24}%`, animationDelay: `${b.lag * dur}ms` }"
          @animationend.self="escaped(b)"
          @click="pop(b)"
        ><span class="bub__in" :class="`bub__in--${b.sway}`">{{ b.text }}</span></button>
      </template>
      <div v-else-if="word" class="missbox">
        <p class="missbox__lead zh">剛剛說的是</p>
        <p class="missbox__w"><b>{{ word.headword }}</b><AudioButton :text="word.headword" size="sm" /></p>
        <p class="missbox__zh">{{ glossOf(word) }}</p>
        <button class="btn btn--block btn--ink zh" @click="advance">{{ lives > 0 ? '記住了，繼續' : '看結果' }}</button>
      </div>
    </div>
    <button v-if="state === 'play'" class="again zh" @click="say">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
      再聽一次
    </button>
  </GameShell>
</template>

<style scoped>
.tank {
  position: relative; height: min(56dvh, 460px); overflow: hidden; border-radius: var(--radius);
  border-radius: var(--radius-xl);
  background: var(--surface); -webkit-backdrop-filter: blur(20px) saturate(112%); backdrop-filter: blur(20px) saturate(112%);
  box-shadow: var(--rim), var(--shadow-1);
}
.bub {
  position: absolute; bottom: -96px; width: 22%; aspect-ratio: 1; padding: 0;
  animation: bub-rise var(--dur) linear forwards; will-change: transform;
}
@keyframes bub-rise { to { transform: translate3d(0, var(--rise), 0); } }
.bub--held { animation-play-state: paused; }
.bub__in {
  width: 100%; height: 100%; border-radius: 50%;
  display: grid; place-items: center; padding: 4px;
  font-family: var(--font-word); font-weight: 700; font-size: clamp(0.8rem, 3.8vw, 1.05rem); color: var(--ink);
  background: radial-gradient(circle at 30% 26%, #ffffffd9 0 10%, transparent 11%), color-mix(in srgb, var(--hl-blue) 70%, transparent);
  border: 1.5px solid var(--t-suffix-edge);
  word-break: break-word; line-height: 1.1;
  animation: sway 2.4s ease-in-out infinite alternate;
}
.bub__in--r { animation-direction: alternate-reverse; }
@keyframes sway { from { transform: translateX(-5px); } to { transform: translateX(5px); } }
.bub--pop .bub__in { animation: popout 0.3s forwards; background: var(--hl-green); border-color: var(--jade); }
.bub--bad .bub__in { background: var(--redpen-wash); border-color: var(--redpen); color: var(--redpen); }
@keyframes popout { to { transform: scale(1.5); opacity: 0; } }
.missbox { position: absolute; inset: auto var(--sp-3) var(--sp-3); display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4); animation: rise 0.18s ease-out; }
.missbox__lead { font-size: var(--step--1); color: var(--ink-3); }
.missbox__w { display: flex; align-items: center; gap: var(--sp-2); font-family: var(--font-word); font-size: var(--step-2); }
.missbox__zh { font-size: var(--step-1); color: var(--ink-2); }
.again { align-self: center; margin-top: var(--sp-4); display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: var(--radius); background: var(--ink); color: var(--paper); font-weight: 700; }
.again svg { width: 20px; height: 20px; }
@media (prefers-reduced-motion: reduce) {
  .bub__in { animation: none; }
  /* the rise IS the game clock: keep it even when motion is reduced */
  .tank .bub { animation-duration: var(--dur) !important; }
}
</style>
