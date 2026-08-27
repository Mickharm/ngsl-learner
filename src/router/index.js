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
 * gh-pages, so the previous build's hashed chunks stop existing. Any route
 * the page had not already imported before the deploy is then gone from
 * both the cache and the server. The routes used every day survive because
 * their modules are already in memory; the one route nobody had opened
 * since the deploy is the one that dies silently.
 *
 * A bare `location.reload()` is not enough to fix this. skipWaiting +
 * clientsClaim only *install* the new service worker — the open tab keeps
 * being served by whichever worker answered the reload's index.html
 * request, and the browser's own update check for that worker is
 * throttled, not instant. The result was exactly what shipped last: the
 * first reload can still be served the stale precache, land back on a
 * broken route, and then sit blocked by the reload-loop guard below for a
 * navigation that never gets a second attempt — a tap that looks like it
 * does nothing.
 *
 * So this reloads only after forcing an update check and giving the new
 * worker a bounded window to actually take control (`controllerchange`).
 * By the time `reload()` runs, the fetch for the fresh index.html — and
 * for the chunk that just 404'd — is answered by the worker that has the
 * current build, not the one that doesn't.
 */
const CHUNK_FAIL = /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch/i
const RELOAD_KEY = 'ngsl.chunkReload'

async function recoverFromChunkFailure (to) {
  let last = 0
  try { last = Number(sessionStorage.getItem(RELOAD_KEY) || 0) } catch { /* private mode */ }
  if (Date.now() - last < 10_000) return
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch { /* ignore */ }
  try { window.location.hash = '#' + (to?.fullPath || '/') } catch { /* ignore */ }

  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.update().catch(() => {})
      await new Promise(resolve => {
        const done = () => resolve()
        navigator.serviceWorker.addEventListener('controllerchange', done, { once: true })
        setTimeout(done, 1500) // don't hang the reload if nothing new shows up
      })
    }
  } catch { /* no service worker in this context — fall through to a plain reload */ }

  window.location.reload()
}

router.onError((err, to) => {
  if (!CHUNK_FAIL.test(err?.message || '')) return
  recoverFromChunkFailure(to)
})

export default router
