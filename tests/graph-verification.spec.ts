import { test, expect, Page } from '@playwright/test'

// Test on port 3000 (default dev server)
test.use({ baseURL: 'http://localhost:3000' })

test.describe('Knowledge Graph Explorer - Full Verification', () => {
  // Collect console errors across all tests
  let consoleErrors: string[] = []
  let pageErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    pageErrors = []

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err.message)
    })

    // Navigate to the Knowledge Graph page
    await page.goto('/studio/graph', { waitUntil: 'domcontentloaded' })
  })

  test('1. Page loads correctly without JavaScript errors', async ({ page }) => {
    // Wait for page to settle
    await page.waitForTimeout(3000)

    // Check for KNOWLEDGE GRAPH heading
    const heading = page.locator('h1:has-text("KNOWLEDGE GRAPH")')
    await expect(heading).toBeVisible({ timeout: 10000 })

    // Check subtitle
    await expect(page.locator('text=Explore entity relationships')).toBeVisible()

    // Check for Next.js error overlay (indicates React errors)
    const errorOverlay = page.locator('[data-nextjs-dialog]')
    const hasErrorOverlay = await errorOverlay.isVisible().catch(() => false)

    // Take screenshot
    await page.screenshot({
      path: 'test-screenshots/graph-v1-page-load.png',
      fullPage: true
    })

    // Report results
    console.log('\n=== TEST 1: Page Load ===')
    console.log('Heading visible: YES')
    console.log('Subtitle visible: YES')
    console.log('Console errors:', consoleErrors.length)
    consoleErrors.forEach(e => console.log('  - ' + e))
    console.log('Page errors:', pageErrors.length)
    pageErrors.forEach(e => console.log('  - ' + e))
    console.log('Error overlay visible:', hasErrorOverlay)

    // Assert no critical errors
    expect(hasErrorOverlay).toBe(false)
  })

  test('2. Graph visualization renders with nodes visible', async ({ page }) => {
    // Wait for sigma container to appear
    const sigmaContainer = page.locator('.sigma-container')
    await expect(sigmaContainer).toBeVisible({ timeout: 30000 })

    // Wait for graph to render
    await page.waitForTimeout(3000)

    // Check that canvas elements exist (sigma renders to canvas)
    const canvases = page.locator('.sigma-container canvas')
    const canvasCount = await canvases.count()
    console.log('\n=== TEST 2: Graph Visualization ===')
    console.log('Sigma container visible: YES')
    console.log('Canvas elements found:', canvasCount)

    // Take screenshot
    await page.screenshot({
      path: 'test-screenshots/graph-v2-visualization.png',
      fullPage: true
    })

    expect(canvasCount).toBeGreaterThan(0)
  })

  test('3. Stats show entities and relationships count', async ({ page }) => {
    // Wait for stats to load in header
    await page.waitForTimeout(2000)

    // Check header stats (shows X entities, Y relationships)
    const entitiesText = page.locator('text=entities').first()
    const relationshipsText = page.locator('text=relationships').first()

    await expect(entitiesText).toBeVisible({ timeout: 10000 })
    await expect(relationshipsText).toBeVisible({ timeout: 10000 })

    // Get the actual counts from the page
    // Stats are in format: <span class="font-mono">71</span> entities
    const headerStats = page.locator('.flex.items-center.gap-4.text-sm')
    const statsText = await headerStats.textContent()

    console.log('\n=== TEST 3: Stats Display ===')
    console.log('Stats text:', statsText)

    // Also check the graph overlay stats
    const overlayStats = page.locator('.absolute.top-4.right-4')
    if (await overlayStats.isVisible().catch(() => false)) {
      const overlayText = await overlayStats.textContent()
      console.log('Overlay stats:', overlayText)
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-screenshots/graph-v3-stats.png',
      fullPage: true
    })
  })

  test('4. Node click shows entity details in sidebar', async ({ page }) => {
    // Wait for graph to fully load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(3000)

    // Get the canvas to click on
    const canvas = page.locator('.sigma-container canvas').first()
    await expect(canvas).toBeVisible()

    const box = await canvas.boundingBox()
    if (!box) {
      throw new Error('Canvas bounding box not found')
    }

    // Try clicking at multiple positions to find a node
    const clickPositions = [
      { x: box.x + box.width * 0.5, y: box.y + box.height * 0.5 },   // Center
      { x: box.x + box.width * 0.35, y: box.y + box.height * 0.35 }, // Upper left
      { x: box.x + box.width * 0.65, y: box.y + box.height * 0.35 }, // Upper right
      { x: box.x + box.width * 0.35, y: box.y + box.height * 0.65 }, // Lower left
      { x: box.x + box.width * 0.65, y: box.y + box.height * 0.65 }, // Lower right
      { x: box.x + box.width * 0.25, y: box.y + box.height * 0.5 },  // Mid left
      { x: box.x + box.width * 0.75, y: box.y + box.height * 0.5 },  // Mid right
    ]

    let nodeSelected = false

    for (const pos of clickPositions) {
      await page.mouse.click(pos.x, pos.y)
      await page.waitForTimeout(500)

      // Check if entity details panel appeared (in sidebar or floating)
      // The sidebar shows entity name when selected
      const sidebarEntity = page.locator('.w-80 h2')
      const floatingPanel = page.locator('.absolute.bottom-4.right-4.w-80 h3')

      if (await sidebarEntity.isVisible().catch(() => false) ||
          await floatingPanel.isVisible().catch(() => false)) {
        nodeSelected = true
        console.log('\n=== TEST 4: Node Click ===')
        console.log('Node selected at position:', pos)

        // Get entity name
        const entityName = await (sidebarEntity.isVisible().catch(() => false)
          ? sidebarEntity.textContent()
          : floatingPanel.textContent())
        console.log('Selected entity:', entityName)
        break
      }
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-screenshots/graph-v4-node-click.png',
      fullPage: true
    })

    console.log('Node selection successful:', nodeSelected)
  })

  test('5. Search box filters entities', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()

    console.log('\n=== TEST 5: Search Box ===')
    console.log('Search input visible: YES')

    // Type a search query (use a common entity name)
    await searchInput.fill('URL')
    await page.waitForTimeout(1000)

    // Take screenshot of search results
    await page.screenshot({
      path: 'test-screenshots/graph-v5a-search-filtered.png',
      fullPage: true
    })

    // Check the stats overlay to see filtered count
    const overlayStats = page.locator('.absolute.top-4.right-4')
    if (await overlayStats.isVisible().catch(() => false)) {
      const statsText = await overlayStats.textContent()
      console.log('Filtered stats:', statsText)
    }

    // Clear search
    await searchInput.clear()
    await page.waitForTimeout(500)

    await page.screenshot({
      path: 'test-screenshots/graph-v5b-search-cleared.png',
      fullPage: true
    })
    console.log('Search cleared: YES')
  })

  test('6. Filter buttons work (All, People, Leagues, Orgs)', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    console.log('\n=== TEST 6: Filter Buttons ===')

    // Test "All" button
    const allButton = page.locator('button:has-text("All")').first()
    await expect(allButton).toBeVisible()
    await allButton.click()
    await page.waitForTimeout(1500)
    console.log('All button clicked')
    await page.screenshot({ path: 'test-screenshots/graph-v6a-filter-all.png', fullPage: true })

    // Test "People" button
    const peopleButton = page.locator('button:has-text("People")')
    await expect(peopleButton).toBeVisible()
    await peopleButton.click()
    await page.waitForTimeout(1500)
    console.log('People filter clicked')
    await page.screenshot({ path: 'test-screenshots/graph-v6b-filter-people.png', fullPage: true })

    // Test "Leagues" button
    const leaguesButton = page.locator('button:has-text("Leagues")')
    await expect(leaguesButton).toBeVisible()
    await leaguesButton.click()
    await page.waitForTimeout(1500)
    console.log('Leagues filter clicked')
    await page.screenshot({ path: 'test-screenshots/graph-v6c-filter-leagues.png', fullPage: true })

    // Test "Orgs" button
    const orgsButton = page.locator('button:has-text("Orgs")')
    await expect(orgsButton).toBeVisible()
    await orgsButton.click()
    await page.waitForTimeout(1500)
    console.log('Orgs filter clicked')
    await page.screenshot({ path: 'test-screenshots/graph-v6d-filter-orgs.png', fullPage: true })

    // Reset to All
    await allButton.click()
    await page.waitForTimeout(1000)
    console.log('Reset to All')
  })

  test('7. Legend is visible with relationship types', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    console.log('\n=== TEST 7: Legend ===')

    // Check for legend container
    const legend = page.locator('text=Relationship Types')
    await expect(legend).toBeVisible()
    console.log('Legend title visible: YES')

    // Check for specific relationship types in legend
    const relationshipTypes = ['BATTLED', 'INTERVIEWED', 'FEUDED_WITH', 'AFFILIATED_WITH']
    for (const type of relationshipTypes) {
      const typeLabel = page.locator(`text=${type}`)
      const isVisible = await typeLabel.isVisible().catch(() => false)
      console.log(`  ${type}: ${isVisible ? 'visible' : 'not visible'}`)
    }

    // Take screenshot
    await page.screenshot({
      path: 'test-screenshots/graph-v7-legend.png',
      fullPage: true
    })
  })

  test('8. Full page quality check', async ({ page }) => {
    // Wait for everything to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(3000)

    console.log('\n=== TEST 8: Full Page Quality Check ===')

    // Check main layout elements
    const header = page.locator('h1:has-text("KNOWLEDGE GRAPH")')
    const sidebar = page.locator('.w-80.border-l-2')
    const graphCanvas = page.locator('.sigma-container')
    const controls = page.locator('.flex.items-center.gap-4.p-4.bg-zinc-900')

    console.log('Header visible:', await header.isVisible())
    console.log('Sidebar visible:', await sidebar.isVisible())
    console.log('Graph canvas visible:', await graphCanvas.isVisible())
    console.log('Controls visible:', await controls.isVisible())

    // Check sidebar content (when no entity selected)
    const graphStats = page.locator('text=Graph Statistics')
    const entityTypes = page.locator('text=Entity Types')
    const helpText = page.locator('text=Click an entity')

    console.log('Graph Statistics visible:', await graphStats.isVisible().catch(() => false))
    console.log('Entity Types visible:', await entityTypes.isVisible().catch(() => false))
    console.log('Help text visible:', await helpText.isVisible().catch(() => false))

    // Check for Most Connected section
    const mostConnected = page.locator('text=Most Connected')
    console.log('Most Connected visible:', await mostConnected.isVisible().catch(() => false))

    // Take full page screenshot
    await page.screenshot({
      path: 'test-screenshots/graph-v8-full-quality.png',
      fullPage: true
    })

    // Final error check
    console.log('\nFinal error count:')
    console.log('Console errors:', consoleErrors.length)
    console.log('Page errors:', pageErrors.length)

    if (consoleErrors.length > 0) {
      console.log('Console error details:')
      consoleErrors.forEach(e => console.log('  -', e))
    }
  })
})
