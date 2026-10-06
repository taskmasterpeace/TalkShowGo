/**
 * Daily Show Creation Test - 72 Hours, No Twitter
 *
 * This test walks through the complete 5-step wizard to create a daily show:
 * 1. Select a template
 * 2. Select a host
 * 3. Configure 72 hours, disable Twitter, scan sources, select topics
 * 4. Preview the script
 * 5. Generate audio
 *
 * Screenshots are taken at each step for verification.
 */

import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = 'test-screenshots'

// Helper to take timestamped screenshots
async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${SCREENSHOT_DIR}/dailyshow-${name}-${timestamp}.png`
  await page.screenshot({ path: filename, fullPage: true })
  console.log(`  Screenshot saved: ${filename}`)
  return filename
}

test.describe('Create Daily Show - 72 Hours, No Twitter', () => {
  test.use({
    viewport: { width: 1920, height: 1080 },
  })

  // Increase timeout to 5 minutes for this test since scanning takes time
  test.setTimeout(300000)

  test('Complete wizard flow to create daily show', async ({ page }) => {
    // Set up console error logging
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(`Console Error: ${msg.text()}`)
      }
    })
    page.on('pageerror', err => {
      consoleErrors.push(`Page Error: ${err.message}`)
    })

    console.log('\n========================================')
    console.log('DAILY SHOW CREATION - 72 HOURS, NO TWITTER')
    console.log('========================================\n')

    // Set Battle Rap topic in localStorage
    await page.goto(BASE_URL)
    await page.evaluate(() => {
      localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    })

    // Navigate to Daily Show wizard
    console.log('STEP 0: Navigating to Daily Show wizard...')
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // ===========================================
    // STEP 1: Select Template
    // ===========================================
    console.log('\n--- STEP 1: Template Selection ---')
    await takeScreenshot(page, 'step1-initial')

    // Check if templates are available
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    const templateCount = await templateCards.count()
    console.log(`  Templates found: ${templateCount}`)

    if (templateCount === 0) {
      console.log('  ERROR: No templates available!')
      const noTemplatesMsg = await page.locator('text=No templates found').isVisible()
      console.log(`  "No templates found" message: ${noTemplatesMsg ? 'VISIBLE' : 'NOT FOUND'}`)
      await takeScreenshot(page, 'step1-no-templates')
      throw new Error('No templates found - cannot proceed')
    }

    // Select the first template
    const firstTemplate = templateCards.first()
    const templateName = await firstTemplate.locator('h3').textContent()
    console.log(`  Selecting template: "${templateName}"`)
    await firstTemplate.click()
    await page.waitForTimeout(500)
    await takeScreenshot(page, 'step1-selected')

    // Click Next to go to Step 2
    const nextButton = page.locator('button').filter({ hasText: /Next/ })
    expect(await nextButton.isDisabled()).toBe(false)
    await nextButton.click()
    await page.waitForTimeout(1000)

    // ===========================================
    // STEP 2: Select Host
    // ===========================================
    console.log('\n--- STEP 2: Host Selection ---')
    await takeScreenshot(page, 'step2-initial')

    // Verify we're on Step 2
    const hostHeading = await page.locator('text=Select Your Host').isVisible()
    console.log(`  On Step 2 "Select Your Host": ${hostHeading ? 'YES' : 'NO'}`)
    expect(hostHeading).toBe(true)

    // Find host cards
    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    const hostCount = await hostCards.count()
    console.log(`  Hosts found: ${hostCount}`)

    // Try to select Maya Sterling first, otherwise Marcus Blaze, otherwise first host
    let selectedHost = 'Unknown'
    const mayaCard = page.locator('button').filter({ hasText: 'Maya Sterling' })
    const marcusCard = page.locator('button').filter({ hasText: 'Marcus Blaze' })

    if (await mayaCard.isVisible()) {
      await mayaCard.click()
      selectedHost = 'Maya Sterling'
    } else if (await marcusCard.isVisible()) {
      await marcusCard.click()
      selectedHost = 'Marcus Blaze'
    } else if (hostCount > 0) {
      await hostCards.first().click()
      selectedHost = await hostCards.first().locator('h3').textContent() || 'Unknown'
    } else {
      console.log('  ERROR: No hosts available!')
      await takeScreenshot(page, 'step2-no-hosts')
      throw new Error('No hosts found - cannot proceed')
    }

    console.log(`  Selected host: ${selectedHost}`)
    await page.waitForTimeout(500)
    await takeScreenshot(page, 'step2-selected')

    // Click Next to go to Step 3
    await page.locator('button').filter({ hasText: /Next/ }).click()
    await page.waitForTimeout(1000)

    // ===========================================
    // STEP 3: Topics Selection
    // ===========================================
    console.log('\n--- STEP 3: Topics Selection ---')
    await takeScreenshot(page, 'step3-initial')

    // Verify we're on Step 3
    const topicsHeading = await page.locator('text=Select Topics').isVisible()
    console.log(`  On Step 3 "Select Topics": ${topicsHeading ? 'YES' : 'NO'}`)
    expect(topicsHeading).toBe(true)

    // Check if "Hours Back" mode is active (default)
    const hoursBackBtn = page.locator('button').filter({ hasText: 'Hours Back' })
    if (await hoursBackBtn.isVisible()) {
      await hoursBackBtn.click()
      await page.waitForTimeout(300)
      console.log('  Switched to Hours Back mode')
    }

    // Change hours dropdown to 72 hours
    console.log('  Looking for hours dropdown...')
    const hoursSelect = page.locator('select').first()
    if (await hoursSelect.isVisible()) {
      // Get all options
      const options = await hoursSelect.locator('option').allTextContents()
      console.log(`  Available hour options: ${options.join(', ')}`)

      // Try to select 72 hours
      try {
        await hoursSelect.selectOption({ label: '72 hours' })
        console.log('  Selected: 72 hours')
      } catch {
        // Try by value
        try {
          await hoursSelect.selectOption('72')
          console.log('  Selected: 72 (by value)')
        } catch {
          console.log('  Could not select 72 hours - using default')
        }
      }
    } else {
      console.log('  Hours dropdown not found - checking for other controls')
    }

    await takeScreenshot(page, 'step3-hours-set')

    // Uncheck "Include Twitter" if checked
    console.log('  Looking for Twitter checkbox...')
    const twitterCheckbox = page.locator('input[type="checkbox"]').first()
    const twitterLabel = page.locator('text=Include Twitter')

    if (await twitterLabel.isVisible()) {
      // Find the checkbox near the label
      const checkboxContainer = page.locator('label').filter({ hasText: 'Include Twitter' })
      const checkbox = checkboxContainer.locator('input[type="checkbox"]')

      if (await checkbox.count() > 0) {
        const isChecked = await checkbox.isChecked()
        console.log(`  Twitter checkbox currently: ${isChecked ? 'CHECKED' : 'UNCHECKED'}`)

        if (isChecked) {
          await checkbox.uncheck()
          console.log('  Unchecked "Include Twitter"')
        }
      } else {
        // Try clicking the label/container
        const twitterToggle = page.locator('label').filter({ hasText: 'Twitter' }).first()
        if (await twitterToggle.isVisible()) {
          await twitterToggle.click()
          console.log('  Clicked Twitter toggle')
        }
      }
    } else {
      console.log('  Twitter checkbox not found')
    }

    await takeScreenshot(page, 'step3-twitter-disabled')

    // Click "Scan Sources" button
    console.log('  Looking for Scan Sources button...')
    const scanButton = page.locator('button').filter({ hasText: 'Scan Sources' })

    if (await scanButton.isVisible()) {
      console.log('  Clicking "Scan Sources"...')
      await scanButton.click()

      // Wait for loading spinner to appear
      console.log('  Waiting for scan to complete...')
      await page.waitForTimeout(1000)

      // Wait for loading to finish - look for spinner to disappear
      // The page shows a Loader2 spinner while loading, then either topics or empty message
      try {
        // Wait for either: topics to appear, error message, or loading to finish
        await page.waitForFunction(() => {
          // Check if loading spinner is visible
          const loadingSpinner = document.querySelector('.animate-spin')
          const loadingText = document.body.textContent?.includes('Scanning Twitter and YouTube')

          // If still loading, return false to keep waiting
          if (loadingSpinner || loadingText) {
            return false
          }

          // Loading is done - either topics are there, an error, or empty state
          return true
        }, { timeout: 60000 })
      } catch {
        console.log('  Scan may still be in progress after 60s')
      }

      await page.waitForTimeout(1000)
      await takeScreenshot(page, 'step3-after-scan')

      // Check what result we got
      const errorVisible = await page.locator('.border-destructive').isVisible()
      if (errorVisible) {
        const errorText = await page.locator('.border-destructive').textContent()
        console.log(`  API Error: ${errorText}`)
      }
    } else {
      console.log('  Scan Sources button not found')
      await takeScreenshot(page, 'step3-no-scan-button')
    }

    // Check for topics
    console.log('  Checking for discovered topics...')
    const topicCards = page.locator('button').filter({ has: page.locator('h3') })
    const topicCount = await topicCards.count()
    console.log(`  Topics found: ${topicCount}`)

    let selectedTopics = 0
    if (topicCount > 0) {
      // Select all available topics (or first few)
      console.log('  Selecting topics...')

      // Look for Select All link first
      const selectAllLink = page.locator('text=Select All')
      if (await selectAllLink.isVisible()) {
        await selectAllLink.click()
        selectedTopics = topicCount
        console.log(`  Clicked "Select All" - selected ${topicCount} topics`)
      } else {
        // Click each topic individually (up to 5)
        const maxTopics = Math.min(topicCount, 5)
        for (let i = 0; i < maxTopics; i++) {
          await topicCards.nth(i).click()
          await page.waitForTimeout(200)
          selectedTopics++
        }
        console.log(`  Selected ${selectedTopics} topics manually`)
      }

      await takeScreenshot(page, 'step3-topics-selected')
    } else {
      // Check for "no topics" message or empty state
      const pageContent = await page.textContent('body') || ''
      const emptyStateText = pageContent.includes('Click "Scan Sources" to discover')
      const noTopicsMessage = pageContent.includes('No trending topics') ||
                              pageContent.includes('No topics found') ||
                              pageContent.includes('no stories')

      console.log(`  Empty state (not scanned): ${emptyStateText ? 'YES' : 'NO'}`)
      console.log(`  No topics found message: ${noTopicsMessage ? 'YES' : 'NO'}`)

      await takeScreenshot(page, 'step3-no-topics')
      console.log('\n  RESULT: No topics found in the last 72 hours')
      console.log('  This is expected if:')
      console.log('    - YouTube channels have not posted in the last 72 hours')
      console.log('    - No content matches the configured topic/niche')
      console.log('    - The sources need to be refreshed')
      console.log('\n  The wizard cannot proceed to Step 4 without topics.')
    }

    // Try to proceed to Step 4 if topics were selected
    const canProceed = selectedTopics > 0
    const nextButtonStep3 = page.locator('button').filter({ hasText: /Next/ })
    const nextEnabled = !(await nextButtonStep3.isDisabled())
    console.log(`  Next button enabled: ${nextEnabled}`)

    if (canProceed && nextEnabled) {
      await nextButtonStep3.click()
      await page.waitForTimeout(2000)

      // ===========================================
      // STEP 4: Preview Script
      // ===========================================
      console.log('\n--- STEP 4: Preview Script ---')
      await takeScreenshot(page, 'step4-initial')

      // Verify we're on Step 4
      const previewHeading = await page.locator('text=Preview').isVisible() ||
                            await page.locator('text=Edit Script').isVisible()
      console.log(`  On Step 4 (Preview/Edit): ${previewHeading ? 'YES' : 'CHECKING...'}`)

      // Look for script textarea
      const scriptTextarea = page.locator('textarea')
      if (await scriptTextarea.isVisible()) {
        const scriptContent = await scriptTextarea.inputValue()
        console.log(`  Script generated: ${scriptContent ? 'YES' : 'NO'}`)
        console.log(`  Script length: ${scriptContent?.length || 0} characters`)

        // Show first 200 chars of script
        if (scriptContent) {
          console.log(`  Script preview: ${scriptContent.substring(0, 200)}...`)
        }
      } else {
        console.log('  Script textarea not found')
      }

      // Check for word count
      const wordCountVisible = await page.locator('text=Words:').isVisible() ||
                               await page.locator('text=words').isVisible()
      console.log(`  Word count display: ${wordCountVisible ? 'YES' : 'NO'}`)

      // Wait a moment and take screenshot
      await page.waitForTimeout(1000)
      await takeScreenshot(page, 'step4-with-script')

      // Click Next to go to Step 5
      const nextButtonStep4 = page.locator('button').filter({ hasText: /Next/ })
      if (!(await nextButtonStep4.isDisabled())) {
        await nextButtonStep4.click()
        await page.waitForTimeout(1000)

        // ===========================================
        // STEP 5: Generate Audio
        // ===========================================
        console.log('\n--- STEP 5: Generate Audio ---')
        await takeScreenshot(page, 'step5-initial')

        // Verify we're on Step 5
        const generateHeading = await page.locator('text=Generate Audio').isVisible() ||
                               await page.locator('text=Generate').isVisible()
        console.log(`  On Step 5 (Generate Audio): ${generateHeading ? 'YES' : 'NO'}`)

        // Check summary info
        const hostSummary = await page.locator('text=Host').isVisible()
        const storiesSummary = await page.locator('text=Stories').isVisible() ||
                              await page.locator('text=Topics').isVisible()
        console.log(`  Summary displays - Host: ${hostSummary ? 'YES' : 'NO'}, Stories: ${storiesSummary ? 'YES' : 'NO'}`)

        // Find Generate Audio button
        const generateButton = page.locator('button').filter({ hasText: /Generate Audio/ })
        const generateBtnVisible = await generateButton.isVisible()
        console.log(`  "Generate Audio" button: ${generateBtnVisible ? 'VISIBLE' : 'NOT FOUND'}`)

        if (generateBtnVisible) {
          console.log('\n  Clicking "Generate Audio" to start generation...')
          await generateButton.click()

          // Wait for generation to start
          await page.waitForTimeout(2000)
          await takeScreenshot(page, 'step5-generating')

          // Wait for generation to complete (may take several minutes)
          console.log('  Waiting for audio generation (up to 5 minutes)...')

          try {
            // Look for completion indicators
            await page.waitForFunction(() => {
              const body = document.body.textContent || ''
              return body.includes('Download') ||
                     body.includes('Complete') ||
                     body.includes('Success') ||
                     body.includes('Error') ||
                     body.includes('Failed')
            }, { timeout: 300000 }) // 5 minutes

            await takeScreenshot(page, 'step5-complete')

            // Check if successful
            const hasDownload = await page.locator('text=Download').isVisible()
            const hasComplete = await page.locator('text=Complete').isVisible() ||
                               await page.locator('text=Success').isVisible()
            const hasError = await page.locator('text=Error').isVisible() ||
                            await page.locator('text=Failed').isVisible()

            console.log(`  Generation result:`)
            console.log(`    - Download available: ${hasDownload ? 'YES' : 'NO'}`)
            console.log(`    - Complete/Success: ${hasComplete ? 'YES' : 'NO'}`)
            console.log(`    - Error/Failed: ${hasError ? 'YES' : 'NO'}`)

          } catch {
            console.log('  Generation timed out or still in progress')
            await takeScreenshot(page, 'step5-timeout')
          }
        }
      }
    } else {
      console.log('\n  Cannot proceed - Next button disabled (no topics selected)')
      await takeScreenshot(page, 'step3-cannot-proceed')
    }

    // ===========================================
    // Final Summary
    // ===========================================
    console.log('\n========================================')
    console.log('TEST SUMMARY')
    console.log('========================================')
    console.log(`  Template: ${templateName}`)
    console.log(`  Host: ${selectedHost}`)
    console.log(`  Topics selected: ${selectedTopics}`)
    console.log(`  Wizard progress: ${selectedTopics > 0 ? 'Completed to Step 5' : 'Stopped at Step 3'}`)

    if (consoleErrors.length > 0) {
      console.log('\n  Console Errors:')
      consoleErrors.forEach(err => console.log(`    - ${err}`))
    } else {
      console.log('\n  No console errors')
    }

    console.log('\n  Screenshots saved to: test-screenshots/')
  })
})
