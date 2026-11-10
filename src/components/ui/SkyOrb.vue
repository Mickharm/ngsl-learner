<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { drawScene } from '@/lib/scene'

/**
 * A learner's own sky, as a medallion: the same scene the app is set in,
 * painted small with that learner's tint and mountain range. On the login
 * screen "which one are you" becomes "which sky is yours".
 */
const props = defineProps({
  learner: { type: String, default: null },
  size: { type: Number, default: 72 },
  /** where the light is along its arc, 0..1 */
  p: { type: Number, default: 0.3 }
})
const el = ref(null)
let mq = null

function paint () {
  const c = el.value
  if (!c) return
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const px = Math.round(props.size * dpr)
  c.width = c.height = px
  const ctx = c.getContext('2d')
  // the scene is composed for a phone; show a 300-unit square of it
  const k = px / 300
  ctx.setTransform(k, 0, 0, k, 0, 0)
  const t = document.documentElement.getAttribute('data-theme')
  const theme = t === 'light' || t === 'dark' ? t : (mq?.matches ? 'dark' : 'light')
  drawScene(ctx, 300, 300, { theme, learner: props.learner, p: props.p, calm: 0, rise: 1, arc: 0, done: 0, total: 0, lift: 0.32 })
}

onMounted(() => {
  if (typeof matchMedia === 'function') {
    mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', paint)
  }
  paint()
})
onUnmounted(() => mq?.removeEventListener?.('change', paint))
watch(() => [props.learner, props.size, props.p], paint)
</script>

<template>
  <canvas ref="el" class="orb" :style="{ width: size + 'px', height: size + 'px' }" aria-hidden="true" />
</template>

<style scoped>
.orb {
  display: block; flex-shrink: 0; border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5), 0 0 0 0.5px rgba(28, 40, 58, 0.12), 0 10px 22px -12px rgba(30, 44, 70, 0.55);
}
</style>
