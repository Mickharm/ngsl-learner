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
    <header class="me__head">
      <span class="me__lv num">Lv.{{ power.level }}</span>
      <div>
        <h1 class="page-title zh">{{ auth.displayName }}</h1>
        <p class="me__title zh">{{ titleOf(power.level) }}，字力 <b class="num">{{ power.xp }}</b>，連續 <b class="num">{{ progress.streak }}</b> 天</p>
      </div>
    </header>

    <section class="card ladder">
      <h2 class="sec zh">你的字在哪一階</h2>
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
.me__head { display: flex; align-items: center; gap: var(--sp-4); }
.me__lv { width: 64px; height: 64px; display: grid; place-items: center; border-radius: 16px; background: var(--slab); color: var(--sun); font-weight: 800; font-size: var(--step-1); box-shadow: 0 4px 0 #0006; flex-shrink: 0; }
.me__title { color: var(--ink-2); font-size: var(--step--1); margin-top: 2px; }
.sec { font-size: var(--step-0); font-weight: 800; }
.ladder { padding: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
.ladder__lead { font-size: var(--step--1); color: var(--ink-2); line-height: 1.6; }
.ladder__rows { display: flex; flex-direction: column; gap: 8px; }
.lr { display: grid; grid-template-columns: 4.5em 1fr 3em; gap: var(--sp-2); align-items: center; }
.lr__l { font-size: var(--step--1); font-weight: 700; }
.lr__bar { height: 14px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
.lr__bar span { display: block; height: 100%; background: var(--t-prefix); border-radius: 4px; min-width: 2px; }
.lr__n { text-align: right; color: var(--ink-2); font-size: var(--step--1); }
.mini { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-2); }
.mini__c { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: var(--sp-3) 4px; border-radius: var(--radius); background: var(--surface); border: 1px solid var(--rule); }
.mini__c b { font-size: var(--step-1); }
.mini__c span { font-size: var(--step--2); color: var(--ink-3); }
.links { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-lg); overflow: hidden; }
.links li + li { border-top: 1px solid var(--rule); }
.link { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-4); }
.link__body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.link__t { font-weight: 700; }
.link__s { font-size: var(--step--2); color: var(--ink-3); }
.link__badge { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 11px; background: var(--rose); color: #fff; font-size: var(--step--2); display: grid; place-items: center; }
.link svg { width: 18px; height: 18px; color: var(--ink-3); }
</style>
