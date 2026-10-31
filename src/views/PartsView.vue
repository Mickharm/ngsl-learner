<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { UNITS, UNIT_BY_ID, PARTS, EXAMPLES } from '@/data/morphology'
import { discoverOf, partsRound } from '@/lib/partsGames'
import { useParts } from '@/stores/parts'
import { useSession } from '@/stores/session'
import { isMastered } from '@/lib/srs'
import { sfx } from '@/lib/sfx'
import SessionHeader from '@/components/SessionHeader.vue'
import AudioButton from '@/components/AudioButton.vue'
import PartsGame from '@/components/parts/PartsGame.vue'

/**
 * 字首字尾 — the Word Parts course.
 *
 *   map       15 units in course order, each with its status
 *   discover  words that share a part; guess what the part means
 *   teach     the parts, their examples as tiles, spelling rules, imposters
 *   play      8 items, five kinds, interleaved (lib/partsGames.js)
 *   result    score → the unit's schedule (concept SRS, like grammar)
 *
 * Opened from the day's quest with ?phase=1 it goes straight to today's unit
 * and hands off to the next phase at the end.
 */
const route = useRoute()
const router = useRouter()
const parts = useParts()
const session = useSession()

const inPhase = computed(() => route.query.phase === '1')
const unitId = ref(null)
const stage = ref('map')              // map | discover | teach | play | result
const unit = computed(() => unitId.value ? UNIT_BY_ID[unitId.value] : null)

const seed = ref(Date.now() % 100000)
const disc = computed(() => unit.value ? discoverOf(unit.value, seed.value) : null)
const discPick = ref(null)

const items = ref([])
const idx = ref(0)
const score = ref(0)
const combo = ref(0)
const best = ref(0)
const result = ref(null)

const current = computed(() => items.value[idx.value] || null)

function open (id) {
  unitId.value = id
  seed.value = Date.now() % 100000
  discPick.value = null
  stage.value = 'discover'
}

function pickDisc (o) {
  if (discPick.value) return
  discPick.value = o
  sfx(o === disc.value.answer ? 'good' : 'soft')
}

function startPlay () {
  items.value = partsRound(unit.value, seed.value, 8)
  idx.value = 0; score.value = 0; combo.value = 0; best.value = 0
  stage.value = 'play'
}

function onAnswer ({ correct }) {
  if (correct) {
    score.value++
    combo.value++
    best.value = Math.max(best.value, combo.value)
    if (combo.value >= 3) sfx('combo')
  } else combo.value = 0
}

function onNext () {
  if (idx.value + 1 < items.value.length) { idx.value++; return }
  result.value = parts.submit(unit.value.id, { correct: score.value, total: items.value.length })
  stage.value = 'result'
  sfx(score.value / items.value.length >= 0.75 ? 'win' : 'soft')
  if (inPhase.value) session.markDone('parts')
}

const stars = computed(() => {
  const r = items.value.length ? score.value / items.value.length : 0
  return r >= 0.95 ? 3 : r >= 0.7 ? 2 : r >= 0.45 ? 1 : 0
})

function leave () {
  if (inPhase.value) router.push(session.nextRoute('parts'))
  else { stage.value = 'map'; unitId.value = null }
}

/* ---- map ---- */
const map = computed(() => UNITS.map((u, i) => {
  const r = parts.recOf(u.id)
  const status = !r ? 'new' : isMastered(r) ? 'mastered' : r.dueAt <= Date.now() ? 'due' : 'learning'
  return { ...u, n: i + 1, status, next: parts.todayUnit?.id === u.id }
}))
const STATUS_ZH = { new: '還沒學', learning: '學過', due: '該複習了', mastered: '熟練' }

/* teach: three examples per part */
const teachParts = computed(() => {
  const u = unit.value
  if (!u) return []
  if (!u.parts.length) return [{ id: null, label: '兩個字', zh: '各自的意思加起來', examples: u.ex.slice(0, 6) }]
  return u.parts.map(id => ({
    id,
    ...PARTS[id],
    examples: u.ex.filter(([, spec]) => spec.split('+').some(t => t === id || t.endsWith('=' + id))).slice(0, 3)
  })).filter(p => p.examples.length)
})
const exByWord = new Map(EXAMPLES.map(e => [e.w, e]))

