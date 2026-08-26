<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useWords } from '@/stores/words'
import { useSettings } from '@/stores/settings'

/**
 * Guards a phase that needs translations/examples. Words arrive enriched on
 * demand rather than in one 2801-word batch, so the first visit of the day may
 * need a few seconds of Gemini calls — this is where that wait is shown, and
 * where the "no API key" dead end is turned into a link that fixes it.
 */

const props = defineProps({
  ids: { type: Array, required: true },
  /** Render children anyway once this fraction is ready. */
  partial: { type: Boolean, default: false }
})

const words = useWords()
const settings = useSettings()

const state = ref('idle')      // idle | working | ready | nokey | error
const message = ref('')

const missing = computed(() => words.missing(props.ids))
const ready = computed(() => props.ids.length > 0 && missing.value.length === 0)

async function run () {
  if (!props.ids.length) return
  if (ready.value) { state.value = 'ready'; return }
  if (!settings.hasGeminiKey) { state.value = 'nokey'; return }

  state.value = 'working'
  message.value = ''
  try {
    await words.ensureEnriched(props.ids)
    state.value = words.missing(props.ids).length ? 'error' : 'ready'
    if (state.value === 'error') message.value = '有些單字沒有成功產生資料，可以再試一次。'
  } catch (err) {
    state.value = err?.code === 'NO_KEY' ? 'nokey' : 'error'
    message.value = err?.message || '產生單字資料時發生錯誤'
  }
}

onMounted(run)
watch(() => props.ids.join(','), run)

const pct = computed(() => {
  const p = words.enrichProgress
  return p.total ? Math.round((p.done / p.total) * 100) : 0
})
</script>

<template>
  <slot v-if="ready || (partial && missing.length < ids.length)" />

  <main v-else-if="state === 'working'" class="shell gate">
    <div class="gate__spinner" aria-hidden="true"><span /><span /><span /></div>
    <h2 class="gate__title zh">正在準備今天的單字</h2>
    <p class="gate__desc zh">
      翻譯、音標、例句都是即時產生的，第一次會花幾秒。之後同一批字就不用再等了。
    </p>
    <div class="gate__bar">
      <div class="gate__fill" :style="{ width: pct + '%' }" />
    </div>
    <p class="gate__count num">{{ words.enrichProgress.done }} / {{ words.enrichProgress.total }}</p>
  </main>

  <main v-else-if="state === 'nokey'" class="shell gate">
    <div class="empty__mark">🔑</div>
    <h2 class="gate__title zh">需要 Gemini API Key</h2>
    <p class="gate__desc zh">
      單字的中文翻譯、音標和例句由 Gemini 產生。到設定頁貼上你的 API Key 就能開始，
      Key 只存在你自己的帳號裡。
    </p>
    <RouterLink to="/settings" class="btn btn--primary zh">前往設定</RouterLink>
  </main>

  <main v-else-if="state === 'error'" class="shell gate">
    <div class="empty__mark">!</div>
    <h2 class="gate__title zh">資料準備失敗</h2>
    <p class="gate__desc zh">{{ message }}</p>
    <div class="gate__actions">
      <button class="btn btn--primary zh" @click="run">重試</button>
      <RouterLink to="/settings" class="btn btn--ghost zh">檢查設定</RouterLink>
    </div>
  </main>

  <main v-else class="shell gate">
    <div class="gate__spinner" aria-hidden="true"><span /><span /><span /></div>
  </main>
</template>

<style scoped>
.gate {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--sp-3);
  text-align: center;
  min-height: 60dvh;
}

.gate__title { font-size: var(--step-1); font-weight: 700; }
.gate__desc {
  font-size: var(--step--1);
  color: var(--ink-2);
  line-height: 1.7;
  max-width: 34ch;
}

.gate__bar {
  width: min(280px, 80%);
  height: 5px;
  border-radius: 3px;
  background: var(--surface-3);
  overflow: hidden;
  margin-top: var(--sp-2);
}
.gate__fill { height: 100%; background: var(--jade); transition: width 0.4s ease; }
.gate__count { font-size: var(--step--2); color: var(--ink-3); }

.gate__actions { display: flex; gap: var(--sp-2); flex-wrap: wrap; justify-content: center; }

.gate__spinner { display: flex; gap: 6px; }
.gate__spinner span {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--jade);
  animation: bounce 1.1s ease-in-out infinite;
}
.gate__spinner span:nth-child(2) { animation-delay: 0.14s; }
.gate__spinner span:nth-child(3) { animation-delay: 0.28s; }
@keyframes bounce {
  0%, 70%, 100% { transform: translateY(0); opacity: 0.4; }
  35% { transform: translateY(-7px); opacity: 1; }
}
</style>
