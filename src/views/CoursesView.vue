<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { useGrammar } from '@/stores/grammar'
import { useEssentials } from '@/stores/essentials'
import { useParts } from '@/stores/parts'
import { isMastered } from '@/lib/srs'
import STORIES from '@/data/stories'

/**
 * 課程 — every strand in one place, each with how far along it is. The day's
 * quest already picks today's piece of each; this is where the learner goes
 * back to something on purpose.
 */
const router = useRouter()
const auth = useAuth()
const grammar = useGrammar()
const essentials = useEssentials()
const parts = useParts()

const storyStars = computed(() => {
  try { return JSON.parse(localStorage.getItem(`ngsl.stories.${auth.userId}`) || '{}') } catch { return {} }
})
const storiesDone = computed(() => Object.values(storyStars.value).filter(v => v >= 1).length)

const showGrammar = ref(false)
const points = computed(() => grammar.all.map((g, i) => {
  const r = grammar.recOf(g.id)
  const today = grammar.todayPoint?.id === g.id
  return {
    ...g, n: i + 1, today,
    open: !!r || today,
    status: today ? '今天' : !r ? '還沒學' : isMastered(r) ? '熟練' : r.dueAt <= Date.now() ? '該複習' : '學過'
  }
}))

const courses = computed(() => [
  { key: 'parts', title: '字首字尾', sub: '15 個單元：合成字、字尾、字首、字根', to: '/parts', done: parts.stats.started, total: parts.stats.total, tiles: [['un', 'prefix'], ['help', 'base'], ['ful', 'suffix']] },
  { key: 'grammar', title: 'Grammar Studio 文法', sub: '先看句子猜規則，再用時間軸和色塊理解', done: grammar.stats.started, total: grammar.stats.total, toggle: true, tiles: [['I', 'base'], ['have', 'suffix'], ['been', 'prefix']] },
  { key: 'story', title: 'Story Time 圖文故事', sub: '分級故事，每個字都能點', to: '/story', done: storiesDone.value, total: STORIES.length, tiles: [['Once', 'base']] },
  { key: 'essentials', title: '基礎知識', sub: '日期、數字、詞性、多益 Part 5 必考', to: '/essentials', done: essentials.stats.started, total: essentials.stats.total, tiles: [['May', 'base'], ['1st', 'root']] }
])

const practice = [
  { title: '聽力', sub: '只聽不看，再看答案', to: '/listen' },
  { title: '造句', sub: '用今天的字寫句子，AI 批改', to: '/write' },
  { title: '旅遊會話', sub: '20 個出國情境', to: '/travel' },
  { title: '每日文章', sub: 'AI 用你今天的字寫一篇短文', to: '/article' }
]

function openCourse (c) {
  if (c.toggle) showGrammar.value = !showGrammar.value
  else router.push(c.to)
}
</script>

<template>
  <main class="shell courses">
    <header>
      <h1 class="page-title zh">課程</h1>
      <p class="lead zh">每天的關卡會自動排好每門課的進度；想回頭複習哪一課，從這裡進去。</p>
    </header>

    <ul class="clist">
      <li v-for="c in courses" :key="c.key">
        <button class="course" @click="openCourse(c)">
          <span class="course__art" aria-hidden="true">
            <span v-for="(t, i) in c.tiles" :key="i" class="lt" :class="`lt--${t[1]}`">{{ t[0] }}</span>
          </span>
          <span class="course__body">
            <span class="course__t zh">{{ c.title }}</span>
            <span class="course__s zh">{{ c.sub }}</span>
            <span class="course__bar"><span :style="{ width: (c.total ? c.done / c.total * 100 : 0) + '%' }" /></span>
            <span class="course__n zh"><b class="num">{{ c.done }}</b> / {{ c.total }}</span>
          </span>
          <svg class="course__chev" :class="{ 'course__chev--open': c.toggle && showGrammar }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>

        <ol v-if="c.key === 'grammar' && showGrammar" class="points">
          <li v-for="p in points" :key="p.id">
            <button class="point" :class="{ 'point--today': p.today }" :disabled="!p.open" @click="router.push(p.today ? '/grammar' : `/grammar?point=${p.id}`)">
              <span class="point__n num">{{ p.n }}</span>
              <span class="point__t zh">{{ p.title }}</span>
              <span class="point__s zh">{{ p.status }}</span>
            </button>
          </li>
        </ol>
      </li>
    </ul>

    <section>
      <h2 class="sec zh">練習</h2>
      <ul class="plist">
        <li v-for="p in practice" :key="p.to">
          <RouterLink :to="p.to" class="prac">
            <span class="prac__t zh">{{ p.title }}</span>
            <span class="prac__s zh">{{ p.sub }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.courses { display: flex; flex-direction: column; gap: var(--sp-5); }
.lead { color: var(--ink-2); font-size: var(--step--1); line-height: 1.6; margin-top: 6px; }
.clist { display: flex; flex-direction: column; gap: var(--sp-3); }
.course { width: 100%; display: grid; grid-template-columns: 92px 1fr 20px; gap: var(--sp-3); align-items: center; padding: var(--sp-3); text-align: left; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-lg); }
.course__art { height: 84px; border-radius: var(--radius); background: var(--surface-2); display: flex; align-items: center; justify-content: center; gap: 2px; flex-wrap: wrap; padding: 4px; }
.course__art .lt { font-size: 0.78rem; min-height: 1.8em; padding: 0.15em 0.35em; box-shadow: 0 2px 0 var(--te); }
.course__body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.course__t { font-weight: 800; }
.course__s { font-size: var(--step--2); color: var(--ink-2); line-height: 1.45; }
.course__bar { height: 6px; border-radius: 3px; background: var(--surface-3); overflow: hidden; margin-top: 4px; }
.course__bar span { display: block; height: 100%; background: var(--jade); border-radius: 3px; }
.course__n { font-size: var(--step--2); color: var(--ink-3); }
.course__chev { width: 18px; height: 18px; color: var(--ink-3); transition: transform 0.15s; }
.course__chev--open { transform: rotate(90deg); }
.points { display: flex; flex-direction: column; gap: 2px; margin: 6px 0 0 12px; padding-left: 12px; border-left: 2px solid var(--rule); }
.point { width: 100%; display: grid; grid-template-columns: 28px 1fr auto; gap: var(--sp-2); align-items: center; padding: 8px 6px; text-align: left; border-radius: var(--radius-sm); }
.point:disabled { opacity: 0.4; }
.point--today { background: var(--sun-wash); }
.point__n { color: var(--ink-3); font-size: var(--step--1); }
.point__t { font-size: var(--step--1); font-weight: 600; line-height: 1.4; }
.point__s { font-size: var(--step--2); color: var(--ink-3); white-space: nowrap; }
.sec { font-size: var(--step-0); font-weight: 800; margin-bottom: var(--sp-2); }
.plist { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.prac { display: flex; flex-direction: column; gap: 3px; padding: var(--sp-3); border-radius: var(--radius); background: var(--surface); border: 1px solid var(--rule); min-height: 76px; }
.prac__t { font-weight: 800; }
.prac__s { font-size: var(--step--2); color: var(--ink-2); line-height: 1.45; }
</style>
