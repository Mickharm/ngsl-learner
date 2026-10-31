<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

/**
 * A finger sketch pad. Drawing a word — even for four seconds, even badly —
 * roughly doubled free recall over writing it out in Wammes, Meade &
 * Fernandes (2016); drawing quality did not matter. So the pad is deliberately
 * crude: one pen, one colour, undo, clear.
 */
const props = defineProps({
  size: { type: Number, default: 260 },
  initial: { type: String, default: '' }
})
const emit = defineEmits(['change'])

const canvas = ref(null)
let ctx = null
let drawing = false
let strokes = []     // [[{x,y}]]
let current = null
const empty = ref(true)

function setup () {
  const c = canvas.value
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  c.width = props.size * dpr
  c.height = props.size * dpr
  ctx = c.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#1a1d24'
  if (props.initial) {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, 0, 0, props.size, props.size); empty.value = false }
    img.src = props.initial
  }
}

function pos (e) {
  const r = canvas.value.getBoundingClientRect()
  const p = e
  return { x: ((p.clientX - r.left) / r.width) * props.size, y: ((p.clientY - r.top) / r.height) * props.size }
}

function start (e) {
  e.preventDefault()
  canvas.value.setPointerCapture?.(e.pointerId)
  drawing = true
  current = [pos(e)]
  strokes.push(current)
}
function move (e) {
  if (!drawing) return
  e.preventDefault()
  const p = pos(e)
  const last = current[current.length - 1]
  current.push(p)
  ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke()
  empty.value = false
}
function end () {
  if (!drawing) return
  drawing = false
  emit('change', snapshot())
}

function redraw () {
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, props.size, props.size)
  for (const s of strokes) {
    ctx.beginPath()
    s.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
    ctx.stroke()
  }
  empty.value = strokes.length === 0
}

function undo () { strokes.pop(); redraw(); emit('change', snapshot()) }
function clear () { strokes = []; redraw(); emit('change', '') }

/** A compact PNG: the canvas downscaled to 160px, white background. */
function snapshot () {
  if (empty.value) return ''
  const out = document.createElement('canvas')
  out.width = 160; out.height = 160
  const o = out.getContext('2d')
  o.fillStyle = '#fff'; o.fillRect(0, 0, 160, 160)
  o.drawImage(canvas.value, 0, 0, 160, 160)
  return out.toDataURL('image/png')
}

onMounted(() => {
  setup()
  if (!props.initial) redraw()
})
onUnmounted(() => { ctx = null })
defineExpose({ snapshot, clear })
</script>

<template>
  <div class="sketch">
    <canvas
      ref="canvas"
      class="sketch__canvas"
      :style="{ width: size + 'px', height: size + 'px' }"
      @pointerdown="start" @pointermove="move" @pointerup="end" @pointerleave="end" @pointercancel="end"
    />
    <div class="sketch__tools">
      <button class="btn btn--quiet btn--sm zh" :disabled="empty" @click="undo">復原</button>
      <button class="btn btn--quiet btn--sm zh" :disabled="empty" @click="clear">清除</button>
    </div>
  </div>
</template>

<style scoped>
.sketch { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.sketch__canvas {
  touch-action: none;
  background: #fff;
  border: 2px dashed var(--rule-strong);
  border-radius: var(--radius);
  cursor: crosshair;
}
.sketch__tools { display: flex; gap: var(--sp-2); }
</style>
