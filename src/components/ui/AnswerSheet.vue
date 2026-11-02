<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useSettings } from '@/stores/settings'
import PenMark from './PenMark.vue'

/**
 * The one feedback sheet every question uses.
 *
 * v3 auto-advanced 1.3 s after a right answer — too short to read the
 * explanation — and some modes also moved on after a wrong one, so the
 * learner never saw why. The rules now:
 *
 *   wrong   never moves on by itself. The sheet stays until 繼續.
 *   right   if 自動前進 is on, a countdown runs inside the 繼續 button, sized
 *           to how much there is to read (1.8–5 s). Touching or scrolling the
 *           sheet stops it — "I'm still reading" needs no button.
 *
 * Fixed to the bottom, where the thumb already is; a spacer of the same
 * height keeps the question above it scrollable. Enter / Space continue.
 */
const props = defineProps({
  right: { type: Boolean, required: true },
  hinted: { type: Boolean, default: false },
  title: { type: String, default: '' },
  /** characters of explanation, to size the countdown */
  chars: { type: Number, default: 0 },
  nextLabel: { type: String, default: '繼續' },
  /** force-disable the countdown for this sheet */
  noAuto: { type: Boolean, default: false }
})
const emit = defineEmits(['next'])
const settings = useSettings()

const sheet = ref(null)
const height = ref(0)
const left = ref(1)
const paused = ref(false)
let raf = 0, t0 = 0, ro = null, done = false

const duration = computed(() => Math.min(5000, Math.max(1800, 1800 + props.chars * 45)))
const counting = computed(() => props.right && !props.noAuto && settings.state.autoAdvance !== false && !paused.value)
const verdict = computed(() => props.title || (props.right ? (props.hinted ? '對了，有用到提示' : '答對了') : '再看一次'))

function go () {
  if (done) return
  done = true
  cancelAnimationFrame(raf)
  emit('next')
}

function tick (t) {
  if (!counting.value) return
  left.value = Math.max(0, 1 - (t - t0) / duration.value)
  if (left.value <= 0) return go()
  raf = requestAnimationFrame(tick)
}

function hold (e) {
  if (e?.target?.closest?.('.as__next')) return
  if (!counting.value) return
  paused.value = true
  cancelAnimationFrame(raf)
}

function onKey (e) {
  if (e.key === 'Enter' || e.key === ' ') {
    if (/input|textarea/i.test(document.activeElement?.tagName || '')) return
    e.preventDefault()
    go()
  }
}

onMounted(async () => {
  await nextTick()
  if (sheet.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => { height.value = sheet.value?.offsetHeight || 0 })
    ro.observe(sheet.value)
  } else height.value = sheet.value?.offsetHeight || 0
  window.addEventListener('keydown', onKey)
  if (counting.value) { t0 = performance.now(); raf = requestAnimationFrame(tick) }
})
onUnmounted(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="as__spacer" :style="{ height: height + 'px' }" aria-hidden="true" />
  <Teleport to="body">
    <section
      ref="sheet"
      class="as"
      :class="right ? 'as--right' : 'as--wrong'"
      role="status"
      @pointerdown="hold"
      @wheel.passive="hold"
      @touchmove.passive="hold"
    >
      <div class="as__in">
        <header class="as__head">
          <PenMark :kind="right ? 'right' : 'wrong'" :size="34" />
          <span class="as__verdict kai">{{ verdict }}</span>
          <span v-if="right && paused" class="as__paused zh">已停住，看完再按繼續</span>
        </header>
        <div class="as__body"><slot /></div>
        <button class="as__next zh" :class="{ 'as__next--wrong': !right }" @click="go">
          <span v-if="counting" class="as__bar" :style="{ transform: `scaleX(${left})` }" />
          <span class="as__label">{{ nextLabel }}</span>
        </button>
      </div>
    </section>
  </Teleport>
</template>

<style scoped>
.as__spacer { flex-shrink: 0; }
.as {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 260;
  background: var(--surface);
  box-shadow: 0 -1px 0 var(--rule), 0 -18px 40px -24px rgba(0, 0, 0, 0.35);
  border-radius: 16px 16px 0 0;
  padding: var(--sp-4) var(--sp-4) calc(env(safe-area-inset-bottom) + var(--sp-4));
  max-height: 62dvh; overflow-y: auto;
  animation: sheet-in 0.22s cubic-bezier(0.2, 0.9, 0.3, 1);
}
/* a red margin line down the left, like the exercise-book margin */
.as::before { content: ''; position: absolute; left: 14px; top: 0; bottom: 0; width: 1.5px; background: var(--line-base); opacity: 0.5; }
.as__in { max-width: 560px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--sp-3); padding-left: 12px; }
.as__head { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.as__verdict { font-size: var(--step-2); font-weight: 700; color: var(--redpen); }
.as--right .as__verdict { color: var(--ink); }
.as__paused { font-size: var(--step--2); color: var(--ink-3); margin-left: auto; }
.as__body { display: flex; flex-direction: column; gap: var(--sp-2); font-size: var(--step-0); line-height: 1.65; }
.as__body:empty { display: none; }
.as__next {
  position: relative; overflow: hidden;
  min-height: 52px; border-radius: var(--radius);
  background: var(--pen); color: var(--pen-ink); font-weight: 700; font-size: var(--step-0);
  box-shadow: 0 2px 0 color-mix(in srgb, var(--pen) 60%, #000);
}
.as__next:active { transform: translateY(2px); box-shadow: none; }
.as__next--wrong { background: var(--ink); color: var(--paper); box-shadow: 0 2px 0 #0006; }
.as__bar { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.22); transform-origin: left; }
.as__label { position: relative; }
@keyframes sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .as { animation: none; } }
</style>
