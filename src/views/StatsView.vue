<script setup>
import { ref, computed, onMounted } from 'vue'
import { useProgress, todayKey } from '@/stores/progress'
import { useGrammar } from '@/stores/grammar'
import { useWords } from '@/stores/words'
import { TOTAL_WORDS, BANDS } from '@/config'
import { STATE, isMastered } from '@/lib/srs'

/**
 * Charts follow three rules that matter more than looks:
 *  - one y-axis per chart (volume and accuracy are separate charts, never a
 *    dual-axis overlay);
 *  - the card composition uses a single-hue sequential ramp, because
 *    learning → review → mastered is ordinal, not categorical;
 *  - the pale ramp steps always ship with a labelled legend, since they sit
 *    below 3:1 against the card surface on their own.
 */

const progress = useProgress()
const grammar = useGrammar()
const words = useWords()

const WEEKS = 8
const tip = ref(null)

onMounted(() => { progress.loadHistory(WEEKS * 7 + 7) })

/* ---------------- daily series ---------------- */
const days = computed(() => {
  const map = new Map(progress.history.map(h => [h.day, h]))
  if (progress.today.total_count) map.set(progress.today.day, progress.today)

  const out = []
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * 86400000)
    const key = todayKey(d)
    const row = map.get(key)
    out.push({
      key,
      date: d,
      total: row?.total_count || 0,
      correct: row?.correct_count || 0,
      minutes: Math.round((row?.seconds || 0) / 60),
      accuracy: row?.total_count ? row.correct_count / row.total_count : null
    })
  }
  return out
})

const maxVolume = computed(() => Math.max(10, ...days.value.map(d => d.total)))
const activeDays = computed(() => days.value.filter(d => d.total > 0).length)

const overallAccuracy = computed(() => {
  const t = days.value.reduce((a, d) => a + d.total, 0)
  const c = days.value.reduce((a, d) => a + d.correct, 0)
  return t ? c / t : null
})

const totalMinutes = computed(() => days.value.reduce((a, d) => a + d.minutes, 0))

