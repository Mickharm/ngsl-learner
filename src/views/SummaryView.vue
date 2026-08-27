<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProgress } from '@/stores/progress'
import { useSettings } from '@/stores/settings'
import { useSession } from '@/stores/session'
import { useWords } from '@/stores/words'
import { TOTAL_WORDS } from '@/config'
import SessionHeader from '@/components/SessionHeader.vue'

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
  { label: '學習時間', value: session.minutesToday, unit: '分鐘', tone: 'plain' }
])

/** The verdict line — one honest sentence, not a participation trophy. */
const verdict = computed(() => {
  const a = accuracy.value
  const mins = session.minutesToday
  if (t.value.total_count === 0) return '今天還沒開始，回去完成關卡吧。'
  if (a !== null && a < 0.6) return '正確率偏低。答錯的字明天會優先出現，不要調高每日新字數。'
  if (mins < 30) return '時間偏短。這個階段每天 60 分鐘以上，進度才穩得住。'
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
      <header class="sum__head">
        <div class="eyebrow">{{ t.day }}</div>
        <h1 class="page-title zh">今天完成了</h1>
        <p class="sum__verdict zh">{{ verdict }}</p>
      </header>

      <section class="grid">
        <div v-for="r in rows" :key="r.label" class="cell">
          <div class="cell__v num" :class="`cell__v--${r.tone}`">
            {{ r.value }}<small v-if="r.unit">{{ r.unit }}</small>
          </div>
          <div class="cell__l zh">{{ r.label }}</div>
        </div>
      </section>

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

.sum__head { display: flex; flex-direction: column; gap: var(--sp-2); padding-top: var(--sp-3); }
.sum__verdict {
  font-size: var(--step-0);
  color: var(--ink-2);
  line-height: 1.7;
  border-left: 3px solid var(--jade);
  padding-left: var(--sp-3);
}

.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
.cell {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-2);
  text-align: center;
}
.cell__v { font-size: var(--step-2); line-height: 1.15; }
.cell__v small { font-size: var(--step--2); color: var(--ink-3); margin-left: 2px; font-family: var(--font-zh); }
.cell__v--jade { color: var(--jade); }
.cell__v--amber { color: var(--amber); }
.cell__v--rose { color: var(--rose); }
.cell__v--violet { color: var(--violet); }
.cell__l { font-size: var(--step--2); color: var(--ink-3); margin-top: 3px; }

.weak { display: flex; flex-direction: column; gap: var(--sp-2); }
.weak__item { display: flex; align-items: center; gap: var(--sp-3); }
.weak__en { font-family: var(--font-word); font-size: var(--step-0); font-weight: 500; min-width: 92px; }
.weak__zh { flex: 1; font-size: var(--step--1); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.sum__actions { display: flex; flex-direction: column; gap: var(--sp-2); margin-top: var(--sp-2); padding-bottom: var(--sp-6); }
</style>
