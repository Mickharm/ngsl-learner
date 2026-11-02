<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import AudioButton from '@/components/AudioButton.vue'
import Confetti from './Confetti.vue'
import Stamp from '@/components/ui/Stamp.vue'
import { glossOf } from '@/lib/game'

/**
 * The frame every arcade game sits in: a HUD (lives, score, streak, time)
 * and the result page. Keeping these identical across games is what makes
 * six games one arcade, and each game only has to be its play field.
 *
 * Opened from the day's quest (?phase=1) the result offers 下一關 and marks
 * the quest's game step done; from the game centre it offers 再玩一次.
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
  missed: { type: Array, default: () => [] },
  /** progress through a bounded quest round: { done, total } */
  goal: { type: Object, default: null }
})
const emit = defineEmits(['again'])
const route = useRoute()
const router = useRouter()
const session = useSession()

const inPhase = computed(() => route.query.phase === '1')
const timeLow = computed(() => props.time != null && props.time < 0.25)
const ratio = computed(() => [0.3, 0.6, 0.8, 0.95][Math.max(0, Math.min(3, props.stars))])
const comment = computed(() => props.headline || ['再玩一次，會更熟', '有進步，繼續加油', '很穩，記得很牢', '太厲害了'][Math.max(0, Math.min(3, props.stars))])

watch(() => props.over, o => { if (o && inPhase.value) session.markDone('play') })

function leave () { router.push(inPhase.value ? '/' : '/games') }
function next () { router.push(session.nextRoute('play')) }
</script>

<template>
  <div class="gs">
    <header class="gs__hud">
      <button class="gs__back" :aria-label="inPhase ? '回今天' : '回遊戲中心'" @click="leave">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <span class="gs__title kai">{{ title }}</span>
      <span v-if="lives != null" class="gs__lives" :aria-label="`剩 ${lives} 條命`">
        <svg v-for="n in maxLives" :key="n" viewBox="0 0 24 24" :class="{ 'gs__heart--off': n > lives }" class="gs__heart"><path d="M12 20.5s-7.2-4.4-9.2-8.9C1.4 8.3 3.4 4.8 6.8 4.8c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.4 0 5.4 3.5 4 6.8-2 4.5-9.2 8.9-9.2 8.9z" /></svg>
      </span>
      <span class="gs__score"><b class="num">{{ score }}</b><small class="zh">{{ scoreLabel }}</small></span>
    </header>
    <div v-if="time != null" class="gs__timer" :class="{ 'gs__timer--low': timeLow }"><span :style="{ transform: `scaleX(${Math.max(0, time)})` }" /></div>
    <div v-else-if="goal && !over" class="gs__goal zh">今天的字：<b class="num">{{ Math.min(goal.done, goal.total) }}</b> / {{ goal.total }}</div>

    <Transition name="fade">
      <div v-if="combo >= 3 && !over" :key="combo" class="gs__combo zh">{{ combo }} 連對{{ combo >= 10 ? '　分數 ×3' : combo >= 5 ? '　分數 ×2' : '' }}</div>
    </Transition>

    <main class="gs__field">
      <slot v-if="!over" />

      <section v-else class="gs__over">
        <Confetti v-if="stars >= 2 || newBest" />
        <Stamp :ratio="ratio" :size="124" />
        <p class="gs__comment kai">{{ comment }}</p>
        <p class="gs__final"><b class="num">{{ score }}</b> <span class="zh">{{ scoreLabel }}</span></p>
        <p v-if="newBest" class="gs__record zh">新紀錄</p>
        <p v-else-if="best != null" class="gs__bestline zh">最佳紀錄 <b class="num">{{ best }}</b></p>
        <slot name="result" />

        <div v-if="missed.length" class="gs__missed">
          <h3 class="gs__mt kai">這幾個字再看一眼</h3>
          <ul>
            <li v-for="w in missed" :key="w.id">
              <b class="gs__mw">{{ w.headword }}</b>
              <span class="kai gs__mz">{{ glossOf(w) }}</span>
              <AudioButton :text="w.headword" size="sm" />
            </li>
          </ul>
        </div>

        <template v-if="inPhase">
          <button class="btn btn--primary btn--block zh" @click="next">下一關</button>
          <button class="btn btn--quiet zh" @click="emit('again')">再玩一次</button>
        </template>
        <template v-else>
          <button class="btn btn--primary btn--block zh" @click="emit('again')">再玩一次</button>
          <button class="btn btn--quiet zh" @click="leave">回遊戲中心</button>
        </template>
      </section>
    </main>
  </div>
