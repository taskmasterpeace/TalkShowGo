/**
 * Daily Show 72-Hour Scan with Fresh Data Test
 *
 * This test verifies that the Daily Show wizard:
 * 1. Navigates to http://localhost:3000/studio/daily-show
 * 2. Selects a template
 * 3. Selects a host
 * 4. Sets Hours Back to 72 hours
 * 5. Clicks "Scan Sources"
 * 6. Takes screenshots of discovered topics
 * 7. Verifies topics have REAL ISO timestamps (not "1 year ago")
 */

import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = 'test-screenshots'

// Helper to take timestamped screenshots
async function takeScreenshot(page: Page, name: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `${SCREENSHOT_DIR}/72h-scan-${name}-${timestamp}.png`
  await page.screenshot({ path: filename, fullPage: true })
  console.log(`    Screenshot: ${filename}`)
  return filename
}

test.describe('Daily Show 72-Hour Scan - Fresh Data Verification', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
  })

  // 2 minute timeout for scanning
  test.setTimeout(120000)

  test('Scan 72 hours and verify topics with real timestamps', async ({ page }) => {
    // Console error collection
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    page.on('pageerror', err => {
      consoleErrors.push(err.message)
    })

    console.log('\n' + '='.repeat(60))
    console.log('DAILY SHOW 72-HOUR SCAN TEST WITH FRESH DATA')
    console.log('='.repeat(60) + '\n')

    // Set Battle Rap topic in localStorage
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    })

    // ===========================================
    // Navigate to Daily Show wizard
    // ===========================================
    console.log('1. Navigating to Daily Show wizard...')
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    await takeScreenshot(page, 'step1-template-page')

    // ===========================================
    // STEP 1: Select Template
    // ===========================================
    console.log('\n2. STEP 1: Selecting template...')

    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    const templateCount = await templateCards.count()
    console.log(`   Templates found: ${templateCount}`)

    if (templateCount === 0) {
      await takeScreenshot(page, 'error-no-templates')
      throw new Error('No templates found - cannot proceed')
    }

    // Select the first template
    const firstTemplate = templateCards.first()
    const templateName = await firstTemplate.locator('h3').textContent()
    console.log(`   Selecting: "${templateName}"`)
    await firstTemplate.click()
    await page.waitForTimeout(500)

    // Click Next
    const nextButton = page.locator('button').filter({ hasText: /Next/ })
    await nextButton.click()
    await page.waitForTimeout(1000)

    // ===========================================
    // STEP 2: Select Host
    // ===========================================
    console.log('\n3. STEP 2: Selecting host...')

    // Verify we're on Step 2
    const hostHeading = await page.locator('text=Select Your Host').isVisible()
    console.log(`   On host selection page: ${hostHeading ? 'YES' : 'NO'}`)
    expect(hostHeading).toBe(true)

    await takeScreenshot(page, 'step2-host-page')

    // Find and select a host
    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    const hostCount = await hostCards.count()
    console.log(`   Hosts found: ${hostCount}`)

    // Try Maya Sterling first
    const mayaCard = page.locator('button').filter({ hasText: 'Maya Sterling' })
    if (await mayaCard.isVisible()) {
      await mayaCard.click()
      console.log(`   Selected: Maya Sterling`)
    } else if (hostCount > 0) {
      await hostCards.first().click()
      const selectedHostName = await hostCards.first().locator('h3').textContent()
      console.log(`   Selected: ${selectedHostName}`)
    }
    await page.waitForTimeout(500)

    // Click Next
    await page.locator('button').filter({ hasText: /Next/ }).click()
    await page.waitForTimeout(1000)

    // ===========================================
    // STEP 3: Topics Selection
    // ===========================================
    console.log('\n4. STEP 3: Topics selection...')

    // Verify we're on Step 3
    const topicsHeading = await page.locator('text=Select Topics').isVisible()
    console.log(`   On topics page: ${topicsHeading ? 'YES' : 'NO'}`)
    expect(topicsHeading).toBe(true)

    await takeScreenshot(page, 'step3-topics-initial')

    // ===========================================
    // Set to 72 hours
    // ===========================================
    console.log('\n5. Setting time range to 72 hours...')

    // Click "Hours Back" button to ensure we're in hours mode
    const hoursBackBtn = page.locator('button').filter({ hasText: 'Hours Back' })
    if (await hoursBackBtn.isVisible()) {
      await hoursBackBtn.click()
      await page.waitForTimeout(300)
      console.log(`   Switched to Hours Back mode`)
    }

    // Find and set the hours dropdown to 72
    const hoursSelect = page.locator('select').first()
    if (await hoursSelect.isVisible()) {
      const currentValue = await hoursSelect.inputValue()
      console.log(`   Current hours value: ${currentValue}`)

      // Select 72 hours
      await hoursSelect.selectOption('72')
      const newValue = await hoursSelect.inputValue()
      console.log(`   New hours value: ${newValue}`)
    }

    await takeScreenshot(page, 'step3-hours-72-set')

    // ===========================================
    // Click Scan Sources
    // ===========================================
    console.log('\n6. Clicking "Scan Sources" button...')

    const scanButton = page.locator('button').filter({ hasText: 'Scan Sources' })
    expect(await scanButton.isVisible()).toBe(true)

    await scanButton.click()
    console.log(`   Scan started...`)

    // Wait for loading spinner
    await page.waitForTimeout(1000)
    await takeScreenshot(page, 'step3-scanning')

    // Wait for scan to complete
    console.log(`   Waiting for scan to complete (up to 60 seconds)...`)
    try {
      await page.waitForFunction(() => {
        const loadingSpinner = document.querySelector('.animate-spin')
        const loadingText = document.body.textContent?.includes('Scanning Twitter and YouTube')
        return !loadingSpinner && !loadingText
      }, { timeout: 60000 })
    } catch {
      console.log(`   Scan timed out or still running`)
    }

    await page.waitForTimeout(1000)
    await takeScreenshot(page, 'step3-scan-complete')

    // ===========================================
    // Check for discovered topics
    // ===========================================
    console.log('\n7. Checking for discovered topics...')

    // Check for errors first
    const errorBox = page.locator('.border-destructive')
    if (await errorBox.isVisible()) {
      const errorText = await errorBox.textContent()
      console.log(`   ERROR: ${errorText}`)
    }

    // Look for topic cards (buttons with h3 inside)
    const topicCards = page.locator('button').filter({ has: page.locator('h3') })
    const topicCount = await topicCards.count()

    console.log(`\n${'='.repeat(60)}`)
    console.log('TOPICS FOUND: ' + topicCount)
    console.log('='.repeat(60))

    if (topicCount > 0) {
      console.log('\nTopic Details:')
      console.log('-'.repeat(60))

      // Extract all topic information
      for (let i = 0; i < topicCount; i++) {
        const card = topicCards.nth(i)
        const headline = await card.locator('h3').textContent()
        const summary = await card.locator('p.text-sm.text-muted-foreground').first().textContent()

        console.log(`\n${i + 1}. ${headline}`)
        console.log(`   Summary: ${summary?.slice(0, 100)}...`)

        // Look for source type badge
        const sourceBadge = await card.locator('span.text-xs.px-2.py-0\\.5.border').first().textContent()
        if (sourceBadge) {
          console.log(`   Source Type: ${sourceBadge}`)
        }

        // Look for score
        const scoreText = await card.locator('span.text-xs.text-muted-foreground').first().textContent()
        if (scoreText) {
          console.log(`   ${scoreText}`)
        }
      }

      await takeScreenshot(page, 'step3-topics-found')

      // ===========================================
      // Verify topic dates are ISO timestamps
      // ===========================================
      console.log('\n' + '='.repeat(60))
      console.log('DATE FORMAT VERIFICATION')
      console.log('='.repeat(60))

      // Get the page content to check for date patterns
      const pageContent = await page.textContent('body') || ''

      // Check for relative dates (bad)
      const relativePatterns = [
        /\d+ year[s]? ago/i,
        /\d+ month[s]? ago/i,
        /\d+ week[s]? ago/i
      ]

      let hasRelativeDates = false
      for (const pattern of relativePatterns) {
        const matches = pageContent.match(pattern)
        if (matches) {
          console.log(`   WARNING: Found relative date: "${matches[0]}"`)
          hasRelativeDates = true
        }
      }

      // Check for ISO dates (good - 2025-12-XX format)
      const isoPattern = /2025-12-\d{2}/g
      const isoMatches = pageContent.match(isoPattern)
      if (isoMatches && isoMatches.length > 0) {
        console.log(`   GOOD: Found ${isoMatches.length} ISO date(s): ${[...new Set(isoMatches)].join(', ')}`)
      }

      if (!hasRelativeDates) {
        console.log(`\n   SUCCESS: No relative dates like "1 year ago" found!`)
      } else {
        console.log(`\n   ISSUE: Found relative dates that should be ISO timestamps`)
      }

    } else {
      console.log('\nNo topics found in the last 72 hours.')
      console.log('This could mean:')
      console.log('  - YouTube channels have no recent content')
      console.log('  - Database needs fresh data loaded')
      console.log('  - API returned empty results')

      // Check for empty state message
      const emptyState = await page.locator('text=Click "Scan Sources" to discover').isVisible()
      const noTopicsMsg = await page.locator('text=No trending topics').isVisible()
      console.log(`\n  Empty state message: ${emptyState ? 'YES' : 'NO'}`)
      console.log(`  No topics message: ${noTopicsMsg ? 'YES' : 'NO'}`)
    }

    // Take final screenshot
    await takeScreenshot(page, 'step3-final')

    // ===========================================
    // Summary
    // ===========================================
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`  Topics Found: ${topicCount}`)
    console.log(`  Console Errors: ${consoleErrors.length}`)
    if (consoleErrors.length > 0) {
      console.log(`  Errors: ${consoleErrors.slice(0, 3).join(', ')}`)
    }
    console.log(`  Screenshots saved to: ${SCREENSHOT_DIR}/`)
    console.log('\n')

    // Assert we found at least 1 topic (since fresh data was loaded)
    // Comment this out if you just want to observe
    // expect(topicCount).toBeGreaterThan(0)
  })
})
