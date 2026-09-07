import { expect, test } from '@playwright/test'

test('the full fleet stays represented while filters, scrubbing and vessel search change the view', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  await expect(page.locator('.field-count small')).toHaveText('60,000 vessels in the full study')
  await expect(page.locator('.field-count strong')).toHaveText('24,406')
  await expect(page.locator('canvas[role="img"]')).toHaveAttribute('data-drawn', /\d+/)
  expect(Number(await page.locator('canvas[role="img"]').getAttribute('data-drawn'))).toBeGreaterThan(10_000)
  await expect(page.getByLabel('Rendering performance')).toContainText('Paused')
  expect(await page.locator('#vessel option').count()).toBeLessThanOrEqual(103)
  await page.getByRole('searchbox', { name: 'Find a vessel' }).fill('59995')
  await page.getByLabel('Inspect a demo vessel').selectOption('demo-59995')
  await expect(page.locator('.evidence-panel')).toContainText('Interpolated demo position')
  await page.getByRole('button', { name: 'Tankers', exact: true }).click()
  await expect(page.locator('.field-count strong')).toHaveText('17,400')
  await page.getByRole('button', { name: 'Cargo', exact: true }).click()
  await expect(page.locator('canvas[role="img"]')).toHaveAttribute('data-drawn', '0')
  await page.getByLabel('Study time', { exact: true }).fill('2591940')
  await page.getByRole('button', { name: 'Cargo', exact: true }).click()
  await expect(page.getByLabel('Data delivery')).toHaveAttribute('data-state', 'ready')
  await expect(page.locator('.field-count small')).toHaveText('60,000 vessels in the full study')
  expect(Number(await page.locator('canvas[role="img"]').getAttribute('data-drawn'))).toBeGreaterThan(0)
})

// Report measured cost, without a machine-dependent FPS assertion. An over-budget
// fixture must remain intact; timings always identify hardware vs software backends.
for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
  test(`measure full-fleet playback at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    await page.setViewportSize(viewport)
    const opening = Date.now()
    await page.goto('/')
    await expect(page.locator('canvas[role="img"]')).toHaveAttribute('data-drawn', /\d+/, { timeout: 30_000 })
    const loadAndFirstDrawMs = Date.now() - opening
    const [counts, search, meter] = await Promise.all([page.locator('.field-count').boundingBox(), page.locator('.port-search').boundingBox(), page.getByLabel('Rendering performance').boundingBox()])
    if (viewport.width < 700) {
      expect(counts!.y + counts!.height).toBeLessThanOrEqual(search!.y)
      expect(search!.y + search!.height).toBeLessThanOrEqual(meter!.y)
    }
    const delivery = await page.getByLabel('Data delivery').evaluate(element => ({ day: element.getAttribute('data-chunk'), cachedChunks: Number(element.getAttribute('data-cached')), decodedChunkBytes: Number(element.getAttribute('data-decoded-bytes')), residentSamples: Number(element.getAttribute('data-resident-samples')) }))
    expect(delivery.cachedChunks).toBe(1)
    expect(delivery.decodedChunkBytes).toBeLessThan(8 * 1024 * 1024)
    const renderer = await page.locator('canvas[role="img"]').getAttribute('data-renderer')
    const backend = await page.locator('.fleet-canvas').getAttribute('data-backend')
    const openingActive = await page.locator('.field-count strong').innerText()
    const openingDrawn = Number(await page.locator('canvas[role="img"]').getAttribute('data-drawn'))
    await page.getByRole('button', { name: 'Play playback', exact: true }).click()
    const sample = await page.evaluate(async () => {
      const canvas = document.querySelector<HTMLCanvasElement>('canvas[role="img"]')!
      const durations: number[] = []
      const intervals: number[] = []
      let previousFrame = canvas.dataset.frame, previousTime = performance.now()
      const startingFrame = Number(previousFrame)
      const started = previousTime
      await new Promise<void>(resolve => {
        const tick = () => {
          const now = performance.now()
          if (canvas.dataset.frame !== previousFrame) {
            durations.push(Number(canvas.dataset.drawMs))
            intervals.push(now - previousTime)
            previousTime = now; previousFrame = canvas.dataset.frame
          }
          if (now - started >= 5000) resolve()
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })
      const percentile95 = (values: number[]) => values.sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * .95) - 1)]
      return {
        measuredDraws: durations.length,
        submittedDraws: Number(canvas.dataset.frame) - startingFrame,
        canvasDrawsPerSecond: durations.length * 1000 / (performance.now() - started),
        p95DrawMs: percentile95(durations),
        p95ObservedFrameIntervalMs: percentile95(intervals),
        devicePixelRatio,
      }
    })
    await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
    expect(sample.measuredDraws).toBeGreaterThan(0)
    // Chunk transitions must not leave an orphan clock submitting extra frames.
    expect(sample.submittedDraws).toBeLessThanOrEqual(sample.measuredDraws + 12)
    expect(sample.p95DrawMs).toBeGreaterThan(0)
    const gpu = await page.locator('.fleet-canvas').evaluate(canvas => ({ bufferBytes: Number(canvas.dataset.bufferBytes ?? 0), geometryUploads: Number(canvas.dataset.geometryUploads ?? 0), drawCalls: Number(canvas.dataset.drawCalls ?? 0) }))
    if (renderer === 'webgl2') {
      expect(gpu.drawCalls).toBe(6)
      expect(gpu.geometryUploads).toBeLessThanOrEqual(3)
      expect(gpu.bufferBytes).toBeLessThan(8 * 1024 * 1024)
    }
    const report = { viewport, renderer, backend, gpu, environment: 'Playwright Chromium; phone viewport is desktop emulation, not phone hardware', totalVessels: 60_000, delivery, openingActive, openingDrawn, loadAndFirstDrawMs, ...sample, targetFrameMs: 1000 / 60, drawBudgetExceeded: sample.p95DrawMs > 1000 / 60, frameBudgetExceeded: sample.p95ObservedFrameIntervalMs > 1000 / 60 }
    console.log(`MANIFEST benchmark: ${JSON.stringify(report)}`)
    await testInfo.attach('rendering-budget.json', { body: JSON.stringify(report, null, 2), contentType: 'application/json' })
    await page.screenshot({ path: testInfo.outputPath('fleet.png') })
    // Exercise an actual gesture and scrub at fleet volume after measuring playback.
    const canvas = await page.locator('canvas[role="img"]').boundingBox()
    await page.mouse.move(canvas!.x + canvas!.width * .5, canvas!.y + canvas!.height * .5)
    await page.mouse.down()
    await page.mouse.move(canvas!.x + canvas!.width * .6, canvas!.y + canvas!.height * .55, { steps: 4 })
    await page.mouse.up()
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await page.getByLabel('Study time', { exact: true }).fill('1728000')
    await expect(page.locator('.clock')).toContainText('DAY 21')
    await expect(page.getByLabel('Rendering performance')).toContainText('Paused')
  })
}