</template>

<style scoped>
.gs { min-height: 100dvh; display: flex; flex-direction: column; }
.gs__hud {
  position: sticky; top: 0; z-index: 50;
  display: grid; grid-template-columns: 40px 1fr auto auto; align-items: center; gap: var(--sp-3);
  padding: calc(env(safe-area-inset-top) + 8px) var(--sp-3) 8px;
  background: var(--nav-bg); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--rule);
}
.gs__back { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 50%; color: var(--ink-2); }
.gs__back svg { width: 22px; height: 22px; }
.gs__title { font-size: var(--step-1); font-weight: 700; }
.gs__lives { display: flex; gap: 3px; }
.gs__heart { width: 20px; height: 20px; fill: var(--redpen); transition: transform 0.2s, opacity 0.2s; }
.gs__heart--off { fill: none; stroke: var(--rule-strong); stroke-width: 1.6; transform: scale(0.85); }
.gs__score { display: flex; align-items: baseline; gap: 3px; font-size: var(--step-1); min-width: 56px; justify-content: flex-end; }
.gs__score small { font-size: var(--step--2); color: var(--ink-3); }
.gs__timer { height: 5px; background: var(--surface-3); }
.gs__timer span { display: block; height: 100%; background: var(--pen); transform-origin: left; transition: transform 0.2s linear; }
.gs__timer--low span { background: var(--redpen); }
.gs__goal { text-align: center; font-size: var(--step--1); color: var(--ink-2); padding-top: 8px; }
.gs__combo {
  position: fixed; top: calc(env(safe-area-inset-top) + 66px); left: 50%; transform: translateX(-50%) rotate(-2deg);
  background: var(--hl-yellow); color: var(--ink); font-weight: 700; padding: 2px 14px; border-radius: 2px;
  z-index: 60; animation: pop-in 0.2s;
}
.gs__field { flex: 1; width: 100%; max-width: 600px; margin: 0 auto; padding: var(--sp-4); padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-5)); display: flex; flex-direction: column; }

.gs__over { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); text-align: center; padding-top: var(--sp-4); }
.gs__comment { font-size: var(--step-2); font-weight: 700; color: var(--redpen); }
.gs__final { font-size: var(--step-4); line-height: 1; font-family: var(--font-word); }
.gs__final span { font-size: var(--step-0); color: var(--ink-3); }
.gs__record { font-weight: 700; background: var(--hl-yellow); padding: 0 10px; border-radius: 2px; transform: rotate(-2deg); }
.gs__bestline { color: var(--ink-3); font-size: var(--step--1); }
.gs__missed { align-self: stretch; text-align: left; background: var(--surface); box-shadow: var(--shadow-1); border-radius: var(--radius); padding: var(--sp-3) var(--sp-4); }
.gs__mt { font-size: var(--step-0); font-weight: 700; margin-bottom: 4px; }
.gs__missed li { display: flex; align-items: center; gap: var(--sp-3); padding: 7px 0; border-top: 1px dashed var(--rule-strong); }
.gs__missed li:first-child { border-top: 0; }
.gs__mw { font-family: var(--font-word); font-size: var(--step-1); }
.gs__mz { flex: 1; color: var(--ink-2); }
</style>
