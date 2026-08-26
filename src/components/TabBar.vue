<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useProgress } from '@/stores/progress'

const route = useRoute()
const progress = useProgress()

const tabs = computed(() => [
  { to: '/', label: '今日', icon: 'today' },
  { to: '/browse', label: '單字庫', icon: 'book' },
  { to: '/errors', label: '錯題', icon: 'flag', badge: progress.errors.length },
  { to: '/stats', label: '數據', icon: 'chart' },
  { to: '/settings', label: '設定', icon: 'gear' }
])

const isActive = to => to === '/' ? route.path === '/' : route.path.startsWith(to)
</script>

<template>
  <nav class="tabbar" aria-label="主選單">
    <RouterLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="tab"
      :class="{ 'tab--on': isActive(t.to) }"
    >
      <span class="tab__icon" aria-hidden="true">
        <svg v-if="t.icon === 'today'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /><circle cx="12" cy="15" r="2" fill="currentColor" stroke="none" />
        </svg>
        <svg v-else-if="t.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5.5A1.5 1.5 0 0 1 4 19.5z" /><path d="M8 3v18M4 17.5h16" />
        </svg>
        <svg v-else-if="t.icon === 'flag'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 21V4M5 4h10l-1.5 3.5L15 11H5" />
        </svg>
        <svg v-else-if="t.icon === 'chart'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
        </svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1 5.3 5.3" />
        </svg>
      </span>
      <span class="tab__label">{{ t.label }}</span>
      <span v-if="t.badge" class="tab__badge num">{{ t.badge > 99 ? '99+' : t.badge }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  left: 0; right: 0; bottom: 0;
  z-index: 200;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  background: var(--nav-bg);
  backdrop-filter: saturate(180%) blur(18px);
  -webkit-backdrop-filter: saturate(180%) blur(18px);
  border-top: 1px solid var(--rule);
  padding-bottom: env(safe-area-inset-bottom);
}

.tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 9px 4px 7px;
  color: var(--ink-3);
  transition: color 0.15s ease;
  min-height: 52px;
}
.tab--on { color: var(--jade); }

.tab__icon { width: 22px; height: 22px; }
.tab__icon svg { width: 100%; height: 100%; }

.tab__label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-family: var(--font-zh);
}

.tab__badge {
  position: absolute;
  top: 4px;
  left: 50%;
  margin-left: 4px;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--rose);
  color: #fff;
  font-size: 9.5px;
  font-weight: 600;
  display: grid;
  place-items: center;
  line-height: 1;
}
</style>
