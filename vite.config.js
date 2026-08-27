import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'))

/**
 * Baked in at build time so the running page can say exactly which commit it
 * is — Settings shows this. The alternative (checking whether "it feels
 * updated") is exactly the ambiguity that cost a redeploy cycle before: an
 * already-open tab can silently keep serving the previous build.
 */
let buildSha = 'unknown'
try {
  buildSha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()
} catch { /* no git available at build time — keep 'unknown' rather than fail the build */ }

export default defineConfig({
  base: '/ngsl-learner/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(buildSha),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'NGSL Learner',
        short_name: 'NGSL',
        description: 'NGSL 2801 單字 · 文法 · 閱讀 每日闖關',
        theme_color: '#12151c',
        background_color: '#12151c',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/ngsl-learner/',
        start_url: '/ngsl-learner/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,json}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Without these, a redeploy keeps serving the previous build until the
        // user closes every tab — which on an iPhone home-screen app is
        // basically never. Take over immediately and bin the old precache.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
})
