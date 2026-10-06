import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3009' })

test('Take graph page screenshot', async ({ page }) => {
  // Set longer timeout
  test.setTimeout(60000)

  // Navigate to graph page
  await page.goto('/studio/graph', { waitUntil: 'networkidle' })

  // Wait for page to settle
  await page.waitForTimeout(5000)

  // Take screenshot
  await page.screenshot({
    path: 'test-screenshots/graph-page-current-state.png',
    fullPage: true
  })

  // Log page content for debugging
  const html = await page.content()
  console.log('Page contains sigma-container:', html.includes('sigma'))
  console.log('Page contains error:', html.includes('Error') || html.includes('error'))

  // Check for any visible error messages
  const errorMessages = await page.locator('.text-red-400, .text-red-500, [class*="error"]').allTextContents()
  console.log('Error messages found:', errorMessages)

  // Check what's visible on the page
  const visibleTexts = await page.locator('h1, h2, h3, p').allTextContents()
  console.log('Visible texts:', visibleTexts.slice(0, 10))
})
