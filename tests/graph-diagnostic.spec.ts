import { test, expect } from '@playwright/test'

test.use({ baseURL: 'http://localhost:3000' })

test('Knowledge Graph diagnostic test', async ({ page }) => {
  // Collect all console and network info
  const consoleMessages: { type: string; text: string }[] = []
  const networkRequests: { url: string; status: number; failed: boolean }[] = []

  page.on('console', msg => {
    consoleMessages.push({ type: msg.type(), text: msg.text() })
  })

  page.on('requestfailed', request => {
    networkRequests.push({
      url: request.url(),
      status: 0,
      failed: true
    })
  })

  page.on('response', response => {
    networkRequests.push({
      url: response.url(),
      status: response.status(),
      failed: response.status() >= 400
    })
  })

  // Navigate to graph page
  console.log('Navigating to /studio/graph...')
  await page.goto('/studio/graph', { waitUntil: 'networkidle' })

  // Wait for the page to settle
  await page.waitForTimeout(5000)

  // Take a screenshot
  await page.screenshot({
    path: 'test-screenshots/graph-diagnostic-1.png',
    fullPage: true
  })

  // Log network errors
  console.log('\n=== Network Requests with Errors ===')
  const failedRequests = networkRequests.filter(r => r.failed)
  failedRequests.forEach(r => {
    console.log(`  [${r.status}] ${r.url}`)
  })

  // Log all console errors
  console.log('\n=== Console Errors ===')
  const consoleErrors = consoleMessages.filter(m => m.type === 'error')
  consoleErrors.forEach(m => {
    console.log(`  ${m.text}`)
  })

  // Check what elements are on the page
  console.log('\n=== Page Structure ===')

  // Check for KNOWLEDGE GRAPH heading
  const heading = page.locator('h1')
  const headingText = await heading.textContent().catch(() => 'NOT FOUND')
  console.log('H1 text:', headingText)

  // Check for loading indicator
  const loadingText = page.locator('text=Loading')
  const isLoading = await loadingText.isVisible().catch(() => false)
  console.log('Loading indicator visible:', isLoading)

  // Check for error messages
  const errorText = page.locator('text=error')
  const hasError = await errorText.first().isVisible().catch(() => false)
  console.log('Error message visible:', hasError)

  // Check for sigma container
  const sigmaContainer = page.locator('.sigma-container')
  const hasSigma = await sigmaContainer.isVisible().catch(() => false)
  console.log('Sigma container visible:', hasSigma)

  // Check for graph canvas
  const canvas = page.locator('canvas')
  const canvasCount = await canvas.count()
  console.log('Canvas elements found:', canvasCount)

  // Check for controls (filter buttons)
  const allButton = page.locator('button:has-text("All")')
  const hasAllButton = await allButton.isVisible().catch(() => false)
  console.log('All filter button visible:', hasAllButton)

  // Check for search input
  const searchInput = page.locator('input[placeholder*="Search"]')
  const hasSearch = await searchInput.isVisible().catch(() => false)
  console.log('Search input visible:', hasSearch)

  // Check for legend
  const legend = page.locator('text=Relationship Types')
  const hasLegend = await legend.isVisible().catch(() => false)
  console.log('Legend visible:', hasLegend)

  // Check for stats in sidebar
  const statsTitle = page.locator('text=Graph Statistics')
  const hasStats = await statsTitle.isVisible().catch(() => false)
  console.log('Graph Statistics visible:', hasStats)

  // Check the body classes (to see if Tailwind loaded)
  const body = page.locator('body')
  const bodyClasses = await body.getAttribute('class')
  console.log('Body classes:', bodyClasses)

  // Check if CSS is styled (look for styled elements)
  const yellowIcon = page.locator('.bg-yellow-400')
  const hasYellowIcon = await yellowIcon.first().isVisible().catch(() => false)
  console.log('Yellow icon (styled) visible:', hasYellowIcon)

  // Wait a bit more and check again
  await page.waitForTimeout(5000)

  await page.screenshot({
    path: 'test-screenshots/graph-diagnostic-2.png',
    fullPage: true
  })

  // Check sigma again after wait
  const hasSigma2 = await sigmaContainer.isVisible().catch(() => false)
  console.log('Sigma container visible (after wait):', hasSigma2)

  // Get page HTML for debugging
  const html = await page.content()
  const hasSignaLib = html.includes('sigma')
  console.log('Page contains sigma reference:', hasSignaLib)

  // Get the count of nodes/edges from the API response visible in stats overlay
  const statsOverlay = page.locator('.absolute.top-4.right-4')
  const statsVisible = await statsOverlay.isVisible().catch(() => false)
  if (statsVisible) {
    const statsContent = await statsOverlay.textContent()
    console.log('Stats overlay content:', statsContent)
  }
})
