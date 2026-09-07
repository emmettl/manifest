import { expect, test } from '@playwright/test'
import catalogue from '../public/data/ports.json' with { type: 'json' }

test('ports are labelled in the opening view and remain legible when zooming', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.goto('/')
  for (const port of catalogue) await expect(page.locator(`[data-port-id="${port.id}"] title`)).toHaveText(port.name)
  for (const port of catalogue.filter(port => port.demoEndpoint)) await expect(page.locator(`[data-port-id="${port.id}"] text`)).toBeVisible()
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

for (const viewport of [{ width: 390, height: 844 }, { width: 1920, height: 1080 }]) {
  test(`finds all ports and focuses alternate names at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/')
    const toggle = page.getByRole('button', { name: `Ports · ${catalogue.length}` })
    await toggle.click()
    await expect(page.locator('#port-directory li')).toHaveCount(catalogue.length)
    const search = page.getByRole('searchbox', { name: 'Find a port' })
    await search.fill('Shenzhen')
    await page.locator('#port-directory li button').click()
    await expect(toggle).toBeFocused()
    await expect(page.locator('[data-port-id="yantian"][data-selected=true] text')).toBeVisible()
    await toggle.click()
    await search.fill('Cai Mep')
    await page.locator('#port-directory li button').click()
    await expect(page.locator('[data-port-id="cai-mep"][data-selected=true] text')).toBeVisible()
    const marker = await page.locator('[data-port-id="cai-mep"] circle').boundingBox()
    const canvas = await page.locator('canvas').boundingBox()
    expect(marker!.x + marker!.width / 2).toBeCloseTo(canvas!.x + canvas!.width / 2, 0)
    expect(marker!.y + marker!.height / 2).toBeCloseTo(canvas!.y + canvas!.height / 2, 0)
    await toggle.click()
    const panel = await page.locator('#port-directory').boundingBox()
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(canvas!.y + canvas!.height)
    await search.fill('no such port')
    await expect(page.getByRole('status')).toHaveText('No matching ports.')
    await search.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeFocused()
  })
}