onMounted(() => {
  session.startClock()
  if (inPhase.value) {
    const u = session.partsUnit || parts.todayUnit
    if (!u) { session.markDone('parts'); router.replace(session.nextRoute('parts')); return }
    open(u.id)
  } else if (route.query.unit && UNIT_BY_ID[route.query.unit]) {
    open(route.query.unit)
  }
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <div class="view">
    <SessionHeader
      :title="unit ? unit.title : '字首字尾'"
      :current="stage === 'play' ? idx + 1 : 0"
      :total="stage === 'play' ? items.length : 0"
      :exit-to="inPhase ? '/' : '/courses'"
    />

    <main class="shell parts">
      <!-- ================= MAP ================= -->
      <template v-if="stage === 'map'">
        <header class="parts__intro">
          <h1 class="page-title zh">字首字尾</h1>
          <p class="parts__lead zh">長的英文字大多是零件拼起來的。學會一個零件，就同時看懂幾十個字。從合成字開始，一路到拉丁字根。</p>
          <div class="legend">
            <span class="legend__k"><span class="legend__sw lt--prefix" />字首：放在前面</span>
            <span class="legend__k"><span class="legend__sw lt--root" />字根：字的核心</span>
            <span class="legend__k"><span class="legend__sw lt--suffix" />字尾：放在後面，常決定詞性</span>
          </div>
        </header>
        <ol class="units">
          <li v-for="u in map" :key="u.id">
            <button class="unit" :class="[`unit--${u.status}`, { 'unit--next': u.next }]" @click="open(u.id)">
              <span class="unit__n num">{{ u.n }}</span>
              <span class="unit__body">
                <span class="unit__title zh">{{ u.title }}</span>
                <span class="unit__parts">
                  <span v-for="p in u.parts.slice(0, 5)" :key="p" class="lt unit__lt" :class="`lt--${PARTS[p].kind}`">{{ PARTS[p].label.split(' ')[0] }}</span>
                  <span v-if="!u.parts.length" class="lt unit__lt">week</span><span v-if="!u.parts.length" class="lt unit__lt">end</span>
                </span>
              </span>
              <span class="unit__status zh">{{ u.next ? '今天' : STATUS_ZH[u.status] }}</span>
            </button>
          </li>
        </ol>
      </template>

      <!-- ================= DISCOVER ================= -->
      <template v-else-if="stage === 'discover' && disc">
        <p class="step zh">先猜猜看</p>
        <div class="disc card">
          <div v-for="e in disc.words" :key="e.w" class="disc__row">
            <span class="disc__tiles">
              <span v-for="(t, i) in e.tiles" :key="i" class="lt" :class="[`lt--${t.kind}`, { 'disc__focus': disc.focus && (t.ref === disc.focus || PARTS[t.ref]?.of === disc.focus) }]">{{ t.text }}</span>
            </span>
            <span class="disc__zh zh">{{ e.zh }}</span>
          </div>
        </div>
        <p class="disc__q zh">{{ disc.q }}</p>
        <div class="opts">
          <button
            v-for="o in disc.options" :key="o"
            class="popt zh"
            :class="{ 'popt--right': discPick && o === disc.answer, 'popt--wrong': discPick === o && o !== disc.answer, 'popt--mute': discPick && discPick !== o && o !== disc.answer }"
            :disabled="!!discPick"
            @click="pickDisc(o)"
          >{{ o }}</button>
        </div>
        <Transition name="slide-up">
          <div v-if="discPick" class="disc__why card">
            <p class="zh"><b>{{ discPick === disc.answer ? '猜對了。' : `答案是「${disc.answer}」。` }}</b>{{ disc.why }}</p>
            <button class="btn btn--primary btn--block zh" @click="stage = 'teach'">看看怎麼用</button>
          </div>
        </Transition>
      </template>

      <!-- ================= TEACH ================= -->
      <template v-else-if="stage === 'teach' && unit">
        <p class="step zh">這個單元的零件</p>
        <p class="hook zh">{{ unit.hook }}</p>

        <section v-for="p in teachParts" :key="p.id || 'compound'" class="tp card">
          <div class="tp__head">
            <span v-if="p.id" class="lt tp__lt" :class="`lt--${p.kind}`">{{ p.label }}</span>
            <span class="tp__zh zh">{{ p.zh }}</span>
            <span v-if="p.pos" class="chip chip--plain zh">變{{ { 'n.': '名詞', 'v.': '動詞', 'adj.': '形容詞', 'adv.': '副詞' }[p.pos] }}</span>
          </div>
          <p v-if="p.more" class="tp__more zh">{{ p.more }}</p>
          <ul class="tp__ex">
            <li v-for="ex in p.examples" :key="ex[0]">
              <span class="tp__tiles">
                <span v-for="(t, i) in exByWord.get(ex[0]).tiles" :key="i" class="lt" :class="`lt--${t.kind}`">{{ t.text }}</span>
              </span>
              <span class="tp__eq">=</span>
              <span class="tp__w">{{ ex[0] }}</span>
              <span class="tp__wzh zh">{{ ex[2] }}</span>
              <AudioButton :text="ex[0]" size="sm" />
            </li>
          </ul>
        </section>

        <section v-if="unit.rules?.length" class="note">
          <h3 class="note__t zh">拼字規則</h3>
          <p v-for="r in unit.rules" :key="r" class="zh">{{ r }}</p>
        </section>
        <section v-if="unit.traps?.length" class="note note--trap">
          <h3 class="note__t zh">小心假零件</h3>
          <p v-for="t in unit.traps" :key="t[0]" class="zh">{{ t[1] }}</p>
        </section>

        <button class="btn btn--primary btn--block zh" @click="startPlay">開始練習（8 題）</button>
      </template>

      <!-- ================= PLAY ================= -->
      <template v-else-if="stage === 'play' && current">
        <div class="hud">
          <span class="hud__score zh">答對 <b class="num">{{ score }}</b></span>
          <Transition name="fade"><span v-if="combo >= 2" :key="combo" class="hud__combo zh">連對 {{ combo }}</span></Transition>
        </div>
        <PartsGame :key="idx" :item="current" @answer="onAnswer" @next="onNext" />
      </template>

      <!-- ================= RESULT ================= -->
      <section v-else-if="stage === 'result' && unit" class="res">
        <div class="res__stars" :aria-label="`${stars} 顆星`">
          <span v-for="n in 3" :key="n" class="star" :class="{ 'star--on': n <= stars }" :style="{ animationDelay: n * 0.12 + 's' }">★</span>
        </div>
        <h2 class="res__title zh">{{ unit.title }}</h2>
        <p class="res__score zh">答對 <b class="num">{{ score }}</b> / <span class="num">{{ items.length }}</span>，最長連對 <b class="num">{{ best }}</b></p>
        <p class="res__desc zh">{{ stars >= 2 ? '這個單元會過幾天再回來考你，每次換一批字。' : '明天會再練一次這個單元。' }}</p>
        <button class="btn btn--primary btn--block zh" @click="leave">{{ inPhase ? '下一關' : '回到課程地圖' }}</button>
        <button v-if="!inPhase" class="btn btn--quiet zh" @click="startPlay">再玩一次</button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.parts { display: flex; flex-direction: column; gap: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-7)); }
