<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useProgress } from '@/stores/progress'
import { useSession } from '@/stores/session'
import { useSettings } from '@/stores/settings'
import { useWords } from '@/stores/words'
import { useAuth } from '@/stores/auth'
import { BANDS } from '@/config'
import { wordPower, levelOf, titleOf } from '@/lib/xp'
import { EXAMPLES } from '@/data/morphology'
import { dayNumber, GAME_BY_ID } from '@/lib/arcade'
import WordAnatomy from '@/components/WordAnatomy.vue'
import AudioButton from '@/components/AudioButton.vue'

/**
 * 今天 (v6) — the first screen is a view, one sentence and one button.
 *
 * The top of the page is left to the scene: the day's arc with the sun (or
 * moon) at the station the learner has reached. Under the range, in the
 * cloud, the title; then the period that is on now, in the one prominent
 * panel with the only filled button on the screen. That is everything above
 * the fold, on purpose.
 *
 * Below it the whole timetable (課表) as a quiet list — finished periods
 * ticked, the current one marked — then one word part a day and the long-run
 * numbers in a single panel.
 */
const auth = useAuth()
const progress = useProgress()
const session = useSession()
const settings = useSettings()
const words = useWords()
const router = useRouter()

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
  write: () => '和 AI 角色用英文聊一個情境，最多 5 回合',
  read: () => '讀一篇看得懂的圖文故事，再玩三個小遊戲',
  play: p => p.empty ? '先學幾個字再來玩' : `${GAME_BY_ID[p.game]?.title || '遊戲'}：用今天的字玩一局`,
  listen: () => `${session.listenCount} 題，只聽不看`,
  summary: () => '看今天的成績'
}
const MINUTES = p => p.key === 'learn' ? Math.round(session.plan.newCount * 1.4) : p.key === 'review' ? Math.round(session.plan.reviewCount * 0.7) : p.key === 'listen' ? Math.round(session.listenMinutes) : p.minutes

function go (p) { if (p.unlocked) router.push(p.route) }

