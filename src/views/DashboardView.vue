<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { BANDS } from '@/config'
import { isMasteredV2 } from '@/lib/wordsrs'
import { wordPower, levelOf, titleOf } from '@/lib/xp'
import { EXAMPLES } from '@/data/morphology'
import { dayNumber } from '@/lib/arcade'
import WordAnatomy from '@/components/WordAnatomy.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * 今天 — the day's route, first and largest, because "what do I do now" is
 * the only question this screen has to answer. The current step is the one
 * that opens up with a button; finished steps collapse to a tick; later ones
 * wait. Under it: one word part a day, the arcade, and the long-run numbers.
 */
const auth = useAuth()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const words = useWords()
const router = useRouter()

const coverage = computed(() => {
  const s = progress.stats
  return { seen: s.seen, mastered: s.mastered, pct: (s.seen / settings.target) * 100, masteredPct: (s.mastered / settings.target) * 100 }
})

const bandProgress = computed(() =>
  Object.values(BANDS).map(b => {
    let seen = 0
    for (let id = b.range[0]; id <= b.range[1]; id++) if (progress.cards.get(id)) seen++
    const total = b.range[1] - b.range[0] + 1
    return { ...b, seen, total, pct: (seen / total) * 100 }
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
const power = computed(() => levelOf(wordPower(progress.cards.values())))

const META = {
  review: p => p.empty ? '目前沒有到期的字' : `${session.plan.reviewCount} 個字，每個字換一種更難的考法`,
  learn: p => p.empty ? '今天沒有新字' : `${session.plan.newCount} 個新字：先猜意思，再看零件與例句`,
  parts: p => p.empty ? '今天沒有要上的單元' : session.plan.parts?.title || '',
  grammar: p => session.grammarPoint?.title || '30 個文法點都排過一輪了',
  essentials: p => session.essentialUnit?.title || '基礎單元都排過一輪了',
  write: () => '用今天的字寫句子，AI 批改',
  read: () => '讀一篇看得懂的圖文故事，再玩三個小遊戲',
  listen: () => `${session.listenCount} 題，只聽不看`,
  summary: () => '看今天的成績'
}

function go (p) { if (p.unlocked) router.push(p.route) }

/** One word part a day: a course example, preferring words already met. */
const wotd = computed(() => {
  const day = dayNumber()
  const met = EXAMPLES.filter(e => {
    const id = words.lookup(e.w)
    return id && progress.cards.get(id) && e.tiles.some(t => t.kind !== 'base')
  })
  const list = met.length >= 5 ? met : EXAMPLES.filter(e => e.tiles.some(t => t.kind !== 'base'))
  return list[day % list.length]
})

onMounted(() => {
  session.rollIfNewDay()
  session.startClock()
  if (needsPlacement.value) router.replace('/setup')
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <main class="shell home">
    <header class="top">
      <h1 class="page-title zh">今天</h1>
      <div class="top__right">
        <span class="streak" :class="{ 'streak--on': progress.streak > 0 }" :aria-label="`連續 ${progress.streak} 天`">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.7c.9 3 3.2 4.2 3.2 4.2s-.6 1.6-.2 2.6c1.2-.4 2-1.6 2-1.6 1.7 2 2.6 3.8 2.6 6C19.6 18.3 16.2 21.3 12 21.3S4.4 18.3 4.4 13.9c0-4.6 4-6.6 5.2-9.1.7-1.4 1.2-2.1 2.4-2.1z" /></svg>
          <span class="num">{{ progress.streak }}</span><span class="zh streak__u">天</span>
        </span>
        <RouterLink to="/me" class="lvl" :aria-label="`字力等級 ${power.level}`">
          <span class="lvl__badge num">Lv.{{ power.level }}</span>
        </RouterLink>
      </div>
    </header>

    <RouterLink v-if="needsKey" to="/settings" class="nudge">
      <span class="nudge__body">
        <span class="nudge__title zh">還沒設定 Gemini API Key</span>
        <span class="nudge__desc zh">單字的翻譯、例句與每日文章都需要它。點這裡去設定。</span>
      </span>
    </RouterLink>

    <!-- the day's route -->
    <section class="quest">
      <div class="quest__head">
        <h2 class="quest__title zh">今日關卡</h2>
        <span class="quest__track zh">{{ session.plan.track === 'A' ? '文法日' : '基礎日' }}</span>
        <span class="quest__est zh">約 <b class="num">{{ session.plan.estimatedMinutes }}</b> 分鐘</span>
        <span class="quest__count num">{{ session.completedCount }}/{{ session.todayPhases.length }}</span>
      </div>

      <ol class="steps">
        <li
          v-for="(p, i) in session.phaseStatus" :key="p.key"
          class="step"
          :class="{ 'step--done': p.done, 'step--current': p.current, 'step--locked': !p.unlocked, 'step--empty': p.empty && !p.done }"
        >
          <button class="step__btn" :disabled="!p.unlocked" @click="go(p)">
            <span class="step__n">
              <svg v-if="p.done" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="step__body">
              <span class="step__label zh">{{ p.label }}</span>
              <span class="step__meta zh">{{ META[p.key]?.(p) }}</span>
            </span>
            <span v-if="p.current" class="step__go zh">開始</span>
            <svg v-else-if="!p.unlocked" class="step__lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></svg>
          </button>
        </li>
      </ol>
    </section>

    <!-- one word part a day -->
    <section v-if="wotd" class="wotd">
      <div class="wotd__head">
        <h2 class="wotd__t zh">今日零件</h2>
        <AudioButton :text="wotd.w" size="sm" />
      </div>
      <WordAnatomy :word="wotd.w" size="md" />
      <RouterLink :to="`/parts?unit=${wotd.unit}`" class="wotd__more zh">看這個零件的整個單元</RouterLink>
    </section>

    <!-- arcade -->
    <section class="play">
      <div class="sec__head"><h2 class="sec__t zh">玩一下</h2><RouterLink to="/games" class="sec__link zh">全部遊戲</RouterLink></div>
      <div class="play__row">
        <RouterLink to="/games/wordle" class="pl pl--ink"><span class="pl__t zh">每日猜字</span><span class="pl__s zh">五個字母，六次機會</span></RouterLink>
        <RouterLink to="/games/rain" class="pl"><span class="pl__t zh">單字雨</span><span class="pl__s zh">落地前點出意思</span></RouterLink>
        <RouterLink to="/games/builder" class="pl"><span class="pl__t zh">零件積木</span><span class="pl__s zh">60 秒拼字</span></RouterLink>
      </div>
    </section>

    <!-- numbers -->
    <section class="nums">
      <div class="sec__head"><h2 class="sec__t zh">進度</h2><RouterLink to="/stats" class="sec__link zh">詳細數據</RouterLink></div>
      <div class="power">
        <span class="power__t zh">{{ titleOf(power.level) }}，字力 <b class="num">{{ power.xp }}</b></span>
        <span class="power__bar"><span :style="{ width: power.pct + '%' }" /></span>
        <span class="power__hint zh">每個字用越難的方式答對，字力越高；忘記會掉。</span>
      </div>
      <div class="metrics">
        <div class="metric"><b class="num">{{ progress.today.total_count }}</b><span class="zh">今日已答</span></div>
        <div class="metric"><b class="num">{{ accuracy === null ? '—' : accuracy + '%' }}</b><span class="zh">正確率</span></div>
        <div class="metric"><b class="num">{{ session.minutesToday }}</b><span class="zh">分鐘</span></div>
        <div class="metric"><b class="num">{{ session.plan.reviewCount }}</b><span class="zh">待複習</span></div>
      </div>
      <div class="prog">
        <div class="prog__head">
          <span class="zh">這一階段</span>
          <span class="prog__scope num">1–{{ settings.target }}</span>
          <span class="prog__pct num">{{ coverage.pct.toFixed(1) }}%</span>
        </div>
        <div class="prog__bar">
          <div class="prog__seen" :style="{ width: coverage.pct + '%' }" />
          <div class="prog__mastered" :style="{ width: coverage.masteredPct + '%' }" />
        </div>
        <div class="prog__legend zh">
          <span><i class="sw sw--seen" />學過 {{ coverage.seen }}</span>
          <span><i class="sw sw--mastered" />熟練 {{ coverage.mastered }}</span>
          <span class="dim">還有 {{ Math.max(0, settings.target - coverage.seen) }}</span>
        </div>
        <div class="bands">
          <div v-for="b in bandProgress" :key="b.key" class="band">
            <span class="band__l zh">{{ b.desc }}</span>
            <span class="bar"><span class="bar__fill" :style="{ width: b.pct + '%' }" /></span>
            <span class="band__n num">{{ b.seen }}/{{ b.total }}</span>
          </div>
        </div>
      </div>
    </section>

    <p v-if="words.enriching" class="syncing zh">正在產生單字資料 {{ words.enrichProgress.done }}/{{ words.enrichProgress.total }}…</p>
  </main>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: var(--sp-5); }
.top { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.top__right { display: flex; align-items: center; gap: var(--sp-2); }
.streak { display: inline-flex; align-items: center; gap: 4px; padding: 6px 12px; border-radius: var(--radius-pill); background: var(--surface-2); color: var(--ink-3); }
.streak--on { background: var(--amber-wash); color: var(--amber); }
.streak svg { width: 16px; height: 16px; }
.streak__u { font-size: var(--step--2); }
.lvl__badge { display: inline-grid; place-items: center; height: 34px; padding: 0 12px; border-radius: 10px; background: var(--slab); color: var(--sun); font-weight: 800; box-shadow: 0 3px 0 #0006; }

.nudge { display: block; padding: var(--sp-3) var(--sp-4); border-radius: var(--radius); background: var(--amber-wash); color: var(--amber); }
.nudge__body { display: flex; flex-direction: column; gap: 2px; }
.nudge__title { font-weight: 800; font-size: var(--step--1); }
.nudge__desc { font-size: var(--step--2); }

/* the route: one navy panel, steps as raised number tiles */
.quest { background: var(--slab); color: var(--slab-ink); border-radius: var(--radius-lg); padding: var(--sp-4) var(--sp-3) var(--sp-3); }
.quest__head { display: flex; align-items: baseline; gap: var(--sp-2); padding: 0 var(--sp-1) var(--sp-3); flex-wrap: wrap; }
.quest__title { font-size: var(--step-1); font-weight: 800; }
.quest__track { font-size: var(--step--2); font-weight: 700; padding: 2px 10px; border-radius: var(--radius-pill); background: #ffffff1f; }
.quest__est { font-size: var(--step--1); opacity: 0.7; flex: 1; }
.quest__count { font-size: var(--step--1); opacity: 0.7; }
.steps { display: flex; flex-direction: column; gap: 4px; }
.step__btn { width: 100%; display: grid; grid-template-columns: 34px 1fr auto; align-items: center; gap: var(--sp-3); padding: 8px var(--sp-2); border-radius: var(--radius); text-align: left; color: inherit; }
.step__n {
  width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px;
  font-family: var(--font-word); font-weight: 800; font-size: var(--step--1);
  background: #ffffff14; color: inherit; border: 1.5px solid #ffffff2e; box-shadow: 0 2px 0 #ffffff1a;
}
.step__n svg { width: 18px; height: 18px; }
.step__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.step__label { font-weight: 700; }
.step__meta { font-size: var(--step--2); opacity: 0.62; line-height: 1.45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step--done .step__n { background: #2fb463; border-color: #2fb463; color: #fff; box-shadow: 0 2px 0 #1d7a42; }
.step--done .step__label { opacity: 0.7; }
.step--locked { opacity: 0.45; }
.step--empty .step__label { text-decoration: line-through; opacity: 0.6; }
.step--current .step__btn { background: #ffffff12; padding-top: 12px; padding-bottom: 12px; }
.step--current .step__n { background: var(--sun); border-color: var(--sun-edge); color: var(--sun-ink); box-shadow: 0 3px 0 var(--sun-edge); }
.step--current .step__label { font-size: var(--step-1); font-weight: 800; }
.step--current .step__meta { white-space: normal; opacity: 0.8; font-size: var(--step--1); }
.step__go { background: var(--sun); color: var(--sun-ink); font-weight: 800; padding: 8px 16px; border-radius: var(--radius-pill); }
.step__lock { width: 16px; height: 16px; opacity: 0.6; }

.wotd { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-lg); }
.wotd__head { display: flex; align-items: center; justify-content: space-between; }
.wotd__t { font-weight: 800; font-size: var(--step-0); }
.wotd__more { font-size: var(--step--1); color: var(--t-prefix); font-weight: 600; align-self: center; }

.sec__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--sp-2); }
.sec__t { font-size: var(--step-0); font-weight: 800; }
.sec__link { font-size: var(--step--1); color: var(--t-prefix); font-weight: 600; }
.play__row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
.pl { display: flex; flex-direction: column; gap: 2px; padding: var(--sp-3); border-radius: var(--radius); background: var(--surface); border: 1px solid var(--rule); min-height: 84px; }
.pl--ink { background: var(--sun); border-color: var(--sun-edge); color: var(--sun-ink); }
.pl__t { font-weight: 800; font-size: var(--step--1); }
.pl__s { font-size: var(--step--2); opacity: 0.75; line-height: 1.4; }

.nums { display: flex; flex-direction: column; gap: var(--sp-3); }
.power { display: flex; flex-direction: column; gap: 6px; }
.power__t { font-weight: 700; }
.power__bar { height: 10px; border-radius: 5px; background: var(--surface-3); overflow: hidden; }
.power__bar span { display: block; height: 100%; background: var(--sun); border-radius: 5px; }
.power__hint { font-size: var(--step--2); color: var(--ink-3); }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
.metric { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--sp-3) 4px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--rule); }
.metric b { font-size: var(--step-1); }
.metric span { font-size: var(--step--2); color: var(--ink-3); }
.prog { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4); border-radius: var(--radius-lg); background: var(--surface); border: 1px solid var(--rule); }
.prog__head { display: flex; align-items: baseline; gap: var(--sp-2); font-weight: 700; }
.prog__scope { flex: 1; color: var(--ink-3); font-size: var(--step--1); }
.prog__bar { position: relative; height: 12px; border-radius: 6px; background: var(--surface-3); overflow: hidden; }
.prog__seen, .prog__mastered { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 6px; }
.prog__seen { background: var(--t-prefix-edge); }
.prog__mastered { background: var(--jade); }
.prog__legend { display: flex; gap: var(--sp-3); font-size: var(--step--2); color: var(--ink-2); flex-wrap: wrap; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 4px; vertical-align: -1px; }
.sw--seen { background: var(--t-prefix-edge); } .sw--mastered { background: var(--jade); }
.bands { display: flex; flex-direction: column; gap: 8px; margin-top: var(--sp-2); }
.band { display: grid; grid-template-columns: 7.5em 1fr auto; gap: var(--sp-2); align-items: center; font-size: var(--step--2); color: var(--ink-2); }
.band__n { color: var(--ink-3); }
.syncing { text-align: center; font-size: var(--step--1); color: var(--ink-3); }
</style>
