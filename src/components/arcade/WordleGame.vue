<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { useWords } from '@/stores/words'
import { useToast } from '@/stores/toast'
import { wordleAnswers, wordleAllowed, dailyAnswer, dayNumber, scoreGuess } from '@/lib/arcade'
import { glossOf, shuffle } from '@/lib/game'
import { sfx, buzz } from '@/lib/sfx'
import GameShell from './GameShell.vue'
import WordAnatomy from '@/components/WordAnatomy.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * 每日猜字 — Wordle on the NGSL list. One shared puzzle a day (the same on
 * both devices), six guesses, every guess must be a real word from the list
 * or one of its forms. The answer then opens as a word card — parts, sound,
 * meaning — so the puzzle ends on learning, not just on a colour grid.
 *
 * Spelling from memory under constraint is retrieval at the hardest rung of
 * the ladder (拼得出), done as play.
 */
const auth = useAuth()
const words = useWords()
const toast = useToast()

const ANSWERS = wordleAnswers(words.allBase)
const ALLOWED = wordleAllowed(words.allBase)
const ROWS = 6

const mode = ref('daily')        // daily | practice
const answer = ref('')
const guesses = ref([])
const typing = ref('')
const shakeRow = ref(false)
const done = ref(false)
const won = ref(false)
const hintShown = ref(false)

const DKEY = () => `ngsl.wordle.${auth.userId || 'anon'}`
function readStats () { try { return JSON.parse(localStorage.getItem(DKEY()) || '{}') } catch { return {} } }
function writeStats (s) { try { localStorage.setItem(DKEY(), JSON.stringify(s)) } catch { /* ignore */ } }
const stats = ref(readStats())

function load (m) {
  mode.value = m
  hintShown.value = false
  typing.value = ''
  if (m === 'daily') {
    const day = dayNumber()
    answer.value = dailyAnswer(ANSWERS, day)
    const saved = stats.value.today?.day === day ? stats.value.today : null
    guesses.value = saved?.guesses || []
    done.value = !!saved?.done
    won.value = !!saved?.won
    hintShown.value = !!saved?.hint
  } else {
    answer.value = shuffle(ANSWERS, Date.now())[0]
    guesses.value = []; done.value = false; won.value = false
  }
}

function persist () {
  if (mode.value !== 'daily') return
  const s = { ...stats.value }
  s.today = { day: dayNumber(), guesses: guesses.value, done: done.value, won: won.value, hint: hintShown.value }
  stats.value = s; writeStats(s)
}

const answerWord = computed(() => {
  const id = words.lookup(answer.value)
  return id ? words.get(id) : null
})
const gloss = computed(() => answerWord.value ? glossOf(answerWord.value) : '')

const board = computed(() => {
  const rows = guesses.value.map(g => ({ letters: g.split(''), marks: scoreGuess(g, answer.value) }))
  if (!done.value && rows.length < ROWS) rows.push({ letters: typing.value.padEnd(5, ' ').split(''), marks: null, current: true })
  while (rows.length < ROWS) rows.push({ letters: '     '.split(''), marks: null })
  return rows
})

const keyState = computed(() => {
  const st = {}
  const rank = { miss: 0, near: 1, hit: 2 }
  for (const g of guesses.value) {
    scoreGuess(g, answer.value).forEach((m, i) => {
      const ch = g[i]
      if (st[ch] == null || rank[m] > rank[st[ch]]) st[ch] = m
    })
  }
  return st
})

function press (k) {
  if (done.value) return
  if (k === 'enter') return submit()
  if (k === 'del') { typing.value = typing.value.slice(0, -1); return }
  if (/^[a-z]$/.test(k) && typing.value.length < 5) { typing.value += k; sfx('tap') }
}

function submit () {
  const g = typing.value
  if (g.length < 5) { nope('要五個字母'); return }
  if (!ALLOWED.has(g)) { nope('這個字不在字表裡'); return }
  guesses.value = [...guesses.value, g]
  typing.value = ''
  if (g === answer.value) {
    done.value = true; won.value = true
    sfx('win')
    finishStats(true)
  } else if (guesses.value.length >= ROWS) {
    done.value = true; won.value = false
    sfx('lose')
    finishStats(false)
  } else sfx('soft')
  persist()
}

function nope (msg) {
  shakeRow.value = true; buzz(30); sfx('bad')
  toast.info(msg)
  setTimeout(() => { shakeRow.value = false }, 400)
}

function finishStats (w) {
  if (mode.value !== 'daily') return
  const s = { ...stats.value }
  const day = dayNumber()
  s.played = (s.played || 0) + 1
  if (w) {
    s.won = (s.won || 0) + 1
    s.streak = s.lastWin === day - 1 ? (s.streak || 0) + 1 : 1
    s.lastWin = day
    s.best = Math.max(s.best || 0, s.streak)
  } else s.streak = 0
  stats.value = s; writeStats(s)
}

function showHint () {
  hintShown.value = true
  persist()
}

function onKey (e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'enter') press('enter')
  else if (k === 'backspace') press('del')
  else if (/^[a-z]$/.test(k)) press(k)
}

const KB = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

