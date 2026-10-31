<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AudioButton from '@/components/AudioButton.vue'
import Confetti from './Confetti.vue'
import { glossOf } from '@/lib/game'

/**
 * The frame every arcade game sits in: a HUD (lives, score, streak, time)
 * and the result screen. Keeping these identical across games is what makes
 * six games feel like one arcade, and means each game only has to be its
 * play field.
 */
const props = defineProps({
  title: { type: String, required: true },
  over: { type: Boolean, default: false },
  score: { type: Number, default: 0 },
  scoreLabel: { type: String, default: '分' },
  lives: { type: Number, default: null },
  maxLives: { type: Number, default: 3 },
  combo: { type: Number, default: 0 },
  /** 0..1, or null for no timer */
  time: { type: Number, default: null },
  best: { type: Number, default: null },
  newBest: { type: Boolean, default: false },
  stars: { type: Number, default: 0 },
  headline: { type: String, default: '' },
  missed: { type: Array, default: () => [] }
})
const emit = defineEmits(['again'])
const router = useRouter()
const timeLow = computed(() => props.time != null && props.time < 0.25)
</script>

<template>
  <div class="gs">
    <header class="gs__hud">
      <button class="gs__back" aria-label="回遊戲中心" @click="router.push('/games')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <span class="gs__title zh">{{ title }}</span>
      <span v-if="lives != null" class="gs__lives" :aria-label="`剩 ${lives} 條命`">
        <svg v-for="n in maxLives" :key="n" viewBox="0 0 24 24" :class="{ 'gs__heart--off': n > lives }" class="gs__heart"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3.2 1.7-2 3.2-3.2 5.3-3.2 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z" /></svg>
      </span>
      <span class="gs__score"><b class="num">{{ score }}</b><small class="zh">{{ scoreLabel }}</small></span>
    </header>
    <div v-if="time != null" class="gs__timer" :class="{ 'gs__timer--low': timeLow }"><span :style="{ transform: `scaleX(${Math.max(0, time)})` }" /></div>

    <Transition name="fade">
      <div v-if="combo >= 3 && !over" :key="combo" class="gs__combo zh">{{ combo }} 連擊{{ combo >= 10 ? ' ×3' : combo >= 5 ? ' ×2' : '' }}</div>
    </Transition>

    <main class="gs__field">
      <slot v-if="!over" />

      <section v-else class="gs__over">
        <Confetti v-if="stars >= 2 || newBest" />
        <div class="gs__stars" :aria-label="`${stars} 顆星`">
          <span v-for="n in 3" :key="n" class="gs__star" :class="{ 'gs__star--on': n <= stars }" :style="{ animationDelay: n * 0.12 + 's' }">★</span>
        </div>
        <h2 class="gs__head zh">{{ headline || (stars >= 2 ? '漂亮！' : '再來一局？') }}</h2>
        <p class="gs__final"><b class="num">{{ score }}</b> <span class="zh">{{ scoreLabel }}</span></p>
        <p v-if="newBest" class="gs__record zh">新紀錄！</p>
        <p v-else-if="best != null" class="gs__bestline zh">最佳紀錄 <b class="num">{{ best }}</b></p>
        <slot name="result" />

        <div v-if="missed.length" class="gs__missed">
          <h3 class="gs__mt zh">這幾個字再看一眼</h3>
          <ul>
            <li v-for="w in missed" :key="w.id">
              <b class="gs__mw">{{ w.headword }}</b>
              <span class="zh gs__mz">{{ glossOf(w) }}</span>
              <AudioButton :text="w.headword" size="sm" />
            </li>
          </ul>
        </div>

        <button class="btn btn--primary btn--block zh" @click="emit('again')">再玩一次</button>
        <button class="btn btn--quiet zh" @click="router.push('/games')">回遊戲中心</button>
      </section>
    </main>
  </div>
</template>

<style scoped>
.gs { min-height: 100dvh; display: flex; flex-direction: column; background: var(--paper); }
.gs__hud {
  position: sticky; top: 0; z-index: 50;
  display: grid; grid-template-columns: 40px 1fr auto auto; align-items: center; gap: var(--sp-3);
  padding: calc(env(safe-area-inset-top) + 8px) var(--sp-3) 8px;
  background: var(--nav-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  max-width: 600px; width: 100%; margin: 0 auto;
}
.gs__back { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: var(--ink-2); }
.gs__back svg { width: 22px; height: 22px; }
.gs__title { font-weight: 800; }
.gs__lives { display: flex; gap: 3px; }
.gs__heart { width: 20px; height: 20px; fill: var(--rose); transition: transform 0.2s, opacity 0.2s; }
.gs__heart--off { fill: var(--surface-3); transform: scale(0.8); }
.gs__score { display: flex; align-items: baseline; gap: 3px; font-size: var(--step-1); min-width: 56px; justify-content: flex-end; }
.gs__score small { font-size: var(--step--2); color: var(--ink-3); }
.gs__timer { height: 6px; background: var(--surface-3); max-width: 600px; width: 100%; margin: 0 auto; }
.gs__timer span { display: block; height: 100%; background: var(--jade); transform-origin: left; transition: transform 0.2s linear; }
.gs__timer--low span { background: var(--rose); }
.gs__combo {
  position: fixed; top: calc(env(safe-area-inset-top) + 70px); left: 50%; transform: translateX(-50%);
  background: var(--sun); color: var(--sun-ink); font-weight: 800; padding: 4px 16px; border-radius: var(--radius-pill);
  z-index: 60; animation: pop-in 0.2s; box-shadow: 0 3px 0 var(--sun-edge);
}
.gs__field { flex: 1; width: 100%; max-width: 600px; margin: 0 auto; padding: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-5)); display: flex; flex-direction: column; }

.gs__over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding-top: var(--sp-5); }
.gs__stars { display: flex; gap: 6px; }
.gs__star { font-size: 3rem; line-height: 1; color: var(--surface-3); }
.gs__star--on { color: var(--sun); animation: pop-in 0.35s both; }
.gs__head { font-size: var(--step-3); font-weight: 800; }
.gs__final { font-size: var(--step-4); line-height: 1; }
.gs__final span { font-size: var(--step-0); color: var(--ink-3); }
.gs__record { font-weight: 800; color: var(--sun-ink); background: var(--sun); padding: 2px 14px; border-radius: var(--radius-pill); }
.gs__bestline { color: var(--ink-3); font-size: var(--step--1); }
.gs__missed { align-self: stretch; text-align: left; background: var(--surface); border: 1px solid var(--rule); border-radius: var(--radius-lg); padding: var(--sp-3) var(--sp-4); }
.gs__mt { font-size: var(--step--1); font-weight: 800; color: var(--ink-3); margin-bottom: 6px; }
.gs__missed li { display: flex; align-items: center; gap: var(--sp-3); padding: 6px 0; border-top: 1px solid var(--rule); }
.gs__missed li:first-child { border-top: 0; }
.gs__mw { font-family: var(--font-word); }
.gs__mz { flex: 1; color: var(--ink-2); font-size: var(--step--1); }
</style>
