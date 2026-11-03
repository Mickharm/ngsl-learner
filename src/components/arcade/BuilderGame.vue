<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuth } from '@/stores/auth'
import { useParts } from '@/stores/parts'
import { EXAMPLES, UNITS } from '@/data/morphology'
import { builderItem } from '@/lib/partsGames'
import { readBest, saveBest } from '@/lib/arcade'
import { shuffle } from '@/lib/game'
import { sfx, buzz } from '@/lib/sfx'
import GameShell from './GameShell.vue'

/**
 * 零件積木 — 60 seconds, build as many words from parts as you can. Uses the
 * units the learner has opened in 字首字尾 (the first five before that), so
 * it is practice on parts already taught, against the clock.
 */
const auth = useAuth()
const parts = useParts()
const LIMIT = 60_000

const items = ref([])
const i = ref(0)
const slots = ref([])
const used = ref(new Set())
const score = ref(0)
const combo = ref(0)
const left = ref(1)
const over = ref(false)
const flash = ref('')
const newBest = ref(false)
const best = ref(readBest(auth.userId).builder ?? null)
const built = ref([])
let raf = 0, t0 = 0

const units = computed(() => {
  const opened = UNITS.filter(u => parts.recOf(u.id))
  return (opened.length >= 2 ? opened : UNITS.slice(0, 5)).map(u => u.id)
})
const item = computed(() => items.value[i.value] || null)

function deal () {
  const pool = EXAMPLES.filter(e => units.value.includes(e.unit) && !e.tiles.some(t => t.kind === 'link'))
  items.value = shuffle(pool, Date.now()).slice(0, 60).map((ex, k) => builderItem(ex, pool.filter(p => p.unit === ex.unit), k + 11))
  i.value = 0
  resetSlots()
}
function resetSlots () {
  slots.value = item.value ? item.value.answer.map(() => null) : []
  used.value = new Set()
}
const kindOf = t => item.value?.kinds?.[t] || 'base'

function place (t, k) {
  if (over.value || used.value.has(k)) return
  const at = slots.value.indexOf(null)
  if (at < 0) return
  sfx('tap')
  slots.value[at] = { t, k }
  used.value = new Set([...used.value, k])
  if (!slots.value.includes(null)) check()
}
function unplace (at) {
  if (!slots.value[at]) return
  const u = new Set(used.value); u.delete(slots.value[at].k); used.value = u
  slots.value[at] = null
}
function check () {
  const ok = slots.value.map(s => s.t).join('') === item.value.word
  if (ok) {
    combo.value++
    score.value += 10 * (combo.value >= 5 ? 2 : 1)
    built.value.push(item.value.word)
    flash.value = 'good'
    sfx(combo.value % 5 === 0 ? 'combo' : 'good')
    setTimeout(() => { flash.value = ''; i.value++; resetSlots() }, 280)
  } else {
    combo.value = 0
    flash.value = 'bad'
    sfx('bad'); buzz(40)
    setTimeout(() => { flash.value = ''; resetSlots() }, 350)
  }
}
function skip () { combo.value = 0; i.value++; resetSlots() }

function tick (t) {
  left.value = Math.max(0, 1 - (t - t0) / LIMIT)
  if (left.value <= 0) return finish()
  if (left.value < 0.17 && Math.floor((t - t0) / 1000) !== Math.floor((t - t0 - 16) / 1000)) sfx('tick')
  raf = requestAnimationFrame(tick)
}
function finish () {
  over.value = true
  newBest.value = saveBest(auth.userId, 'builder', score.value)
  best.value = readBest(auth.userId).builder
  sfx(newBest.value ? 'win' : 'lose')
}
const stars = computed(() => score.value >= 150 ? 3 : score.value >= 80 ? 2 : score.value >= 30 ? 1 : 0)

function start () {
  cancelAnimationFrame(raf)
  score.value = 0; combo.value = 0; over.value = false; newBest.value = false; built.value = []
  deal()
  t0 = performance.now(); left.value = 1
  raf = requestAnimationFrame(tick)
}
onMounted(start)
onUnmounted(() => cancelAnimationFrame(raf))
</script>

<template>
  <GameShell
    title="零件積木" :over="over" :score="score" :combo="combo" :time="left"
    :best="best" :new-best="newBest" :stars="stars" @again="start"
  >
    <template v-if="item">
      <div class="ask" :class="flash && `ask--${flash}`">
        <p class="ask__zh zh">{{ item.zh }}</p>
        <p class="ask__pos zh">{{ { 'n.': '名詞', 'v.': '動詞', 'adj.': '形容詞', 'adv.': '副詞', 'pron.': '代名詞' }[item.pos] || '' }}</p>
        <div class="slots">
          <button v-for="(s, k) in slots" :key="k" class="slot" :class="s ? ['lt', `lt--${kindOf(s.t)}`] : 'slot--empty'" @click="unplace(k)">{{ s?.t || '' }}</button>
        </div>
      </div>
      <div class="bank">
        <button v-for="(t, k) in item.bank" :key="i + ':' + k" class="lt" :class="`lt--${kindOf(t)}`" :disabled="used.has(k)" @click="place(t, k)">{{ t }}</button>
      </div>
      <button class="btn btn--quiet btn--sm zh skip" @click="skip">跳過這題</button>
    </template>
    <template #result>
      <p v-if="built.length" class="built"><span v-for="w in built" :key="w" class="lt lt--good">{{ w }}</span></p>
    </template>
  </GameShell>
</template>

<style scoped>
.ask { padding: var(--sp-5) var(--sp-4); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.ask--bad { animation: shake 0.3s; }
.ask__zh { font-size: var(--step-3); font-weight: 900; text-align: center; line-height: 1.2; }
.ask__pos { font-size: var(--step--1); color: var(--ink-3); }
.slots { display: flex; gap: 6px; margin-top: var(--sp-3); flex-wrap: wrap; justify-content: center; }
.slot { min-width: 64px; min-height: 50px; font-size: var(--step-2); }
.slot--empty { border: 2px dashed var(--rule-strong); border-radius: 10px; }
.bank { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 8px; margin-top: var(--sp-5); }
.bank .lt { font-size: var(--step-2); min-height: 52px; padding: 0 14px; }
.skip { align-self: center; margin-top: var(--sp-4); }
.built { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.built .lt { font-size: var(--step--1); }
</style>
