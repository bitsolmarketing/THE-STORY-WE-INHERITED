/**
 * Verification harness (spec Â§27): drives the real app in headless Chromium with software WebGL,
 * scrolls 0 â†’ 1 â†’ 0, screenshots every step, and reports console/page/WebGL/asset errors.
 *
 *   npm run build && npm run preview   (or npm run dev)  then:  npm run verify
 *   VERIFY_URL=http://localhost:5173 node e2e/verify.mjs
 *   VERIFY_STEPS=24 VERIFY_WIDTH=1600 VERIFY_HEIGHT=900 node e2e/verify.mjs
 */
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.env.VERIFY_URL ?? 'http://localhost:4173/?enter'
const STEPS = Number(process.env.VERIFY_STEPS ?? 20)
const WIDTH = Number(process.env.VERIFY_WIDTH ?? 1600)
const HEIGHT = Number(process.env.VERIFY_HEIGHT ?? 900)
const OUT = resolve('e2e/out')
const SETTLE_MS = Number(process.env.VERIFY_SETTLE_MS ?? 2500)

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

const report = {
  url: URL,
  steps: STEPS,
  consoleErrors: [],
  consoleWarnings: [],
  pageErrors: [],
  failedRequests: [],
  webgl: {},
  frames: [],
  screenshots: [],
  timing: {},
}

const browser = await chromium.launch({
  headless: true,
  args: [
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--disable-gpu-sandbox',
  ],
})
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 })

page.on('console', (msg) => {
  const type = msg.type()
  const text = msg.text()
  if (type === 'error') report.consoleErrors.push(text)
  else if (type === 'warning') report.consoleWarnings.push(text)
})
page.on('pageerror', (err) => report.pageErrors.push(String(err?.stack ?? err)))
page.on('requestfailed', (req) => report.failedRequests.push({ url: req.url(), error: req.failure()?.errorText }))
page.on('response', (res) => {
  if (res.status() >= 400) report.failedRequests.push({ url: res.url(), status: res.status() })
})

const t0 = Date.now()
await page.goto(URL, { waitUntil: 'domcontentloaded' })
try {
  await page.waitForFunction(() => window.__CINEMA_READY__ === true, null, { timeout: 90_000 })
} catch {
  report.pageErrors.push('Timed out waiting for window.__CINEMA_READY__')
}
report.timing.readyMs = Date.now() - t0

report.webgl = await page.evaluate(() => {
  const c = window.__CINEMA__
  const gl = c?.renderer?.getContext?.()
  return {
    hasHook: Boolean(c),
    contextLost: gl ? gl.isContextLost() : null,
    renderer: gl ? gl.getParameter(gl.RENDERER) : null,
    version: gl ? gl.getParameter(gl.VERSION) : null,
    quality: c?.store?.getState?.().quality?.tier ?? null,
  }
})

async function settle(targetP) {
  // Wait until damped progress has converged on the scroll target (or time out).
  try {
    await page.waitForFunction(
      (tp) => {
        const f = window.__CINEMA__?.frame
        return f && Math.abs(f.progress - f.target) < 0.0015 && Math.abs(f.target - tp) < 0.01
      },
      targetP,
      { timeout: SETTLE_MS, polling: 50 },
    )
  } catch {
    /* proceed anyway; the report will show the actual progress */
  }
}

