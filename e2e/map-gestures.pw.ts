import { expect, test } from '@playwright/test'

test('ordinary mouse wheel zooms the map in and out without scrolling the page', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  const canvas = page.locator('canvas[role="img"]')
  const zoomOut = page.getByRole('button', { name: 'Zoom out', exact: true })
  await expect(canvas).toBeVisible()
  await expect(zoomOut).toBeDisabled()
  await canvas.hover()
  const scrollY = await page.evaluate(() => window.scrollY)
  await page.mouse.wheel(0, -100)
  await expect(zoomOut).toBeEnabled()
  await page.mouse.wheel(0, 200)
  await expect(zoomOut).toBeDisabled()
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollY)
})
