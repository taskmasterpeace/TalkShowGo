import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3009' })

test('Debug graph page errors', async ({ page }) => {
  // Collect console messages
  const consoleMessages: string[] = []
  const consoleErrors: string[] = []

  page.on('console', msg => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`)
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })

  // Collect page errors
  const pageErrors: string[] = []
  page.on('pageerror', err => {
    pageErrors.push(err.message)
  })

  // Navigate and wait
  await page.goto('/studio/graph', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(10000)

  // Take screenshot
  await page.screenshot({
    path: 'test-screenshots/graph-debug.png',
    fullPage: true
  })

  // Log all errors
  console.log('\n=== CONSOLE ERRORS ===')
  consoleErrors.forEach(e => console.log(e))

  console.log('\n=== PAGE ERRORS ===')
  pageErrors.forEach(e => console.log(e))

  console.log('\n=== ALL CONSOLE MESSAGES ===')
  consoleMessages.forEach(m => console.log(m))

  // Check for error overlay
  const errorOverlay = page.locator('[data-nextjs-dialog]')
  if (await errorOverlay.isVisible().catch(() => false)) {
    const errorText = await errorOverlay.textContent()
    console.log('\n=== NEXTJS ERROR OVERLAY ===')
    console.log(errorText)
  }
})
