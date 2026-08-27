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

/**
 * A lazy route chunk that fails to load aborts the navigation and leaves the
 * screen exactly as it was — the learner taps and nothing happens, with the
 * error only in the console.
 *
 * It is not hypothetical: every deploy force-pushes a new `dist/` over
 * gh-pages, so the previous build's hashed chunks stop existing, and the new
 * service worker takes over the open page immediately (skipWaiting +
 * clientsClaim + cleanupOutdatedCaches). Any route the page had not already
 * imported is then gone from both the cache and the server. The routes used
 * every day survive because their modules are already in memory; the one route
 * nobody had opened since the deploy — /setup — is the one that dies silently.
 *
 * Reload once, on the route that was asked for: a fresh index.html carries the
 * new chunk names. The timestamp guard stops a genuinely missing chunk from
 * turning into a reload loop.
 */
const CHUNK_FAIL = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i
const RELOAD_KEY = 'ngsl.chunkReload'

router.onError((err, to) => {
  if (!CHUNK_FAIL.test(err?.message || '')) return
  let last = 0
  try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0) } catch { /* private mode */ }
  if (Date.now() - last < 10_000) return
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* ignore */ }
  window.location.hash = '#' + (to?.fullPath || '/')
  window.location.reload()
})

export default router
