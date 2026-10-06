import { test, expect } from '@playwright/test'

test.describe('Knowledge Graph Page UI Test', () => {
  test('should load Knowledge Graph page without JavaScript chunk errors', async ({ page }) => {
    // Set longer timeout for page load
    test.setTimeout(60000)

    // Listen for console errors (JavaScript chunk errors)
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Listen for page errors
    const pageErrors: string[] = []
    page.on('pageerror', error => {
      pageErrors.push(error.message)
    })

    // Navigate to the Knowledge Graph page
    const response = await page.goto('http://localhost:3000/studio/graph', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    })

    // Check response status
    expect(response?.status()).toBeLessThan(400)

    // Wait for the page to settle
    await page.waitForTimeout(3000)

    // Take initial screenshot
    await page.screenshot({
      path: 'C:/Users/taskm/OneDrive/Documents/contentkingdom/test-screenshots/graph-page-ui-test.png',
      fullPage: true
    })

    // 1. Verify page loads without JavaScript chunk errors
    const hasChunkError = consoleErrors.some(e =>
      e.includes('ChunkLoadError') ||
      e.includes('Loading chunk') ||
      e.includes('chunk failed')
    )
    console.log('Console errors:', consoleErrors)
    console.log('Page errors:', pageErrors)

    // 2. Check that the header renders
    const header = page.locator('h1:has-text("KNOWLEDGE GRAPH")')
    await expect(header).toBeVisible({ timeout: 10000 })

    // 3. Check the header description
    const description = page.locator('text=Explore entity relationships and connections')
    await expect(description).toBeVisible({ timeout: 5000 })

    // 4. Check for the network icon in header
    const networkIcon = page.locator('.bg-yellow-400')
    await expect(networkIcon).toBeVisible({ timeout: 5000 })

    // 5. Check for the search input
    const searchInput = page.locator('input[placeholder*="Search"]')
    const searchVisible = await searchInput.isVisible().catch(() => false)
    console.log('Search input visible:', searchVisible)

    // 6. Check for filter buttons (All, People, Leagues, Orgs)
    const allFilterButton = page.locator('button:has-text("All")')
    const allFilterVisible = await allFilterButton.isVisible().catch(() => false)
    console.log('All filter button visible:', allFilterVisible)

    // 7. Check for "no data" message or graph content
    const noDataMessage = page.locator('text=No entities in the graph yet')
    const errorMessage = page.locator('.text-red-400')
    const loadingMessage = page.locator('text=Loading')
    const syncButton = page.locator('button:has-text("Sync Entities")')

    const noData = await noDataMessage.isVisible().catch(() => false)
    const hasError = await errorMessage.isVisible().catch(() => false)
    const isLoading = await loadingMessage.isVisible().catch(() => false)
    const hasSyncButton = await syncButton.isVisible().catch(() => false)

    console.log('No data message visible:', noData)
    console.log('Error message visible:', hasError)
    console.log('Loading visible:', isLoading)
    console.log('Sync button visible:', hasSyncButton)

    // Get error message text if visible
    if (hasError) {
      const errorText = await errorMessage.textContent()
      console.log('Error message text:', errorText)
    }

    // 8. Check sidebar renders
    const sidebar = page.locator('.w-80.border-l-2')
    const sidebarVisible = await sidebar.isVisible().catch(() => false)
    console.log('Sidebar visible:', sidebarVisible)

    // Take final screenshot after all checks
    await page.screenshot({
      path: 'C:/Users/taskm/OneDrive/Documents/contentkingdom/test-screenshots/graph-page-final-state.png',
      fullPage: true
    })

    // Report findings
    console.log('\n=== UI Test Results ===')
    console.log('Page loaded successfully: true')
    console.log('JavaScript chunk errors:', hasChunkError ? 'YES' : 'NO')
    console.log('Header visible: true')
    console.log('Shows appropriate state for no Memgraph:', noData || hasError || hasSyncButton)

    // Test passes if header is visible (page loaded) and no chunk errors
    expect(hasChunkError).toBe(false)
  })
})
