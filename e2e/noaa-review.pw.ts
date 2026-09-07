import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
const land = JSON.parse(readFileSync('public/data/land.geojson', 'utf8'))

// Invented contract data: CI never downloads or publishes the actual NOAA sample.
const testStudy = {
  schemaVersion: 1, kind: 'tracks', id: 'noaa-test', title: 'Invented contract test',
  startUtc: '2025-01-01T00:00:00Z', duration: 259200,
  source: { id: 'noaa-la-2025', label: 'Invented contract test', license: 'test-only', evidence: 'observed', publication: 'review-required' },
  vessels: [{ id: 'test-cargo', label: 'Test cargo', category: 'cargo', evidence: 'observed' }],
  segments: [
    { id: 'one', vesselId: 'test-cargo', samples: [{ time: 42900, position: [-118.5, 33.5] }, { time: 43500, position: [-118.49, 33.5] }] },
    { id: 'two', vesselId: 'test-cargo', samples: [{ time: 86400, position: [-118.48, 33.5] }, { time: 87000, position: [-118.47, 33.5] }] },
  ],
  audit: { maxGapSeconds: 600, maxSpeedKnots: 45, gapSplits: 1, speedSplits: 0, classSplits: 0 },
}

for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  test(`local observed playback preserves evidence and gaps at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.route('**/__local/noaa-la-2025.json', route => route.fulfill({ json: testStudy }))
    await page.route('**/__local/noaa-la-land.geojson', route => route.fulfill({ json: land }))
    await page.goto('/?study=noaa-la-2025')
    await expect(page.locator('.demo-badge')).toHaveText('OBSERVED AIS · LOCAL REVIEW')
    await expect(page.locator('.field-count strong')).toHaveText('1')
    await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled()
    await expect(page.locator('.clock')).toContainText('2025-01-01')
    await page.getByLabel('Inspect an observed vessel').selectOption('test-cargo')
    await expect(page.locator('.evidence-panel')).toContainText('Interpolated between received samples.')
    await page.getByLabel('Study time', { exact: true }).fill('60000')
    await expect(page.locator('.field-count strong')).toHaveText('0')
    await expect(page.locator('.evidence-panel')).toContainText('No position at this time.')
    await page.getByLabel('Study time', { exact: true }).fill('86400')
    await expect(page.locator('.clock')).toContainText('2025-01-02')
    await expect(page.locator('.evidence-panel')).toContainText('Received sample.')
    await page.getByRole('button', { name: 'About the data' }).click()
    await expect(page.getByRole('dialog')).toContainText('Public artwork redistribution remains under review.')
    await page.getByRole('button', { name: 'Close source notes' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
  })
}

test('missing review artifact does not fall back to synthetic movement', async ({ page }) => {
  await page.route('**/__local/noaa-la-2025.json', route => route.fulfill({ status: 404, body: 'Missing local sample' }))
  await page.goto('/?study=noaa-la-2025')
  await expect(page.getByRole('status')).toContainText('local NOAA sample is unavailable')
  await expect(page.locator('canvas[role="img"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeDisabled()
})

for (const width of [1366, 390]) for (const renderer of ['webgl2', 'canvas2d']) {
  test(`shipping-line filters preserve attribution and Unknown at ${width}px in ${renderer}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(renderer => {
      if (renderer === 'canvas2d') {
        const getContext = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function(type: string, ...args: unknown[]) {
          return type === 'webgl2' ? null : Reflect.apply(getContext, this, [type, ...args])
        } as typeof getContext
      } else {
        const getParameter = WebGL2RenderingContext.prototype.getParameter
        WebGL2RenderingContext.prototype.getParameter = function(parameter: number) {
          return parameter === 0x9246 ? 'Operator shader contract test' : getParameter.call(this, parameter)
        }
      }
    }, renderer)
    const fixture = structuredClone(testStudy)
    const groups = ['msc', 'maersk', 'cma-cgm', 'unknown']
    fixture.vessels = groups.map((group, index) => ({
      id: group, label: `Invented ${group} vessel`, category: 'cargo', evidence: 'observed',
      ...(group !== 'unknown' ? { imo: '1234567', operator: { imo: '1234567', groupId: group, operatorName: `Invented ${group} operator`, role: 'commercial-operator', validFrom: '2025-01-01T00:00:00Z', validTo: '2025-01-04T00:00:00Z', evidenceNote: 'Invented contract evidence, never actual vessel data.', source: { label: 'Test fleet directory', url: 'https://example.com/fleet', retrievedUtc: '2026-09-07T00:00:00Z' } } } : { reportedName: 'MSC NAME WITHOUT EVIDENCE' }),
      mmsi: `12345678${index}`,
    }))
    fixture.segments = groups.map((group, index) => ({ id: group, vesselId: group, samples: [{ time: 42900, position: [-118.5 + index * .03, 33.5] }, { time: 43500, position: [-118.49 + index * .03, 33.5] }] }))
    await page.route('**/__local/noaa-la-2025.json', route => route.fulfill({ json: fixture }))
    await page.route('**/__local/noaa-la-land.geojson', route => route.fulfill({ json: land }))
    await page.goto('/?study=noaa-la-2025')
    const map = page.locator('canvas[role="img"]')
    await expect(map).toHaveAttribute('data-renderer', renderer)
    await expect(page.locator('.field-count strong')).toHaveText('4')
    await expect(page.locator('.operator-controls')).toContainText('3 of 4 vessel records')
    expect((await page.locator('.operator-controls').boundingBox())!.height).toBeLessThan(width > 700 ? 150 : 230)
    for (const [id, name] of [['msc', 'MSC'], ['maersk', 'Maersk'], ['cma-cgm', 'CMA CGM']]) {
      await page.getByRole('button', { name, exact: true }).click()
      await expect(page.locator('.field-count strong')).toHaveText('1')
      await expect(map).toHaveAttribute('data-drawn', '1')
      await expect(page.getByLabel('Inspect an observed vessel')).toHaveValue('')
      await page.getByLabel('Inspect an observed vessel').selectOption(id)
      await expect(page.locator('.operator-evidence')).toContainText(`Operator: ${name}`)
      await page.getByText('Dated operator evidence', { exact: true }).click()
      await expect(page.getByRole('link', { name: 'Test fleet directory' })).toHaveAttribute('href', 'https://example.com/fleet')
    }
    await page.getByLabel('Filter shipping company').selectOption('unknown')
    await expect(page.locator('.field-count strong')).toHaveText('1')
    await page.getByLabel('Inspect an observed vessel').selectOption('unknown')
    await expect(page.locator('.operator-evidence')).toContainText('Operator: Unknown')
    await expect(page.locator('.operator-evidence')).toContainText('MSC NAME WITHOUT EVIDENCE')
    await page.getByLabel('Filter shipping company').selectOption('top3')
    await expect(page.locator('.field-count strong')).toHaveText('3')
    await expect(map).toHaveAttribute('data-drawn', '3')
    await page.getByLabel('Filter shipping company').selectOption('cosco')
    await expect(page.locator('.empty-hint')).toContainText('No verified matches')
    await expect(map).toHaveAttribute('data-drawn', '0')
    await page.getByRole('button', { name: 'Show all operators' }).click()
    await expect(page.locator('.field-count strong')).toHaveText('4')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width)
  })
}

