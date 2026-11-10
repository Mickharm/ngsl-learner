<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'
import { GAMES, readBest, dayNumber } from '@/lib/arcade'
import { useGamePool } from '@/composables/useGamePool'

/**
 * 遊戲中心. Every game is practice on words already met (or, for 零件積木,
 * parts already taught) — none of them touches the review schedule.
 * Today's puzzle sits on top because it is the one that changes daily.
 */
const router = useRouter()
const auth = useAuth()
const { pool, fromMet } = useGamePool(12)
const best = computed(() => readBest(auth.userId))
const wordleToday = computed(() => {
  try {
    const s = JSON.parse(localStorage.getItem(`ngsl.wordle.${auth.userId || 'anon'}`) || '{}')
    return s.today?.day === dayNumber() ? s.today : null
  } catch { return null }
})
const list = computed(() => GAMES.filter(g => g.id !== 'wordle').map(g => ({
  ...g,
  ready: pool.value.length >= g.minWords,
  best: best.value[g.id]
})))
</script>

<template>
  <main class="shell games">
    <header>
      <h1 class="page-title">遊戲</h1>
      <p class="games__lead zh">用你學過的字玩。遊戲不會改動複習排程，放心玩。<template v-if="!fromMet">你學過的字還不多，先混入最常見的字。</template></p>
    </header>

    <button class="daily" @click="router.push('/games/wordle')">
      <span class="daily__tiles" aria-hidden="true">
        <span class="dt dt--hit">W</span><span class="dt dt--near">O</span><span class="dt">R</span><span class="dt dt--hit">D</span><span class="dt">S</span>
      </span>
      <span class="daily__body">
        <span class="daily__t">每日猜字</span>
        <span class="daily__s zh">{{ wordleToday?.done ? (wordleToday.won ? `今天 ${wordleToday.guesses.length} 次猜中` : '今天沒猜到，明天再來') : '今天的五個字母還沒猜' }}</span>
      </span>
      <span class="daily__go zh">{{ wordleToday?.done ? '看答案' : '開始' }}</span>
    </button>

    <ul class="grid">
      <li v-for="g in list" :key="g.id">
        <button class="game" :class="`game--${g.id}`" :disabled="!g.ready" @click="router.push(`/games/${g.id}`)">
          <span class="game__art" aria-hidden="true">
            <template v-if="g.id === 'rain'"><span class="lt lt--piece a1">cat</span><span class="lt lt--piece a2">bus</span><span class="ga-ground" /></template>
            <template v-else-if="g.id === 'bubbles'"><span class="bb b1" /><span class="bb b2" /><span class="bb b3" /></template>
            <template v-else-if="g.id === 'builder'"><span class="lt lt--prefix lt--piece">un</span><span class="lt lt--piece">kind</span><span class="lt lt--suffix lt--piece">ly</span></template>
            <template v-else-if="g.id === 'memory'"><span class="mc">?</span><span class="mc mc--open">dog</span><span class="mc">?</span></template>
            <template v-else-if="g.id === 'match'"><span class="lt lt--piece">sun</span><span class="ml" /><span class="lt lt--piece">太陽</span></template>
          </span>
          <span class="game__t">{{ g.title }}</span>
          <span class="game__s zh">{{ g.ready ? g.sub : `先學 ${g.minWords} 個字才能玩` }}</span>
          <span class="game__meta zh">練{{ g.skill }}<template v-if="g.best != null">　最佳 <b class="num">{{ g.best }}</b></template></span>
        </button>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.games { display: flex; flex-direction: column; gap: var(--sp-5); }
.games__lead { color: var(--ink-2); font-size: var(--step--1); line-height: 1.6; margin-top: 6px; }

/* today's puzzle: the one dark, thick-material panel on the page */
.daily { display: grid; grid-template-columns: auto 1fr auto; gap: var(--sp-3); align-items: center; padding: var(--sp-4) var(--sp-4) var(--sp-4) var(--sp-5); border-radius: var(--r-panel); text-align: left; background: var(--surface); box-shadow: var(--rim), var(--shadow-1); -webkit-backdrop-filter: blur(20px) saturate(140%); backdrop-filter: blur(20px) saturate(140%); transition: transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1); }
.daily:active { transform: scale(0.97); }
.daily__tiles { display: grid; grid-template-columns: repeat(5, 22px); gap: 3px; }
.dt { width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; background: var(--surface-3); font-family: var(--font-word); font-weight: 700; font-size: 0.75rem; color: var(--ink); }
.dt--hit { background: #6f9e86; color: #fff; }
.dt--near { background: #c9ad5e; color: #282725; }
.daily__body { display: flex; flex-direction: column; gap: 2px; }
.daily__t { font-weight: 650; font-size: var(--step-0); }
.daily__s { font-size: var(--step--2); color: var(--ink-2); }
.daily__go { background: var(--pen); color: var(--pen-ink); font-weight: 600; padding: 8px 16px; border-radius: 999px; }

.grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.game { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 6px var(--sp-3); text-align: left; overflow: hidden; transition: transform 0.3s cubic-bezier(0.3, 1.5, 0.5, 1); }
.game:active:not(:disabled) { transform: scale(0.96); }
.game:disabled { opacity: 0.5; }
/* each game's art sits in its own tinted well (concentric: card 22 − 6 = 16) */
.game__art { --w: #8fadb9; position: relative; height: 80px; align-self: stretch; display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 8px; overflow: hidden; border-radius: 16px;
  background: var(--surface-2); }
.game__art .lt { font-size: 0.85rem; min-height: 1.8em; }
.game__t, .game__s, .game__meta { padding: 0 10px; }
.game__t { font-weight: 650; font-size: var(--step-0); }
.game__s { font-size: var(--step--2); color: var(--ink-2); line-height: 1.45; flex: 1; }
.game__meta { font-size: var(--step--2); color: var(--ink-3); }

.a1 { position: absolute; top: 6px; left: 22%; }
.a2 { position: absolute; top: 30px; right: 22%; }
.ga-ground { position: absolute; bottom: 0; left: 0; right: 0; height: 3px; background: var(--line-base); opacity: 0.6; }
.bb { position: absolute; border-radius: 50%; border: 1.5px solid var(--t-suffix-edge); background: color-mix(in srgb, var(--hl-blue) 70%, transparent); }
.b1 { width: 34px; height: 34px; left: 22%; bottom: 8px; }
.b2 { width: 26px; height: 26px; left: 48%; bottom: 30px; }
.b3 { width: 30px; height: 30px; right: 18%; bottom: 14px; }
.mc { width: 32px; height: 40px; border-radius: 8px; display: grid; place-items: center; background: var(--pen); color: #fff; font-weight: 700; font-family: var(--font-word); font-size: 0.8rem; }
.mc--open { background: var(--surface); color: var(--ink); box-shadow: var(--shadow-1); }
.ml { width: 22px; height: 2px; border-radius: 1px; background: var(--pen); }
</style>
