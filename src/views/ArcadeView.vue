<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { useProgress } from '@/stores/progress'
import { useWords } from '@/stores/words'
import { useSettings } from '@/stores/settings'
import { useAuth } from '@/stores/auth'
import { shuffle } from '@/lib/game'
import { oddRound } from '@/lib/oddOne'
import { speak } from '@/lib/tts'
import MatchPairs from '@/components/games/MatchPairs.vue'
import WordGame from '@/components/games/WordGame.vue'

/**
 * 遊樂場 — free play on words already met. Nothing here reaches the
 * scheduler: it is extra retrieval practice the learner chooses, Marzano's
 * step 6 ("involve students in games that let them play with the terms").
 *
 *   配對      連連看 against the clock
 *   拼字蜂    spell from picture + sound, ten in a row
 *   聽音辨義  hear it, pick the meaning
 *   誰不一樣  three of a theme and one intruder — works from day one
 */
const progress = useProgress()
const words = useWords()
const settings = useSettings()
const auth = useAuth()

const game = ref(null)        // null | match | spell | listen | odd
const round = ref(0)
const score = ref(0)
const total = ref(0)
const seed = ref(Date.now() % 100000)

const BEST = () => `ngsl.arcade.${auth.userId || 'anon'}`
function readBest () { try { return JSON.parse(localStorage.getItem(BEST()) || '{}') } catch { return {} } }
const best = ref(readBest())
function saveBest (key, val, higherIsBetter = true) {
  const cur = best.value[key]
  if (cur == null || (higherIsBetter ? val > cur : val < cur)) {
    best.value = { ...best.value, [key]: val }
    try { localStorage.setItem(BEST(), JSON.stringify(best.value)) } catch { /* ignore */ }
    return true
  }
  return false
}

/** Words the learner has met and that have meanings. */
const known = computed(() => {
  const ids = [...progress.cards.values()].filter(c => c.state !== 'new').map(c => c.wordId)
  return words.getMany(ids).filter(w => w.meanings?.length)
})
const knownHeads = computed(() => new Set(known.value.map(w => w.headword.toLowerCase())))
const enoughWords = computed(() => known.value.length >= 6)

const deck = ref([])
const idx = ref(0)
const finished = ref(false)
const newBest = ref(false)
const startedAt = ref(0)

function start (g) {
  game.value = g
  seed.value = Date.now() % 100000
  score.value = 0; total.value = 0; idx.value = 0; finished.value = false; newBest.value = false
  startedAt.value = Date.now()
  if (g === 'match') deck.value = shuffle(known.value, seed.value).slice(0, 5)
  if (g === 'spell') deck.value = shuffle(known.value.filter(w => /^[a-z]+$/i.test(w.headword)), seed.value).slice(0, 10)
  if (g === 'listen') deck.value = shuffle(known.value, seed.value).slice(0, 10)
  if (g === 'odd') { deck.value = []; round.value = 0; nextOdd() }
}

function back () { game.value = null }

/* match */
function onMatch ({ mistakes, ms }) {
  finished.value = true
  score.value = Math.round(ms / 1000)
  total.value = mistakes
  newBest.value = saveBest('match', score.value + mistakes * 3, false)
}

/* spell / listen */
function onWord (a) { total.value++; if (a.correct) score.value++ }
function nextWord () {
  if (idx.value + 1 < deck.value.length) idx.value++
  else { finished.value = true; newBest.value = saveBest(game.value, score.value) }
}

