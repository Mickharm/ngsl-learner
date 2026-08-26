<script setup>
import { ref } from 'vue'
import { speak, ttsSupported } from '@/lib/tts'
import { useSettings } from '@/stores/settings'

const props = defineProps({
  text: { type: String, required: true },
  size: { type: String, default: 'md' },   // sm | md | lg
  rate: { type: Number, default: null },
  label: { type: String, default: '' }
})

const settings = useSettings()
const playing = ref(false)

async function play () {
  if (playing.value || !ttsSupported) return
  playing.value = true
  await speak(props.text, {
    rate: props.rate ?? settings.state.ttsRate,
    voiceURI: settings.state.ttsVoiceURI
  })
  playing.value = false
}

defineExpose({ play })
</script>

<template>
  <button
    class="audio"
    :class="[`audio--${size}`, { 'audio--on': playing }]"
    :disabled="!ttsSupported"
    :aria-label="label || `播放 ${text}`"
    :title="ttsSupported ? '播放發音' : '此瀏覽器不支援語音'"
    @click.stop="play"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 5 6.5 9H3v6h3.5L11 19z" />
      <path v-if="!playing" d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path v-else d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" class="wave" />
    </svg>
  </button>
</template>

<style scoped>
.audio {
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--rule);
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s, transform 0.12s;
}
.audio:active:not(:disabled) { transform: scale(0.92); }
.audio:disabled { opacity: 0.35; }
.audio--on { color: var(--jade); background: var(--jade-wash); border-color: var(--jade-edge); }

.audio--sm { width: 30px; height: 30px; }
.audio--sm svg { width: 15px; height: 15px; }
.audio--md { width: 42px; height: 42px; }
.audio--md svg { width: 21px; height: 21px; }
.audio--lg { width: 54px; height: 54px; }
.audio--lg svg { width: 26px; height: 26px; }

.wave { animation: pulse 0.9s ease-in-out infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
