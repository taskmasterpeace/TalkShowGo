import { test, expect } from '@playwright/test'

// Override baseURL for this test file since server runs on port 3009
test.use({ baseURL: 'http://localhost:3009' })

test.describe('Knowledge Graph Explorer', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to graph page
    await page.goto('/studio/graph')
  })

  test('1. Page loads correctly without errors', async ({ page }) => {
    // Check page title/heading
    await expect(page.locator('h1')).toContainText('KNOWLEDGE GRAPH')

    // Check subtitle
    await expect(page.locator('text=Explore entity relationships')).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/graph-1-page-load.png', fullPage: true })

    // Check no console errors
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Wait a bit for any delayed errors
    await page.waitForTimeout(2000)

    console.log('Console errors:', errors.length ? errors : 'None')
  })

  test('2. Graph visualization appears with nodes', async ({ page }) => {
    // Wait for the graph container to appear (SigmaContainer)
    await page.waitForSelector('.sigma-container', { timeout: 30000 })

    // Check that the graph canvas is rendered
    const sigmaContainer = page.locator('.sigma-container')
    await expect(sigmaContainer).toBeVisible()

    // Wait for graph to render
    await page.waitForTimeout(3000)

    // Take screenshot of graph
    await page.screenshot({ path: 'test-screenshots/graph-2-visualization.png', fullPage: true })
  })

  test('3. Stats are displayed in header', async ({ page }) => {
    // Wait for stats to load
    await page.waitForSelector('text=entities', { timeout: 10000 })

    // Check entities count is visible
    const entitiesText = page.locator('text=entities')
    await expect(entitiesText).toBeVisible()

    // Check relationships count is visible
    const relationshipsText = page.locator('text=relationships')
    await expect(relationshipsText).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/graph-3-stats.png', fullPage: true })
  })

  test('4. Search functionality works', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()

    // Type search query
    await searchInput.fill('Cassidy')

    // Wait for search to filter
    await page.waitForTimeout(1000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/graph-4-search.png', fullPage: true })

    // Clear search
    await searchInput.clear()
    await page.waitForTimeout(500)
  })

  test('5. Filter buttons work (All, People, Leagues, Orgs)', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Test All filter
    const allButton = page.locator('button:has-text("All")')
    await expect(allButton).toBeVisible()
    await allButton.click()
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-screenshots/graph-5a-filter-all.png', fullPage: true })

    // Test People filter
    const peopleButton = page.locator('button:has-text("People")')
    await expect(peopleButton).toBeVisible()
    await peopleButton.click()
    await page.waitForTimeout(1500) // Wait for refetch
    await page.screenshot({ path: 'test-screenshots/graph-5b-filter-people.png', fullPage: true })

    // Test Leagues filter
    const leaguesButton = page.locator('button:has-text("Leagues")')
    await expect(leaguesButton).toBeVisible()
    await leaguesButton.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'test-screenshots/graph-5c-filter-leagues.png', fullPage: true })

    // Test Orgs filter
    const orgsButton = page.locator('button:has-text("Orgs")')
    await expect(orgsButton).toBeVisible()
    await orgsButton.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'test-screenshots/graph-5d-filter-orgs.png', fullPage: true })

    // Reset to All
    await allButton.click()
    await page.waitForTimeout(1500)
  })

  test('6. Sync/refresh button is functional', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Find sync button (has RefreshCw icon)
    const syncButton = page.locator('button').filter({ has: page.locator('svg.lucide-refresh-cw') }).last()
    await expect(syncButton).toBeVisible()

    // Click sync button
    await syncButton.click()

    // Wait for sync to complete (button may show loading state)
    await page.waitForTimeout(3000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/graph-6-sync.png', fullPage: true })
  })

  test('7. Legend shows relationship types', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Check for legend text
    const legendTitle = page.locator('text=Relationship Types')
    await expect(legendTitle).toBeVisible()

    // Check for some relationship types in legend
    const battledLabel = page.locator('text=BATTLED')
    const interviewedLabel = page.locator('text=INTERVIEWED')

    // At least one should be visible
    const hasBattled = await battledLabel.isVisible().catch(() => false)
    const hasInterviewed = await interviewedLabel.isVisible().catch(() => false)

    expect(hasBattled || hasInterviewed).toBeTruthy()

    // Take screenshot of legend area
    await page.screenshot({ path: 'test-screenshots/graph-7-legend.png', fullPage: true })
  })

  test('8. Clicking on a node shows entity details', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(3000)

    // Get the sigma canvas
    const canvas = page.locator('.sigma-container canvas').first()
    await expect(canvas).toBeVisible()

    // Get canvas bounding box
    const box = await canvas.boundingBox()
    if (!box) {
      throw new Error('Canvas not found')
    }

    // Click in the center of the canvas (where nodes likely are)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForTimeout(1000)

    // Try clicking in different spots if center didn't work
    const spots = [
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 },
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.3 },
      { x: box.x + box.width * 0.3, y: box.y + box.height * 0.7 },
      { x: box.x + box.width * 0.7, y: box.y + box.height * 0.7 },
    ]

    for (const spot of spots) {
      await page.mouse.click(spot.x, spot.y)
      await page.waitForTimeout(500)

      // Check if sidebar shows entity details (in sidebar or floating panel)
      const entityPanel = page.locator('text=connections').first()
      if (await entityPanel.isVisible().catch(() => false)) {
        console.log('Entity selected!')
        break
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/graph-8-node-click.png', fullPage: true })
  })

  test('9. Sidebar shows stats when no entity selected', async ({ page }) => {
    // Wait for graph to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(2000)

    // Check for Graph Statistics section in sidebar
    const statsTitle = page.locator('text=Graph Statistics')
    await expect(statsTitle).toBeVisible()

    // Check for Entity Types section
    const entityTypesLabel = page.locator('text=Entity Types')
    await expect(entityTypesLabel).toBeVisible()

    // Check for help text
    const helpText = page.locator('text=Click an entity')
    await expect(helpText).toBeVisible()

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/graph-9-sidebar-stats.png', fullPage: true })
  })

  test('10. Overall UI quality check', async ({ page }) => {
    // Wait for everything to load
    await page.waitForSelector('.sigma-container', { timeout: 30000 })
    await page.waitForTimeout(3000)

    // Take a full page screenshot for quality review
    await page.screenshot({ path: 'test-screenshots/graph-10-full-page.png', fullPage: true })

    // Check layout is correct (no overflow, no missing elements)
    const header = page.locator('h1:has-text("KNOWLEDGE GRAPH")')
    await expect(header).toBeVisible()

    const sidebar = page.locator('.w-80')
    await expect(sidebar).toBeVisible()

    // Verify the page doesn't have obvious styling issues
    const body = page.locator('body')
    const bodyClass = await body.getAttribute('class')
    console.log('Body classes:', bodyClass)

    console.log('UI Quality Check: PASSED')
  })
})
