import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuth } from '@/stores/auth'

/**
 * Hash history, deliberately. GitHub Pages serves static files with no
 * rewrite rule, so a deep link like /review under history mode returns a 404.
 * Hash routing survives a refresh and an iOS home-screen launch.
 */

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true, chrome: false } },
  { path: '/setup', name: 'setup', component: () => import('@/views/PlacementView.vue'), meta: { chrome: false } },
  { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
  { path: '/learn', name: 'learn', component: () => import('@/views/LearnView.vue'), meta: { chrome: false } },
  { path: '/review', name: 'review', component: () => import('@/views/ReviewView.vue'), meta: { chrome: false } },
  { path: '/grammar', name: 'grammar', component: () => import('@/views/GrammarView.vue'), meta: { chrome: false } },
  { path: '/essentials', name: 'essentials', component: () => import('@/views/EssentialsView.vue'), meta: { chrome: false } },
  { path: '/write', name: 'write', component: () => import('@/views/WriteView.vue'), meta: { chrome: false } },
  { path: '/listen', name: 'listen', component: () => import('@/views/ListenView.vue'), meta: { chrome: false } },
  { path: '/article', name: 'article', component: () => import('@/views/ArticleView.vue'), meta: { chrome: false } },
  { path: '/summary', name: 'summary', component: () => import('@/views/SummaryView.vue'), meta: { chrome: false } },
  { path: '/errors', name: 'errors', component: () => import('@/views/ErrorsView.vue') },
  { path: '/travel', name: 'travel', component: () => import('@/views/TravelView.vue') },
  { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue') },
  { path: '/browse', name: 'browse', component: () => import('@/views/BrowseView.vue') },
  { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

router.beforeEach(async to => {
  const auth = useAuth()
  if (!auth.ready) await auth.init()
  if (!to.meta.public && !auth.signedIn) {
    // A session can lapse mid-use — an expired token, storage swept by the
    // browser. Replay the remembered credentials before showing a form the
    // learner has already filled in on this device.
    if (await auth.restore()) return true
    return { name: 'login', query: { next: to.fullPath } }
  }
  if (to.name === 'login' && auth.signedIn) return { name: 'dashboard' }
  return true
})

export default router
