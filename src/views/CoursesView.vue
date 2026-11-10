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
  { key: 'parts', title: '字首字尾', sub: '15 個單元：合成字、字尾、字首、字根', to: '/parts', done: parts.stats.started, total: parts.stats.total },
  { key: 'grammar', title: '文法', sub: '先看句子猜規則，再用時間軸和色塊理解', to: '/grammar', done: grammar.stats.started, total: grammar.stats.total },
  { key: 'story', title: '故事屋', sub: '分級圖文故事，每個字都能點', to: '/story', done: storiesDone.value, total: STORIES.length },
  { key: 'essentials', title: '基礎知識', sub: '日期、數字、詞性、多益 Part 5 必考', to: '/essentials', done: essentials.stats.started, total: essentials.stats.total }
])

const practice = [
  { title: '聽力', sub: '只聽不看，再看答案', to: '/listen' },
  { title: '主題對話', sub: '和 AI 角色用英文聊一個情境', to: '/talk' },
  { title: '旅遊會話', sub: '20 個出國情境', to: '/travel' },
  { title: '每日文章', sub: 'AI 用你今天的字寫一篇短文', to: '/article' }
]

function openCourse (c) { router.push(c.to) }
</script>

<template>
  <main class="shell courses">
    <header>
      <h1 class="page-title">課本目錄</h1>
      <p class="lead zh">每天的課表會自動排好每一科的進度；想回頭複習哪一課，從這裡翻過去。</p>
    </header>

    <ol class="toc">
      <li v-for="(c, i) in courses" :key="c.key" class="toc__item">
        <button class="toc__row" @click="openCourse(c)">
          <span class="toc__n">第{{ ['一', '二', '三', '四'][i] }}冊</span>
          <span class="toc__t kai">{{ c.title }}</span>
          <span class="toc__dots" aria-hidden="true" />
          <span class="toc__p num">{{ c.done }}<small>/{{ c.total }}</small></span>
        </button>
        <p class="toc__s zh">{{ c.sub }}</p>
        <span class="toc__bar" aria-hidden="true"><span :style="{ width: (c.total ? c.done / c.total * 100 : 0) + '%' }" /></span>

        <ol v-if="c.key === 'grammar' && showGrammar" class="points">
          <li v-for="p in points" :key="p.id">
            <button class="point" :class="{ 'point--today': p.today }" :disabled="!p.open" @click="router.push(p.today ? '/grammar' : `/grammar?point=${p.id}`)">
              <span class="point__n num">{{ p.n }}</span>
              <span class="point__t zh">{{ p.title }}</span>
              <span class="point__s zh">{{ p.status }}</span>
            </button>
          </li>
        </ol>
        <button v-if="c.key === 'grammar'" class="toc__more zh" @click="showGrammar = !showGrammar">{{ showGrammar ? '收起 30 個文法點' : '展開 30 個文法點' }}</button>
      </li>
    </ol>

    <section>
      <h2 class="sec kai">練習本</h2>
      <ul class="plist">
        <li v-for="p in practice" :key="p.to">
          <RouterLink :to="p.to" class="prac">
            <span class="prac__t">{{ p.title }}</span>
            <span class="prac__s zh">{{ p.sub }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </main>
</template>

<style scoped>
.courses { display: flex; flex-direction: column; gap: var(--sp-6); }
.lead { color: var(--ink-2); font-size: var(--step--1); line-height: 1.6; margin-top: 6px; }
.toc { display: flex; flex-direction: column; padding: 4px var(--sp-5); border-radius: var(--radius-xl); background: radial-gradient(130% 110px at var(--lx) 0, var(--sheen), transparent 70%), var(--surface); box-shadow: var(--rim), var(--shadow-1); -webkit-backdrop-filter: blur(22px) saturate(140%); backdrop-filter: blur(22px) saturate(140%); }
.toc__item { padding: var(--sp-4) 0; }
.toc__item + .toc__item { border-top: 0.5px solid var(--rule-strong); }
.toc__row { width: 100%; display: flex; align-items: baseline; gap: var(--sp-2); text-align: left; }
.toc__n { font-size: var(--step--1); color: var(--pen); font-weight: 600; flex-shrink: 0; }
.toc__t { font-size: var(--step-2); font-weight: 700; }
.toc__dots { flex: 1; border-bottom: 1.5px dotted var(--rule-strong); transform: translateY(-5px); min-width: 12px; }
.toc__p { font-size: var(--step-2); font-family: var(--font-fig); font-variant-numeric: lining-nums; }
.toc__p small { font-size: 0.7em; color: var(--ink-3); }
.toc__s { font-size: var(--step--1); color: var(--ink-2); margin-top: 2px; }
.toc__bar { display: block; height: 4px; background: var(--surface-3); margin-top: 10px; border-radius: 2px; overflow: hidden; }
.toc__bar span { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--pen), var(--pen-hi)); }
.toc__more { margin-top: 8px; font-size: var(--step--1); color: var(--pen); }
.points { display: flex; flex-direction: column; margin-top: 8px; }
.point { width: 100%; display: grid; grid-template-columns: 26px 1fr auto; gap: var(--sp-2); align-items: center; padding: 9px 2px; text-align: left; border-bottom: 0.5px solid var(--rule); }
.point:disabled { opacity: 0.4; }
.point--today .point__t { background: linear-gradient(transparent 55%, var(--hl-yellow) 55%); }
.point__n { color: var(--ink-3); font-size: var(--step--1); }
.point__t { font-size: var(--step--1); font-weight: 600; line-height: 1.4; justify-self: start; }
.point__s { font-size: var(--step--2); color: var(--ink-3); white-space: nowrap; }
.sec { margin-bottom: var(--sp-2); }
.plist { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-2); }
.prac { display: flex; flex-direction: column; gap: 3px; padding: var(--sp-3); min-height: 80px; }
.prac__t { font-weight: 700; font-size: var(--step-1); }
.prac__s { font-size: var(--step--2); color: var(--ink-2); line-height: 1.45; }
</style>
