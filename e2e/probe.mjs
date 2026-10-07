/**
 * Debug probe: load the film, jump to a progress value, report scene graph / camera / GL state and
 * save a screenshot. Usage: node e2e/probe.mjs 0.05 [0.3 …]   (VERIFY_URL to override the server)
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const URL = process.env.VERIFY_URL ?? 'http://localhost:5173/?enter'
// Numbers are progress values; "@E08" is that chapter's settled frame; "@E08:0.3" a beat-local point.
const points = process.argv.slice(2)
const OUT = resolve('e2e/out/probe')
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const W = Number(process.env.PROBE_W ?? 1600)
const H = Number(process.env.PROBE_H ?? 900)
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: W < 768, hasTouch: W < 768 })
if (process.env.REDUCED === '1') await page.emulateMedia({ reducedMotion: 'reduce' })
const logs = []
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`))
page.on('pageerror', (e) => logs.push(`[pageerror] ${e}`))
await page.goto(URL)
await page.waitForFunction(() => window.__CINEMA_READY__ === true, null, { timeout: 60000 })
await page.waitForTimeout(800)

for (const arg of points.length ? points : ['0']) {
  if (arg.startsWith('#')) {
    // A secondary layer of the site (menu, timeline, archive, sources, about); "#archive=E37" scopes the archive.
    const [hash, ev] = arg.slice(1).split('=')
    await page.evaluate(
      ([h, e]) => {
        const s = window.__CINEMA__.store.getState()
        if (h === 'archive') s.openArchive({ eventId: e ?? null })
        else if (h === 'close') s.closeOverlay()
        else s.openOverlay(h)
      },
      [hash, ev],
    )
    await page.waitForTimeout(1500)
    await page.screenshot({ path: resolve(OUT, `${arg.replace(/[#=]/g, '_')}.png`) })
    console.log(JSON.stringify({ overlay: arg }))
    continue
  }
  const p = await page.evaluate((a) => {
    if (!a.startsWith('@')) return Number(a)
    const [id, k] = a.slice(1).split(/:(?=[\d.]+$)/)
    const tl = window.__CINEMA__.store.getState().timeline
    const b = tl.byId(id)
    if (!b) return 0
    return k !== undefined ? b.start + (b.end - b.start) * Number(k) : tl.restingProgress(b) + (b.end - b.start) * 0.12
  }, arg)
  // Jump directly (the film's speed cap would otherwise take seconds to arrive).
  await page.evaluate((pp) => {
    window.scrollTo(0, pp * (document.documentElement.scrollHeight - innerHeight))
    window.__CINEMA__.frame.target = pp
    window.__CINEMA__.frame.progress = pp
  }, p)
  await page.waitForTimeout(1400)
  const info = await page.evaluate(() => {
    const c = window.__CINEMA__
    const list = []
    c.scene.traverse((o) => {
      if (o.isMesh || o.isPoints || o.isInstancedMesh) list.push({ type: o.type, visible: o.visible, name: o.material?.type, uniforms: o.material?.uniforms ? Object.fromEntries(Object.entries(o.material.uniforms).filter(([, v]) => typeof v.value === 'number').map(([k, v]) => [k, +v.value.toFixed?.(3)])) : null })
    })
    return {
      progress: c.frame.progress,
      beat: c.store.getState().beatId,
      cam: c.camera.position.toArray().map((v) => +v.toFixed(2)),
      fov: c.camera.fov,
      children: c.scene.children.length,
      objects: list,
      stats: c.stats(),
    }
  })
  console.log(JSON.stringify(info, null, 1))
  await page.screenshot({ path: resolve(OUT, `${arg.replace(/[@:>]/g, '_')}.png`) })
}
console.log(logs.join('\n'))
await browser.close()
