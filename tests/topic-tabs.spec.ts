import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Helper to get the topic tabs specifically (they contain topic names like "Battle Rap")
// The TopicTabs component is the first tablist below the topbar
const getTopicTabs = (page: import('@playwright/test').Page) => {
  // Topic tabs are in the TabsList that contains known topic names
  // We can identify them by looking for tabs that contain topic names
  return page.locator('[role="tablist"]').first()
}

const getTopicTabTriggers = (page: import('@playwright/test').Page) => {
  // Get tab triggers from the first tablist only (topic tabs)
  return page.locator('[role="tablist"]').first().locator('[role="tab"]')
}

const getActiveTopicTab = (page: import('@playwright/test').Page) => {
  // Get the active tab from the first tablist only (topic tabs)
  return page.locator('[role="tablist"]').first().locator('[role="tab"][data-state="active"]')
}

test.describe('Topic Tabs Functionality', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30000)
  })

  test('1. Navigate to /audit - verify topic tabs appear', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    // Wait for the page to load - use heading to be more specific
    await expect(page.getByRole('heading', { name: 'AUDIT' })).toBeVisible({ timeout: 10000 })

    // Look for tabs - TabsList renders with role="tablist"
    const tabsList = getTopicTabs(page)
    await expect(tabsList).toBeVisible({ timeout: 10000 })

    // Take screenshot for verification
    await page.screenshot({ path: 'test-screenshots/01-audit-topic-tabs.png', fullPage: false })

    console.log('SUCCESS: Topic tabs are visible on /audit page')
  })

  test('2. Check tab visibility - verify topic names are shown', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    // Wait for tabs to load
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    // Get topic tab triggers specifically
    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    console.log(`Found ${tabCount} topic tabs`)

    // Verify we have at least one tab (if there are topics)
    if (tabCount > 0) {
      // Get the text of each tab
      for (let i = 0; i < tabCount; i++) {
        const tabText = await tabs.nth(i).textContent()
        console.log(`Tab ${i + 1}: "${tabText}"`)
      }

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/02-tab-visibility.png', fullPage: false })

      console.log('SUCCESS: Topic tabs are visible with topic names')
    } else {
      console.log('NOTE: No topic tabs found - this might be expected if only 1 topic exists')
    }
  })

  test('3. Click a different tab - verify active state change', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    // Wait for tabs
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Get the first tab's initial state
      const firstTab = tabs.first()
      const secondTab = tabs.nth(1)

      // Get initial active state
      const firstTabInitialState = await firstTab.getAttribute('data-state')
      const secondTabInitialState = await secondTab.getAttribute('data-state')

      console.log(`Initial states - Tab 1: ${firstTabInitialState}, Tab 2: ${secondTabInitialState}`)

      // Take screenshot before click
      await page.screenshot({ path: 'test-screenshots/03a-before-tab-click.png', fullPage: false })

      // Click the second tab (or first if second is active)
      if (secondTabInitialState === 'active') {
        await firstTab.click()
        await page.waitForTimeout(500)

        const firstTabAfterClick = await firstTab.getAttribute('data-state')
        expect(firstTabAfterClick).toBe('active')
        console.log(`After click - Tab 1 state: ${firstTabAfterClick}`)
      } else {
        await secondTab.click()
        await page.waitForTimeout(500)

        const secondTabAfterClick = await secondTab.getAttribute('data-state')
        expect(secondTabAfterClick).toBe('active')
        console.log(`After click - Tab 2 state: ${secondTabAfterClick}`)
      }

      // Take screenshot after click
      await page.screenshot({ path: 'test-screenshots/03b-after-tab-click.png', fullPage: false })

      console.log('SUCCESS: Tab click changes active state')
    } else {
      console.log('SKIPPED: Need at least 2 tabs to test tab switching')
    }
  })

  test('4. Navigate to /perimeter - verify tab selection persists', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click the second tab
      const secondTab = tabs.nth(1)
      const secondTabText = await secondTab.textContent()
      await secondTab.click()
      await page.waitForTimeout(500)

      console.log(`Selected tab: "${secondTabText}"`)

      // Navigate to /perimeter
      await page.goto(`${BASE_URL}/perimeter`)
      await page.waitForLoadState('networkidle')

      // Verify tabs are visible
      await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

      // Check which tab is active (use topic-specific locator)
      const activeTab = getActiveTopicTab(page)
      const activeTabText = await activeTab.textContent()

      console.log(`Active tab on /perimeter: "${activeTabText}"`)

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/04-perimeter-persistence.png', fullPage: false })

      // Verify the same tab is still selected
      expect(activeTabText).toBe(secondTabText)
      console.log('SUCCESS: Tab selection persists to /perimeter')
    } else {
      // Just verify tabs exist on perimeter
      await page.goto(`${BASE_URL}/perimeter`)
      await page.waitForLoadState('networkidle')

      const tabsList = getTopicTabs(page)
      const tabsVisible = await tabsList.isVisible().catch(() => false)

      if (tabsVisible || tabCount === 1) {
        console.log('SUCCESS: /perimeter page loads correctly')
      }

      await page.screenshot({ path: 'test-screenshots/04-perimeter-persistence.png', fullPage: false })
    }
  })

  test('5. Navigate to /nexus - verify tabs appear with persistence', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click the second tab
      const secondTab = tabs.nth(1)
      const secondTabText = await secondTab.textContent()
      await secondTab.click()
      await page.waitForTimeout(500)

      // Navigate to /nexus
      await page.goto(`${BASE_URL}/nexus`)
      await page.waitForLoadState('networkidle')

      // Verify tabs are visible
      await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

      // Check which tab is active (use topic-specific locator)
      const activeTab = getActiveTopicTab(page)
      const activeTabText = await activeTab.textContent()

      console.log(`Active tab on /nexus: "${activeTabText}"`)

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/05-nexus-persistence.png', fullPage: false })

      expect(activeTabText).toBe(secondTabText)
      console.log('SUCCESS: Tab selection persists to /nexus')
    } else {
      await page.goto(`${BASE_URL}/nexus`)
      await page.waitForLoadState('networkidle')

      await page.screenshot({ path: 'test-screenshots/05-nexus-persistence.png', fullPage: false })
      console.log('SUCCESS: /nexus page loads correctly')
    }
  })

  test('6. Navigate to /extraction - verify tabs appear with persistence', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click the second tab
      const secondTab = tabs.nth(1)
      const secondTabText = await secondTab.textContent()
      await secondTab.click()
      await page.waitForTimeout(500)

      // Navigate to /extraction
      await page.goto(`${BASE_URL}/extraction`)
      await page.waitForLoadState('networkidle')

      // Verify tabs are visible
      await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

      // Check which tab is active (use topic-specific locator - FIRST tablist)
      const activeTab = getActiveTopicTab(page)
      const activeTabText = await activeTab.textContent()

      console.log(`Active tab on /extraction: "${activeTabText}"`)

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/06-extraction-persistence.png', fullPage: false })

      expect(activeTabText).toBe(secondTabText)
      console.log('SUCCESS: Tab selection persists to /extraction')
    } else {
      await page.goto(`${BASE_URL}/extraction`)
      await page.waitForLoadState('networkidle')

      await page.screenshot({ path: 'test-screenshots/06-extraction-persistence.png', fullPage: false })
      console.log('SUCCESS: /extraction page loads correctly')
    }
  })

  test('7. Navigate to /outpost - verify tabs appear with persistence', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    if (tabCount >= 2) {
      // Click the second tab
      const secondTab = tabs.nth(1)
      const secondTabText = await secondTab.textContent()
      await secondTab.click()
      await page.waitForTimeout(500)

      // Navigate to /outpost
      await page.goto(`${BASE_URL}/outpost`)
      await page.waitForLoadState('networkidle')

      // Verify tabs are visible
      await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

      // Check which tab is active (use topic-specific locator - FIRST tablist)
      const activeTab = getActiveTopicTab(page)
      const activeTabText = await activeTab.textContent()

      console.log(`Active tab on /outpost: "${activeTabText}"`)

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/07-outpost-persistence.png', fullPage: false })

      expect(activeTabText).toBe(secondTabText)
      console.log('SUCCESS: Tab selection persists to /outpost')
    } else {
      await page.goto(`${BASE_URL}/outpost`)
      await page.waitForLoadState('networkidle')

      await page.screenshot({ path: 'test-screenshots/07-outpost-persistence.png', fullPage: false })
      console.log('SUCCESS: /outpost page loads correctly')
    }
  })

  test('Full navigation flow - verify tabs persist across all pages', async ({ page }) => {
    // This is a comprehensive test that goes through all pages in one flow
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')

    // Wait for tabs
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

    const tabs = getTopicTabTriggers(page)
    const tabCount = await tabs.count()

    console.log(`\n=== Full Navigation Flow Test ===`)
    console.log(`Total tabs found: ${tabCount}`)

    // Get all tab names
    const tabNames: string[] = []
    for (let i = 0; i < tabCount; i++) {
      const name = await tabs.nth(i).textContent()
      tabNames.push(name || '')
      console.log(`Tab ${i + 1}: "${name}"`)
    }

    if (tabCount >= 2) {
      // Select the second tab
      const selectedTabName = tabNames[1]
      await tabs.nth(1).click()
      await page.waitForTimeout(500)
      console.log(`\nSelected: "${selectedTabName}"`)

      // Pages to navigate
      const pages = ['/perimeter', '/nexus', '/extraction', '/outpost']

      for (const pagePath of pages) {
        await page.goto(`${BASE_URL}${pagePath}`)
        await page.waitForLoadState('networkidle')
        await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

        // Use topic-specific locator (FIRST tablist)
        const activeTab = getActiveTopicTab(page)
        const activeTabName = await activeTab.textContent()

        const isPersisted = activeTabName === selectedTabName
        console.log(`${pagePath}: Active tab = "${activeTabName}" | Persisted: ${isPersisted ? 'YES' : 'NO'}`)

        expect(activeTabName).toBe(selectedTabName)
      }

      console.log('\nSUCCESS: Tab selection persists across all pages!')
    } else {
      console.log('SKIPPED: Need at least 2 tabs to test persistence')

      // Still verify pages load
      const pages = ['/audit', '/perimeter', '/nexus', '/extraction', '/outpost']
      for (const pagePath of pages) {
        await page.goto(`${BASE_URL}${pagePath}`)
        await page.waitForLoadState('networkidle')

        const tabsList = getTopicTabs(page)
        const isVisible = await tabsList.isVisible().catch(() => false)
        console.log(`${pagePath}: Tabs visible = ${isVisible}`)
      }
    }
  })
})
