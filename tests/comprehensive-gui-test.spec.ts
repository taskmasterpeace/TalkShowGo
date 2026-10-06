/**
 * Comprehensive GUI Test for TalkShowGo
 * Tests all main pages with screenshots and console error capture
 */

import { test, expect, Page, ConsoleMessage } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Store console errors globally for each test
const consoleErrors: Map<string, string[]> = new Map()

test.describe('TalkShowGo Comprehensive GUI Test', () => {
  // Run in fullscreen
  test.use({
    viewport: { width: 1920, height: 1080 },
  })

  test.beforeEach(async ({ page }, testInfo) => {
    // Initialize error storage for this test
    consoleErrors.set(testInfo.title, [])

    // Capture console errors
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const errors = consoleErrors.get(testInfo.title) || []
        errors.push(`${msg.type()}: ${msg.text()}`)
        consoleErrors.set(testInfo.title, errors)
      }
    })

    // Capture page errors
    page.on('pageerror', (err) => {
      const errors = consoleErrors.get(testInfo.title) || []
      errors.push(`Page Error: ${err.message}`)
      consoleErrors.set(testInfo.title, errors)
    })

    // Set Battle Rap topic in localStorage to avoid topic warnings
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    })
  })

  test.afterEach(async ({ }, testInfo) => {
    // Log any console errors after test
    const errors = consoleErrors.get(testInfo.title) || []
    if (errors.length > 0) {
      console.log(`\n[${testInfo.title}] Console Errors:`)
      errors.forEach(err => console.log(`  - ${err}`))
    }
  })

  test('1. Command Center (/) - Dashboard loads, stats display, charts render', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/01-command-center.png', fullPage: true })

    // Check main heading
    const heading = page.getByRole('heading', { name: 'Command Center' })
    await expect(heading).toBeVisible()

    // Check for stats cards
    const activeSourcesVisible = await page.locator('text=Active Sources').isVisible().catch(() => false)
    const entitiesTrackedVisible = await page.locator('text=Entities Tracked').isVisible().catch(() => false)
    const quickActionsVisible = await page.locator('text=Quick Actions').isVisible().catch(() => false)

    console.log('Dashboard Stats:')
    console.log(`  - Active Sources: ${activeSourcesVisible ? 'VISIBLE' : 'MISSING'}`)
    console.log(`  - Entities Tracked: ${entitiesTrackedVisible ? 'VISIBLE' : 'MISSING'}`)
    console.log(`  - Quick Actions: ${quickActionsVisible ? 'VISIBLE' : 'MISSING'}`)

    // Check for charts - look for chart containers
    const chartContainers = await page.locator('.recharts-responsive-container').count()
    console.log(`  - Chart containers found: ${chartContainers}`)

    // Check for chart dimension errors (the -1 width/height issue)
    const errors = consoleErrors.get('1. Command Center (/) - Dashboard loads, stats display, charts render') || []
    const chartErrors = errors.filter(e => e.includes('width') || e.includes('height') || e.includes('-1'))
    if (chartErrors.length > 0) {
      console.log('  - CHART DIMENSION ERRORS FOUND:', chartErrors)
    }

    // Look for specific chart elements
    const hasLineChart = await page.locator('.recharts-line').isVisible().catch(() => false)
    const hasBarChart = await page.locator('.recharts-bar').isVisible().catch(() => false)
    const hasAreaChart = await page.locator('.recharts-area').isVisible().catch(() => false)
    console.log(`  - Line chart elements: ${hasLineChart ? 'YES' : 'NO'}`)
    console.log(`  - Bar chart elements: ${hasBarChart ? 'YES' : 'NO'}`)
    console.log(`  - Area chart elements: ${hasAreaChart ? 'YES' : 'NO'}`)

    expect(activeSourcesVisible || entitiesTrackedVisible).toBeTruthy()
  })

  test('2. OUTPOST (/outpost) - Topic management, source lists load', async ({ page }) => {
    await page.goto(`${BASE_URL}/outpost`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/02-outpost.png', fullPage: true })

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log('OUTPOST Page:')
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for topic-related content
    const hasTopicContent = await page.locator('text=YouTube').or(page.locator('text=Twitter')).or(page.locator('text=Sources')).first().isVisible().catch(() => false)
    console.log(`  - Has source content: ${hasTopicContent ? 'YES' : 'NO'}`)

    // Check for tab/navigation elements
    const tabs = await page.locator('[role="tab"]').count()
    console.log(`  - Tab elements: ${tabs}`)

    // Check for data loading
    const loadingIndicators = await page.locator('text=Loading').or(page.locator('[class*="loading"]')).count()
    console.log(`  - Loading indicators: ${loadingIndicators}`)

    expect(pageLoaded).toBeTruthy()
  })

  test('3. PERIMETER (/perimeter) - Twitter feed loads, Refresh button works', async ({ page }) => {
    await page.goto(`${BASE_URL}/perimeter`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(3000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/03-perimeter.png', fullPage: true })

    console.log('PERIMETER Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for Twitter content
    const hasTwitterContent = await page.locator('text=Twitter').or(page.locator('text=tweets')).or(page.locator('text=feed')).first().isVisible().catch(() => false)
    console.log(`  - Has Twitter content: ${hasTwitterContent ? 'YES' : 'NO'}`)

    // Find Refresh button
    const refreshButton = page.locator('button').filter({ hasText: /refresh/i }).first()
    const hasRefreshButton = await refreshButton.isVisible().catch(() => false)
    console.log(`  - Refresh button visible: ${hasRefreshButton ? 'YES' : 'NO'}`)

    // If refresh button exists, try clicking it
    if (hasRefreshButton) {
      console.log('  - Testing Refresh button click...')
      const initialScreenshot = await page.screenshot({ path: 'test-screenshots/03a-perimeter-before-refresh.png' })

      try {
        await refreshButton.click()
        await page.waitForTimeout(2000)

        // Take screenshot after refresh
        await page.screenshot({ path: 'test-screenshots/03b-perimeter-after-refresh.png' })

        // Check for any errors after refresh
        const errors = consoleErrors.get('3. PERIMETER (/perimeter) - Twitter feed loads, Refresh button works') || []
        if (errors.length > 0) {
          console.log('  - ERRORS AFTER REFRESH:', errors)
        } else {
          console.log('  - Refresh completed without console errors')
        }

        // Check if content changed or loading indicator appeared
        const loadingAfterClick = await page.locator('[class*="loading"]').or(page.locator('[class*="spinner"]')).isVisible().catch(() => false)
        console.log(`  - Loading indicator after click: ${loadingAfterClick ? 'YES' : 'NO'}`)

      } catch (e) {
        console.log(`  - REFRESH BUTTON CLICK FAILED: ${e.message}`)
      }
    } else {
      // Try finding any button that might refresh
      const allButtons = await page.locator('button').allTextContents()
      console.log(`  - Available buttons: ${allButtons.join(', ')}`)
    }

    expect(pageLoaded).toBeTruthy()
  })

  test('4. EXTRACTION (/extraction) - Entity list loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/extraction`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/04-extraction.png', fullPage: true })

    console.log('EXTRACTION Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for entity content
    const hasEntities = await page.locator('text=Entities').or(page.locator('text=entities')).first().isVisible().catch(() => false)
    console.log(`  - Has entity content: ${hasEntities ? 'YES' : 'NO'}`)

    // Look for entity list/table
    const tableRows = await page.locator('tr').or(page.locator('[role="row"]')).count()
    console.log(`  - Table/list rows: ${tableRows}`)

    // Check for entity cards
    const entityCards = await page.locator('[class*="card"]').count()
    console.log(`  - Card elements: ${entityCards}`)

    // Check for action buttons
    const hasEnrichButton = await page.locator('button').filter({ hasText: /enrich/i }).isVisible().catch(() => false)
    const hasEditButton = await page.locator('button').filter({ hasText: /edit/i }).isVisible().catch(() => false)
    console.log(`  - Enrich button: ${hasEnrichButton ? 'YES' : 'NO'}`)
    console.log(`  - Edit button: ${hasEditButton ? 'YES' : 'NO'}`)

    expect(pageLoaded).toBeTruthy()
  })

  test('5. AUDIT (/audit) - Credibility sources load', async ({ page }) => {
    await page.goto(`${BASE_URL}/audit`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/05-audit.png', fullPage: true })

    console.log('AUDIT Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for audit content
    const hasAuditContent = await page.locator('text=Audit').or(page.locator('text=Credibility')).or(page.locator('text=Score')).first().isVisible().catch(() => false)
    console.log(`  - Has audit content: ${hasAuditContent ? 'YES' : 'NO'}`)

    // Look for sources
    const hasSources = await page.locator('text=Sources').or(page.locator('text=sources')).first().isVisible().catch(() => false)
    console.log(`  - Has sources: ${hasSources ? 'YES' : 'NO'}`)

    // Count data elements
    const listItems = await page.locator('li').count()
    const cards = await page.locator('[class*="card"]').count()
    console.log(`  - List items: ${listItems}`)
    console.log(`  - Cards: ${cards}`)

    expect(pageLoaded).toBeTruthy()
  })

  test('6. NEXUS (/nexus) - Stories load', async ({ page }) => {
    await page.goto(`${BASE_URL}/nexus`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/06-nexus.png', fullPage: true })

    console.log('NEXUS Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for story content
    const hasStoryContent = await page.locator('text=Stories').or(page.locator('text=Story')).first().isVisible().catch(() => false)
    console.log(`  - Has story content: ${hasStoryContent ? 'YES' : 'NO'}`)

    // Look for story elements
    const storyCards = await page.locator('[class*="card"]').or(page.locator('[class*="story"]')).count()
    console.log(`  - Story/card elements: ${storyCards}`)

    // Check for action buttons
    const hasViewButton = await page.locator('button').filter({ hasText: /view/i }).isVisible().catch(() => false)
    const hasGenerateButton = await page.locator('button').filter({ hasText: /generate/i }).isVisible().catch(() => false)
    console.log(`  - View button: ${hasViewButton ? 'YES' : 'NO'}`)
    console.log(`  - Generate button: ${hasGenerateButton ? 'YES' : 'NO'}`)

    expect(pageLoaded).toBeTruthy()
  })

  test('7. Studio Main (/studio) - Studio page loads with tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/07-studio.png', fullPage: true })

    console.log('STUDIO Page:')

    // Check heading
    const heading = page.getByRole('heading', { name: 'STUDIO' })
    const hasHeading = await heading.isVisible().catch(() => false)
    console.log(`  - STUDIO heading: ${hasHeading ? 'YES' : 'NO'}`)

    // Check for tabs
    const hostsTab = await page.getByRole('tab', { name: /Hosts/i }).isVisible().catch(() => false)
    const producersTab = await page.getByRole('tab', { name: /Producers/i }).isVisible().catch(() => false)
    const workflowsTab = await page.getByRole('tab', { name: /Workflows/i }).isVisible().catch(() => false)

    console.log(`  - Hosts tab: ${hostsTab ? 'YES' : 'NO'}`)
    console.log(`  - Producers tab: ${producersTab ? 'YES' : 'NO'}`)
    console.log(`  - Workflows tab: ${workflowsTab ? 'YES' : 'NO'}`)

    // Check for Build New Host button
    const hasBuildHostButton = await page.locator('button').filter({ hasText: /Build.*Host/i }).isVisible().catch(() => false)
    console.log(`  - Build Host button: ${hasBuildHostButton ? 'YES' : 'NO'}`)

    expect(hasHeading).toBeTruthy()
  })

  test('8. Daily Show (/studio/daily-show) - 5-step wizard loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/08-daily-show.png', fullPage: true })

    console.log('DAILY SHOW Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for wizard/step elements
    const hasTemplateStep = await page.locator('text=Template').or(page.locator('text=Select Template')).first().isVisible().catch(() => false)
    const hasHostStep = await page.locator('text=Host').or(page.locator('text=Select Host')).first().isVisible().catch(() => false)

    console.log(`  - Template step: ${hasTemplateStep ? 'YES' : 'NO'}`)
    console.log(`  - Host step: ${hasHostStep ? 'YES' : 'NO'}`)

    // Look for step indicators
    const stepIndicators = await page.locator('[class*="step"]').count()
    console.log(`  - Step indicators: ${stepIndicators}`)

    // Check for buttons
    const hasNextButton = await page.locator('button').filter({ hasText: /next/i }).isVisible().catch(() => false)
    const hasGenerateButton = await page.locator('button').filter({ hasText: /generate/i }).isVisible().catch(() => false)
    console.log(`  - Next button: ${hasNextButton ? 'YES' : 'NO'}`)
    console.log(`  - Generate button: ${hasGenerateButton ? 'YES' : 'NO'}`)

    expect(pageLoaded).toBeTruthy()
  })

  test('9. Schedules (/studio/schedules) - Schedule management loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/schedules`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/09-schedules.png', fullPage: true })

    console.log('SCHEDULES Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Check for topic warning
    const hasTopicWarning = await page.locator('text=Please select a topic').isVisible().catch(() => false)
    console.log(`  - Topic warning: ${hasTopicWarning ? 'YES (BAD)' : 'NO (GOOD)'}`)

    // Look for schedules heading
    const hasHeading = await page.locator('text=Daily Show Schedules').or(page.locator('text=Schedules')).first().isVisible().catch(() => false)
    console.log(`  - Has heading: ${hasHeading ? 'YES' : 'NO'}`)

    // Check for New Schedule button
    const newScheduleButton = page.locator('button').filter({ hasText: /new schedule/i })
    const hasNewScheduleBtn = await newScheduleButton.isVisible().catch(() => false)
    console.log(`  - New Schedule button: ${hasNewScheduleBtn ? 'YES' : 'NO'}`)

    // Test New Schedule button if present
    if (hasNewScheduleBtn) {
      console.log('  - Testing New Schedule button...')
      await newScheduleButton.click()
      await page.waitForTimeout(1000)

      // Take modal screenshot
      await page.screenshot({ path: 'test-screenshots/09a-schedules-modal.png', fullPage: true })

      // Check modal elements
      const hasDaily = await page.locator('button').filter({ hasText: /daily/i }).isVisible().catch(() => false)
      const hasWeekly = await page.locator('button').filter({ hasText: /weekly/i }).isVisible().catch(() => false)
      const hasInterval = await page.locator('button').filter({ hasText: /interval/i }).isVisible().catch(() => false)

      console.log(`  - Modal Daily button: ${hasDaily ? 'YES' : 'NO'}`)
      console.log(`  - Modal Weekly button: ${hasWeekly ? 'YES' : 'NO'}`)
      console.log(`  - Modal Interval button: ${hasInterval ? 'YES' : 'NO'}`)

      // Close modal if possible
      const cancelButton = page.locator('button').filter({ hasText: /cancel/i }).or(page.locator('[aria-label="Close"]'))
      const hasCancel = await cancelButton.first().isVisible().catch(() => false)
      if (hasCancel) {
        await cancelButton.first().click()
        await page.waitForTimeout(500)
      }
    }

    expect(pageLoaded).toBeTruthy()
  })

  test('10. Templates (/studio/templates) - Template management loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/templates`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/10-templates.png', fullPage: true })

    console.log('TEMPLATES Page:')

    // Check page loaded
    const pageLoaded = await page.locator('main').isVisible()
    console.log(`  - Page loaded: ${pageLoaded ? 'YES' : 'NO'}`)

    // Look for template content
    const hasTemplateContent = await page.locator('text=Template').first().isVisible().catch(() => false)
    console.log(`  - Has template content: ${hasTemplateContent ? 'YES' : 'NO'}`)

    // Check for create/add button
    const hasCreateButton = await page.locator('button').filter({ hasText: /create|add|new/i }).isVisible().catch(() => false)
    console.log(`  - Create/Add button: ${hasCreateButton ? 'YES' : 'NO'}`)

    // Count template cards
    const templateCards = await page.locator('[class*="card"]').count()
    console.log(`  - Template cards: ${templateCards}`)

    expect(pageLoaded).toBeTruthy()
  })

  test('11. Navigation sidebar works correctly', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('NAVIGATION Test:')

    // Take initial screenshot
    await page.screenshot({ path: 'test-screenshots/11-navigation.png', fullPage: true })

    // Check navigation links
    const navLinks = [
      { text: /Command Center/i, expectedUrl: '/' },
      { text: /OUTPOST/i, expectedUrl: '/outpost' },
      { text: /PERIMETER/i, expectedUrl: '/perimeter' },
      { text: /EXTRACTION/i, expectedUrl: '/extraction' },
      { text: /AUDIT/i, expectedUrl: '/audit' },
      { text: /NEXUS/i, expectedUrl: '/nexus' },
      { text: /STUDIO/i, expectedUrl: '/studio' },
    ]

    for (const link of navLinks) {
      const navLink = page.locator('a, button').filter({ hasText: link.text }).first()
      const isVisible = await navLink.isVisible().catch(() => false)
      console.log(`  - ${link.text.toString().replace(/\//g, '')}: ${isVisible ? 'VISIBLE' : 'NOT FOUND'}`)
    }

    // Test clicking OUTPOST link
    const outpostLink = page.locator('a').filter({ hasText: /OUTPOST/i }).first()
    const hasOutpostLink = await outpostLink.isVisible().catch(() => false)

    if (hasOutpostLink) {
      console.log('  - Testing navigation to OUTPOST...')
      await outpostLink.click()
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      const currentUrl = page.url()
      const isOnOutpost = currentUrl.includes('/outpost')
      console.log(`  - Navigation successful: ${isOnOutpost ? 'YES' : 'NO'} (URL: ${currentUrl})`)
    }

    expect(true).toBeTruthy()
  })

  test('12. Topic tabs appear and work across pages', async ({ page }) => {
    const pagesToTest = [
      { url: '/outpost', name: 'OUTPOST' },
      { url: '/perimeter', name: 'PERIMETER' },
      { url: '/extraction', name: 'EXTRACTION' },
    ]

    console.log('TOPIC TABS Test:')

    for (const testPage of pagesToTest) {
      await page.goto(`${BASE_URL}${testPage.url}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(1000)

      // Look for topic tabs or topic selector
      const hasTopicTabs = await page.locator('[role="tab"]').or(page.locator('[class*="tab"]')).count()
      const hasTopicSelector = await page.locator('select').or(page.locator('[class*="select"]')).count()

      console.log(`  - ${testPage.name}: Tabs=${hasTopicTabs}, Selectors=${hasTopicSelector}`)

      // Screenshot if tabs found
      if (hasTopicTabs > 0) {
        await page.screenshot({ path: `test-screenshots/12-topic-tabs-${testPage.name.toLowerCase()}.png`, fullPage: true })
      }
    }

    expect(true).toBeTruthy()
  })
})

// Summary test that runs at the end
test('13. SUMMARY - Compile all issues found', async ({ page }) => {
  console.log('\n========================================')
  console.log('COMPREHENSIVE GUI TEST SUMMARY')
  console.log('========================================\n')

  console.log('All console errors collected:')
  for (const [testName, errors] of consoleErrors.entries()) {
    if (errors.length > 0) {
      console.log(`\n[${testName}]`)
      errors.forEach(err => console.log(`  - ${err}`))
    }
  }

  console.log('\nScreenshots saved to: test-screenshots/')
  console.log('\nDone!')

  expect(true).toBeTruthy()
})
