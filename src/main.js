import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
import { ensureLatest } from './lib/updater'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

/**
 * Pick up a new deploy without the learner doing anything.
 *
 * Up to v3.0.0 the service worker was registered by the plugin's bare
 * registerSW.js: a new build installed and took control in the background,
 * but the page on screen stayed the old build until a manual reload — on a
 * home-screen app that meant "it still shows 2.0". Now:
 *
 *   - the plugin's autoUpdate client reloads the page once the new worker
 *     has activated (workbox `activated` with isUpdate);
 *   - on launch and every time the app comes back to the foreground it
 *     compares its build with the server's version.json and, if stale,
 *     updates — escalating to a clean reload when the worker does not take
 *     over (src/lib/updater.js). An iPhone keeps a home-screen app alive in
 *     the background for days and never re-runs the page-load check.
 *
 * Reloading only happens right after the app is opened or resumed, so it does
 * not cut into a lesson in progress.
 */
registerSW({
  immediate: true,
  onRegisteredSW (_url, reg) {
    if (!reg) return
    let last = Date.now()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 60_000) return
      last = Date.now()
      ensureLatest()
    })
    // and once per launch: compare with the server's version.json, escalate
    // to a clean reload if the worker never takes the new build (v5.2.2)
    setTimeout(() => ensureLatest(), 3000)
  },
  onRegisterError () { /* no service worker here (private mode, file://) — the app still runs */ }
})
