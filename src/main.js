import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { registerSW } from 'virtual:pwa-register'
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
 *   - every time the app comes back to the foreground it asks the server for
 *     a newer sw.js, because an iPhone keeps a home-screen app alive in the
 *     background for days and never re-runs the page-load check.
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
      reg.update().catch(() => {})
    })
  },
  onRegisterError () { /* no service worker here (private mode, file://) — the app still runs */ }
})