async function measureFrames(ms = 1200) {
  return page.evaluate(
    (duration) =>
      new Promise((resolveFn) => {
        const times = []
        let last = performance.now()
        const start = last
        function tick(now) {
          times.push(now - last)
          last = now
          if (now - start < duration) requestAnimationFrame(tick)
          else {
            times.shift()
            const avg = times.reduce((s, v) => s + v, 0) / Math.max(1, times.length)
            const worst = Math.max(...times)
            resolveFn({ avgMs: Number(avg.toFixed(2)), worstMs: Number(worst.toFixed(2)), frames: times.length })
          }
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )
}

async function snapshot(label, targetP) {
  const state = await page.evaluate(() => {
    const c = window.__CINEMA__
    const s = c?.store?.getState?.()
    return {
      progress: c?.frame.progress ?? null,
      target: c?.frame.target ?? null,
      chapter: s?.beatId ?? null,
      year: s?.year ?? null,
      stats: c?.stats?.() ?? null,
    }
  })
  const file = `${label}.png`
  await page.screenshot({ path: resolve(OUT, file), fullPage: false })
  report.screenshots.push({ file, targetP, ...state })
  return state
}

const scrollMax = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)
report.timing.scrollMax = scrollMax

// Place the film directly (the engine's leash correctly refuses giant programmatic scroll jumps).
const placeAt = (p) =>
  page.evaluate(
    ([pp, max]) => {
      window.scrollTo({ top: pp * max, behavior: 'auto' })
      window.__CINEMA__.frame.target = pp
      window.__CINEMA__.frame.progress = pp
    },
    [p, scrollMax],
  )

// Forward pass.
for (let i = 0; i <= STEPS; i++) {
  const p = i / STEPS
  await placeAt(p)
  await settle(p)
  const state = await snapshot(`fwd-${String(i).padStart(2, '0')}`, p)
  if (i % Math.max(1, Math.floor(STEPS / 5)) === 0) {
    const f = await measureFrames()
    report.frames.push({ pass: 'fwd', targetP: p, chapter: state.chapter, ...f })
  }
}

// Reverse pass (coarser).
const back = Math.max(4, Math.floor(STEPS / 2))
for (let i = back; i >= 0; i--) {
  const p = i / back
  await placeAt(p)
  await settle(p)
  await snapshot(`rev-${String(i).padStart(2, '0')}`, p)
}

// Archive open/close smoke test.
try {
  const trigger = page.getByRole('button', { name: /archive/i }).first()
  await trigger.click({ timeout: 5000 })
  await page.waitForTimeout(900)
  await page.screenshot({ path: resolve(OUT, 'archive-open.png') })
  report.screenshots.push({ file: 'archive-open.png', targetP: 0, note: 'archive drawer' })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
  report.archive = { opened: true, closed: await page.evaluate(() => !window.__CINEMA__?.store.getState().archiveOpen) }
} catch (e) {
  report.archive = { opened: false, error: String(e) }
}

report.webgl.contextLostAtEnd = await page.evaluate(() => window.__CINEMA__?.renderer?.getContext?.().isContextLost() ?? null)
report.timing.totalMs = Date.now() - t0

await browser.close()

// Filter known-benign noise.
const benign = [/SwiftShader/i, /GPU stall/i, /Automatic fallback to software WebGL/i]
report.consoleWarnings = report.consoleWarnings.filter((w) => !benign.some((r) => r.test(w)))

const problems = report.consoleErrors.length + report.pageErrors.length + report.failedRequests.length + (report.webgl.contextLostAtEnd ? 1 : 0)
writeFileSync(resolve(OUT, 'report.json'), JSON.stringify(report, null, 2))

console.log(`\nVERIFY ${URL}`)
console.log(`ready in ${report.timing.readyMs} ms, total ${report.timing.totalMs} ms, renderer: ${report.webgl.renderer}, tier: ${report.webgl.quality}`)
console.log(`screenshots: ${report.screenshots.length} â†’ ${OUT}`)
console.log(`console errors: ${report.consoleErrors.length}, page errors: ${report.pageErrors.length}, failed requests: ${report.failedRequests.length}, context lost: ${report.webgl.contextLostAtEnd}`)
for (const e of report.consoleErrors.slice(0, 10)) console.log('  [console.error]', e.slice(0, 300))
for (const e of report.pageErrors.slice(0, 10)) console.log('  [pageerror]', e.slice(0, 300))
for (const r of report.failedRequests.slice(0, 10)) console.log('  [request]', r.url, r.status ?? r.error)
for (const f of report.frames) console.log(`  frames @${f.targetP.toFixed(2)} (${f.chapter}): avg ${f.avgMs} ms, worst ${f.worstMs} ms`)
for (const s of report.screenshots) if (s.progress != null) console.log(`  ${s.file}: target ${s.targetP.toFixed(3)} progress ${s.progress.toFixed(3)} chapter ${s.chapter} year ${s.year} calls ${s.stats?.calls} tris ${s.stats?.triangles}`)
process.exit(problems > 0 ? 1 : 0)
