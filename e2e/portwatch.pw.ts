import { expect, test } from '@playwright/test'
import { daysBetween } from '../scripts/portwatch-core.mjs'

// Invented contract fixture; tests never require provider acquisition or credentials.
const dates = daysBetween('2023-11-01', '2024-03-31')
const fixture = {
  schemaVersion: 1, kind: 'portwatch-activity', start: dates[0], end: dates.at(-1), dates,
  source: { id: 'imf-portwatch', evidence: 'ais-derived-aggregate', attribution: 'Invented test fixture', capturedUtc: '2026-09-17T12:00:00Z' },
  baseline: { start: '2023-11-01', end: '2023-11-30', days: 30 },
  audit: { availableDays: 607, expectedDays: 608, missingDays: ['chokepoint1/2024-02-01'] },
  locations: [
    ...['Suez Canal', 'Bab el-Mandeb Strait', 'Cape of Good Hope'].map((name, i) => ({
      id: ['chokepoint1', 'chokepoint4', 'chokepoint7'][i], name, kind: 'chokepoint', country: null, position: [[32, 30], [43, 12], [20, -34]][i],
      days: dates.map(date => i === 0 && date === '2024-02-01' ? null : ({ calls: [40, 20, 10, 5, 2, 3], transit: [40000, 20000, 10000, 5000, 2000, 3000] })),
    })),
    { id: 'port1201', name: 'Singapore', kind: 'port', country: 'Singapore', position: [103, 1], days: dates.map(() => ({ calls: [80, 40, 20, 10, 4, 6], imports: [80000, 40000, 20000, 10000, 4000, 6000], exports: [160000, 80000, 40000, 20000, 8000, 12000] })) },
  ],
}
for (const width of [1366, 390]) {
  test(`PortWatch dates, filters, evidence and missing data at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
    await page.route('**/__local/portwatch-study.json', route => route.fulfill({ json: fixture }))
    await page.goto('/?study=portwatch')
    await expect(page.getByTestId('pw-daily')).toHaveText('40')
    await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeVisible()
    await page.getByLabel('Vessel category').selectOption('1')
    await expect(page.getByTestId('pw-daily')).toHaveText('20')
    await page.getByLabel('Study date', { exact: true }).fill(String(dates.indexOf('2024-02-01')))
    await expect(page.getByTestId('pw-daily')).toHaveText('—')
    await expect(page.getByText('No data for transits', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '02 Ports', exact: true }).click()
    await page.getByLabel('Activity measure').selectOption('imports')
    await expect(page.getByTestId('pw-daily')).toHaveText('40,000')
    await page.getByRole('button', { name: /About the data/ }).click()
    await expect(page.getByRole('dialog')).toContainText('Missing values remain missing')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).not.toBeVisible()
    await page.getByLabel('Study date', { exact: true }).fill('150')
    await page.getByRole('button', { name: 'Play playback', exact: true }).click()
    await expect(page.getByLabel('Study date', { exact: true })).toHaveValue('151')
    await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(errors).toEqual([])
  })
}
test('PortWatch load failure can be retried', async ({ page }) => {
  let failed = true
  await page.route('**/__local/portwatch-study.json', route => failed ? route.fulfill({ status: 404 }) : route.fulfill({ json: fixture }))
  await page.goto('/?study=portwatch')
  await expect(page.getByRole('alert')).toContainText('unavailable')
  failed = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByTestId('pw-daily')).toHaveText('40')
})