onMounted(() => { load('daily'); window.addEventListener('keydown', onKey) })
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <GameShell title="每日猜字" :score="stats.streak || 0" score-label="連勝">
    <p class="wd__mode zh">{{ mode === 'daily' ? '今天的題目，每個人都一樣' : '練習題，不計連勝' }}</p>

    <div class="board" role="grid" aria-label="猜字盤">
      <div v-for="(r, ri) in board" :key="ri" class="brow" :class="{ shake: r.current && shakeRow }" role="row">
        <span
          v-for="(ch, ci) in r.letters" :key="ci"
          class="cell" :class="[r.marks ? `cell--${r.marks[ci]}` : '', { 'cell--typed': r.current && ch.trim() }]"
          :style="r.marks ? { animationDelay: ci * 0.09 + 's' } : null"
          role="gridcell"
        >{{ ch.trim() }}</span>
      </div>
    </div>

    <div class="legend wd__legend">
      <span class="legend__k"><span class="sw sw--hit" />字母和位置都對</span>
      <span class="legend__k"><span class="sw sw--near" />有這個字母，位置不對</span>
      <span class="legend__k"><span class="sw sw--miss" />沒有這個字母</span>
    </div>

    <template v-if="!done">
      <button v-if="!hintShown && gloss" class="btn btn--quiet btn--sm zh wd__hint" @click="showHint">看中文提示</button>
      <p v-else-if="hintShown && gloss" class="wd__hinttext zh">提示：{{ gloss }}</p>
      <div class="kb">
        <div v-for="(row, i) in KB" :key="i" class="kb__row">
          <button v-if="i === 2" class="key key--wide zh" @click="press('enter')">送出</button>
          <button v-for="k in row" :key="k" class="key" :class="keyState[k] ? `key--${keyState[k]}` : ''" @click="press(k)">{{ k }}</button>
          <button v-if="i === 2" class="key key--wide" aria-label="刪除" @click="press('del')">⌫</button>
        </div>
      </div>
    </template>

    <section v-else class="wd__end card">
      <p class="wd__verdict zh">{{ won ? `${guesses.length} 次就猜中！` : '這次沒猜到，答案是：' }}</p>
      <WordAnatomy :word="answer" size="md" />
      <div class="wd__mean">
        <span class="zh">{{ gloss || '（這個字還沒有翻譯，學到它時會補上）' }}</span>
        <AudioButton :text="answer" size="md" />
      </div>
      <p v-if="mode === 'daily'" class="wd__stats zh">玩過 <b class="num">{{ stats.played || 0 }}</b> 次，猜中 <b class="num">{{ stats.won || 0 }}</b> 次，最長連勝 <b class="num">{{ stats.best || 0 }}</b></p>
      <button class="btn btn--primary btn--block zh" @click="load('practice')">再來一題練習</button>
    </section>
  </GameShell>
</template>

<style scoped>
.wd__mode { text-align: center; font-size: var(--step--1); color: var(--ink-3); margin-bottom: var(--sp-3); }
.board { display: grid; gap: 6px; justify-content: center; }
.brow { display: grid; grid-template-columns: repeat(5, min(15vw, 58px)); gap: 6px; }
.cell {
  aspect-ratio: 1; display: grid; place-items: center;
  font-family: var(--font-word); font-weight: 700; font-size: clamp(1.4rem, 7vw, 1.9rem); text-transform: uppercase;
  border: 2px solid var(--rule-strong); border-radius: 10px; background: var(--surface);
}
.cell--typed { border-color: var(--ink-3); animation: pop-in 0.1s; }
.cell--hit, .cell--near, .cell--miss { animation: flip 0.45s both; color: #fff; }
.cell--hit { background: var(--jade); border-color: var(--jade); box-shadow: 0 3px 0 var(--jade-ink); }
.cell--near { background: var(--sun); border-color: var(--sun-edge); color: var(--sun-ink); box-shadow: 0 3px 0 var(--sun-edge); }
.cell--miss { background: var(--ink-3); border-color: var(--ink-3); }
@keyframes flip { 0% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
.wd__legend { justify-content: center; margin: var(--sp-3) 0; }
.sw { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.sw--hit { background: var(--jade); } .sw--near { background: var(--sun); } .sw--miss { background: var(--ink-3); }
.wd__hint { align-self: center; }
.wd__hinttext { text-align: center; font-weight: 700; color: var(--ink-2); }
.kb { display: flex; flex-direction: column; gap: 7px; margin-top: var(--sp-3); }
.kb__row { display: flex; justify-content: center; gap: 5px; }
.key { flex: 1; max-width: 42px; height: 52px; border-radius: 8px; background: var(--surface-3); font-family: var(--font-word); font-weight: 700; font-size: 1rem; text-transform: uppercase; color: var(--ink); }
.key--wide { max-width: 64px; flex: 1.5; font-size: 0.82rem; text-transform: none; }
.key--hit { background: var(--jade); color: #fff; }
.key--near { background: var(--sun); color: var(--sun-ink); }
.key--miss { background: var(--ink-3); color: var(--paper); opacity: 0.7; }
.key:active { transform: translateY(1px); }
.wd__end { margin-top: var(--sp-4); padding: var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; }
.wd__verdict { font-weight: 800; font-size: var(--step-1); }
.wd__mean { display: flex; align-items: center; gap: var(--sp-3); font-weight: 700; font-size: var(--step-1); }
.wd__stats { font-size: var(--step--1); color: var(--ink-2); }
.shake { animation: shake 0.35s; }
</style>
