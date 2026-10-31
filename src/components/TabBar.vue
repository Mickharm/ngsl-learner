<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useProgress } from '@/stores/progress'

/**
 * v3 navigation, by what the learner wants to do rather than by data type:
 * today's route, the courses, play, look a word up, and themselves.
 * Mistakes, stats and settings live under 我的.
 */
const route = useRoute()
const progress = useProgress()

const tabs = computed(() => [
  { to: '/', label: '今天', icon: 'today', match: ['/'] },
  { to: '/courses', label: '課程', icon: 'course', match: ['/courses'] },
  { to: '/games', label: '遊戲', icon: 'game', match: ['/games'] },
  { to: '/browse', label: '單字', icon: 'book', match: ['/browse'] },
  { to: '/me', label: '我的', icon: 'me', match: ['/me', '/errors', '/stats', '/settings', '/travel'], badge: progress.mistakeCount }
])

const isActive = t => t.to === '/' ? route.path === '/' : t.match.some(m => route.path.startsWith(m))
</script>

<template>
  <nav class="tabbar" aria-label="主選單">
    <RouterLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :class="{ 'tab--on': isActive(t) }" :aria-current="isActive(t) ? 'page' : null">
      <span class="tab__icon" aria-hidden="true">
        <svg v-if="t.icon === 'today'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9.5h12V10" /><path d="M10 19.5v-5h4v5" /></svg>
        <svg v-else-if="t.icon === 'course'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="7" height="7" rx="1.8" /><rect x="13.5" y="4" width="7" height="7" rx="1.8" /><rect x="3.5" y="14" width="7" height="7" rx="1.8" /><rect x="13.5" y="14" width="7" height="7" rx="1.8" /></svg>
        <svg v-else-if="t.icon === 'game'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10a4.5 4.5 0 0 1 4.4 5.4l-.9 4.4a2.3 2.3 0 0 1-3.9 1.1L14.5 16h-5l-2.1 1.9a2.3 2.3 0 0 1-3.9-1.1l-.9-4.4A4.5 4.5 0 0 1 7 7z" /><path d="M8 10v3M6.5 11.5h3" /><circle cx="15.5" cy="11" r="0.9" fill="currentColor" /><circle cx="17.5" cy="13" r="0.9" fill="currentColor" /></svg>
        <svg v-else-if="t.icon === 'book'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v14H5.5A1.5 1.5 0 0 0 4 19.5z" /><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3" /><path d="M9 8.5h6" /></svg>
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20.5c1.3-3.6 4.2-5.4 7.5-5.4s6.2 1.8 7.5 5.4" /></svg>
      </span>
      <span class="tab__label">{{ t.label }}</span>
      <span v-if="t.badge" class="tab__badge num">{{ t.badge > 99 ? '99+' : t.badge }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed; left: 0; right: 0; bottom: 0; z-index: 200;
  display: grid; grid-template-columns: repeat(5, 1fr);
  background: var(--nav-bg);
  backdrop-filter: saturate(160%) blur(18px); -webkit-backdrop-filter: saturate(160%) blur(18px);
  border-top: 1px solid var(--rule);
  padding: 4px 4px env(safe-area-inset-bottom);
}
.tab { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px 2px 6px; color: var(--ink-3); min-height: 56px; }
.tab__icon { width: 46px; height: 28px; display: grid; place-items: center; border-radius: var(--radius-pill); transition: background 0.15s; }
.tab__icon svg { width: 22px; height: 22px; }
.tab--on { color: var(--ink); }
.tab--on .tab__icon { background: var(--sun); color: var(--sun-ink); }
.tab__label { font-size: 11px; font-weight: 700; font-family: var(--font-zh); }
.tab__badge { position: absolute; top: 2px; left: 50%; margin-left: 10px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--rose); color: #fff; font-size: 10px; font-weight: 700; display: grid; place-items: center; line-height: 1; }
</style>
