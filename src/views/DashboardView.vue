<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { TOTAL_WORDS, BANDS } from '@/config'

const auth = useAuth()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const words = useWords()
const router = useRouter()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return '深夜還在念書'
  if (h < 11) return '早安'
  if (h < 14) return '午安'
  if (h < 18) return '下午好'
  return '晚安'
})

const coverage = computed(() => {
  const s = progress.stats
  return {
    seen: s.seen,
    mastered: s.mastered,
    pct: (s.seen / TOTAL_WORDS) * 100,
    masteredPct: (s.mastered / TOTAL_WORDS) * 100
  }
})

const bandProgress = computed(() =>
  Object.values(BANDS).map(b => {
    let seen = 0, mastered = 0
    for (let id = b.range[0]; id <= b.range[1]; id++) {
      const c = progress.cards.get(id)
      if (!c) continue
      seen++
      if (c.intervalDays >= 21 && c.streak >= 3) mastered++
    }
    const total = b.range[1] - b.range[0] + 1
    return { ...b, seen, mastered, total, pct: (seen / total) * 100 }
  })
)

const accuracy = computed(() => {
  const t = progress.today
  return t.total_count ? Math.round((t.correct_count / t.total_count) * 100) : null
})

const needsPlacement = computed(() =>
  progress.loaded && progress.stats.seen === 0 && !localStorage.getItem('ngsl.placed')
)

const needsKey = computed(() => progress.loaded && !settings.hasGeminiKey)

function go (p) {
  if (!p.unlocked) return
  router.push(p.route)
}

