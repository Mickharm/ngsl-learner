<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { useAuth } from '@/stores/auth'
import { useFamily } from '@/stores/family'
import { BANDS } from '@/config'
import { wordPower, levelOf, titleOf } from '@/lib/xp'
import { EXAMPLES } from '@/data/morphology'
import { dayNumber, GAME_BY_ID } from '@/lib/arcade'
import WordAnatomy from '@/components/WordAnatomy.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * 今天 — the day as a class timetable (課表): 第一節 複習, 第二節 新字… The
 * period that is on now is highlighted and carries the only button on the
 * screen; finished periods get the teacher's red tick. Under it, one word
 * part a day and the long-run numbers, kept quiet.
 */
const auth = useAuth()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const words = useWords()
const router = useRouter()
const family = useFamily()

const ZH_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六']
const today = new Date()
const dateLine = `${today.getMonth() + 1} 月 ${today.getDate()} 日　星期${WEEKDAY[today.getDay()]}`

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
  grammar: () => session.grammarPoint?.title || '30 個文法點都排過一輪了',
  essentials: () => session.essentialUnit?.title || '基礎單元都排過一輪了',
  write: () => '用今天的字寫句子，AI 批改',
  read: () => '讀一篇看得懂的圖文故事，再玩三個小遊戲',
  play: p => p.empty ? '先學幾個字再來玩' : `${GAME_BY_ID[p.game]?.title || '遊戲'}：用今天的字玩一局`,
  listen: () => `${session.listenCount} 題，只聽不看`,
  summary: () => '看今天的成績'
}
const MINUTES = p => p.key === 'learn' ? Math.round(session.plan.newCount * 1.4) : p.key === 'review' ? Math.round(session.plan.reviewCount * 0.7) : p.key === 'listen' ? Math.round(session.listenMinutes) : p.minutes

function go (p) { if (p.unlocked) router.push(p.route) }

const current = computed(() => session.phaseStatus.find(p => p.current))

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

/* ---- 家人聯絡簿 ---- */
const myLine = computed(() => ({
  done_steps: session.completedCount,
  total_steps: session.todayPhases.length,
  minutes: session.minutesToday,
  streak: progress.streak,
  xp: power.value.xp
}))
watch(myLine, l => family.publish(l))
const showFamily = computed(() => family.available && family.board.length >= 2)

onMounted(async () => {
  session.rollIfNewDay()
  session.startClock()
  if (needsPlacement.value) { router.replace('/setup'); return }
  await family.load()
  family.publish(myLine.value)
})
onUnmounted(() => session.stopClock())
</script>

