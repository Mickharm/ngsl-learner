/**
 * Is the build on screen the build on the server — and if not, make it so.
 *
 * v5.2.1 (2026-11-08): the deploy was live (gh-pages, sw.js on the CDN both
 * pointed at 5.2.1) and a device still showed 5.2.0 the next day. The update
 * path until now was "ask the browser to re-check sw.js and trust it": when
 * the new worker does not install or take control, nothing tells the page,
 * and nothing tries again harder.
 *
 * Now the server publishes `version.json` (emitted by vite.config.js, kept
 * OUT of the precache, fetched with no-store). The page compares that sha
 * with its own baked-in one, so "stale" is a fact rather than a guess:
 *
 *   1. same sha → current, done;
 *   2. different → reg.update(), wait for the new worker to take control;
 *   3. still not in control after UPDATE_WAIT_MS → drop the worker and its
 *      caches, reload from the network. The next load registers a fresh
 *      worker for the current build.
 *
 * Step 3 runs at most once per HARD_RESET_GAP_MS (sessionStorage guard) so a
 * broken deploy can never put the app into a reload loop. Offline → no-op.
 * Learning data lives in IndexedDB/localStorage/Supabase, never in the
 * Cache Storage cleared here.
 */
/* global __BUILD_SHA__ __APP_VERSION__ */
const BASE = import.meta.env.BASE_URL || '/'
export const LOCAL = { version: __APP_VERSION__, sha: __BUILD_SHA__ }
const UPDATE_WAIT_MS = 15000
const HARD_RESET_GAP_MS = 10 * 60 * 1000
const GUARD = 'ngsl.hardUpdate'

export async function serverBuild () {
  try {
    const r = await fetch(`${BASE}version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = await r.json()
    return j && j.sha ? j : null
  } catch { return null }
}

function waitForControl (ms) {
  return new Promise(resolve => {
    if (!navigator.serviceWorker) return resolve(false)
    const t = setTimeout(() => resolve(false), ms)
    navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(t); resolve(true) }, { once: true })
  })
}

async function hardReset () {
  try { sessionStorage.setItem(GUARD, String(Date.now())) } catch { /* ignore */ }
  try {
    const regs = await navigator.serviceWorker?.getRegistrations?.() || []
    await Promise.all(regs.map(r => r.unregister()))
  } catch { /* ignore */ }
  try {
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
  } catch { /* ignore */ }
  const u = new URL(location.href)
  u.searchParams.set('u', Date.now().toString(36))
  location.replace(u.toString())
}

function mayHardReset () {
  try { return Date.now() - Number(sessionStorage.getItem(GUARD) || 0) > HARD_RESET_GAP_MS } catch { return true }
}

/**
 * @param {{ force?: boolean, onStatus?: (s: {state: string, server?: object}) => void }} [opt]
 *   force: the learner pressed the button — skip the hard-reset guard.
 * @returns {Promise<'current'|'offline'|'updating'|'reset'|'stuck'>}
 */
export async function ensureLatest ({ force = false, onStatus = () => {} } = {}) {
  onStatus({ state: 'checking' })
  const server = await serverBuild()
  if (!server) { onStatus({ state: 'offline' }); return 'offline' }
  if (server.sha === LOCAL.sha) { onStatus({ state: 'current', server }); return 'current' }

  onStatus({ state: 'updating', server })
  const reg = await navigator.serviceWorker?.getRegistration?.().catch(() => null)
  if (reg) {
    await reg.update().catch(() => {})
    // the plugin's autoUpdate client reloads the page once control changes
    if (await waitForControl(UPDATE_WAIT_MS)) { location.reload(); return 'updating' }
  }
  if (force || mayHardReset()) { onStatus({ state: 'reset', server }); await hardReset(); return 'reset' }
  onStatus({ state: 'stuck', server })
  return 'stuck'
}