onMounted(() => {
  session.rollIfNewDay()
  session.startClock()
  if (needsPlacement.value) router.replace('/setup')
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <main class="shell">
    <!-- header -->
    <header class="top">
      <div>
        <div class="eyebrow">{{ progress.today.day }}</div>
        <h1 class="page-title zh">{{ greeting }}，{{ auth.displayName }}</h1>
      </div>
      <div class="streak" :class="{ 'streak--on': progress.streak > 0 }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.7c.9 3 3.2 4.2 3.2 4.2s-.6 1.6-.2 2.6c1.2-.4 2-1.6 2-1.6 1.7 2 2.6 3.8 2.6 6C19.6 18.3 16.2 21.3 12 21.3S4.4 18.3 4.4 13.9c0-4.6 4-6.6 5.2-9.1.7-1.4 1.2-2.1 2.4-2.1z" />
        </svg>
        <span class="num">{{ progress.streak }}</span>
      </div>
    </header>

    <!-- setup nudges -->
    <RouterLink v-if="needsKey" to="/settings" class="nudge">
      <div class="nudge__body">
        <div class="nudge__title zh">還沒設定 Gemini API Key</div>
        <p class="nudge__desc zh">單字的翻譯、例句與每日文章都需要它。點這裡去設定，一分鐘搞定。</p>
      </div>
      <svg class="nudge__arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
    </RouterLink>

    <!-- today's numbers -->
    <section class="metrics">
      <div class="metric">
        <div class="metric__n num">{{ progress.today.total_count }}</div>
        <div class="metric__l zh">今日已答</div>
      </div>
      <div class="metric">
        <div class="metric__n num">{{ accuracy === null ? '—' : accuracy + '%' }}</div>
        <div class="metric__l zh">正確率</div>
      </div>
      <div class="metric">
        <div class="metric__n num">{{ session.minutesToday }}</div>
        <div class="metric__l zh">分鐘</div>
      </div>
      <div class="metric">
        <div class="metric__n num">{{ session.plan.reviewCount }}</div>
        <div class="metric__l zh">待複習</div>
      </div>
    </section>

    <!-- the quest -->
    <section class="quest">
      <div class="quest__head">
        <h2 class="section-title zh">今日關卡</h2>
        <span class="quest__est zh">約 <span class="num">{{ session.plan.estimatedMinutes }}</span> 分鐘</span>
        <span class="quest__count num">{{ session.completedCount }}/{{ session.PHASES.length }}</span>
      </div>

      <ol class="steps">
        <li
          v-for="(p, i) in session.phaseStatus"
          :key="p.key"
          class="step"
          :class="{
            'step--done': p.done,
            'step--current': p.current,
            'step--locked': !p.unlocked,
            'step--empty': p.empty && !p.done
          }"
        >
          <button class="step__btn" :disabled="!p.unlocked" @click="go(p)">
            <span class="step__dot">
              <svg v-if="p.done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <span v-else-if="p.empty" class="step__dash">—</span>
              <svg v-else-if="!p.unlocked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
              <span v-else class="num">{{ i + 1 }}</span>
            </span>

            <span class="step__body">
              <span class="step__label zh">{{ p.label }}</span>
              <span class="step__meta zh">
                <template v-if="p.key === 'learn'">
                  {{ p.empty ? '今天沒有新字，先把複習做完' : `${session.plan.newCount} 個新字` }}
                </template>
                <template v-else-if="p.key === 'review'">
                  {{ p.empty ? '目前沒有到期的卡片' : `${session.plan.reviewCount} 張卡片` }}
                </template>
                <template v-else-if="p.key === 'grammar'">
                  {{ session.grammarPoint?.title || '30 個文法點都排過一輪了' }}
                </template>
                <template v-else-if="p.key === 'essentials'">
                  {{ session.essentialUnit?.title || '12 個基礎單元都排過一輪了' }}
                </template>
                <template v-else-if="p.key === 'write'">用今天的字寫句子，AI 批改</template>
                <template v-else-if="p.key === 'article'">用今天的單字生成短文</template>
                <template v-else>看今天的成績</template>
              </span>
            </span>

            <span v-if="p.unlocked && !p.done" class="step__go">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </button>
          <span v-if="i < session.phaseStatus.length - 1" class="step__line" />
        </li>
      </ol>
    </section>

    <!-- overall progress -->
    <section class="card card--pad prog">
      <div class="prog__head">
        <h2 class="section-title zh">NGSL 2801 進度</h2>
        <span class="prog__pct num">{{ coverage.pct.toFixed(1) }}%</span>
      </div>

      <div class="prog__bar">
        <div class="prog__seen" :style="{ width: coverage.pct + '%' }" />
        <div class="prog__mastered" :style="{ width: coverage.masteredPct + '%' }" />
      </div>

      <div class="prog__legend">
        <span class="lg"><i class="lg__sw lg__sw--seen" /><span class="zh">已學 {{ coverage.seen }}</span></span>
        <span class="lg"><i class="lg__sw lg__sw--mastered" /><span class="zh">熟練 {{ coverage.mastered }}</span></span>
        <span class="lg dim zh">剩 {{ TOTAL_WORDS - coverage.seen }}</span>
      </div>

      <div class="hr" />

      <div class="bands">
        <div v-for="b in bandProgress" :key="b.key" class="band">
          <div class="band__top">
            <span class="chip" :class="b.key === 'B1' ? 'chip--jade' : b.key === 'B2' ? 'chip--violet' : 'chip--amber'">{{ b.label }}</span>
            <span class="band__desc zh dim">{{ b.desc }}</span>
            <span class="band__n num">{{ b.seen }}/{{ b.total }}</span>
          </div>
          <div class="bar">
            <div class="bar__fill" :style="{ width: b.pct + '%' }" />
          </div>
        </div>
      </div>
    </section>

    <!-- shortcuts -->
    <section class="short">
      <RouterLink to="/travel" class="short__card">
        <span class="short__t zh">旅遊會話</span>
        <span class="short__d zh">20 個情境，隨時可練</span>
      </RouterLink>
      <RouterLink to="/errors" class="short__card">
        <span class="short__t zh">錯題本</span>
        <span class="short__d zh">{{ progress.errors.length }} 題待複習</span>
      </RouterLink>
    </section>

    <p v-if="words.enriching" class="syncing zh">
      正在產生單字資料 {{ words.enrichProgress.done }}/{{ words.enrichProgress.total }}…
    </p>
  </main>
</template>

<style scoped>
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); margin-bottom: var(--sp-5); }

.streak {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 12px 6px 9px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  border: 1px solid var(--rule);
  color: var(--ink-3);
  flex-shrink: 0;
}
.streak--on { color: var(--amber); background: var(--amber-wash); border-color: var(--amber-edge); }
.streak svg { width: 17px; height: 17px; }
.streak .num { font-size: var(--step-0); font-weight: 600; }

.nudge {
  display: flex; align-items: center; gap: var(--sp-3);
  background: var(--amber-wash);
  border: 1px solid var(--amber-edge);
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-4);
  margin-bottom: var(--sp-4);
  color: var(--amber);
}
.nudge__title { font-size: var(--step--1); font-weight: 700; margin-bottom: 2px; }
.nudge__desc { font-size: var(--step--2); opacity: 0.9; line-height: 1.55; }
.nudge__arrow { width: 18px; height: 18px; flex-shrink: 0; }

