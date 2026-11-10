<script setup>
import { computed } from 'vue'
import { useAuth } from '@/stores/auth'
import { useProgress } from '@/stores/progress'
import { useParts } from '@/stores/parts'
import { useGrammar } from '@/stores/grammar'
import { wordPower, levelOf, titleOf } from '@/lib/xp'
import { LADDER, ladderOf } from '@/lib/wordsrs'

/**
 * 我的 — who is learning and how far: level, the five-rung ladder as a bar
 * chart of the learner's own words, and the doors to mistakes, data and
 * settings.
 */
const auth = useAuth()
const progress = useProgress()
const parts = useParts()
const grammar = useGrammar()

const power = computed(() => levelOf(wordPower(progress.cards.values())))
const ladder = computed(() => {
  const counts = LADDER.map(() => 0)
  for (const c of progress.cards.values()) if (c.state !== 'new') counts[ladderOf(c)]++
  const max = Math.max(1, ...counts)
  return LADDER.map((l, i) => ({ ...l, n: counts[i], pct: counts[i] / max * 100 }))
})

const links = computed(() => [
  { to: '/errors', title: '錯題本', sub: '還沒弄懂的字和題目', badge: progress.mistakeCount },
  { to: '/stats', title: '學習數據', sub: '每天的量、正確率、記憶曲線' },
  { to: '/browse', title: '單字庫', sub: '全部 2,801 字，搜尋與狀態' },
  { to: '/settings', title: '設定', sub: '每日目標、發音、音效、帳號' }
])
</script>

<template>
  <main class="shell me">
    <header class="me__card">
      <div class="me__id">
        <span class="me__school zh">英文作業簿　學生證</span>
        <h1 class="page-title me__name">{{ auth.displayName }}</h1>
        <p class="me__title zh">{{ titleOf(power.level) }}，字力 <b class="num">{{ power.xp }}</b>，連續 <b class="num">{{ progress.streak }}</b> 天</p>
      </div>
      <span class="me__lv">Lv.{{ power.level }}</span>
    </header>

    <section class="card ladder">
      <h2 class="sec kai">你的字在哪一階</h2>
      <p class="ladder__lead zh">每個字會一階一階往上考：先認得、再聽得懂、想得起、拼得出，最後在句子裡用得出來。</p>
      <ul class="ladder__rows">
        <li v-for="l in ladder" :key="l.key" class="lr">
          <span class="lr__l zh">{{ l.short }}</span>
          <span class="lr__bar"><span :style="{ width: l.pct + '%' }" /></span>
          <span class="lr__n num">{{ l.n }}</span>
        </li>
      </ul>
    </section>

    <section class="mini">
      <div class="mini__c"><b class="num">{{ progress.stats.seen }}</b><span class="zh">學過的字</span></div>
      <div class="mini__c"><b class="num">{{ progress.stats.mastered }}</b><span class="zh">熟練</span></div>
      <div class="mini__c"><b class="num">{{ parts.stats.started }}</b><span class="zh">零件單元</span></div>
      <div class="mini__c"><b class="num">{{ grammar.stats.started }}</b><span class="zh">文法點</span></div>
    </section>

    <ul class="links">
      <li v-for="l in links" :key="l.to">
        <RouterLink :to="l.to" class="link">
          <span class="link__body"><span class="link__t zh">{{ l.title }}</span><span class="link__s zh">{{ l.sub }}</span></span>
          <span v-if="l.badge" class="link__badge num">{{ l.badge > 99 ? '99+' : l.badge }}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </RouterLink>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.me { display: flex; flex-direction: column; gap: var(--sp-5); }
.me__card { position: relative; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-5); border-radius: var(--radius-xl); }
.me__id { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.me__school { font-size: var(--step--2); color: var(--ink-3); letter-spacing: 0.12em; }
.me__name { font-size: var(--step-4); }
.me__title { color: var(--ink-2); font-size: var(--step--1); }
/* the level as a small sun */
.me__lv { width: 78px; height: 78px; flex-shrink: 0; display: grid; place-items: center; border-radius: 50%; color: var(--sun-ink); font-family: var(--font-fig); font-weight: 600; font-size: var(--step-2); background: radial-gradient(circle at 38% 30%, #fff7dc, var(--gold-fill) 72%); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6), 0 0 0 6px var(--gold-wash), 0 12px 26px -12px rgba(170, 120, 30, 0.6); }
.ladder { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.ladder__lead { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; }
.ladder__rows { display: flex; flex-direction: column; gap: 8px; }
.lr { display: grid; grid-template-columns: 4.5em 1fr 3em; gap: var(--sp-2); align-items: center; }
.lr__l { font-size: var(--step--1); font-weight: 700; }
.lr__bar { height: 12px; border-radius: 6px; background: var(--surface-2); overflow: hidden; }
.lr__bar span { display: block; height: 100%; border-radius: 6px; background: linear-gradient(90deg, var(--pen), var(--pen-hi)); opacity: 0.75; min-width: 2px; }
.lr__n { text-align: right; color: var(--ink-2); font-size: var(--step-0); font-family: var(--font-fig); font-variant-numeric: lining-nums tabular-nums; }
.mini { display: grid; grid-template-columns: repeat(4, 1fr); }
.mini__c { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; }
.mini__c + .mini__c { box-shadow: inset 0.5px 0 0 var(--rule-strong); }
.mini__c b { font-size: var(--step-3); line-height: 1.15; font-family: var(--font-fig); font-variant-numeric: lining-nums tabular-nums; font-weight: 500; }
.mini__c span { font-size: var(--step--2); color: var(--ink-3); }
.links { display: flex; flex-direction: column; border-radius: var(--r-panel); overflow: hidden; background: radial-gradient(130% 110px at var(--lx) 0, var(--sheen), transparent 70%), var(--surface); box-shadow: var(--rim), var(--shadow-1); -webkit-backdrop-filter: blur(22px) saturate(140%); backdrop-filter: blur(22px) saturate(140%); }
.links li + li { box-shadow: inset 0 0.5px 0 var(--rule); }
.link { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-5); transition: background 0.15s; }
.link:active { background: var(--surface-2); }
.link__body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.link__t { font-weight: 650; font-family: var(--font-sys); font-size: var(--step-0); }
.link__s { font-size: var(--step--2); color: var(--ink-3); }
.link__badge { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: var(--redpen); color: #fff; font-size: var(--step--2); display: grid; place-items: center; }
.link svg { width: 18px; height: 18px; color: var(--ink-3); }
</style>