/* accuracy polyline over the days that have data */
const accuracyPath = computed(() => {
  const pts = days.value
    .map((d, i) => ({ i, a: d.accuracy }))
    .filter(p => p.a !== null)
  if (pts.length < 2) return null
  const n = days.value.length - 1
  const coords = pts.map(p => [(p.i / n) * 100, 100 - p.a * 100])
  const line = coords.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${line} L${coords.at(-1)[0].toFixed(2)},100 L${coords[0][0].toFixed(2)},100 Z`
  return { line, area, last: coords.at(-1), points: coords }
})

/* ---------------- card composition ---------------- */
const composition = computed(() => {
  let learning = 0, review = 0, mastered = 0
  for (const c of progress.cards.values()) {
    if (isMastered(c)) mastered++
    else if (c.state === STATE.REVIEW) review++
    else learning++
  }
  const unseen = TOTAL_WORDS - (learning + review + mastered)
  return [
    { key: 'mastered', label: '熟練', n: mastered, tone: 'c3' },
    { key: 'review', label: '複習中', n: review, tone: 'c2' },
    { key: 'learning', label: '學習中', n: learning, tone: 'c1' },
    { key: 'unseen', label: '未接觸', n: unseen, tone: 'c0' }
  ]
})

/* ---------------- forecast ---------------- */
const forecast = computed(() => {
  const buckets = Array.from({ length: 14 }, (_, i) => ({ i, n: 0 }))
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const t0 = start.getTime()
  for (const c of progress.cards.values()) {
    const day = Math.floor((c.dueAt - t0) / 86400000)
    if (day < 0) buckets[0].n++
    else if (day < 14) buckets[day].n++
  }
  return buckets
})
const maxForecast = computed(() => Math.max(5, ...forecast.value.map(b => b.n)))

/* ---------------- bands ---------------- */
const bands = computed(() => Object.values(BANDS).map(b => {
  let seen = 0
  for (let id = b.range[0]; id <= b.range[1]; id++) if (progress.cards.has(id)) seen++
  const total = b.range[1] - b.range[0] + 1
  return { ...b, seen, total, pct: (seen / total) * 100 }
}))

/* ---------------- pace ---------------- */
const pace = computed(() => {
  const recent = days.value.slice(-28).filter(d => d.total > 0)
  if (recent.length < 3) return null
  const newPerActiveDay = progress.stats.seen / Math.max(1, activeDays.value)
  const remaining = TOTAL_WORDS - progress.stats.seen
  const daysLeft = Math.ceil(remaining / Math.max(1, newPerActiveDay))
  return { newPerActiveDay, daysLeft, months: (daysLeft / 30).toFixed(1) }
})

const weekLabels = computed(() =>
  days.value.filter((_, i) => i % 7 === 0).map(d => `${d.date.getMonth() + 1}/${d.date.getDate()}`)
)

function showTip (payload, evt) {
  tip.value = payload
  evt?.stopPropagation?.()
}
</script>

<template>
  <main class="shell stats" @click="tip = null">
    <header class="stats__head">
      <div class="eyebrow">Analytics</div>
      <h1 class="page-title zh">學習數據</h1>
    </header>

    <!-- headline numbers -->
    <section class="tiles">
      <div class="tile">
        <div class="tile__v num">{{ progress.stats.seen }}</div>
        <div class="tile__l zh">已學單字</div>
      </div>
      <div class="tile">
        <div class="tile__v num">{{ overallAccuracy === null ? '—' : Math.round(overallAccuracy * 100) + '%' }}</div>
        <div class="tile__l zh">{{ WEEKS }} 週正確率</div>
      </div>
      <div class="tile">
        <div class="tile__v num">{{ activeDays }}</div>
        <div class="tile__l zh">學習天數</div>
      </div>
      <div class="tile">
        <div class="tile__v num">{{ Math.round(totalMinutes / 60) }}<small>h</small></div>
        <div class="tile__l zh">累計時數</div>
      </div>
    </section>

    <!-- volume -->
    <section class="card card--pad chart">
      <div class="chart__head">
        <h2 class="chart__title zh">每日作答量</h2>
        <span class="chart__sub num">最近 {{ WEEKS }} 週</span>
      </div>

      <div class="cols" role="img" aria-label="每日作答量長條圖">
        <button
          v-for="d in days" :key="d.key"
          class="col"
          :class="{ 'col--zero': !d.total }"
          @click.stop="showTip({ title: d.key, lines: [`作答 ${d.total} 題`, d.accuracy === null ? '—' : `正確率 ${Math.round(d.accuracy * 100)}%`, `${d.minutes} 分鐘`] }, $event)"
        >
          <span class="col__bar" :style="{ height: Math.max(d.total ? 3 : 1, (d.total / maxVolume) * 100) + '%' }" />
        </button>
      </div>
      <div class="axis">
        <span v-for="(l, i) in weekLabels" :key="i" class="axis__t num">{{ l }}</span>
      </div>
    </section>

    <!-- accuracy (separate chart: never a second y-axis on the one above) -->
    <section class="card card--pad chart">
      <div class="chart__head">
        <h2 class="chart__title zh">正確率趨勢</h2>
        <span v-if="overallAccuracy !== null" class="chart__sub num">
          平均 {{ Math.round(overallAccuracy * 100) }}%
        </span>
      </div>

      <div v-if="accuracyPath" class="line-wrap">
        <svg class="line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line v-for="y in [20, 40, 60, 80]" :key="y" class="grid" x1="0" :y1="y" x2="100" :y2="y" />
          <line class="grid grid--target" x1="0" y1="20" x2="100" y2="20" />
          <path class="area" :d="accuracyPath.area" />
          <path class="stroke" :d="accuracyPath.line" />
        </svg>
        <svg class="dots" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <circle class="tip-dot" :cx="accuracyPath.last[0]" :cy="accuracyPath.last[1]" r="1.6" />
        </svg>
        <span class="line__mark line__mark--hi zh">80% 目標</span>
      </div>
      <p v-else class="chart__empty zh">再累積幾天資料就會出現趨勢線</p>
    </section>

    <!-- composition -->
    <section class="card card--pad chart">
      <div class="chart__head">
        <h2 class="chart__title zh">2801 字掌握狀態</h2>
        <span class="chart__sub num">{{ ((progress.stats.seen / TOTAL_WORDS) * 100).toFixed(1) }}%</span>
      </div>

      <div class="stack-bar">
        <span
          v-for="seg in composition" :key="seg.key"
          class="seg" :class="`seg--${seg.tone}`"
          :style="{ flexGrow: Math.max(seg.n, 0) }"
          :title="`${seg.label} ${seg.n}`"
        />
      </div>

      <ul class="legend">
        <li v-for="seg in composition" :key="seg.key" class="legend__i">
          <i class="legend__sw" :class="`seg--${seg.tone}`" />
          <span class="legend__l zh">{{ seg.label }}</span>
          <span class="legend__n num">{{ seg.n }}</span>
        </li>
      </ul>

      <div class="hr" />

      <div class="bands">
        <div v-for="b in bands" :key="b.key" class="bandrow">
          <span class="chip" :class="b.key === 'B1' ? 'chip--jade' : b.key === 'B2' ? 'chip--violet' : 'chip--amber'">{{ b.label }}</span>
          <div class="bar grow"><div class="bar__fill" :style="{ width: b.pct + '%' }" /></div>
          <span class="bandrow__n num">{{ b.seen }}/{{ b.total }}</span>
        </div>
      </div>
    </section>

    <!-- forecast -->
    <section class="card card--pad chart">
      <div class="chart__head">
        <h2 class="chart__title zh">未來兩週複習量</h2>
        <span class="chart__sub num">{{ forecast.reduce((a, b) => a + b.n, 0) }} 張</span>
      </div>

      <div class="cols cols--wide">
        <button
          v-for="b in forecast" :key="b.i"
          class="col"
          @click.stop="showTip({ title: b.i === 0 ? '今天' : `${b.i} 天後`, lines: [`${b.n} 張卡片到期`] }, $event)"
        >
          <span class="col__bar col__bar--amber" :style="{ height: Math.max(b.n ? 3 : 1, (b.n / maxForecast) * 100) + '%' }" />
          <span v-if="b.i % 3 === 0" class="col__lbl num">{{ b.i === 0 ? '今' : b.i }}</span>
        </button>
      </div>
      <p class="chart__note zh">
        每天的量取決於你之前的評分。如果某天特別高，可以在設定調低「每日複習上限」，多的會自動順延。
      </p>
    </section>

    <!-- grammar + pace -->
    <section class="card card--pad chart">
      <h2 class="chart__title zh">文法與節奏</h2>
      <div class="kvs">
        <div class="kv"><span class="kv__k zh">文法點進度</span><span class="kv__v num">{{ grammar.stats.started }} / {{ grammar.stats.total }}</span></div>
        <div class="kv"><span class="kv__k zh">文法正確率</span><span class="kv__v num">{{ grammar.stats.accuracy === null ? '—' : Math.round(grammar.stats.accuracy * 100) + '%' }}</span></div>
        <div class="kv"><span class="kv__k zh">單字資料完成度</span><span class="kv__v num">{{ words.enrichedCount }} / {{ TOTAL_WORDS }}</span></div>
        <div class="kv"><span class="kv__k zh">連續學習</span><span class="kv__v num">{{ progress.streak }} 天</span></div>
      </div>

      <div v-if="pace" class="pace">
        <p class="pace__line zh">
          以目前的節奏，剩下的 <strong class="num">{{ TOTAL_WORDS - progress.stats.seen }}</strong> 個字
          大約還需要 <strong class="num">{{ pace.months }}</strong> 個月。
        </p>
        <p class="pace__sub zh">
          這是用「已學單字 ÷ 實際學習天數」推估的，跳過的日子不會算進去。
        </p>
      </div>
    </section>

    <!-- tooltip -->
    <Transition name="fade">
      <div v-if="tip" class="tip" @click.stop>
        <div class="tip__t num">{{ tip.title }}</div>
        <div v-for="(l, i) in tip.lines" :key="i" class="tip__l zh">{{ l }}</div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.stats { display: flex; flex-direction: column; gap: var(--sp-4); }
.stats__head { display: flex; flex-direction: column; gap: 3px; margin-bottom: var(--sp-1); }

/* tiles */
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
.tile {
  background: var(--surface); border: 1px solid var(--rule);
  border-radius: var(--radius); padding: var(--sp-3) var(--sp-2); text-align: center;
}
.tile__v { font-size: var(--step-1); line-height: 1.15; }
.tile__v small { font-size: var(--step--2); color: var(--ink-3); }
.tile__l { font-size: 10px; color: var(--ink-3); margin-top: 2px; }

/* chart shell */
.chart { display: flex; flex-direction: column; gap: var(--sp-3); }
.chart__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.chart__title { font-size: var(--step-0); font-weight: 700; letter-spacing: -0.01em; }
.chart__sub { font-size: var(--step--2); color: var(--ink-3); }
.chart__empty { font-size: var(--step--1); color: var(--ink-3); text-align: center; padding: var(--sp-5) 0; }
.chart__note { font-size: var(--step--2); color: var(--ink-3); line-height: 1.7; }

/* bar columns */
.cols {
  display: flex;
  align-items: flex-end;
  gap: 2px;                 /* 2px surface gap between adjacent bars */
  height: 92px;
}
.cols--wide { gap: 4px; height: 76px; }

.col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
  min-width: 0;
  position: relative;
}
.col__bar {
  display: block;
  width: 100%;
  background: var(--jade);
  border-radius: 3px 3px 0 0;    /* rounded data-end, square on the baseline */
  transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
.col--zero .col__bar { background: var(--surface-3); }
.col__bar--amber { background: var(--amber); }
.col__lbl {
  position: absolute; bottom: -16px; left: 50%; transform: translateX(-50%);
  font-size: 9px; color: var(--ink-3);
}
.cols--wide { margin-bottom: 16px; }

.axis { display: flex; justify-content: space-between; }
.axis__t { font-size: 9.5px; color: var(--ink-3); }

/* line chart */
.line-wrap { position: relative; height: 108px; }
.line, .dots { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.grid { stroke: var(--rule); stroke-width: 0.4; vector-effect: non-scaling-stroke; }
.grid--target { stroke: var(--jade-edge); stroke-dasharray: 3 3; }
.area { fill: var(--jade-wash); }
.stroke {
  fill: none;
  stroke: var(--jade);
  stroke-width: 2;               /* 2px line, unscaled */
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}
.tip-dot { fill: var(--jade); stroke: var(--surface); stroke-width: 1; vector-effect: non-scaling-stroke; }
.line__mark {
  position: absolute; right: 0; top: 20%; transform: translateY(-130%);
  font-size: 9.5px; color: var(--jade); opacity: 0.85;
}

/* stacked composition */
.stack-bar {
  display: flex;
  gap: 2px;                       /* 2px surface gap between segments */
  height: 26px;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.seg { display: block; min-width: 2px; border-radius: 2px; transition: flex-grow 0.5s ease; }

/* single-hue sequential ramp: learning → review → mastered; unseen is neutral */
.seg--c0 { background: var(--surface-3); }
.seg--c1 { background: #7fd0b4; }
.seg--c2 { background: #21916f; }
.seg--c3 { background: #00674f; }

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .seg--c1 { background: #2a6b56; }
  :root:not([data-theme="light"]) .seg--c2 { background: #2eb489; }
  :root:not([data-theme="light"]) .seg--c3 { background: #7cf0bd; }
}
:root[data-theme="dark"] .seg--c1 { background: #2a6b56; }
:root[data-theme="dark"] .seg--c2 { background: #2eb489; }
:root[data-theme="dark"] .seg--c3 { background: #7cf0bd; }

.legend { display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-4); }
.legend__i { display: flex; align-items: center; gap: 6px; }
.legend__sw { width: 10px; height: 10px; border-radius: 2px; display: block; flex-shrink: 0; }
.legend__l { font-size: var(--step--2); color: var(--ink-2); }
.legend__n { font-size: var(--step--2); color: var(--ink); }

.bands { display: flex; flex-direction: column; gap: var(--sp-2); }
.bandrow { display: flex; align-items: center; gap: var(--sp-2); }
.bandrow__n { font-size: var(--step--2); color: var(--ink-3); min-width: 62px; text-align: right; }

/* kv */
.kvs { display: flex; flex-direction: column; gap: var(--sp-2); }
.kv { display: flex; align-items: baseline; justify-content: space-between; }
.kv__k { font-size: var(--step--1); color: var(--ink-2); }
.kv__v { font-size: var(--step--1); color: var(--ink); }

.pace {
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: var(--sp-3);
  display: flex; flex-direction: column; gap: 4px;
}
.pace__line { font-size: var(--step--1); line-height: 1.7; color: var(--ink-2); }
.pace__line strong { color: var(--jade); }
.pace__sub { font-size: var(--step--2); color: var(--ink-3); line-height: 1.6; }

/* tooltip */
.tip {
  position: fixed;
  left: 50%; transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom) + 78px);
  z-index: 250;
  background: var(--ink); color: var(--paper);
  border-radius: var(--radius);
  padding: var(--sp-2) var(--sp-4);
  box-shadow: var(--shadow-3);
  display: flex; flex-direction: column; gap: 1px;
  min-width: 150px;
}
.tip__t { font-size: var(--step--2); opacity: 0.65; }
.tip__l { font-size: var(--step--1); font-weight: 500; }
</style>
