<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { pictureOf } from '@/data/pictures'
import { loadDrawing } from '@/lib/drawings'

/**
 * The picture for a word. The learner's own drawing wins over the stock emoji:
 * a self-made symbol is the stronger retrieval cue (it was generated, not just
 * seen), and for abstract words it is the only picture there is.
 */
const props = defineProps({
  wordId: { type: Number, default: 0 },
  headword: { type: String, default: '' },
  size: { type: Number, default: 120 },
  /** Show a dashed "draw one" placeholder when there is no picture at all. */
  placeholder: { type: Boolean, default: false },
  /** A drawing still being made (Word Lab), shown before it is saved. */
  live: { type: String, default: null }
})

const stored = ref('')
const drawing = computed(() => props.live ?? stored.value)
const emoji = computed(() => pictureOf(props.headword))

async function refresh () {
  stored.value = props.wordId ? (await loadDrawing(props.wordId)) || '' : ''
}
onMounted(refresh)
watch(() => props.wordId, refresh)
defineExpose({ refresh })
</script>

<template>
  <div v-if="drawing || emoji || placeholder" class="pic" :style="{ '--sz': size + 'px' }">
    <img v-if="drawing" :src="drawing" class="pic__draw" alt="你的圖" />
    <span v-else-if="emoji" class="pic__emoji" aria-hidden="true">{{ emoji }}</span>
    <span v-else-if="size >= 80" class="pic__none zh">畫一個<br>你的記號</span>
    <span v-else class="pic__none pic__none--sm" aria-hidden="true">✏️</span>
    <span v-if="drawing && emoji" class="pic__badge" aria-hidden="true">{{ emoji }}</span>
  </div>
</template>

<style scoped>
.pic {
  position: relative;
  width: var(--sz); height: var(--sz);
  display: grid; place-items: center;
  flex-shrink: 0;
}
.pic__emoji { font-size: calc(var(--sz) * 0.72); line-height: 1; filter: drop-shadow(0 4px 10px rgba(0,0,0,0.12)); }
.pic__draw {
  width: 100%; height: 100%;
  border-radius: var(--radius);
  background: #fff;
  border: 1px solid var(--rule);
  object-fit: contain;
}
.pic__none {
  width: 100%; height: 100%;
  display: grid; place-items: center; text-align: center;
  border: 2px dashed var(--rule-strong);
  border-radius: var(--radius);
  color: var(--ink-3);
  font-size: calc(var(--sz) * 0.12);
  line-height: 1.4;
}
.pic__none--sm { font-size: calc(var(--sz) * 0.4); border-width: 1.5px; opacity: 0.7; }
.pic__badge {
  position: absolute; right: -6px; bottom: -6px;
  font-size: calc(var(--sz) * 0.26);
  background: var(--surface); border-radius: 50%;
  box-shadow: var(--shadow-1);
  width: calc(var(--sz) * 0.36); height: calc(var(--sz) * 0.36);
  display: grid; place-items: center;
}
</style>
