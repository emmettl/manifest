import { expect, test } from '@playwright/test'

test('the production site stays synthetic even with the local review query', async ({ page, request }) => {
  await page.goto('/?study=noaa-la-2025')
  await expect(page.locator('.demo-badge')).toHaveText('SYNTHETIC STUDY')
  await expect(page.getByLabel('Inspect a demo vessel')).toBeVisible()
  const response = await request.get('/__local/noaa-la-2025.json')
  expect(response.headers()['content-type'] ?? '').not.toContain('application/json')
})

test('PortWatch stays a local review and is excluded from the production site', async ({ page, request }) => {
  await page.goto('/?study=portwatch')
  await expect(page.locator('.demo-badge')).toHaveText('SYNTHETIC STUDY')
  const response = await request.get('/__local/portwatch-study.json')
  expect(response.headers()['content-type'] ?? '').not.toContain('application/json')
})