.parts__intro { display: flex; flex-direction: column; gap: var(--sp-3); }
.parts__lead { color: var(--ink-2); line-height: 1.65; }

.units { display: flex; flex-direction: column; gap: var(--sp-2); }
.unit { width: 100%; display: grid; grid-template-columns: 40px 1fr auto; align-items: center; gap: var(--sp-3); padding: 14px; text-align: left; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-lg); transition: transform 0.1s; }
.unit:active { transform: scale(0.99); }
.unit__n { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--surface-2); color: var(--ink-2); font-size: var(--step-0); }
.unit--learning .unit__n, .unit--mastered .unit__n { background: var(--jade-wash); color: var(--jade-ink); }
.unit--due .unit__n { background: var(--amber-wash); color: var(--amber); }
.unit--next { border: 2px solid var(--sun); }
.unit--next .unit__n { background: var(--sun); color: var(--sun-ink); }
.unit__body { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.unit__title { font-weight: 700; line-height: 1.35; }
.unit__parts { display: flex; flex-wrap: wrap; gap: 6px; }
.unit__lt { font-size: 0.8rem; min-height: 1.9em; box-shadow: 0 2px 0 var(--te); }
.unit__status { font-size: var(--step--2); color: var(--ink-3); white-space: nowrap; }
.unit--next .unit__status { color: var(--ink); font-weight: 700; }

.step { font-size: var(--step--1); font-weight: 700; color: var(--ink-3); }
.disc { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.disc__row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.disc__tiles { display: flex; gap: 4px; flex-wrap: wrap; }
.disc__tiles .lt { font-size: var(--step-1); }
.disc__focus { outline: 2.5px solid var(--focus); outline-offset: 2px; }
.disc__zh { color: var(--ink-2); font-weight: 600; text-align: right; }
.disc__q { font-size: var(--step-1); font-weight: 800; line-height: 1.4; }
.disc__why { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); line-height: 1.6; }
.opts { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.popt { min-height: 60px; padding: 8px 10px; border-radius: var(--radius); background: var(--surface); border: 1.5px solid var(--rule-strong); font-weight: 600; line-height: 1.3; }
.popt--right { border-color: var(--jade); background: var(--jade-wash); color: var(--jade-ink); animation: pop-in 0.25s; }
.popt--wrong { border-color: var(--rose); background: var(--rose-wash); color: var(--rose); animation: shake 0.3s; }
.popt--mute { opacity: 0.4; }

.hook { font-size: var(--step-1); font-weight: 700; line-height: 1.5; }
.tp { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.tp__head { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; }
.tp__lt { font-size: var(--step-2); }
.tp__zh { font-size: var(--step-1); font-weight: 800; }
.tp__more { color: var(--ink-2); font-size: var(--step--1); line-height: 1.6; }
.tp__ex { display: flex; flex-direction: column; gap: 10px; }
.tp__ex li { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.tp__tiles { display: flex; gap: 3px; }
.tp__tiles .lt { font-size: 0.95rem; min-height: 1.9em; box-shadow: 0 2px 0 var(--te); }
.tp__eq { color: var(--ink-3); }
.tp__w { font-family: var(--font-word); font-weight: 700; }
.tp__wzh { color: var(--ink-2); font-size: var(--step--1); flex: 1; }

.note { display: flex; flex-direction: column; gap: 6px; padding: var(--sp-3) var(--sp-4); border-left: 4px solid var(--t-prefix); background: var(--surface); border-radius: 0 var(--radius) var(--radius) 0; line-height: 1.6; font-size: var(--step--1); }
.note--trap { border-left-color: var(--rose); }
.note__t { font-size: var(--step--1); font-weight: 800; }

.hud { display: flex; align-items: center; justify-content: space-between; min-height: 28px; }
.hud__score { font-size: var(--step--1); color: var(--ink-2); }
.hud__combo { font-weight: 800; color: var(--sun-ink); background: var(--sun); padding: 2px 12px; border-radius: var(--radius-pill); animation: pop-in 0.2s; font-size: var(--step--1); }

.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding-top: var(--sp-6); }
.res__stars { display: flex; gap: 6px; }
.star { font-size: 3rem; color: var(--surface-3); line-height: 1; }
.star--on { color: var(--sun); animation: pop-in 0.35s both; }
.res__title { font-size: var(--step-2); font-weight: 800; }
.res__score { color: var(--ink-2); }
.res__desc { color: var(--ink-2); font-size: var(--step--1); max-width: 30ch; line-height: 1.6; }
</style>
