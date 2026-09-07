import { expect, test } from '@playwright/test'

test('opens one day, seeks directly, reuses prefetch and bounds the working set', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (/\/demo\/day-\d+/.test(request.url())) requests.push(request.url()) })
  await page.goto('/')
  const meter = page.getByLabel('Data delivery')
  await expect(meter).toHaveAttribute('data-state', 'ready')
  await expect(meter).toHaveAttribute('data-cached', '1')
  expect(requests).toHaveLength(1)
  expect(requests[0]).toContain('/day-10-')
  await page.getByRole('button', { name: 'Play playback', exact: true }).click()
  await expect(meter).toHaveAttribute('data-cached', '2')
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click()
  const prefetched = requests.filter(url => url.includes('/day-11-')).length
  await page.getByLabel('Study time', { exact: true }).fill(String(11 * 86400))
  await expect(meter).toHaveAttribute('data-chunk', '11')
  await expect(meter).toHaveAttribute('data-state', 'ready')
  expect(requests.filter(url => url.includes('/day-11-'))).toHaveLength(prefetched)
  for (const day of [25, 2, 29, 0]) {
    await page.getByLabel('Study time', { exact: true }).fill(String(day * 86400))
    await expect(meter).toHaveAttribute('data-chunk', String(day))
    await expect(meter).toHaveAttribute('data-state', 'ready')
    expect(Number(await meter.getAttribute('data-cached'))).toBeLessThanOrEqual(2)
    expect(Number(await meter.getAttribute('data-decoded-bytes'))).toBeLessThan(16 * 1024 * 1024)
  }
  expect(requests).toHaveLength(6)
  await expect(page.locator('.field-count small')).toHaveText('60,000 vessels in the full study')
})

test('failed chunks are distinct from absent ships and retry without reloading the catalogue', async ({ page }) => {
  let catalogues = 0, attempts = 0
  page.on('request', request => { if (request.url().includes('/demo/vessels-')) catalogues++ })
  await page.route('**/demo/day-20-*.json', async route => {
    attempts++
    if (attempts === 1) await route.fulfill({ status: 503, body: 'Temporarily unavailable' })
    else await route.continue()
  })
  await page.goto('/')
  await expect(page.getByLabel('Data delivery')).toHaveAttribute('data-state', 'ready')
  await page.getByLabel('Study time', { exact: true }).fill(String(20 * 86400))
  await expect(page.getByRole('status')).toContainText('could not be loaded')
  await expect(page.locator('.field-count')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retry this day' }).click()
  await expect(page.getByLabel('Data delivery')).toHaveAttribute('data-state', 'ready')
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(catalogues).toBe(1)
  expect(attempts).toBe(2)
  expect(Number((await page.locator('.field-count strong').innerText()).replaceAll(',', ''))).toBeGreaterThan(20_000)
})

test('rapid scrubbing cannot display a late response from an obsolete day', async ({ page }) => {
  let release!: () => void
  let entered!: () => void
  const started = new Promise<void>(resolve => { entered = resolve })
  const held = new Promise<void>(resolve => { release = resolve })
  await page.route('**/demo/day-15-*.json', async route => {
    entered()
    await held
    try { await route.continue() } catch { /* cancellation of the obsolete request is expected */ }
  })
  await page.goto('/')
  const meter = page.getByLabel('Data delivery')
  await expect(meter).toHaveAttribute('data-state', 'ready')
  await page.getByLabel('Study time', { exact: true }).fill(String(15 * 86400))
  await started
  await expect(page.getByRole('status')).toContainText('Loading movement')
  await page.getByLabel('Study time', { exact: true }).fill(String(3 * 86400))
  await expect(meter).toHaveAttribute('data-chunk', '3')
  await expect(meter).toHaveAttribute('data-state', 'ready')
  release()
  await page.getByRole('button', { name: 'Cargo', exact: true }).click()
  await expect(meter).toHaveAttribute('data-chunk', '3')
  await expect(page.locator('.clock')).toContainText('DAY 04')
})
