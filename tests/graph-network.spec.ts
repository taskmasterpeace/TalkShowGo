import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3009' })

test('Check network requests on graph page', async ({ page }) => {
  // Collect failed network requests
  const failedRequests: string[] = []

  page.on('response', response => {
    if (response.status() >= 400) {
      failedRequests.push(`[${response.status()}] ${response.url()}`)
    }
  })

  page.on('requestfailed', request => {
    failedRequests.push(`[FAILED] ${request.url()} - ${request.failure()?.errorText}`)
  })

  // Navigate and wait
  await page.goto('/studio/graph', { waitUntil: 'networkidle' })
  await page.waitForTimeout(5000)

  // Log failed requests
  console.log('\n=== FAILED NETWORK REQUESTS ===')
  failedRequests.forEach(r => console.log(r))

  // Take screenshot
  await page.screenshot({
    path: 'test-screenshots/graph-network.png',
    fullPage: true
  })
})
