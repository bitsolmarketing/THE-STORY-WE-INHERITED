/**
 * Patient screenshot probe: like probe.mjs but waits for lazy scenes to mount and never aborts the
 * run on one bad point. Usage: node e2e/shots.mjs @E08 @open:train 0.05 …
 * Env: SHOTS_OUT (folder), PROBE_W / PROBE_H, WAIT (ms per point), VERIFY_URL.
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.env.VERIFY_URL ?? 'http://localhost:5173/?enter'
const OUT = resolve(process.env.SHOTS_OUT ?? 'e2e/out/shots')
const WAIT = Number(process.env.WAIT ?? 4000)
mkdirSync(OUT, { recursive: true })

const W = Number(process.env.PROBE_W ?? 1600)
const H = Number(process.env.PROBE_H ?? 900)
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 768, hasTouch: W < 768 })
if (process.env.REDUCED === '1') await page.emulateMedia({ reducedMotion: 'reduce' })
const logs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text().slice(0, 300)}`) })
const seenErrors = new Set()
page.on('pageerror', (e) => {
  const key = String(e)
  if (seenErrors.has(key)) return
  seenErrors.add(key)
  logs.push(`[pageerror] ${e.stack ?? e}`.slice(0, 1200))
})
await page.goto(URL)
await page.waitForFunction(() => window.__CINEMA_READY__ === true, null, { timeout: 90000 })
await page.waitForTimeout(1000)
// CANVAS_ONLY=1: hide every DOM overlay, so only the WebGL frame is captured.
if (process.env.CANVAS_ONLY === '1') await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }' })

for (const arg of process.argv.slice(2)) {
  try {
    const p = await page.evaluate((a) => {
      if (!a.startsWith('@')) return Number(a)
      const [id, k] = a.slice(1).split(/:(?=[\d.]+$)/)
      const tl = window.__CINEMA__.store.getState().timeline
      const b = tl.byId(id)
      if (!b) return -1
      return k !== undefined ? b.start + (b.end - b.start) * Number(k) : tl.restingProgress(b) + (b.end - b.start) * 0.12
    }, arg)
    if (p < 0) { console.log(`skip ${arg}: unknown beat`); continue }
    await page.evaluate((pp) => {
      window.scrollTo(0, pp * (document.documentElement.scrollHeight - innerHeight))
      window.__CINEMA__.frame.target = pp
      window.__CINEMA__.frame.progress = pp
    }, p)
    await page.waitForTimeout(WAIT)
    const beat = await page.evaluate(() => window.__CINEMA__.store.getState().beatId)
    const name = arg.replace(/[@:>#=]/g, '_')
    await page.screenshot({ path: resolve(OUT, `${name}.png`) })
    console.log(`${arg} -> ${p.toFixed(4)} ${beat}`)
  } catch (e) {
    console.log(`fail ${arg}: ${e}`)
  }
}
console.log(logs.join('\n'))
await browser.close()
