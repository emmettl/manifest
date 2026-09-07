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
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeDisabled()
})

test('local data cannot be read through Vite static paths or cross-origin requests', async ({ request }) => {
  for (const path of ['/data/raw/noaa-2025/normalized.json', '/data/compiled/noaa-la-2025.json']) {
    const response = await request.get(path)
    expect(response.status()).toBe(403)
  }
  const response = await request.get('/__local/noaa-la-2025.json', { headers: { Origin: 'https://example.com' } })
  expect(response.status()).toBe(403)
})
