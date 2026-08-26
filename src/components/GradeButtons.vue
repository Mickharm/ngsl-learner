<script setup>
import { computed } from 'vue'
import { GRADE, previewIntervals, formatDelay, newCard } from '@/lib/srs'
import { useSettings } from '@/stores/settings'

const props = defineProps({
  card: { type: Object, default: null }
})
const emit = defineEmits(['grade'])
const settings = useSettings()

const BUTTONS = [
  { grade: GRADE.AGAIN, label: '忘記', hint: '完全想不起來', tone: 'rose' },
  { grade: GRADE.HARD,  label: '模糊', hint: '想很久才想到', tone: 'amber' },
  { grade: GRADE.GOOD,  label: '記得', hint: '正常想起來',   tone: 'jade' },
  { grade: GRADE.EASY,  label: '簡單', hint: '秒答',         tone: 'violet' }
]

/**
 * A word being seen for the first time has no stored card yet — fall back to a
 * fresh one so the buttons still show what each answer costs. Hiding the
 * intervals on exactly the cards where the learner is calibrating their own
 * honesty is the wrong moment to go quiet.
 */
const previews = computed(() => {
  if (!settings.state.showIntervalHints) return null
  const card = props.card || newCard(0)
  const p = previewIntervals(card)
  return Object.fromEntries(Object.entries(p).map(([g, ms]) => [g, formatDelay(ms)]))
})
</script>

<template>
  <div class="grades">
    <button
      v-for="b in BUTTONS"
      :key="b.grade"
      class="grade"
      :class="`grade--${b.tone}`"
      @click="emit('grade', b.grade)"
    >
      <span class="grade__label zh">{{ b.label }}</span>
      <span v-if="previews" class="grade__next num">{{ previews[b.grade] }}</span>
      <span v-else class="grade__hint zh">{{ b.hint }}</span>
    </button>
  </div>
</template>

<style scoped>
.grades {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
}

.grade {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 58px;
  padding: var(--sp-2) 2px;
  border-radius: var(--radius);
  border: 1px solid;
  transition: transform 0.1s ease, filter 0.15s ease;
}
.grade:active { transform: scale(0.955); }

.grade__label { font-size: var(--step-0); font-weight: 700; line-height: 1.2; }
.grade__next {
  font-size: var(--step--2);
  opacity: 0.85;
  letter-spacing: 0.02em;
}
.grade__hint { font-size: 10px; opacity: 0.75; line-height: 1.2; }

.grade--rose   { color: var(--rose);   background: var(--rose-wash);   border-color: var(--rose-edge); }
.grade--amber  { color: var(--amber);  background: var(--amber-wash);  border-color: var(--amber-edge); }
.grade--jade   { color: var(--jade);   background: var(--jade-wash);   border-color: var(--jade-edge); }
.grade--violet { color: var(--violet); background: var(--violet-wash); border-color: transparent; }

@media (max-width: 360px) {
  .grade__hint { display: none; }
}
</style>