const current = computed(() => session.phaseStatus.find(p => p.current))
const currentIndex = computed(() => session.phaseStatus.findIndex(p => p.current))
const ORDINAL = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
const greeting = (() => {
  const h = today.getHours()
  return h < 5 ? '夜深了' : h < 11 ? '早安' : h < 14 ? '午安' : h < 18 ? '下午好' : '晚安'
})()

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
    <header class="hero">
      <div class="hero__meta">
        <p class="hero__date zh">{{ dateLine }}</p>
        <RouterLink to="/me" class="lvl" :aria-label="`字力等級 ${power.level}，連續 ${progress.streak} 天`">
          <span class="lvl__badge num">Lv.{{ power.level }}</span>
          <span class="lvl__streak zh" :class="{ 'lvl__streak--on': progress.streak > 0 }">連續 {{ progress.streak }} 天</span>
        </RouterLink>
      </div>

      <!-- the scene shows through here: the arc, the light, the range -->
      <div class="hero__sky" aria-hidden="true" />

      <div class="hero__title">
        <p class="hero__hi zh">{{ auth.displayName }}，{{ greeting }}</p>
        <h1 class="page-title">今天的課</h1>
        <p class="hero__sum zh">
          {{ session.plan.track === 'A' ? '文法日' : '基礎日' }}，約 {{ session.plan.estimatedMinutes }} 分鐘。已經上完
          <b class="fig">{{ session.completedCount }}</b> / <span class="fig">{{ session.todayPhases.length }}</span> 節
        </p>
      </div>
    </header>

    <RouterLink v-if="needsKey" to="/settings" class="nudge zh">
      還沒設定 Gemini API Key：新單字的翻譯與例句需要它。點這裡設定。
    </RouterLink>

    <!-- now: the one prominent panel, the one filled button -->
    <section v-if="session.allDone" class="now now--done">
      <p class="now__n zh">八節都上完了</p>
      <h2 class="now__t kai">今天到這裡</h2>
      <p class="now__m zh">複習量已經排到明天。想再練，下面每一節都可以重上。</p>
      <RouterLink to="/summary" class="btn btn--primary btn--block zh">看今天的成績</RouterLink>
    </section>
    <section v-else-if="current" class="now">
      <p class="now__n zh">第{{ ORDINAL[currentIndex] }}節</p>
      <h2 class="now__t kai">{{ current.label }}</h2>
      <p class="now__m zh">{{ META[current.key]?.(current) }}</p>
      <button class="btn btn--primary btn--block now__go zh" @click="go(current)">
        <span>開始</span>
        <span v-if="!current.empty && MINUTES(current)" class="now__min">約 {{ MINUTES(current) }} 分鐘</span>
      </button>
    </section>

    <!-- the timetable -->
    <section class="quest">
      <div class="quest__head">
        <h2 class="quest__title kai">今日課表</h2>
        <span class="quest__count fig">{{ session.completedCount }}/{{ session.todayPhases.length }}</span>
      </div>

      <ol class="steps">
        <li
          v-for="(p, i) in session.phaseStatus" :key="p.key"
          class="step"
          :class="{ 'step--done': p.done, 'step--current': p.current, 'step--locked': !p.unlocked, 'step--empty': p.empty && !p.done }"
        >
          <button class="step__btn" :disabled="!p.unlocked" @click="go(p)">
            <span class="step__n fig" aria-hidden="true">
              <svg v-if="p.done" viewBox="0 0 24 24"><path d="M7 12.4l3.3 3.3L17.2 8.8" /></svg>
              <template v-else>{{ i + 1 }}</template>
            </span>
            <span class="step__body">
              <span class="step__label zh">{{ p.label }}</span>
              <span class="step__meta zh">{{ META[p.key]?.(p) }}</span>
            </span>
            <span class="step__end">
              <span v-if="p.done" class="step__tick zh">完成</span>
              <span v-else-if="p.current" class="step__go zh">現在</span>
              <span v-else-if="!p.empty" class="step__min num">{{ MINUTES(p) }} 分</span>
            </span>
          </button>
        </li>
      </ol>
    </section>

    <!-- one word part a day -->
    <section v-if="wotd" class="wotd">
      <div class="sec__head">
        <h2 class="sec__t kai">今日零件</h2>
        <AudioButton :text="wotd.w" size="sm" />
      </div>
      <div class="wotd__body card">
        <WordAnatomy :word="wotd.w" size="md" />
        <RouterLink :to="`/parts?unit=${wotd.unit}`" class="wotd__more zh">這個零件的整個單元</RouterLink>
      </div>
    </section>

    <!-- play -->
    <section class="play">
      <div class="sec__head"><h2 class="sec__t kai">下課玩一下</h2><RouterLink to="/games" class="sec__link zh">全部遊戲</RouterLink></div>
      <div class="play__row">
        <RouterLink to="/games/wordle" class="pl">
          <span class="pl__i" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" /></svg></span>
          <span class="pl__t zh">每日猜字</span><span class="pl__s zh">五個字母，六次機會</span>
        </RouterLink>
        <RouterLink to="/games/rain" class="pl">
          <span class="pl__i" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 4.5c2 3 3 4.8 3 6.4a3 3 0 0 1-6 0c0-1.6 1-3.4 3-6.4z" /><path d="M16.5 10c2 3 3 4.8 3 6.4a3 3 0 0 1-6 0c0-1.6 1-3.4 3-6.4z" /></svg></span>
          <span class="pl__t zh">單字雨</span><span class="pl__s zh">落地前點出意思</span>
        </RouterLink>
        <RouterLink to="/games/builder" class="pl">
          <span class="pl__i" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="12" width="8" height="7.5" rx="2" /><rect x="12.5" y="12" width="8" height="7.5" rx="2" /><rect x="8" y="4.5" width="8" height="7.5" rx="2" /></svg></span>
          <span class="pl__t zh">零件積木</span><span class="pl__s zh">60 秒拼字</span>
        </RouterLink>
      </div>
    </section>

    <!-- report card: one panel -->
    <section class="nums">
      <div class="sec__head"><h2 class="sec__t kai">成績單</h2><RouterLink to="/stats" class="sec__link zh">詳細數據</RouterLink></div>
      <div class="card rc">
        <div class="power">
          <span class="power__t zh">{{ titleOf(power.level) }}<span class="power__xp">字力 <b class="fig">{{ power.xp }}</b></span></span>
          <span class="power__bar"><span :style="{ width: power.pct + '%' }" /></span>
          <span class="power__hint zh">每個字用越難的方式答對，字力越高；忘記會掉。</span>
        </div>
        <dl class="metrics">
          <div class="metric"><dt class="zh">今日已答</dt><dd class="fig">{{ progress.today.total_count }}</dd></div>
          <div class="metric"><dt class="zh">正確率</dt><dd class="fig">{{ accuracy === null ? '—' : accuracy + '%' }}</dd></div>
          <div class="metric"><dt class="zh">分鐘</dt><dd class="fig">{{ session.minutesToday }}</dd></div>
          <div class="metric"><dt class="zh">待複習</dt><dd class="fig">{{ session.plan.reviewCount }}</dd></div>
        </dl>
        <div class="prog">
          <div class="prog__head">
            <span class="zh">這一階段</span>
            <span class="prog__scope num">1–{{ settings.target }}</span>
            <span class="prog__pct fig">{{ coverage.pct.toFixed(1) }}%</span>
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
      </div>
    </section>

    <p v-if="words.enriching" class="syncing zh">正在產生單字資料 {{ words.enrichProgress.done }}/{{ words.enrichProgress.total }}…</p>
  </main>
