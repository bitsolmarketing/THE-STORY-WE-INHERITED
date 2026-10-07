/**
 * Judge's-eye test of the experience (brief §31): entry screen → Judges' Cut playback (timed,
 * sampled) → interrupt by scrolling → a careless flick (must not skip decades) → timeline travel →
 * archive from the bottom bar. Reports console/page errors. Screens go to e2e/out/journey/.
 *
 *   node e2e/journey.mjs            (VERIFY_URL to override; JOURNEY_FULL=1 to watch the whole cut)
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.env.VERIFY_URL ?? 'http://localhost:5173/'
const FULL = process.env.JOURNEY_FULL === '1'
const OUT = resolve('e2e/out/journey')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 })
const errors = []
page.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 300)))
page.on('pageerror', (e) => errors.push(`[pageerror] ${e}`))
page.on('requestfailed', (r) => errors.push(`[request] ${r.url()} ${r.failure()?.errorText}`))

const state = () =>
  page.evaluate(() => {
    const c = window.__CINEMA__
    const s = c.store.getState()
    return { p: +c.frame.progress.toFixed(4), beat: s.beatId, year: s.year, mode: s.mode, playing: s.playing, overlay: s.overlay, fps: null }
  })
const shot = (name) => page.screenshot({ path: resolve(OUT, `${name}.png`) })
const log = (label, s) => console.log(label.padEnd(24), JSON.stringify(s))

await page.goto(URL)
await page.waitForFunction(() => window.__CINEMA_READY__ === true, null, { timeout: 60000 })
await page.waitForTimeout(1600)
await shot('00-entry')

// 1. Play the Judges' Cut from the entry screen.
await page.getByRole('button', { name: /Play the Judges/ }).click()
const t0 = Date.now()
const samples = []
const duration = FULL ? 135000 : 42000
while (Date.now() - t0 < duration) {
  await page.waitForTimeout(FULL ? 10000 : 7000)
  const s = await state()
  samples.push({ t: Math.round((Date.now() - t0) / 1000), ...s })
  log(`judges +${samples[samples.length - 1].t}s`, s)
  await shot(`judges-${String(samples[samples.length - 1].t).padStart(3, '0')}`)
  if (!s.playing && s.p > 0.99) break
}
const monotonic = samples.every((s, i) => i === 0 || s.p >= samples[i - 1].p - 1e-4)
const yearsSeen = [...new Set(samples.map((s) => s.year))]

// 2. Interrupt: one scroll gesture hands control back.
await page.mouse.move(800, 450)
await page.mouse.wheel(0, 120)
await page.waitForTimeout(400)
const afterInterrupt = await state()
log('after interrupt', afterInterrupt)

// 3. A careless flick: a huge wheel burst must not teleport the film across decades.
const before = await state()
for (let i = 0; i < 6; i++) await page.mouse.wheel(0, 2400)
await page.waitForTimeout(250)
const quickly = await state()
await page.waitForTimeout(3500)
const settled = await state()
log('flick: before', before)
log('flick: +250ms', quickly)
log('flick: +3.75s', settled)

// 4. Timeline travel to 1971.
await page.evaluate(() => window.__CINEMA__.store.getState().openOverlay('timeline'))
await page.waitForTimeout(900)
await shot('timeline')
await page.getByRole('button', { name: '1971', exact: true }).click()
await page.waitForTimeout(500)
await shot('travel-veil')
await page.waitForTimeout(2600)
const afterTravel = await state()
log('after travel to 1971', afterTravel)
await shot('travel-arrived')

// 4b. Chapter keys: → three times, ← once (each glides to the next settled frame).
const stepped = []
for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowLeft']) {
  await page.keyboard.press(key)
  await page.waitForTimeout(3200)
  stepped.push((await state()).beat)
}
log('chapter keys', stepped)
await shot('after-keys')

// 5. Archive from the bottom bar.
await page.getByRole('button', { name: /^Archive/ }).first().click()
await page.waitForTimeout(1200)
await shot('archive')
const archiveOpen = (await state()).overlay === 'archive'
await page.keyboard.press('Escape')
await page.waitForTimeout(500)

await browser.close()

const report = {
  judges: { samples: samples.length, monotonic, yearsSeen, reachedEnd: samples.some((s) => s.p > 0.99) },
  interrupt: { paused: afterInterrupt.playing === false },
  flick: { jumpIn250ms: +(quickly.p - before.p).toFixed(4), after: settled },
  travel: { year: afterTravel.year, beat: afterTravel.beat },
  chapterKeys: stepped,
  archiveOpen,
  errors,
}
console.log(JSON.stringify(report, null, 1))
process.exit(errors.length ? 1 : 0)