/* odd one out */
const odd = ref(null)
const oddPicked = ref(null)
function nextOdd () {
  odd.value = oddRound(seed.value + round.value * 7919, knownHeads.value)
  oddPicked.value = null
}
function pickOdd (o, i) {
  if (oddPicked.value !== null) return
  oddPicked.value = i
  total.value++
  if (o.odd) score.value++
  speak(o.word, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
}
function oddNext () {
  round.value++
  if (round.value >= 10) { finished.value = true; newBest.value = saveBest('odd', score.value); return }
  nextOdd()
}

const pool = computed(() => known.value)
onUnmounted(() => { game.value = null })
</script>

<template>
  <main class="shell arc">
    <!-- ===== hub ===== -->
    <template v-if="!game">
      <header>
        <div class="eyebrow">Arcade</div>
        <h1 class="page-title zh">遊樂場</h1>
        <p class="arc__lead zh">用你學過的字玩。不影響複習排程，想玩多少都可以。</p>
      </header>
      <div class="games">
        <button class="gcard" :disabled="!enoughWords" @click="start('match')">
          <span class="gcard__ico">🧩</span><span class="gcard__t zh">配對</span><span class="gcard__d zh">圖片配英文，越快越好</span>
          <span v-if="best.match != null" class="gcard__best num">最佳 {{ best.match }}</span>
        </button>
        <button class="gcard" :disabled="!enoughWords" @click="start('spell')">
          <span class="gcard__ico">🐝</span><span class="gcard__t zh">拼字蜂</span><span class="gcard__d zh">看圖聽音，拼出 10 個字</span>
          <span v-if="best.spell != null" class="gcard__best num">最佳 {{ best.spell }}/10</span>
        </button>
        <button class="gcard" :disabled="!enoughWords" @click="start('listen')">
          <span class="gcard__ico">🎧</span><span class="gcard__t zh">聽音辨義</span><span class="gcard__d zh">只聽聲音，選出意思</span>
          <span v-if="best.listen != null" class="gcard__best num">最佳 {{ best.listen }}/10</span>
        </button>
        <button class="gcard" @click="start('odd')">
          <span class="gcard__ico">🤔</span><span class="gcard__t zh">誰不一樣</span><span class="gcard__d zh">四個字裡找出不同類的那個</span>
          <span v-if="best.odd != null" class="gcard__best num">最佳 {{ best.odd }}/10</span>
        </button>
      </div>
      <p v-if="!enoughWords" class="dim zh arc__note">再學幾個新字（至少 6 個）就能玩前三個遊戲。「誰不一樣」現在就能玩。</p>
    </template>

    <!-- ===== a game ===== -->
    <template v-else>
      <div class="arc__bar">
        <button class="btn btn--quiet btn--sm zh" @click="back">← 遊樂場</button>
        <span v-if="game !== 'match'" class="num">{{ score }} / {{ total }}</span>
      </div>

      <section v-if="finished" class="fin">
        <div class="fin__big">{{ newBest ? '🏆' : '🎉' }}</div>
        <p v-if="game === 'match'" class="zh">用了 <b class="num">{{ score }}</b> 秒，配錯 <b class="num">{{ total }}</b> 次</p>
        <p v-else class="zh">答對 <b class="num">{{ score }}</b> / <span class="num">{{ total }}</span></p>
        <p v-if="newBest" class="fin__best zh">新紀錄！</p>
        <div class="row row-2">
          <button class="btn btn--ghost zh" @click="back">換一個遊戲</button>
          <button class="btn btn--primary zh" @click="start(game)">再玩一次</button>
        </div>
      </section>

      <MatchPairs v-else-if="game === 'match'" :words="deck" :seed="seed" :count="5" @done="onMatch" />

      <WordGame
        v-else-if="(game === 'spell' || game === 'listen') && deck[idx]"
        :key="game + idx"
        :word="deck[idx]"
        :mode="game"
        :pool="pool"
        :seed="seed + idx"
        @answer="onWord"
        @next="nextWord"
      />

      <section v-else-if="game === 'odd' && odd" class="odd">
        <p class="odd__q zh">哪一個不屬於同一類？ <span class="num dim">{{ round + 1 }}/10</span></p>
        <div class="odd__grid">
          <button
            v-for="(o, i) in odd.options" :key="o.word"
            class="oddc"
            :class="{ 'oddc--right': oddPicked !== null && o.odd, 'oddc--wrong': oddPicked === i && !o.odd }"
            :disabled="oddPicked !== null"
            @click="pickOdd(o, i)"
          >
            <span class="oddc__pic">{{ o.emoji }}</span>
            <span class="oddc__w">{{ o.word }}</span>
          </button>
        </div>
        <div v-if="oddPicked !== null" class="card odd__fb">
          <p class="zh">其他三個都是<b>「{{ odd.label }}」</b>，<b>{{ odd.options.find(o => o.odd).word }}</b> 屬於「{{ odd.oddLabel }}」。</p>
          <button class="btn btn--primary btn--block zh" @click="oddNext">下一題</button>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.arc { display: flex; flex-direction: column; gap: var(--sp-4); }
.arc__lead { font-size: var(--step--1); color: var(--ink-2); margin-top: 4px; }
.arc__note { font-size: var(--step--1); line-height: 1.6; }
.games { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.gcard {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  padding: var(--sp-4); border-radius: var(--radius-lg);
  background: var(--surface); border: 1px solid var(--rule); box-shadow: var(--shadow-1);
  text-align: left; min-height: 140px;
}
.gcard:disabled { opacity: 0.45; }
.gcard:active:not(:disabled) { transform: scale(0.98); }
.gcard__ico { font-size: 2rem; }
.gcard__t { font-weight: 800; font-size: var(--step-1); }
.gcard__d { font-size: var(--step--2); color: var(--ink-3); line-height: 1.45; }
.gcard__best { margin-top: auto; font-size: var(--step--2); color: var(--amber); }
.arc__bar { display: flex; justify-content: space-between; align-items: center; }
.fin { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding-top: var(--sp-6); text-align: center; }
.fin__big { font-size: 4rem; }
.fin__best { color: var(--amber); font-weight: 800; }
.odd { display: flex; flex-direction: column; gap: var(--sp-3); }
.odd__q { font-weight: 700; text-align: center; }
.odd__grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.oddc { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--sp-4) var(--sp-2); border-radius: var(--radius); border: 1.5px solid var(--rule-strong); background: var(--surface); }
.oddc__pic { font-size: 2.6rem; line-height: 1; }
.oddc__w { font-family: var(--font-word); font-size: var(--step-1); }
.oddc--right { border-color: var(--jade); background: var(--jade-wash); }
.oddc--wrong { border-color: var(--rose); background: var(--rose-wash); }
.odd__fb { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); font-size: var(--step--1); line-height: 1.6; }
</style>
