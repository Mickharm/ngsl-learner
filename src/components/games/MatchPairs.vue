<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { matchPairs, shuffle } from '@/lib/game'
import { speak } from '@/lib/tts'
import { useSettings } from '@/stores/settings'

/**
 * 連連看: pictures with meanings on the left, English on the right, tap one
 * from each side. Used inside Word Lab after every few new words and in the
 * arcade. It is practice, not measurement — it never reaches the scheduler.
 */
const props = defineProps({
  words: { type: Array, required: true },
  seed: { type: Number, default: 1 },
  count: { type: Number, default: 5 }
})
const emit = defineEmits(['done'])
const settings = useSettings()

const pairs = ref([])
const right = ref([])
const selL = ref(null)
const selR = ref(null)
const matched = ref(new Set())
const bad = ref(null)
const mistakes = ref(0)
const startedAt = ref(Date.now())

function build () {
  pairs.value = matchPairs(props.words, props.seed, props.count)
  right.value = shuffle(pairs.value.map(p => ({ id: p.id, text: p.right })), props.seed + 99)
  selL.value = null; selR.value = null
  matched.value = new Set(); mistakes.value = 0; bad.value = null
  startedAt.value = Date.now()
}

const done = computed(() => pairs.value.length > 0 && matched.value.size === pairs.value.length)

function tryMatch () {
  if (selL.value == null || selR.value == null) return
  if (selL.value === selR.value) {
    const id = selL.value
    matched.value = new Set([...matched.value, id])
    selL.value = null; selR.value = null
    if (done.value) setTimeout(() => emit('done', { mistakes: mistakes.value, ms: Date.now() - startedAt.value }), 450)
  } else {
    mistakes.value++
    bad.value = [selL.value, selR.value]
    setTimeout(() => { bad.value = null; selL.value = null; selR.value = null }, 450)
  }
}
function tapL (id) { if (matched.value.has(id) || bad.value) return; selL.value = id; tryMatch() }
function tapR (o) {
  if (matched.value.has(o.id) || bad.value) return
  selR.value = o.id
  speak(o.text, { rate: settings.state.ttsRate, voiceURI: settings.state.ttsVoiceURI, leadIn: settings.state.ttsLeadIn })
  tryMatch()
}

watch(() => props.words.map(w => w.id).join(','), build)
onMounted(build)
</script>

<template>
  <section class="mp">
    <p class="mp__help zh">左邊圖片配右邊英文，點一下左、再點一下右</p>
    <div class="mp__cols">
      <div class="mp__col">
        <button
          v-for="p in pairs" :key="'l' + p.id"
          class="mcard mcard--l"
          :class="{ 'mcard--sel': selL === p.id, 'mcard--ok': matched.has(p.id), 'mcard--bad': bad && bad[0] === p.id }"
          :disabled="matched.has(p.id)"
          @click="tapL(p.id)"
        >
          <span v-if="p.left.pic" class="mcard__pic" aria-hidden="true">{{ p.left.pic }}</span>
          <span class="mcard__zh zh">{{ p.left.zh }}</span>
        </button>
      </div>
      <div class="mp__col">
        <button
          v-for="o in right" :key="'r' + o.id"
          class="mcard mcard--r"
          :class="{ 'mcard--sel': selR === o.id, 'mcard--ok': matched.has(o.id), 'mcard--bad': bad && bad[1] === o.id }"
          :disabled="matched.has(o.id)"
          @click="tapR(o)"
        >{{ o.text }}</button>
      </div>
    </div>
    <p class="mp__score zh"><span class="num">{{ matched.size }}</span>/<span class="num">{{ pairs.length }}</span> 配對完成<template v-if="mistakes"> · 配錯 <span class="num">{{ mistakes }}</span></template></p>
  </section>
</template>

<style scoped>
.mp { display: flex; flex-direction: column; gap: var(--sp-3); }
.mp__help { font-size: var(--step--1); color: var(--ink-2); text-align: center; }
.mp__cols { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.mp__col { display: flex; flex-direction: column; gap: var(--sp-2); }
.mcard {
  min-height: 62px;
  border: 1.5px solid var(--rule-strong); border-radius: var(--radius);
  background: var(--surface);
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 6px 8px;
  transition: transform 0.12s, background 0.15s, border-color 0.15s, opacity 0.3s;
}
.mcard:active:not(:disabled) { transform: scale(0.97); }
.mcard--r { font-family: var(--font-word); font-size: var(--step-1); }
.mcard__pic { font-size: 1.7rem; line-height: 1; }
.mcard__zh { font-size: var(--step--1); font-weight: 600; text-align: left; line-height: 1.25; }
.mcard--sel { border-color: var(--violet); background: var(--violet-wash); box-shadow: 0 0 0 3px var(--violet-wash); }
.mcard--ok { border-color: var(--jade-edge); background: var(--jade-wash); opacity: 0.45; }
.mcard--bad { border-color: var(--rose); background: var(--rose-wash); animation: shake 0.35s; }
.mp__score { text-align: center; font-size: var(--step--1); color: var(--ink-3); }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
</style>