test('local data cannot be read through Vite static paths or cross-origin requests', async ({ request }) => {
  for (const path of [
    '/data/raw/noaa-2025/normalized.json', '/data/compiled/noaa-la-2025.json',
    // A clean CI checkout has no local sample: missing paths must not fall
    // through to Vite's 200 HTML fallback either.
    '/data/raw/ci-missing-static-boundary.json', '/data/compiled/ci-missing-static-boundary.json',
    '/data/raw', '/data/compiled', '/data/%72aw/ci-missing-static-boundary.json?raw',
    `/@fs${process.cwd()}/data/raw/ci-missing-static-boundary.json`,
    `/@fs${process.cwd()}/data/compiled/noaa-la-2025.json?import`,
  ]) {
    const response = await request.get(path)
    expect(response.status(), path).toBe(403)
    expect(await response.text(), path).toBe('Private data is not served directly.')
  }
  const head = await request.head('/data/compiled/ci-missing-static-boundary.json')
  expect(head.status()).toBe(403)
  const response = await request.get('/__local/noaa-la-2025.json', { headers: { Origin: 'https://example.com' } })
  expect(response.status()).toBe(403)
})

test('GPU pixels preserve gaps and the renderer recovers from context loss', async ({ page }) => {
  // Exercise shaders with a tiny invented study even on CI's software GPU.
  await page.addInitScript(() => {
    const getParameter = WebGL2RenderingContext.prototype.getParameter
    WebGL2RenderingContext.prototype.getParameter = function(parameter: number) {
      return parameter === 0x9246 ? 'Shader contract test' : getParameter.call(this, parameter)
    }
  })
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.route('**/__local/noaa-la-2025.json', route => route.fulfill({ json: testStudy }))
  await page.route('**/__local/noaa-la-land.geojson', route => route.fulfill({ json: land }))
  await page.goto('/?study=noaa-la-2025')
  const map = page.locator('canvas[role="img"]')
  await expect(map).toHaveAttribute('data-renderer', 'webgl2')
  // Read in the draw task, before the browser discards the drawing buffer.
  await page.evaluate(() => {
    const map = document.querySelector('canvas[role="img"]')!
    const canvas = document.querySelector<HTMLCanvasElement>('.fleet-canvas')!
    const gl = canvas.getContext('webgl2')!
    new MutationObserver(() => {
      const pixels = new Uint8Array(canvas.width * canvas.height * 4)
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      let count = 0
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 30) count++
      canvas.dataset.litPixels = String(count)
      canvas.dataset.glError = String(gl.getError())
    }).observe(map, { attributes: true, attributeFilter: ['data-frame'] })
  })
  await page.getByLabel('Study time', { exact: true }).fill('43320')
  await expect.poll(() => page.locator('.fleet-canvas').getAttribute('data-lit-pixels').then(Number)).toBeGreaterThan(8)
  await expect(page.locator('.fleet-canvas')).toHaveAttribute('data-gl-error', '0')
  await expect(page.locator('.fleet-canvas')).toHaveAttribute('data-geometry-uploads', '1')
  // The marker at this instant is just right of the opening camera's centre.
  const box = (await map.boundingBox())!
  const scale = Math.max(box.width / 360, box.height / 130) * 85
  await map.click({ position: { x: box.width / 2 + .007 * scale, y: box.height / 2 } })
  await expect(page.getByLabel('Inspect an observed vessel')).toHaveValue('test-cargo')
  await page.getByLabel('Study time', { exact: true }).fill('60000')
  await expect(page.locator('.fleet-canvas')).toHaveAttribute('data-lit-pixels', '0')
  await expect(map).toHaveAttribute('data-drawn', '0')
  await page.getByLabel('Study time', { exact: true }).fill('86460')
  await expect.poll(() => page.locator('.fleet-canvas').getAttribute('data-lit-pixels').then(Number)).toBeGreaterThan(8)
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('.fleet-canvas')!
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    // Extensions cannot be requested while the context is lost.
    Object.assign(canvas, { restoreTestContext: () => extension.restoreContext() })
    extension.loseContext()
  })
  await expect(map).toHaveAttribute('data-renderer', 'canvas2d')
  await expect(map).toHaveAttribute('data-drawn', '1')
  await expect(page.getByLabel('Rendering performance')).toContainText('Canvas fallback')
  await page.evaluate(() => {
    document.querySelector<HTMLCanvasElement & { restoreTestContext: () => void }>('.fleet-canvas')!.restoreTestContext()
  })
  await expect(map).toHaveAttribute('data-renderer', 'webgl2')
  await expect.poll(() => page.locator('.fleet-canvas').getAttribute('data-lit-pixels').then(Number)).toBeGreaterThan(8)
  await expect(page.locator('.fleet-canvas')).toHaveAttribute('data-gl-error', '0')
})
