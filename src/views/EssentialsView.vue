<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useEssentials } from '@/stores/essentials'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useToast } from '@/stores/toast'
import { generateDrills } from '@/lib/gemini'
import { inlineMd } from '@/lib/format'
import SessionHeader from '@/components/SessionHeader.vue'
import DrillRunner from '@/components/DrillRunner.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * Foundation units: read the rule, drill it, then keep drilling with generated
 * questions. The fixed seed drills exist so the unit works offline and so the
 * first pass is always the same quality; everything after that is generated,
 * which is what stops a unit from running dry after one sitting.
 */

const essentials = useEssentials()
const session = useSession()
const settings = useSettings()
const toast = useToast()
const router = useRouter()

const unit = computed(() => essentials.todayUnit)
const stage = ref('teach')       // teach | drill | result
const drills = ref([])
const score = ref({ correct: 0, total: 0 })
const extraLoading = ref(false)
const roundsDone = ref(0)

const rec = computed(() => unit.value ? essentials.recOf(unit.value.id) : null)
const isNew = computed(() => !rec.value)

function startSeed () {
  drills.value = unit.value.drills
  stage.value = 'drill'
}

/** Fresh questions on the same point, aimed at what this learner keeps missing. */
async function startGenerated (count = 6) {
  if (!settings.hasGeminiKey) {
    toast.error('需要 Gemini API Key 才能出新題目')
    return
  }
  extraLoading.value = true
  try {
    const seen = unit.value.drills.map(d => d.answer || d.q || d.wrong).filter(Boolean)
    const fresh = await generateDrills({
      topic: unit.value.title,
      focus: unit.value.summary,
      count,
      avoid: seen,
      weak: unit.value.pitfalls.slice(0, 3),
      key: settings.state.geminiKey,
      model: settings.state.geminiModel
    })
    if (!fresh.length) { toast.error('這次沒有產生出可用的題目，再試一次'); return }
    drills.value = fresh
    stage.value = 'drill'
  } catch (e) {
    toast.error(e.message)
  } finally {
    extraLoading.value = false
  }
}

function onDone ({ correct, total }) {
  score.value = { correct, total }
  roundsDone.value++
  essentials.submit(unit.value.id, { correct, total })
  stage.value = 'result'
}

function finish () {
  session.markDone('essentials')
  router.push('/write')
}

onMounted(() => {
  session.startClock()
  if (!unit.value) {
    session.markDone('essentials')
    router.replace('/write')
  }
})
onUnmounted(() => session.stopClock())

const GROUP_LABEL = {
  time: '時間', number: '數字', pronoun: '代名詞', verb: '動詞',
  form: '字形', quantity: '數量', question: '疑問', place: '方位',
  phrase: '片語', money: '金錢'
}
</script>

<template>
  <div class="view">
    <SessionHeader
      title="基礎知識"
      :current="stage === 'result' ? drills.length : 0"
      :total="stage === 'drill' || stage === 'result' ? drills.length : 0"
    />

    <main v-if="unit" class="shell ess">
      <!-- ---------------- teach ---------------- -->
      <template v-if="stage === 'teach'">
        <div class="ess__tags">
          <span class="chip chip--jade">{{ GROUP_LABEL[unit.group] || unit.group }}</span>
          <span class="chip chip--plain">{{ isNew ? '新單元' : '複習' }}</span>
          <span class="dim num">#{{ unit.order }}/12</span>
        </div>

        <header class="ess__head">
          <h1 class="ess__title zh">{{ unit.title }}</h1>
          <p class="ess__summary zh">{{ unit.summary }}</p>
        </header>

        <section class="card card--pad ess__intro">
          <p v-for="(line, i) in unit.intro" :key="i" class="zh" v-html="inlineMd(line)" />
        </section>

        <section v-if="unit.table" class="ess__tablewrap">
          <div class="ess__tabletop">
            <span class="eyebrow">{{ unit.table.caption }}</span>
            <span v-if="unit.table.head.length > 3" class="ess__scrollhint zh">← 可左右滑動 →</span>
          </div>
          <div class="scroll-x">
            <table class="ess__table">
              <thead>
                <tr><th v-for="(h, i) in unit.table.head" :key="i" class="zh">{{ h }}</th></tr>
              </thead>
              <tbody>
                <tr v-for="(row, r) in unit.table.rows" :key="r">
                  <td v-for="(cell, c) in row" :key="c" :class="{ 'ess__en': /^[A-Za-z$]/.test(cell) }">
                    <span>{{ cell }}</span>
                    <AudioButton v-if="c === 0 && /^[A-Za-z]/.test(cell)" :text="cell.split(' ')[0]" size="sm" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="pit">
          <div class="pit__head zh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 8.5v5M12 16.8v.2" /><circle cx="12" cy="12" r="9" /></svg>
            最常錯的地方
          </div>
          <ul class="pit__list">
            <li v-for="(p, i) in unit.pitfalls" :key="i" class="zh" v-html="inlineMd(p)" />
          </ul>
        </section>

        <button class="btn btn--primary btn--block zh" @click="startSeed">
          開始練習（{{ unit.drills.length }} 題）
        </button>
        <button class="btn btn--quiet btn--sm zh ess__skip" @click="finish">跳過這個階段</button>
      </template>

      <!-- ---------------- drill ---------------- -->
      <DrillRunner
        v-else-if="stage === 'drill'"
        :key="roundsDone"
        :drills="drills"
        :label="unit.title"
        @done="onDone"
        @exit="stage = 'teach'"
      />

      <!-- ---------------- result ---------------- -->
      <template v-else>
        <div class="res">
          <div class="res__ring" :style="{ '--pct': score.total ? (score.correct / score.total) * 100 : 0 }">
            <span class="res__pct num">{{ score.total ? Math.round((score.correct / score.total) * 100) : 0 }}<small>%</small></span>
          </div>
          <h2 class="res__title zh">{{ unit.title }}</h2>
          <p class="res__line zh">答對 <strong class="num">{{ score.correct }}</strong> / {{ score.total }} 題</p>
          <p class="res__note zh">
            <template v-if="score.correct / score.total >= 0.75">
              這個單元幾天後會再出現確認。想再練可以出一批新題目。
            </template>
            <template v-else>
              正確率偏低，這個單元明天會再出現。多練一輪會更有把握。
            </template>
          </p>
        </div>

        <button class="btn btn--ghost btn--block zh" :disabled="extraLoading" @click="startGenerated(6)">
          {{ extraLoading ? '出題中…' : '再來 6 題（AI 出新題）' }}
        </button>
        <button class="btn btn--primary btn--block zh" @click="finish">繼續，進入造句</button>
        <button class="btn btn--quiet btn--sm zh ess__skip" @click="stage = 'teach'">再看一次說明</button>
      </template>
    </main>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.ess {
  display: flex; flex-direction: column; gap: var(--sp-4);
  padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-6));
}