.metrics {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
  margin-bottom: var(--sp-5);
}
.metric {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--sp-3) var(--sp-2);
  text-align: center;
}
.metric__n { font-size: var(--step-2); line-height: 1.1; }
.metric__l { font-size: var(--step--2); color: var(--ink-3); margin-top: 2px; }

/* quest */
.quest { margin-bottom: var(--sp-5); }
.quest__head { display: flex; align-items: baseline; gap: var(--sp-3); margin-bottom: var(--sp-3); }
.quest__est { font-size: var(--step--2); color: var(--ink-3); margin-left: auto; }
.quest__count { font-size: var(--step--1); color: var(--ink-3); }

.steps { position: relative; }
.step { position: relative; }

.step__btn {
  width: 100%;
  display: flex; align-items: center; gap: var(--sp-3);
  padding: var(--sp-3) var(--sp-3);
  border-radius: var(--radius);
  text-align: left;
  transition: background 0.15s;
  position: relative;
  z-index: 1;
}
.step__btn:active:not(:disabled) { background: var(--surface-2); }
.step__btn:disabled { cursor: default; }

.step__dot {
  width: 34px; height: 34px;
  border-radius: 50%;
  display: grid; place-items: center;
  flex-shrink: 0;
  background: var(--surface-2);
  border: 1px solid var(--rule-strong);
  color: var(--ink-3);
  font-size: var(--step--1);
  transition: background 0.2s, border-color 0.2s, color 0.2s;
}
.step__dot svg { width: 16px; height: 16px; }

.step--done .step__dot { background: var(--jade); border-color: var(--jade); color: var(--surface); }
.step--current .step__dot {
  background: var(--surface);
  border-color: var(--jade);
  color: var(--jade);
  box-shadow: 0 0 0 4px var(--jade-wash);
}
.step--locked .step__dot { opacity: 0.5; }
.step--empty .step__dot { color: var(--ink-3); border-style: dashed; }
.step--empty .step__label { color: var(--ink-3); }
.step__dash { font-family: var(--font-mono); }

.step__body { flex: 1; display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.step__label { font-size: var(--step-0); font-weight: 600; }
.step--locked .step__label { color: var(--ink-3); }
.step__meta {
  font-size: var(--step--2); color: var(--ink-3);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.step--current .step__label { color: var(--jade); }

.step__go { width: 18px; height: 18px; color: var(--ink-3); flex-shrink: 0; }
.step__go svg { width: 100%; height: 100%; }

.step__line {
  position: absolute;
  left: calc(var(--sp-3) + 17px);
  top: 46px;
  bottom: -6px;
  width: 2px;
  background: var(--rule);
}
.step--done + .step .step__line,
.step--done .step__line { background: var(--jade-edge); }

/* progress card */
.prog { display: flex; flex-direction: column; gap: var(--sp-3); margin-bottom: var(--sp-5); }
.prog__head { display: flex; align-items: baseline; justify-content: space-between; }
.prog__pct { font-size: var(--step-1); color: var(--jade); }

.prog__bar {
  position: relative;
  height: 10px;
  border-radius: 5px;
  background: var(--surface-3);
  overflow: hidden;
}
.prog__seen, .prog__mastered {
  position: absolute; left: 0; top: 0; bottom: 0;
  border-radius: 5px;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.prog__seen { background: var(--jade-edge); }
.prog__mastered { background: var(--jade); }

.prog__legend { display: flex; align-items: center; gap: var(--sp-4); flex-wrap: wrap; font-size: var(--step--2); }
.lg { display: flex; align-items: center; gap: 5px; color: var(--ink-2); }
.lg__sw { width: 9px; height: 9px; border-radius: 2px; display: block; }
.lg__sw--seen { background: var(--jade-edge); }
.lg__sw--mastered { background: var(--jade); }

.bands { display: flex; flex-direction: column; gap: var(--sp-3); }
.band { display: flex; flex-direction: column; gap: 6px; }
.band__top { display: flex; align-items: center; gap: var(--sp-2); }
.band__desc { font-size: var(--step--2); flex: 1; }
.band__n { font-size: var(--step--2); color: var(--ink-2); }

/* shortcuts */
.short { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.short__card {
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  padding: var(--sp-4);
  display: flex; flex-direction: column; gap: 2px;
  transition: border-color 0.15s;
}
.short__card:active { background: var(--surface-2); }
.short__t { font-size: var(--step-0); font-weight: 700; }
.short__d { font-size: var(--step--2); color: var(--ink-3); }

.syncing {
  margin-top: var(--sp-4);
  text-align: center;
  font-size: var(--step--2);
  color: var(--ink-3);
}
</style>