<template>
  <main class="shell home">
    <header class="top">
      <div>
        <p class="top__date kai">{{ dateLine }}</p>
        <h1 class="page-title">{{ auth.displayName }}，今天的課</h1>
      </div>
      <RouterLink to="/me" class="lvl" :aria-label="`字力等級 ${power.level}`">
        <span class="lvl__badge num">Lv.{{ power.level }}</span>
        <span class="lvl__streak zh" :class="{ 'lvl__streak--on': progress.streak > 0 }">連續 {{ progress.streak }} 天</span>
      </RouterLink>
    </header>

    <RouterLink v-if="needsKey" to="/settings" class="nudge zh">
      還沒設定 Gemini API Key：新單字的翻譯與例句需要它。點這裡設定。
    </RouterLink>

    <!-- the timetable -->
    <section class="quest">
      <div class="quest__head">
        <h2 class="quest__title kai">今日課表</h2>
        <span class="quest__meta zh">{{ session.plan.track === 'A' ? '文法日' : '基礎日' }}，約 {{ session.plan.estimatedMinutes }} 分鐘</span>
        <span class="quest__count num">{{ session.completedCount }}/{{ session.todayPhases.length }}</span>
      </div>

      <ol class="steps">
        <li
          v-for="(p, i) in session.phaseStatus" :key="p.key"
          class="step"
          :class="{ 'step--done': p.done, 'step--current': p.current, 'step--locked': !p.unlocked, 'step--empty': p.empty && !p.done }"
        >
          <button class="step__btn" :disabled="!p.unlocked" @click="go(p)">
            <span class="step__n kai" aria-hidden="true">{{ ZH_NUM[i] }}</span>
            <span class="step__body">
              <span class="step__label zh">{{ p.label }}</span>
              <span class="step__meta zh">{{ META[p.key]?.(p) }}</span>
            </span>
            <span class="step__end">
              <svg v-if="p.done" class="step__tick" viewBox="0 0 32 24" aria-label="完成"><path d="M3 13.5c3 2.6 5.6 5.3 8 8.2C16.4 13.4 22.5 6.2 29.5 2" /></svg>
              <span v-else-if="p.current" class="step__go zh">開始</span>
              <span v-else-if="!p.empty" class="step__min num">{{ MINUTES(p) }}′</span>
            </span>
          </button>
        </li>
      </ol>
    </section>

    <!-- the family's day -->
    <section v-if="showFamily" class="fam">
      <h2 class="sec__t kai">家人聯絡簿</h2>
      <ul class="fam__list">
        <li v-for="m in family.board" :key="m.user_id" class="fam__row" :class="{ 'fam__row--me': m.me }">
          <span class="fam__name kai">{{ m.name }}</span>
          <span class="fam__bar"><span :style="{ width: (m.total_steps ? m.doneSteps / m.total_steps * 100 : 0) + '%' }" /></span>
          <span class="fam__n num">{{ m.doneSteps }}/{{ m.total_steps || 8 }}</span>
          <span class="fam__streak zh">{{ m.streak }} 天</span>
          <svg v-if="m.finished" class="fam__tick" viewBox="0 0 32 24" aria-label="今天的課上完了"><path d="M3 13.5c3 2.6 5.6 5.3 8 8.2C16.4 13.4 22.5 6.2 29.5 2" /></svg>
          <span v-else class="fam__tick" />
        </li>
      </ul>
    </section>

    <!-- one word part a day -->
    <section v-if="wotd" class="wotd">
      <div class="wotd__head">
        <h2 class="sec__t kai">今日零件</h2>
        <AudioButton :text="wotd.w" size="sm" />
      </div>
      <WordAnatomy :word="wotd.w" size="md" />
      <RouterLink :to="`/parts?unit=${wotd.unit}`" class="wotd__more zh">這個零件的整個單元</RouterLink>
    </section>

    <!-- play -->
    <section class="play">
      <div class="sec__head"><h2 class="sec__t kai">下課玩一下</h2><RouterLink to="/games" class="sec__link zh">全部遊戲</RouterLink></div>
      <div class="play__row">
        <RouterLink to="/games/wordle" class="pl"><span class="pl__t zh">每日猜字</span><span class="pl__s zh">五個字母，六次機會</span></RouterLink>
        <RouterLink to="/games/rain" class="pl"><span class="pl__t zh">單字雨</span><span class="pl__s zh">落地前點出意思</span></RouterLink>
        <RouterLink to="/games/builder" class="pl"><span class="pl__t zh">零件積木</span><span class="pl__s zh">60 秒拼字</span></RouterLink>
      </div>
    </section>

    <!-- report card -->
    <section class="nums">
      <div class="sec__head"><h2 class="sec__t kai">成績單</h2><RouterLink to="/stats" class="sec__link zh">詳細數據</RouterLink></div>
      <div class="power">
        <span class="power__t zh">{{ titleOf(power.level) }}，字力 <b class="num">{{ power.xp }}</b></span>
        <span class="power__bar"><span :style="{ width: power.pct + '%' }" /></span>
        <span class="power__hint zh">每個字用越難的方式答對，字力越高；忘記會掉。</span>
      </div>
      <dl class="metrics">
        <div class="metric"><dt class="zh">今日已答</dt><dd class="num">{{ progress.today.total_count }}</dd></div>
        <div class="metric"><dt class="zh">正確率</dt><dd class="num">{{ accuracy === null ? '—' : accuracy + '%' }}</dd></div>
        <div class="metric"><dt class="zh">分鐘</dt><dd class="num">{{ session.minutesToday }}</dd></div>
        <div class="metric"><dt class="zh">待複習</dt><dd class="num">{{ session.plan.reviewCount }}</dd></div>
      </dl>
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
.home { display: flex; flex-direction: column; gap: var(--sp-6); }
.top { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--sp-3); }
.top__date { color: var(--ink-3); font-size: var(--step-0); }
.top .page-title { font-size: var(--step-3); line-height: 1.25; }
.lvl { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
.lvl__badge { display: inline-grid; place-items: center; height: 30px; padding: 0 10px; border: 1.5px solid var(--ink); border-radius: 4px; font-weight: 700; transform: rotate(-3deg); }
.lvl__streak { font-size: var(--step--2); color: var(--ink-3); }
.lvl__streak--on { color: var(--redpen); font-weight: 700; }
.nudge { display: block; padding: 10px 12px; border-left: 4px solid var(--redpen); background: var(--redpen-wash); color: var(--ink); font-size: var(--step--1); border-radius: 0 6px 6px 0; }

/* timetable: a ruled sheet with a red margin, periods on the lines */
.quest {
  position: relative;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-1);
  padding: var(--sp-4) var(--sp-3) var(--sp-2) 56px;
}
.quest::before { content: ''; position: absolute; left: 44px; top: 0; bottom: 0; width: 1.5px; background: var(--line-base); opacity: 0.7; }
.quest__head { display: flex; align-items: baseline; gap: var(--sp-2); padding-bottom: var(--sp-2); }
.quest__title { font-size: var(--step-2); font-weight: 700; }
.quest__meta { font-size: var(--step--2); color: var(--ink-3); flex: 1; }
.quest__count { font-size: var(--step--1); color: var(--ink-3); }
.steps { display: flex; flex-direction: column; }
.step { border-top: 1px solid var(--line); }
.step__btn { position: relative; width: 100%; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: var(--sp-3); padding: 12px 4px 12px 0; text-align: left; min-height: 58px; }
.step__n {
  position: absolute; left: -46px; top: 50%; transform: translateY(-50%);
  width: 30px; text-align: center; font-size: var(--step-1); font-weight: 700; color: var(--ink-3);
}
.step__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.step__label { font-weight: 700; font-size: var(--step-0); }
.step__meta { font-size: var(--step--2); color: var(--ink-3); line-height: 1.45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step__end { display: flex; align-items: center; }
.step__min { font-size: var(--step--1); color: var(--ink-3); }
.step__tick { width: 30px; height: 22px; fill: none; stroke: var(--redpen); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.step--done .step__label { color: var(--ink-3); font-weight: 500; }
.step--locked .step__btn { opacity: 0.5; }
.step--empty .step__label { text-decoration: line-through; text-decoration-color: var(--ink-3); }
.step--current .step__label { font-size: var(--step-1); }
.step--current .step__label, .step--current .step__n { color: var(--ink); }
/* the highlighter across the period that is on now */
.step--current .step__label { background: linear-gradient(transparent 52%, var(--hl-yellow) 52%, var(--hl-yellow) 92%, transparent 92%); padding: 0 2px; margin-left: -2px; align-self: flex-start; }
.step--current .step__meta { white-space: normal; color: var(--ink-2); font-size: var(--step--1); }
.step__go { background: var(--pen); color: var(--pen-ink); font-weight: 700; padding: 9px 18px; border-radius: var(--radius); box-shadow: 0 2px 0 color-mix(in srgb, var(--pen) 60%, #000); }

.sec__head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--sp-2); }
.sec__t { font-size: var(--step-1); font-weight: 700; }
.sec__link { font-size: var(--step--1); color: var(--pen); }

.fam { display: flex; flex-direction: column; gap: var(--sp-2); }
.fam__list { display: flex; flex-direction: column; }
.fam__row { display: grid; grid-template-columns: 4em 1fr auto auto 26px; align-items: center; gap: var(--sp-2); padding: 9px 0; border-bottom: 1px dashed var(--rule-strong); }
.fam__row--me .fam__name { background: linear-gradient(transparent 55%, var(--hl-yellow) 55%, var(--hl-yellow) 92%, transparent 92%); }
.fam__name { font-size: var(--step-1); font-weight: 700; justify-self: start; }
.fam__bar { height: 6px; background: var(--surface-3); border-radius: 2px; overflow: hidden; }
.fam__bar span { display: block; height: 100%; background: var(--pen); }
.fam__n { font-size: var(--step--1); color: var(--ink-2); }
.fam__streak { font-size: var(--step--2); color: var(--ink-3); min-width: 3em; text-align: right; }
.fam__tick { width: 26px; height: 20px; fill: none; stroke: var(--redpen); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }

.wotd { display: flex; flex-direction: column; gap: var(--sp-2); }
.wotd__head { display: flex; align-items: center; justify-content: space-between; }
.wotd__more { font-size: var(--step--1); color: var(--pen); align-self: center; text-decoration: underline; text-underline-offset: 3px; text-decoration-color: var(--line); }

.play__row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
.pl { display: flex; flex-direction: column; gap: 2px; padding: var(--sp-3); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow-1); min-height: 80px; border-top: 4px solid var(--hl-pink); }
.pl:nth-child(2) { border-top-color: var(--hl-blue); }
.pl:nth-child(3) { border-top-color: var(--hl-yellow); }
.pl__t { font-weight: 700; font-size: var(--step--1); }
.pl__s { font-size: var(--step--2); color: var(--ink-3); line-height: 1.4; }

.nums { display: flex; flex-direction: column; gap: var(--sp-3); }
.power { display: flex; flex-direction: column; gap: 6px; }
.power__t { font-weight: 700; }
.power__bar { height: 8px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.power__bar span { display: block; height: 100%; background: var(--pen); }
.power__hint { font-size: var(--step--2); color: var(--ink-3); }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1.5px solid var(--ink); border-bottom: 1px solid var(--rule-strong); }
.metric { display: flex; flex-direction: column; align-items: center; padding: 10px 2px; }
.metric + .metric { border-left: 1px solid var(--rule); }
.metric dt { font-size: var(--step--2); color: var(--ink-3); order: 2; }
.metric dd { font-size: var(--step-1); font-weight: 700; font-family: var(--font-word); }
.prog { display: flex; flex-direction: column; gap: var(--sp-2); }
.prog__head { display: flex; align-items: baseline; gap: var(--sp-2); font-weight: 700; }
.prog__scope { flex: 1; color: var(--ink-3); font-size: var(--step--1); }
.prog__bar { position: relative; height: 10px; border-radius: 2px; background: var(--surface-3); overflow: hidden; }
.prog__seen, .prog__mastered { position: absolute; left: 0; top: 0; bottom: 0; }
.prog__seen { background: var(--hl-blue); }
.prog__mastered { background: var(--jade); }
.prog__legend { display: flex; gap: var(--sp-3); font-size: var(--step--2); color: var(--ink-2); flex-wrap: wrap; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
.sw--seen { background: var(--hl-blue); } .sw--mastered { background: var(--jade); }
.bands { display: flex; flex-direction: column; gap: 8px; margin-top: var(--sp-2); }
.band { display: grid; grid-template-columns: 7.5em 1fr auto; gap: var(--sp-2); align-items: center; font-size: var(--step--2); color: var(--ink-2); }
.band__n { color: var(--ink-3); }
.syncing { text-align: center; font-size: var(--step--1); color: var(--ink-3); }
</style>