.ess__tags { display: flex; align-items: center; gap: var(--sp-2); font-size: var(--step--2); }
.ess__tags .dim { margin-left: auto; }

.ess__head { display: flex; flex-direction: column; gap: var(--sp-2); }
.ess__title {
  font-size: var(--step-2); font-weight: 800; letter-spacing: -0.015em;
  line-height: 1.35; text-wrap: balance; line-break: strict;
}
@media (min-width: 420px) { .ess__title { font-size: var(--step-3); } }
.ess__summary { font-size: var(--step-0); color: var(--ink-2); line-height: 1.7; }

.ess__intro { display: flex; flex-direction: column; gap: var(--sp-3); }
.ess__intro p { font-size: var(--step--1); line-height: 1.85; color: var(--ink-2); }
.ess__intro :deep(strong) { color: var(--ink); font-weight: 700; }
.ess__intro :deep(code) {
  font-family: var(--font-word); font-size: var(--step-0); color: var(--ink);
  background: var(--surface-2); padding: 1px 5px; border-radius: 4px;
}

.ess__tablewrap { display: flex; flex-direction: column; gap: var(--sp-2); }
.ess__tabletop { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); }
.ess__scrollhint { font-size: var(--step--2); color: var(--ink-3); }
.ess__table { width: 100%; border-collapse: collapse; font-size: var(--step--1); }
.ess__table th {
  text-align: left; padding: var(--sp-2) var(--sp-3);
  background: var(--surface-2); color: var(--ink-2);
  font-size: var(--step--2); font-weight: 600; white-space: nowrap;
  position: sticky; top: 0;
}
.ess__table td {
  padding: var(--sp-2) var(--sp-3);
  border-bottom: 1px solid var(--rule);
  vertical-align: top;
}
/* Reference tables run to four columns; forcing nowrap pushed the last one
   off the screen edge, where it read as missing rather than as scrollable. */
.ess__table td.ess__en { font-family: var(--font-word); }
.ess__table td { min-width: 84px; }
.ess__table td span { margin-right: 6px; }
.ess__table td :deep(.audio) { display: inline-grid; vertical-align: middle; }

.pit {
  border: 1px solid var(--rose-edge); background: var(--rose-wash);
  border-radius: var(--radius); padding: var(--sp-3) var(--sp-4);
  display: flex; flex-direction: column; gap: var(--sp-2);
}
.pit__head { display: flex; align-items: center; gap: 6px; color: var(--rose); font-weight: 700; font-size: var(--step--1); }
.pit__head svg { width: 16px; height: 16px; }
.pit__list { display: flex; flex-direction: column; gap: var(--sp-2); }
.pit__list li { font-size: var(--step--1); line-height: 1.7; color: var(--ink-2); }
.pit__list :deep(code) {
  font-family: var(--font-word); background: var(--surface);
  padding: 1px 5px; border-radius: 4px; color: var(--ink);
}

.res { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-6) 0 var(--sp-4); text-align: center; }
.res__ring {
  width: 118px; height: 118px; border-radius: 50%;
  display: grid; place-items: center;
  background: conic-gradient(var(--jade) calc(var(--pct) * 1%), var(--surface-3) 0);
  position: relative;
}
.res__ring::after { content: ''; position: absolute; inset: 9px; border-radius: 50%; background: var(--paper); }
.res__pct { position: relative; z-index: 1; font-size: var(--step-3); font-weight: 600; }
.res__pct small { font-size: var(--step-0); color: var(--ink-3); }
.res__title { font-size: var(--step-1); font-weight: 700; }
.res__line { font-size: var(--step-0); color: var(--ink-2); }
.res__note { font-size: var(--step--1); color: var(--ink-3); line-height: 1.7; max-width: 32ch; }

.ess__skip { align-self: center; }
</style>
