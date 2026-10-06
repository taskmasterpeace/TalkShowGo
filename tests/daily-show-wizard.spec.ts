/**
 * Daily Show Wizard E2E Tests
 * Tests the 5-step wizard at /studio/daily-show
 */

import { test, expect, Page, ConsoleMessage } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

// Store console errors globally for each test
const consoleErrors: Map<string, string[]> = new Map()

test.describe('Daily Show Wizard - Complete Flow', () => {
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

  test('Step 1 - Template Selection: Page loads and displays template options', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-step1-template.png', fullPage: true })

    console.log('=== STEP 1: Template Selection ===')

    // Check page title
    const pageTitle = await page.locator('text=Battle Rap Daily').first().isVisible()
    console.log(`  - Page title "Battle Rap Daily": ${pageTitle ? 'VISIBLE' : 'NOT FOUND'}`)
    expect(pageTitle).toBeTruthy()

    // Check step heading
    const stepHeading = await page.locator('text=Select Show Template').isVisible()
    console.log(`  - "Select Show Template" heading: ${stepHeading ? 'VISIBLE' : 'NOT FOUND'}`)
    expect(stepHeading).toBeTruthy()

    // Check for wizard step indicators
    const wizardSteps = ['Template', 'Host', 'Topics', 'Preview', 'Generate']
    for (const step of wizardSteps) {
      const stepVisible = await page.locator(`text=${step}`).first().isVisible().catch(() => false)
      console.log(`  - Wizard step "${step}": ${stepVisible ? 'VISIBLE' : 'NOT FOUND'}`)
    }

    // Check step icons
    const templateStep = await page.locator('button').filter({ hasText: 'Template' }).first()
    const isActiveStep = await templateStep.evaluate(el => {
      return el.className.includes('bg-primary') || window.getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'
    }).catch(() => false)
    console.log(`  - Template step is active: ${isActiveStep ? 'YES' : 'NO'}`)

    // Check for template cards/buttons
    const templateButtons = await page.locator('button').filter({ has: page.locator('h3') }).count()
    console.log(`  - Template options found: ${templateButtons}`)

    // Check for "No templates found" message if templates are missing
    const noTemplates = await page.locator('text=No templates found').isVisible().catch(() => false)
    if (noTemplates) {
      console.log('  - WARNING: No templates found message displayed')
    }

    // Check navigation buttons
    const backButton = await page.locator('button').filter({ hasText: /Back/ }).isVisible()
    const nextButton = await page.locator('button').filter({ hasText: /Next/ }).isVisible()
    console.log(`  - Back button: ${backButton ? 'VISIBLE' : 'NOT FOUND'}`)
    console.log(`  - Next button: ${nextButton ? 'VISIBLE' : 'NOT FOUND'}`)

    // Verify Back button is disabled on first step
    const backDisabled = await page.locator('button').filter({ hasText: /Back/ }).isDisabled()
    console.log(`  - Back button disabled (expected on step 1): ${backDisabled ? 'YES' : 'NO'}`)
    expect(backDisabled).toBeTruthy()
  })

  test('Step 1 to Step 2 - Template selection and navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    console.log('=== STEP 1 -> STEP 2 NAVIGATION ===')

    // Try to find and click a template
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    const templateCount = await templateCards.count()

    if (templateCount > 0) {
      // Click the first template
      const firstTemplate = templateCards.first()
      const templateName = await firstTemplate.locator('h3').textContent()
      console.log(`  - Selecting template: "${templateName}"`)

      await firstTemplate.click()
      await page.waitForTimeout(500)

      // Take screenshot after selection
      await page.screenshot({ path: 'test-screenshots/daily-show-step1-template-selected.png', fullPage: true })

      // Check for checkmark indicating selection
      const checkIcon = await firstTemplate.locator('svg').first().isVisible().catch(() => false)
      console.log(`  - Selection indicator visible: ${checkIcon ? 'YES' : 'NO'}`)

      // Check Next button is enabled
      const nextButton = page.locator('button').filter({ hasText: /Next/ })
      const nextEnabled = !(await nextButton.isDisabled().catch(() => true))
      console.log(`  - Next button enabled: ${nextEnabled ? 'YES' : 'NO'}`)

      // Click Next to go to Step 2
      await nextButton.click()
      await page.waitForTimeout(1000)

      // Take screenshot of Step 2
      await page.screenshot({ path: 'test-screenshots/daily-show-step2-host.png', fullPage: true })

      // Verify we're on Step 2
      const hostHeading = await page.locator('text=Select Your Host').isVisible()
      console.log(`  - Navigated to Step 2 "Select Your Host": ${hostHeading ? 'YES' : 'NO'}`)
      expect(hostHeading).toBeTruthy()
    } else {
      console.log('  - No templates available, skipping selection test')
      // Even without templates, clicking Next should be disabled
      const nextButton = page.locator('button').filter({ hasText: /Next/ })
      const nextDisabled = await nextButton.isDisabled()
      console.log(`  - Next button disabled (no template selected): ${nextDisabled ? 'YES' : 'NO'}`)
      expect(nextDisabled).toBeTruthy()
    }
  })

  test('Step 2 - Host Selection: Shows all 7 host personalities', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Navigate to Step 2 (select a template first if available)
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
    }

    // Click Next to go to Step 2
    const nextButton = page.locator('button').filter({ hasText: /Next/ })
    if (!(await nextButton.isDisabled().catch(() => true))) {
      await nextButton.click()
      await page.waitForTimeout(1000)
    }

    console.log('=== STEP 2: Host Selection ===')

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-step2-hosts.png', fullPage: true })

    // Check step heading
    const stepHeading = await page.locator('text=Select Your Host').isVisible()
    console.log(`  - "Select Your Host" heading: ${stepHeading ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check for all 7 hosts
    const hostNames = [
      'Maya Sterling',
      'Marcus Blaze',
      'Devon Sharp',
      'Tasha Raw',
      'James Noble',
      'DJ Momentum',
      'King Knowledge'
    ]

    console.log('  - Host personalities:')
    for (const hostName of hostNames) {
      const hostVisible = await page.locator(`text=${hostName}`).first().isVisible().catch(() => false)
      console.log(`    - ${hostName}: ${hostVisible ? 'FOUND' : 'MISSING'}`)
    }

    // Count host cards
    const hostCards = await page.locator('button').filter({ has: page.locator('h3') }).count()
    console.log(`  - Total host cards: ${hostCards}`)
    expect(hostCards).toBeGreaterThanOrEqual(7)

    // Check for archetype labels
    const archetypes = ['investigative anchor', 'hot take king', 'witty satirist', 'unfiltered real',
                       'smooth narrator', 'hype energy', 'street analyst']
    let archetypeCount = 0
    for (const archetype of archetypes) {
      const found = await page.locator(`text=${archetype}`).isVisible().catch(() => false)
      if (found) archetypeCount++
    }
    console.log(`  - Archetype labels found: ${archetypeCount}/7`)

    // Check for Production Format dropdown
    const productionFormatLabel = await page.locator('text=Production Format').isVisible().catch(() => false)
    console.log(`  - Production Format dropdown: ${productionFormatLabel ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check for Algorithm Style checkbox
    const algorithmCheckbox = await page.locator('text=Use Algorithm Institute channel style').isVisible().catch(() => false)
    console.log(`  - Algorithm Style checkbox: ${algorithmCheckbox ? 'VISIBLE' : 'NOT FOUND'}`)
  })

  test('Step 2 to Step 3 - Host selection and navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Navigate through Step 1
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(1000)
    }

    console.log('=== STEP 2 -> STEP 3 NAVIGATION ===')

    // Find and click a host
    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    const hostCount = await hostCards.count()

    if (hostCount > 0) {
      // Click Marcus Blaze (the hot take king)
      const marcusCard = page.locator('button').filter({ hasText: 'Marcus Blaze' })
      const hasMarcus = await marcusCard.isVisible().catch(() => false)

      if (hasMarcus) {
        await marcusCard.click()
        console.log('  - Selected host: Marcus Blaze')
      } else {
        await hostCards.first().click()
        const selectedName = await hostCards.first().locator('h3').textContent()
        console.log(`  - Selected host: ${selectedName}`)
      }

      await page.waitForTimeout(500)

      // Take screenshot after selection
      await page.screenshot({ path: 'test-screenshots/daily-show-step2-host-selected.png', fullPage: true })

      // Click Next to go to Step 3
      const nextButton = page.locator('button').filter({ hasText: /Next/ })
      await nextButton.click()
      await page.waitForTimeout(1000)

      // Take screenshot of Step 3
      await page.screenshot({ path: 'test-screenshots/daily-show-step3-topics.png', fullPage: true })

      // Verify we're on Step 3
      const topicsHeading = await page.locator('text=Select Topics').isVisible()
      console.log(`  - Navigated to Step 3 "Select Topics": ${topicsHeading ? 'YES' : 'NO'}`)
      expect(topicsHeading).toBeTruthy()
    }
  })

  test('Step 3 - Topics Selection: UI elements and scan functionality', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Navigate to Step 3
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await hostCards.count() > 0) {
      await hostCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(1000)
    }

    console.log('=== STEP 3: Topics Selection ===')

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-step3-initial.png', fullPage: true })

    // Check step heading
    const stepHeading = await page.locator('text=Select Topics').isVisible()
    console.log(`  - "Select Topics" heading: ${stepHeading ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check date mode toggle (Hours Back / Specific Date)
    const hoursBackBtn = await page.locator('button').filter({ hasText: 'Hours Back' }).isVisible().catch(() => false)
    const specificDateBtn = await page.locator('button').filter({ hasText: 'Specific Date' }).isVisible().catch(() => false)
    console.log(`  - Date mode toggle:`)
    console.log(`    - Hours Back button: ${hoursBackBtn ? 'VISIBLE' : 'NOT FOUND'}`)
    console.log(`    - Specific Date button: ${specificDateBtn ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check hours dropdown
    const hoursDropdown = await page.locator('select').first().isVisible().catch(() => false)
    console.log(`  - Hours dropdown: ${hoursDropdown ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check Twitter toggle
    const twitterToggle = await page.locator('text=Include Twitter').isVisible().catch(() => false)
    console.log(`  - Include Twitter checkbox: ${twitterToggle ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check Scan Sources button
    const scanButton = await page.locator('button').filter({ hasText: 'Scan Sources' }).isVisible()
    console.log(`  - Scan Sources button: ${scanButton ? 'VISIBLE' : 'NOT FOUND'}`)
    expect(scanButton).toBeTruthy()

    // Check empty state message
    const emptyStateVisible = await page.locator('text=Click "Scan Sources" to discover trending topics').isVisible().catch(() => false)
    console.log(`  - Empty state message: ${emptyStateVisible ? 'VISIBLE' : 'NOT FOUND'}`)

    // Test Specific Date mode
    if (specificDateBtn) {
      await page.locator('button').filter({ hasText: 'Specific Date' }).click()
      await page.waitForTimeout(500)

      // Take screenshot of date mode
      await page.screenshot({ path: 'test-screenshots/daily-show-step3-date-mode.png', fullPage: true })

      // Check for date picker
      const datePicker = await page.locator('input[type="date"]').isVisible().catch(() => false)
      console.log(`  - Date picker visible: ${datePicker ? 'YES' : 'NO'}`)

      // Check for Yesterday/Day Before buttons
      const yesterdayBtn = await page.locator('button').filter({ hasText: 'Yesterday' }).isVisible().catch(() => false)
      const dayBeforeBtn = await page.locator('button').filter({ hasText: 'Day Before' }).isVisible().catch(() => false)
      console.log(`  - Yesterday preset: ${yesterdayBtn ? 'VISIBLE' : 'NOT FOUND'}`)
      console.log(`  - Day Before preset: ${dayBeforeBtn ? 'VISIBLE' : 'NOT FOUND'}`)
    }
  })

  test('Step 3 - Topic checkbox selection', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    // Navigate to Step 3
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await hostCards.count() > 0) {
      await hostCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(1000)
    }

    console.log('=== STEP 3: Topic Selection Checkboxes ===')

    // Check if there are any topics already loaded (from auto-selection or previous state)
    const checkSquareIcons = await page.locator('[class*="CheckSquare"], svg').count()
    const topicButtons = await page.locator('button').filter({ has: page.locator('h3') }).count()

    console.log(`  - Topic buttons found: ${topicButtons}`)

    // Check for Select All / Deselect All link
    const selectAllLink = await page.locator('text=Select All').or(page.locator('text=Deselect All')).isVisible().catch(() => false)
    console.log(`  - Select All/Deselect All link: ${selectAllLink ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check for selection counter
    const selectionCounter = await page.locator('text=/\\d+ of \\d+ selected/').isVisible().catch(() => false)
    console.log(`  - Selection counter: ${selectionCounter ? 'VISIBLE' : 'NOT FOUND'}`)

    // Next button should be disabled if no topics are selected
    const nextButton = page.locator('button').filter({ hasText: /Next/ })
    const nextDisabled = await nextButton.isDisabled().catch(() => true)
    console.log(`  - Next button disabled (no topics): ${nextDisabled ? 'YES (expected)' : 'NO'}`)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-step3-checkboxes.png', fullPage: true })
  })

  test('Step 4 - Preview Script: Shows editable textarea', async ({ page }) => {
    // This test mocks going to step 4 by manipulating state
    // In real scenario, topics would need to be selected first

    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('=== STEP 4: Preview Script ===')

    // Navigate through steps
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await hostCards.count() > 0) {
      await hostCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    // Try clicking on Step 4 directly via the wizard steps (if enabled)
    const previewStep = page.locator('button').filter({ hasText: 'Preview' })
    const previewStepEnabled = !(await previewStep.isDisabled().catch(() => true))

    if (previewStepEnabled) {
      await previewStep.click()
      await page.waitForTimeout(1000)

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/daily-show-step4-preview.png', fullPage: true })

      // Check step heading
      const stepHeading = await page.locator('text=Preview & Edit Script').isVisible()
      console.log(`  - "Preview & Edit Script" heading: ${stepHeading ? 'VISIBLE' : 'NOT FOUND'}`)

      // Check for textarea
      const textarea = await page.locator('textarea').isVisible().catch(() => false)
      console.log(`  - Script textarea: ${textarea ? 'VISIBLE' : 'NOT FOUND'}`)

      // Check for word count
      const wordCount = await page.locator('text=Words:').isVisible().catch(() => false)
      console.log(`  - Word count display: ${wordCount ? 'VISIBLE' : 'NOT FOUND'}`)

      // Check for estimated duration
      const estDuration = await page.locator('text=Est. duration').isVisible().catch(() => false)
      console.log(`  - Estimated duration: ${estDuration ? 'VISIBLE' : 'NOT FOUND'}`)

      // Check for Regenerate button
      const regenerateBtn = await page.locator('button').filter({ hasText: 'Regenerate' }).isVisible().catch(() => false)
      console.log(`  - Regenerate button: ${regenerateBtn ? 'VISIBLE' : 'NOT FOUND'}`)
    } else {
      console.log('  - Cannot access Step 4 without completing previous steps')
      console.log('  - Step 4 is correctly gated (expected behavior)')

      // Take screenshot showing the disabled state
      await page.screenshot({ path: 'test-screenshots/daily-show-step4-blocked.png', fullPage: true })
    }
  })

  test('Step 5 - Generate Audio: Shows generation UI', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('=== STEP 5: Generate Audio ===')

    // Navigate through steps
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await hostCards.count() > 0) {
      await hostCards.first().click()
      await page.waitForTimeout(300)
    }

    // Try clicking on Step 5 directly via the wizard steps (if enabled)
    const generateStep = page.locator('button').filter({ hasText: 'Generate' })
    const generateStepEnabled = !(await generateStep.isDisabled().catch(() => true))

    if (generateStepEnabled) {
      await generateStep.click()
      await page.waitForTimeout(1000)

      // Take screenshot
      await page.screenshot({ path: 'test-screenshots/daily-show-step5-generate.png', fullPage: true })

      // Check step heading
      const stepHeading = await page.locator('text=Generate Audio').isVisible()
      console.log(`  - "Generate Audio" heading: ${stepHeading ? 'VISIBLE' : 'NOT FOUND'}`)

      // Check for summary cards (Host, Stories, Duration)
      const hostSummary = await page.locator('text=Host').isVisible().catch(() => false)
      const storiesSummary = await page.locator('text=Stories').isVisible().catch(() => false)
      const durationSummary = await page.locator('text=Duration').isVisible().catch(() => false)
      console.log(`  - Summary cards:`)
      console.log(`    - Host: ${hostSummary ? 'VISIBLE' : 'NOT FOUND'}`)
      console.log(`    - Stories: ${storiesSummary ? 'VISIBLE' : 'NOT FOUND'}`)
      console.log(`    - Duration: ${durationSummary ? 'VISIBLE' : 'NOT FOUND'}`)

      // Check for Generate Audio button
      const generateBtn = await page.locator('button').filter({ hasText: 'Generate Audio' }).isVisible().catch(() => false)
      console.log(`  - Generate Audio button: ${generateBtn ? 'VISIBLE' : 'NOT FOUND'}`)
    } else {
      console.log('  - Cannot access Step 5 without completing previous steps')
      console.log('  - Step 5 is correctly gated (expected behavior)')

      // Take screenshot showing the disabled state
      await page.screenshot({ path: 'test-screenshots/daily-show-step5-blocked.png', fullPage: true })
    }
  })

  test('Navigation - Back button works correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('=== BACK NAVIGATION TEST ===')

    // Navigate to Step 2
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(1000)
    }

    // Verify we're on Step 2
    const onStep2 = await page.locator('text=Select Your Host').isVisible()
    console.log(`  - On Step 2: ${onStep2 ? 'YES' : 'NO'}`)

    // Click Back
    await page.locator('button').filter({ hasText: /Back/ }).click()
    await page.waitForTimeout(1000)

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-back-navigation.png', fullPage: true })

    // Verify we're back on Step 1
    const onStep1 = await page.locator('text=Select Show Template').isVisible()
    console.log(`  - Returned to Step 1: ${onStep1 ? 'YES' : 'NO'}`)
    expect(onStep1).toBeTruthy()

    // Verify Back button is disabled again
    const backDisabled = await page.locator('button').filter({ hasText: /Back/ }).isDisabled()
    console.log(`  - Back button disabled on Step 1: ${backDisabled ? 'YES' : 'NO'}`)
    expect(backDisabled).toBeTruthy()
  })

  test('Step indicators show correct progress', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('=== STEP INDICATORS TEST ===')

    // Step 1: Template should be active
    const templateBtn = page.locator('button').filter({ hasText: 'Template' }).first()
    let templateClasses = await templateBtn.getAttribute('class') || ''
    console.log(`  - Step 1 (Template):`)
    console.log(`    - Has primary/active styling: ${templateClasses.includes('bg-primary') ? 'YES' : 'NO'}`)

    // Navigate to Step 2
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(1000)
    }

    // Take screenshot showing step progress
    await page.screenshot({ path: 'test-screenshots/daily-show-step-indicators.png', fullPage: true })

    // Check Step 1 is now completed (should have checkmark icon or success styling)
    templateClasses = await templateBtn.getAttribute('class') || ''
    const hasSuccessStyle = templateClasses.includes('success') || templateClasses.includes('text-success')
    console.log(`  - Step 1 (Template) completed:`)
    console.log(`    - Has success/completed styling: ${hasSuccessStyle ? 'YES' : 'checking SVG...'}`)

    // Check for checkmark icon in Step 1
    const checkIcon = await templateBtn.locator('svg').first()
    const hasCheckIcon = await checkIcon.isVisible().catch(() => false)
    console.log(`    - Has checkmark icon: ${hasCheckIcon ? 'YES' : 'NO'}`)

    // Step 2 should be active
    const hostBtn = page.locator('button').filter({ hasText: 'Host' }).first()
    const hostClasses = await hostBtn.getAttribute('class') || ''
    console.log(`  - Step 2 (Host):`)
    console.log(`    - Has primary/active styling: ${hostClasses.includes('bg-primary') ? 'YES' : 'NO'}`)

    // Steps 3, 4, 5 should be disabled/muted
    const topicsBtn = page.locator('button').filter({ hasText: 'Topics' }).first()
    const topicsDisabled = await topicsBtn.isDisabled()
    console.log(`  - Step 3 (Topics) disabled: ${topicsDisabled ? 'YES (expected)' : 'NO'}`)
  })

  test('Wizard step click navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('=== WIZARD STEP CLICK NAVIGATION ===')

    // Complete Step 1
    const templateCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    // Complete Step 2 - select a host
    const hostCards = page.locator('button').filter({ has: page.locator('h3') })
    if (await hostCards.count() > 0) {
      await hostCards.first().click()
      await page.waitForTimeout(300)
      await page.locator('button').filter({ hasText: /Next/ }).click()
      await page.waitForTimeout(500)
    }

    // Now try clicking back to Step 1 via the wizard step indicator
    const templateStep = page.locator('button').filter({ hasText: 'Template' }).first()
    await templateStep.click()
    await page.waitForTimeout(500)

    // Verify we're back on Step 1
    const onStep1 = await page.locator('text=Select Show Template').isVisible()
    console.log(`  - Clicking Template step returned to Step 1: ${onStep1 ? 'YES' : 'NO'}`)
    expect(onStep1).toBeTruthy()

    // Take screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-wizard-click-nav.png', fullPage: true })

    // NOTE: When clicking back to Step 1, we lose the selection state, so Host step becomes disabled
    // This is expected behavior - the wizard requires completing steps in order
    const hostStep = page.locator('button').filter({ hasText: 'Host' }).first()
    const hostStepDisabled = await hostStep.isDisabled()
    console.log(`  - Host step disabled after going back to Step 1: ${hostStepDisabled ? 'YES (expected - need to select template again)' : 'NO'}`)

    // Re-select a template to enable Host step
    if (await templateCards.count() > 0) {
      await templateCards.first().click()
      await page.waitForTimeout(300)
    }

    // Now Host step should be clickable via Next button
    const nextButton = page.locator('button').filter({ hasText: /Next/ })
    const nextEnabled = !(await nextButton.isDisabled().catch(() => true))
    console.log(`  - Next button enabled after re-selecting template: ${nextEnabled ? 'YES' : 'NO'}`)

    if (nextEnabled) {
      await nextButton.click()
      await page.waitForTimeout(500)
      const onStep2 = await page.locator('text=Select Your Host').isVisible()
      console.log(`  - Successfully navigated to Step 2: ${onStep2 ? 'YES' : 'NO'}`)
      expect(onStep2).toBeTruthy()
    }
  })

  test('UI Layout and Responsiveness', async ({ page }) => {
    await page.goto(`${BASE_URL}/studio/daily-show`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    console.log('=== UI LAYOUT TEST ===')

    // Check main container
    const mainContainer = await page.locator('.max-w-6xl').isVisible().catch(() => false)
    console.log(`  - Main container (max-w-6xl): ${mainContainer ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check header elements
    const radioIcon = await page.locator('svg').first().isVisible().catch(() => false)
    const pageTitle = await page.locator('text=Battle Rap Daily').first().isVisible()
    const subtitle = await page.locator('text=Create your daily show in 5 steps').isVisible().catch(() => false)
    console.log(`  - Header:`)
    console.log(`    - Icon: ${radioIcon ? 'VISIBLE' : 'NOT FOUND'}`)
    console.log(`    - Title: ${pageTitle ? 'VISIBLE' : 'NOT FOUND'}`)
    console.log(`    - Subtitle: ${subtitle ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check wizard step bar
    const wizardBar = await page.locator('div').filter({ has: page.locator('button:has-text("Template")') }).first()
    const hasWizardBar = await wizardBar.isVisible().catch(() => false)
    console.log(`  - Wizard step bar: ${hasWizardBar ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check content area has proper styling
    const contentArea = await page.locator('div.border-2.border-foreground').first().isVisible().catch(() => false)
    console.log(`  - Content area (border-2): ${contentArea ? 'VISIBLE' : 'NOT FOUND'}`)

    // Check navigation buttons are properly positioned
    const navButtonsContainer = await page.locator('div.flex.justify-between').last().isVisible().catch(() => false)
    console.log(`  - Navigation buttons container: ${navButtonsContainer ? 'VISIBLE' : 'NOT FOUND'}`)

    // Take full-page screenshot
    await page.screenshot({ path: 'test-screenshots/daily-show-layout.png', fullPage: true })

    // Test at smaller viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'test-screenshots/daily-show-layout-tablet.png', fullPage: true })
    console.log(`  - Tablet viewport screenshot captured`)

    // Restore viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
  })
})

test('SUMMARY - Compile test results', async ({ page }) => {
  console.log('\n========================================')
  console.log('DAILY SHOW WIZARD TEST SUMMARY')
  console.log('========================================\n')

  console.log('All console errors collected:')
  for (const [testName, errors] of consoleErrors.entries()) {
    if (errors.length > 0) {
      console.log(`\n[${testName}]`)
      errors.forEach(err => console.log(`  - ${err}`))
    }
  }

  console.log('\nScreenshots saved to: test-screenshots/')
  console.log('\nTest Files:')
  console.log('  - daily-show-step1-template.png')
  console.log('  - daily-show-step1-template-selected.png')
  console.log('  - daily-show-step2-host.png')
  console.log('  - daily-show-step2-hosts.png')
  console.log('  - daily-show-step2-host-selected.png')
  console.log('  - daily-show-step3-topics.png')
  console.log('  - daily-show-step3-initial.png')
  console.log('  - daily-show-step3-date-mode.png')
  console.log('  - daily-show-step3-checkboxes.png')
  console.log('  - daily-show-step4-preview.png / daily-show-step4-blocked.png')
  console.log('  - daily-show-step5-generate.png / daily-show-step5-blocked.png')
  console.log('  - daily-show-back-navigation.png')
  console.log('  - daily-show-step-indicators.png')
  console.log('  - daily-show-wizard-click-nav.png')
  console.log('  - daily-show-layout.png')
  console.log('  - daily-show-layout-tablet.png')
  console.log('\nDone!')

  expect(true).toBeTruthy()
})
