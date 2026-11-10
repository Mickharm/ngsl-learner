<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  current: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  exitTo: { type: String, default: '/' },
  exitLabel: { type: String, default: '離開' }
})

const router = useRouter()
const pct = computed(() => props.total ? Math.min(100, (props.current / props.total) * 100) : 0)
</script>

<template>
  <header class="shead">
    <div class="shead__bar">
      <button class="shead__exit" :aria-label="exitLabel" @click="router.push(exitTo)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div class="shead__title zh">{{ title }}</div>
      <div v-if="total" class="shead__count num">{{ current }}<span class="shead__slash">/</span>{{ total }}</div>
      <div v-else class="shead__count" />
      <div class="shead__fill" :style="{ width: `calc((100% - 44px) * ${pct / 100})` }" />
    </div>
  </header>
</template>

<style scoped>
/* A floating glass bar: circular back button, title, count, and the round's
   progress as a thin capsule inside the bar. */
.shead {
  position: sticky; top: 0; z-index: 90;
  padding: calc(env(safe-area-inset-top) + 6px) 10px 6px;
}
.shead__bar {
  display: grid;
  grid-template-columns: 44px 1fr 64px;
  align-items: center;
  gap: var(--sp-2);
  height: 52px;
  padding: 0 6px;
  max-width: 680px;
  margin: 0 auto;
  border-radius: 999px;
  background: var(--glass-solid);
  box-shadow: var(--glass-rim), var(--shadow-1);
  position: relative; overflow: hidden;
}
@supports ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .shead__bar { background: var(--glass); -webkit-backdrop-filter: blur(26px) saturate(150%); backdrop-filter: blur(26px) saturate(150%); }
}
@media (prefers-reduced-transparency: reduce) { .shead__bar { background: var(--glass-solid); -webkit-backdrop-filter: none; backdrop-filter: none; } }

.shead__exit {
  width: 40px; height: 40px;
  display: grid; place-items: center;
  border-radius: 50%;
  color: var(--ink);
  background: var(--surface-2);
  transition: transform 0.25s cubic-bezier(0.3, 1.5, 0.5, 1);
}
.shead__exit svg { width: 20px; height: 20px; }
.shead__exit:active { transform: scale(0.9); }

.shead__title {
  font-size: var(--step-0);
  font-weight: 650;
  letter-spacing: -0.01em;
  text-align: center;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.shead__count {
  font-size: var(--step--1);
  color: var(--ink-2);
  text-align: right;
  padding-right: var(--sp-3);
}
.shead__slash { color: var(--ink-3); margin: 0 1px; }

.shead__fill {
  position: absolute; left: 22px; bottom: 5px; height: 3px; border-radius: 2px;
  max-width: calc(100% - 44px);
  background: linear-gradient(90deg, var(--pen), var(--pen-hi));
  box-shadow: 0 0 10px var(--pen-glow);
  transition: width 0.45s cubic-bezier(0.3, 1, 0.4, 1);
}
</style>
