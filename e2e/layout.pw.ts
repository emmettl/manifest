import { expect, test } from '@playwright/test'
import catalogue from '../public/data/ports.json' with { type: 'json' }

test('ports are labelled in the opening view and remain legible when zooming', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  for (const port of catalogue) await expect(page.locator(`[data-port-id="${port.id}"] text`)).toHaveText(port.name.toUpperCase())
  const boxes = await page.locator('[data-port-id] rect').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()))
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j]
    expect(a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top).toBe(false)
  }
  await page.getByRole('button', { name: '01China', exact: true }).click()
  await expect(page.locator('[data-port-id="shanghai"] text')).toBeVisible()
  await expect(page.locator('[data-port-id="yantian"] text')).toBeVisible()
})

for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }, { width: 3840, height: 2160 }, { width: 1920, height: 1600 }]) {
  test(`world opening uses the screen at ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
    // Sample actual rendered land near the top: the photographed failure left this area empty.
    await expect.poll(() => canvas.evaluate(element => {
      const context = element.getContext('2d')!
      const { data } = context.getImageData(0, 0, element.width, Math.max(1, Math.floor(element.height * .2)))
      let land = 0, samples = 0
      for (let offset = 0; offset < data.length; offset += 4 * 16) {
        samples++
        if (data[offset] === 20 && data[offset + 1] === 35 && data[offset + 2] === 41) land++
      }
      return land / samples
    })).toBeGreaterThan(.01)
    const bounds = await canvas.boundingBox()
    expect(bounds!.width).toBeCloseTo(viewport.width, 0)
    expect(bounds!.height).toBeGreaterThanOrEqual(360)
    const footer = await page.locator('.playback').boundingBox()
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height + 1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width)
  })
}

test('high-density canvas stays inside its container through playback and resizing', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Play playback', exact: true }).click()
  for (const viewport of [{ width: 3840, height: 2160 }, { width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport)
    await expect.poll(() => page.locator('canvas').evaluate(canvas => {
      const bounds = canvas.getBoundingClientRect()
      const parent = canvas.parentElement!.getBoundingClientRect()
      return Math.abs(canvas.width - Math.round(bounds.width * 2)) + Math.abs(canvas.height - Math.round(bounds.height * 2)) + Math.abs(bounds.height - parent.height)
    })).toBeLessThan(1)
    const footer = await page.locator('.playback').boundingBox()
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(viewport.height + 1)
  }
  await context.close()
})