</template>

<style scoped>
.home { display: flex; flex-direction: column; gap: var(--sp-6); }

/* ---- hero: the scene, then the title in the cloud under the range ---- */
.hero { display: flex; flex-direction: column; margin-bottom: calc(var(--sp-3) * -1); }
.hero__meta { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); padding: 2px 4px 0; min-height: 44px; }
.hero__date { font-size: var(--step--1); font-weight: 600; color: var(--ink); opacity: 0.78; padding-top: 6px; text-shadow: 0 0 12px rgba(255, 255, 255, 0.5); }
/* the range stands at 40% of the tallest viewport (scene.js › frame); the
   title starts just under it. 60px = the shell's top padding + the meta row. */
.hero__sky { height: calc(40vh - 60px - env(safe-area-inset-top) + 30px); height: calc(40lvh - 60px - env(safe-area-inset-top) + 30px); min-height: 150px; }
.hero__title { padding: 0 4px; }
.hero__hi { font-size: var(--step-0); font-weight: 600; color: var(--ink-2); }
.hero .page-title { font-size: clamp(2.5rem, 12vw, 3.1rem); line-height: 1.08; letter-spacing: 0.03em; margin-top: 2px; }
.hero__sum { margin-top: 10px; font-size: var(--step--1); color: var(--ink-2); }
.hero__sum .fig { font-size: 1.2em; color: var(--ink); }
.hero__sum b.fig { font-weight: 600; }

.lvl { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.lvl__badge {
  display: inline-grid; place-items: center; height: 32px; padding: 0 14px; border-radius: 999px;
  font-family: var(--font-fig); font-weight: 600; font-size: var(--step-0); color: var(--ink);
  background: var(--glass); box-shadow: var(--glass-rim), var(--shadow-1);
  -webkit-backdrop-filter: blur(20px) saturate(145%); backdrop-filter: blur(20px) saturate(145%);
}
.lvl__streak { font-size: var(--step--2); font-weight: 600; color: var(--ink); opacity: 0.62; padding-right: 4px; }
.lvl__streak--on { opacity: 1; color: var(--ink); }

.nudge { display: block; padding: 12px 16px; background: var(--amber-wash); color: var(--ink); font-size: var(--step--1); border-radius: var(--radius-lg); line-height: 1.55; }

/* ---- now ---- */
.now {
  position: relative; display: flex; flex-direction: column;
  padding: var(--sp-5) var(--sp-5) var(--sp-4);
  border-radius: var(--radius-xl);
  background: radial-gradient(140% 150px at var(--lx) 0, var(--sheen), transparent 72%), var(--surface);
  box-shadow: var(--rim), var(--shadow-2);
  -webkit-backdrop-filter: blur(26px) saturate(145%); backdrop-filter: blur(26px) saturate(145%);
}
.now__n { font-size: var(--step--1); font-weight: 600; color: var(--pen); letter-spacing: 0.08em; }
.now__t { font-size: var(--step-4); font-weight: 700; letter-spacing: 0.03em; line-height: 1.2; margin-top: 2px; }
.now__m { font-size: var(--step--1); color: var(--ink-2); line-height: 1.55; margin-top: 6px; min-height: 1.55em; }
.now .btn { margin-top: var(--sp-4); min-height: 56px; font-size: var(--step-1); }
.now__go { justify-content: space-between; padding: 0 var(--sp-5) 0 var(--sp-6); }
.now__min { font-size: var(--step--1); font-weight: 500; opacity: 0.82; }

/* ---- the timetable: a quiet grouped list ---- */
.quest {
  background: radial-gradient(130% 110px at var(--lx) 0, var(--sheen), transparent 70%), var(--surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--rim), var(--shadow-1);
  padding: var(--sp-4) 0 6px;
  overflow: hidden;
}
.quest__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-2); padding: 0 var(--sp-5) var(--sp-2); }
.quest__count { font-size: var(--step-0); color: var(--ink-2); }
.steps { display: flex; flex-direction: column; }
.step { position: relative; }
.step + .step .step__btn::before { content: ''; position: absolute; left: 62px; right: 0; top: 0; height: 0.5px; background: var(--rule); }
.step__btn { position: relative; width: 100%; display: grid; grid-template-columns: 30px 1fr auto; align-items: center; gap: 14px; padding: 10px var(--sp-5) 10px var(--sp-4); text-align: left; min-height: 58px; transition: background 0.15s; }
.step__btn:active:not(:disabled) { background: var(--surface-2); }
.step__n {
  width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  font-size: var(--step-0); font-weight: 500; color: var(--ink-2);
  box-shadow: inset 0 0 0 1px var(--rule-strong);
}
.step__n svg { width: 18px; height: 18px; fill: none; stroke: #fff; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
.step--done .step__n { background: var(--green); box-shadow: none; }
.step--current .step__n { background: var(--pen); color: #fff; box-shadow: 0 0 0 4px var(--pen-wash); }
.step__body { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.step__label { font-weight: 600; font-size: var(--step-0); letter-spacing: -0.01em; }
.step__meta { font-size: var(--step--2); color: var(--ink-2); line-height: 1.45; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.step__end { display: flex; align-items: center; }
.step__min { font-size: var(--step--1); color: var(--ink-3); }
.step__tick { font-size: var(--step--2); font-weight: 600; color: var(--jade); }
.step__go { font-size: var(--step--2); font-weight: 700; color: var(--pen); background: var(--pen-wash); padding: 3px 10px; border-radius: 999px; }
.step--done .step__label { color: var(--ink-2); font-weight: 500; }
.step--locked .step__btn { opacity: 0.5; }
.step--empty .step__label { text-decoration: line-through; text-decoration-color: var(--ink-3); }

.sec__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--sp-3); padding: 0 4px; }
.sec__link { font-size: var(--step--1); color: var(--pen); font-weight: 600; }

.wotd__body { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-5) var(--sp-4) var(--sp-4); }
.wotd__more { font-size: var(--step--1); color: var(--pen); align-self: center; font-weight: 600; }

.play__row { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--sp-2); }
.pl { display: flex; flex-direction: column; gap: 2px; padding: 14px 12px 12px; min-height: 116px; transition: transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1); }
.pl:active { transform: scale(0.96); }
.pl__i { width: 38px; height: 38px; border-radius: var(--r-inset); display: grid; place-items: center; margin-bottom: 8px; background: var(--pen-wash); color: var(--pen); }
.pl__i svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
.pl__t { font-weight: 650; font-size: var(--step--1); }
.pl__s { font-size: var(--step--2); color: var(--ink-2); line-height: 1.4; }

