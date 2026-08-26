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
    </div>
    <div class="shead__track">
      <div class="shead__fill" :style="{ width: pct + '%' }" />
    </div>
  </header>
</template>

<style scoped>
.shead {
  position: sticky;
  top: 0;
  z-index: 90;
  background: var(--nav-bg);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  padding-top: env(safe-area-inset-top);
  border-bottom: 1px solid var(--rule);
}

.shead__bar {
  display: grid;
  grid-template-columns: 40px 1fr 64px;
  align-items: center;
  gap: var(--sp-2);
  height: 50px;
  padding: 0 var(--sp-2);
  max-width: 680px;
  margin: 0 auto;
}

.shead__exit {
  width: 38px; height: 38px;
  display: grid; place-items: center;
  border-radius: var(--radius-sm);
  color: var(--ink-2);
}
.shead__exit svg { width: 22px; height: 22px; }
.shead__exit:active { background: var(--surface-2); }

.shead__title {
  font-size: var(--step-0);
  font-weight: 700;
  text-align: center;
  letter-spacing: -0.01em;
}

.shead__count {
  font-size: var(--step--1);
  color: var(--ink-2);
  text-align: right;
  padding-right: var(--sp-2);
}
.shead__slash { color: var(--ink-3); margin: 0 1px; }

.shead__track { height: 3px; background: var(--surface-3); }
.shead__fill {
  height: 100%;
  background: var(--jade);
  transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
