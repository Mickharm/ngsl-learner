/**
 * Regenerates public/icons from the app's own scene (src/lib/scene.js), so
 * the home-screen icon is the place the app opens on: the range in its sea
 * of cloud, the light over it, and "Ag" on the four-line staff.
 *
 *   node scripts/make-icons.mjs
 */
import { chromium } from 'playwright'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const scene = readFileSync(resolve(ROOT, 'src/lib/scene.js'), 'utf8').replace(/export /g, '')
const font = readFileSync(resolve(ROOT, 'src/assets/fonts/andika-latin-700-normal.woff2')).toString('base64')
const CHROME = [process.env.CHROME_PATH, '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/usr/bin/google-chrome'].find(p => p && existsSync(p))

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 600, height: 600 }, deviceScaleFactor: 1 })
await page.setContent(`<style>@font-face{font-family:Andika;font-weight:700;src:url(data:font/woff2;base64,${font}) format('woff2')}body{margin:0}</style><canvas id="c"></canvas>`)
await page.addScriptTag({ content: scene })
await page.evaluate(() => document.fonts.load('700 100px Andika'))

for (const size of [192, 512]) {
  await page.evaluate(size => {
    const c = document.getElementById('c')
    c.width = c.height = size
    const ctx = c.getContext('2d')
    // the scene, framed so the range sits just above the middle
    const k = size / 300
    ctx.setTransform(k, 0, 0, k, 0, 0)
    drawScene(ctx, 300, 300, { theme: 'light', learner: null, p: 0.72, calm: 0, rise: 1, arc: 0, done: 0, total: 0, lift: 0.06 })
    // "Ag" on the staff, in the cloud under the range. Andika: ascender
    // 0.4395em, x-height 0.7129em, baseline 1.2207em, descender 1.4551em
    // below the top of a 1.6113 line (see .staff in main.css).
    const em = 112, top = 152, left = 58, right = 242
    const line = (dy, color, w) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(left, top + dy * em); ctx.lineTo(right, top + dy * em); ctx.stroke() }
    line(0.4395 - 0.4395, 'rgba(22,94,131,0.26)', 1.2)
    line(0.7129 - 0.4395, 'rgba(22,94,131,0.26)', 1.2)
    line(1.4551 - 0.4395, 'rgba(22,94,131,0.26)', 1.2)
    line(1.2207 - 0.4395, 'rgba(183,40,46,0.55)', 1.8)
    ctx.fillStyle = '#1c2229'
    ctx.font = `700 ${em}px Andika`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('Ag', 150, top + (1.2207 - 0.4395) * em)
  }, size)
  await page.locator('#c').screenshot({ path: resolve(ROOT, `public/icons/icon-${size}.png`) })
  console.log(`icon-${size}.png`)
}
await browser.close()
