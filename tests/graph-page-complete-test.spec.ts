import { test, expect } from '@playwright/test'

test.describe('Knowledge Graph Page Complete UI Test', () => {
  test('should load Knowledge Graph page and show appropriate state', async ({ page }) => {
    // Set longer timeout for page load
    test.setTimeout(90000)

    // Listen for console errors (JavaScript chunk errors)
    const consoleErrors: string[] = []
    const networkErrors: string[] = []

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

    // Track failed requests
    page.on('requestfailed', request => {
      networkErrors.push(`${request.url()} - ${request.failure()?.errorText}`)
    })

    // Navigate to the Knowledge Graph page
    console.log('Navigating to Knowledge Graph page...')
    const response = await page.goto('http://localhost:3000/studio/graph', {
      waitUntil: 'networkidle',
      timeout: 45000
    })

    // Check response status
    expect(response?.status()).toBeLessThan(400)
    console.log('Page loaded with status:', response?.status())

    // Wait for loading to complete - wait until loading text disappears or timeout
    console.log('Waiting for page to settle...')
    try {
      await page.waitForSelector('text=Loading knowledge graph', { state: 'hidden', timeout: 15000 })
      console.log('Loading spinner disappeared')
    } catch {
      console.log('Loading spinner did not disappear within timeout, checking current state...')
    }

    // Wait a bit more for any animations
    await page.waitForTimeout(2000)

    // Take screenshot of current state
    await page.screenshot({
      path: 'C:/Users/taskm/OneDrive/Documents/contentkingdom/test-screenshots/graph-page-complete.png',
      fullPage: true
    })

    // === CHECK 1: No JavaScript chunk errors ===
    const hasChunkError = consoleErrors.some(e =>
      e.includes('ChunkLoadError') ||
      e.includes('Loading chunk') ||
      e.includes('chunk failed')
    )
    console.log('\n=== Console Errors ===')
    consoleErrors.forEach(e => console.log('  -', e))
    console.log('JavaScript chunk errors:', hasChunkError ? 'FOUND' : 'NONE')
    expect(hasChunkError).toBe(false)

    // === CHECK 2: Header renders properly ===
    console.log('\n=== UI Element Checks ===')

    const header = page.locator('h1:has-text("KNOWLEDGE GRAPH")')
    const headerVisible = await header.isVisible()
    console.log('Header "KNOWLEDGE GRAPH" visible:', headerVisible)
    expect(headerVisible).toBe(true)

    // Description text
    const description = page.locator('text=Explore entity relationships and connections')
    const descVisible = await description.isVisible()
    console.log('Description text visible:', descVisible)

    // Yellow icon container
    const yellowIcon = page.locator('.bg-yellow-400')
    const iconVisible = await yellowIcon.isVisible()
    console.log('Yellow icon container visible:', iconVisible)

    // === CHECK 3: Search and filter controls ===
    const searchInput = page.locator('input[placeholder*="Search"]')
    const searchVisible = await searchInput.isVisible().catch(() => false)
    console.log('Search input visible:', searchVisible)

    // Filter buttons
    const allButton = page.locator('button:has-text("All")').first()
    const allButtonVisible = await allButton.isVisible().catch(() => false)
    console.log('All filter button visible:', allButtonVisible)

    const peopleButton = page.locator('button:has-text("People")')
    const peopleVisible = await peopleButton.isVisible().catch(() => false)
    console.log('People filter button visible:', peopleVisible)

    const leaguesButton = page.locator('button:has-text("Leagues")')
    const leaguesVisible = await leaguesButton.isVisible().catch(() => false)
    console.log('Leagues filter button visible:', leaguesVisible)

    const orgsButton = page.locator('button:has-text("Orgs")')
    const orgsVisible = await orgsButton.isVisible().catch(() => false)
    console.log('Orgs filter button visible:', orgsVisible)

    // === CHECK 4: Appropriate state message ===
    // When Memgraph is not running, we expect one of these states:
    // - "No entities in the graph yet" (no data)
    // - Error message (connection failed)
    // - Loading state (still trying)
    // - Graph with data (if somehow data exists)

    const noDataText = page.locator('text=No entities in the graph yet')
    const noDataVisible = await noDataText.isVisible().catch(() => false)
    console.log('"No entities" message visible:', noDataVisible)

    const errorText = page.locator('.text-red-400')
    const errorVisible = await errorText.isVisible().catch(() => false)
    let errorContent = ''
    if (errorVisible) {
      errorContent = await errorText.textContent() || ''
    }
    console.log('Error message visible:', errorVisible)
    console.log('Error content:', errorContent)

    const loadingText = page.locator('text=Loading')
    const stillLoading = await loadingText.isVisible().catch(() => false)
    console.log('Still loading:', stillLoading)

    const syncButton = page.locator('button:has-text("Sync Entities")')
    const syncVisible = await syncButton.isVisible().catch(() => false)
    console.log('Sync Entities button visible:', syncVisible)

    const retryButton = page.locator('button:has-text("Retry")')
    const retryVisible = await retryButton.isVisible().catch(() => false)
    console.log('Retry button visible:', retryVisible)

    // === CHECK 5: Sidebar renders ===
    const sidebar = page.locator('.w-80.border-l-2')
    const sidebarVisible = await sidebar.isVisible().catch(() => false)
    console.log('Sidebar visible:', sidebarVisible)

    // Graph Statistics heading (shown in sidebar when stats available)
    const statsHeading = page.locator('text=Graph Statistics')
    const statsVisible = await statsHeading.isVisible().catch(() => false)
    console.log('Graph Statistics heading visible:', statsVisible)

    // === CHECK 6: Styling looks correct ===
    // Check that the brutalist design elements are present
    const brutalistBorder = page.locator('.border-2.border-black').first()
    const hasBrutalistStyle = await brutalistBorder.isVisible().catch(() => false)
    console.log('Brutalist border styling present:', hasBrutalistStyle)

    // Dark background
    const darkBg = page.locator('.bg-zinc-950, .bg-zinc-900').first()
    const hasDarkBg = await darkBg.isVisible().catch(() => false)
    console.log('Dark background styling present:', hasDarkBg)

    // === SUMMARY ===
    console.log('\n=== TEST SUMMARY ===')
    console.log('1. Page loads without JavaScript chunk errors: PASS')
    console.log('2. Header renders properly:', headerVisible ? 'PASS' : 'FAIL')
    console.log('3. Search/filter controls render:', searchVisible && allButtonVisible ? 'PASS' : 'PARTIAL')
    console.log('4. Shows appropriate state:', (noDataVisible || errorVisible || retryVisible || syncVisible) ? 'PASS' : stillLoading ? 'STILL LOADING' : 'CHECK')
    console.log('5. Sidebar renders:', sidebarVisible ? 'PASS' : 'FAIL')
    console.log('6. Styling looks correct:', (hasBrutalistStyle || hasDarkBg) ? 'PASS' : 'PARTIAL')

    // Network errors report
    if (networkErrors.length > 0) {
      console.log('\n=== Network Errors ===')
      networkErrors.forEach(e => console.log('  -', e))
    }

    // The test passes if:
    // 1. No JS chunk errors
    // 2. Header is visible
    // Both are already asserted above
  })
})
