<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useSession } from '@/stores/session'
import { useWords } from '@/stores/words'
import { TOTAL_WORDS } from '@/config'
import SessionHeader from '@/components/SessionHeader.vue'
import Stamp from '@/components/ui/Stamp.vue'

const progress = useProgress()
const settings = useSettings()
const session = useSession()
const words = useWords()
const router = useRouter()

const t = computed(() => progress.today)

const accuracy = computed(() => t.value.total_count ? t.value.correct_count / t.value.total_count : null)
const grammarAcc = computed(() => t.value.grammar_total ? t.value.grammar_correct / t.value.grammar_total : null)
const articleAcc = computed(() => t.value.article_total ? t.value.article_correct / t.value.article_total : null)

const rows = computed(() => [
  { label: '新學單字', value: t.value.new_count, unit: '字', tone: 'jade' },
  { label: '複習卡片', value: t.value.review_count, unit: '張', tone: 'plain' },
  { label: '單字正確率', value: accuracy.value === null ? '—' : Math.round(accuracy.value * 100) + '%', tone: accuracy.value >= 0.8 ? 'jade' : accuracy.value >= 0.6 ? 'amber' : 'rose' },
  { label: '文法正確率', value: grammarAcc.value === null ? '—' : Math.round(grammarAcc.value * 100) + '%', tone: 'violet' },
  { label: '閱讀理解', value: articleAcc.value === null ? '—' : `${t.value.article_correct}/${t.value.article_total}`, tone: 'plain' },
  { label: '聽力', value: session.listenResult ? `${session.listenResult.correct}/${session.listenResult.total}` : '—', tone: 'violet' },
  { label: '學習時間', value: session.minutesToday, unit: '分鐘', tone: 'plain' }
])

/** The verdict line — one honest sentence, not a participation trophy. */
const verdict = computed(() => {
  const a = accuracy.value
  const mins = session.minutesToday
  if (t.value.total_count === 0) return '今天還沒開始，回去完成關卡吧。'
  if (a !== null && a < 0.6) return '正確率偏低。答錯的字明天會優先出現，不要調高每日新字數。'
  if (mins < settings.state.dailyMinutes * 0.6) {
    return `今天 ${mins} 分鐘，低於你設定的 ${settings.state.dailyMinutes} 分鐘目標。時間不夠時，複習比新字重要。`
  }
  if (a !== null && a >= 0.9 && t.value.new_count >= 10) return '狀態很好。如果連續一週都這樣，可以考慮把每日新字數調高。'
  return '穩定推進中。明天的複習量已經排好了。'
})

const coverage = computed(() => (progress.stats.seen / settings.target) * 100)

const weakWords = computed(() =>
  progress.troubleWords.slice(0, 6).map(c => words.get(c.wordId)).filter(Boolean)
)

onMounted(() => {
  session.markDone('summary')
  progress.setDay({ completed: true })
  progress.flush()
  session.stopClock()
})
</script>

<template>
  <div class="view">
    <SessionHeader title="今日結算" />

    <main class="shell sum">
      <!-- the scene shows through here: the arc with every station passed -->
      <div class="sum__sky" aria-hidden="true" />
      <header class="sum__head">
        <div class="sum__title">
          <p class="sum__date fig">{{ t.day }}</p>
          <h1 class="page-title">今天的課<br>上完了</h1>
        </div>
        <div class="sum__stamp"><Stamp :ratio="accuracy ?? 0" :text="t.total_count ? '' : '待補'" :size="116" /></div>
      </header>
      <p class="sum__verdict zh">{{ verdict }}</p>

      <!-- the report card as an inset grouped list -->
      <table class="report">
        <tbody>
          <tr v-for="r in rows" :key="r.label">
            <th class="zh">{{ r.label }}</th>
            <td :class="`v--${r.tone}`"><b class="num">{{ r.value }}</b><small v-if="r.unit" class="zh">{{ r.unit }}</small></td>
          </tr>
        </tbody>
      </table>

      <section class="card card--pad stack stack-3">
        <div class="row between">
          <span class="section-title zh">NGSL 總進度</span>
          <span class="num" style="color: var(--jade)">{{ coverage.toFixed(1) }}%</span>
        </div>
        <div class="bar"><div class="bar__fill" :style="{ width: coverage + '%' }" /></div>
        <div class="row between" style="font-size: var(--step--2); color: var(--ink-3)">
          <span class="zh">已學 <span class="num">{{ progress.stats.seen }}</span></span>
          <span class="zh">熟練 <span class="num">{{ progress.stats.mastered }}</span></span>
          <span class="zh">連續 <span class="num">{{ progress.streak }}</span> 天</span>
        </div>
      </section>

      <section v-if="weakWords.length" class="card card--pad stack stack-3">
        <div class="row between">
          <span class="section-title zh">最常忘記的字</span>
          <RouterLink to="/errors" class="btn btn--quiet btn--sm zh">全部</RouterLink>
        </div>
        <div class="weak">
          <div v-for="w in weakWords" :key="w.id" class="weak__item">
            <span class="weak__en">{{ w.headword }}</span>
            <span class="weak__zh zh">{{ w.meanings?.[0]?.zh || '—' }}</span>
            <span class="chip chip--rose">忘 {{ progress.cardOf(w.id)?.lapses }}</span>
          </div>
        </div>
      </section>

      <div class="sum__actions">
        <RouterLink to="/" class="btn btn--primary btn--block zh">回到今日</RouterLink>
        <RouterLink to="/stats" class="btn btn--ghost btn--block zh">看長期數據</RouterLink>
      </div>
    </main>
  </div>
</template>

<style scoped>
.view { min-height: 100dvh; }
.sum { display: flex; flex-direction: column; gap: var(--sp-4); }

/* 76px = the sticky header + the shell's top padding (each also adds the
   safe-area inset, hence × 2); the title starts in the cloud under the range */
.sum__sky { height: calc(40vh - 76px - env(safe-area-inset-top) * 2 + 26px); height: calc(40lvh - 76px - env(safe-area-inset-top) * 2 + 26px); min-height: 130px; margin-bottom: calc(var(--sp-4) * -1); }
.sum__head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--sp-4); padding: 0 4px; }
.sum__stamp { flex-shrink: 0; margin-bottom: 4px; }
.sum__date { color: var(--ink-2); font-size: var(--step-0); }
.sum__head .page-title { font-size: clamp(2.3rem, 11vw, 2.9rem); line-height: 1.12; letter-spacing: 0.03em; }
.sum__verdict { font-size: var(--step-0); color: var(--ink); line-height: 1.6; padding: 14px 16px; }
.report { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; }
.report th { text-align: left; font-weight: 500; color: var(--ink); padding: 13px 16px; font-size: var(--step-0); }
.report td { text-align: right; padding: 13px 16px; }
.report tr + tr th, .report tr + tr td { box-shadow: inset 0 0.5px 0 var(--rule); }
.report td b { font-size: var(--step-0); font-weight: 600; color: var(--ink-2); }
.report td small { color: var(--ink-3); margin-left: 3px; font-size: var(--step--2); }
.v--jade b { color: var(--jade); } .v--amber b { color: var(--amber); } .v--rose b { color: var(--redpen); }

.weak { display: flex; flex-direction: column; gap: var(--sp-2); }
.weak__item { display: flex; align-items: center; gap: var(--sp-3); }
.weak__en { font-family: var(--font-word); font-size: var(--step-0); font-weight: 500; min-width: 92px; }
.weak__zh { flex: 1; font-size: var(--step--1); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sum__actions { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); padding-bottom: var(--sp-6); }
</style>