/* ---- report card: one panel, three bands ---- */
.rc { display: flex; flex-direction: column; overflow: hidden; }
.power { display: flex; flex-direction: column; gap: 10px; padding: var(--sp-5) var(--sp-5) var(--sp-4); }
.power__t { display: flex; align-items: baseline; justify-content: space-between; font-family: var(--font-kai); font-weight: 700; font-size: var(--step-1); letter-spacing: 0.02em; }
.power__xp { font-family: var(--font-zh); font-weight: 500; font-size: var(--step--1); color: var(--ink-2); letter-spacing: 0; }
.power__xp .fig { font-size: var(--step-2); color: var(--ink); margin-left: 4px; }
.power__bar { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
.power__bar span { display: block; height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--pen), var(--pen-hi)); }
.power__hint { font-size: var(--step--2); color: var(--ink-2); }
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); box-shadow: inset 0 0.5px 0 var(--rule), inset 0 -0.5px 0 var(--rule); }
.metric { display: flex; flex-direction: column; align-items: center; padding: 14px 2px 12px; }
.metric + .metric { box-shadow: inset 0.5px 0 0 var(--rule); }
.metric dt { font-size: var(--step--2); color: var(--ink-2); order: 2; }
.metric dd { font-size: var(--step-3); line-height: 1.15; }
.prog { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4) var(--sp-5) var(--sp-5); }
.prog__head { display: flex; align-items: baseline; gap: var(--sp-2); font-weight: 600; }
.prog__scope { flex: 1; color: var(--ink-3); font-size: var(--step--1); }
.prog__pct { font-size: var(--step-1); }
.prog__bar { position: relative; height: 8px; border-radius: 4px; background: var(--surface-3); overflow: hidden; }
.prog__seen, .prog__mastered { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; }
.prog__seen { background: color-mix(in srgb, var(--pen) 38%, transparent); }
.prog__mastered { background: var(--green); }
.prog__legend { display: flex; gap: var(--sp-3); font-size: var(--step--2); color: var(--ink-2); flex-wrap: wrap; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 4px; vertical-align: -1px; }
.sw--seen { background: color-mix(in srgb, var(--pen) 38%, transparent); } .sw--mastered { background: var(--green); }
.bands { display: flex; flex-direction: column; gap: 8px; margin-top: var(--sp-2); }
.band { display: grid; grid-template-columns: 7.5em 1fr auto; gap: var(--sp-2); align-items: center; font-size: var(--step--2); color: var(--ink-2); }
.band__n { color: var(--ink-3); }
.syncing { text-align: center; font-size: var(--step--1); color: var(--ink-3); }

@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hero__date { text-shadow: none; } }
:root[data-theme="dark"] .hero__date { text-shadow: none; }
</style>
