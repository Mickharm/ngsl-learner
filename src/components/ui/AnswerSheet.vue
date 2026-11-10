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
          <span class="as__verdict">{{ verdict }}</span>
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
/* a glass sheet inset from the screen edges, as iOS 26 partial sheets are;
   thick variant, because it carries text (HIG: regular glass for text) */
.as {
  position: fixed; z-index: 260;
  left: 8px; right: 8px; bottom: calc(env(safe-area-inset-bottom) + 8px);
  max-width: 600px; margin: 0 auto;
  border-radius: 32px;
  padding: var(--sp-4) var(--sp-4) var(--sp-4);
  max-height: 62dvh; overflow-y: auto; overscroll-behavior: contain;
  background: var(--glass-solid);
  box-shadow: var(--glass-rim), var(--shadow-3);
  animation: sheet-up 0.42s cubic-bezier(0.2, 1.05, 0.3, 1);
}
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .as { background: var(--glass-thick); -webkit-backdrop-filter: blur(30px) saturate(145%); backdrop-filter: blur(30px) saturate(145%); }
}
@media (prefers-reduced-transparency: reduce) { .as { background: var(--glass-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }
/* a tint along the top edge says right / wrong before any word is read */
.as::before { content: ''; position: absolute; inset: 0 0 auto; height: 72px; border-radius: 32px 32px 0 0; pointer-events: none; opacity: 0.9; }
.as--right::before { background: linear-gradient(var(--jade-wash), transparent); }
.as--wrong::before { background: linear-gradient(var(--redpen-wash), transparent); }
.as__in { position: relative; display: flex; flex-direction: column; gap: var(--sp-3); padding: 0 4px; }
.as__head { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.as__verdict { font-size: var(--step-1); font-weight: 700; letter-spacing: -0.01em; color: var(--redpen); }
.as--right .as__verdict { color: var(--jade); }
.as__paused { font-size: var(--step--2); color: var(--ink-3); margin-left: auto; }
.as__body { display: flex; flex-direction: column; gap: var(--sp-2); font-size: var(--step-0); line-height: 1.6; }
.as__body:empty { display: none; }
.as__next {
  position: relative; overflow: hidden;
  min-height: 52px; border-radius: 999px;
  background: linear-gradient(180deg, var(--pen-hi), var(--pen) 62%); color: var(--pen-ink); font-weight: 600; font-size: var(--step-0);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 12px 24px -12px var(--pen-glow);
  transition: transform 0.25s cubic-bezier(0.3, 1.5, 0.5, 1);
}
.as__next:active { transform: scale(0.97); }
.as__bar { position: absolute; inset: 0; background: rgba(255, 255, 255, 0.24); transform-origin: left; }
.as__label { position: relative; }
@media (prefers-reduced-motion: reduce) { .as { animation: none; } }
</style>
