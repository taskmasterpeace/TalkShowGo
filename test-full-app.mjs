/**
 * Comprehensive UI/UX Testing Script
 * Tests all sections of the Talk Show Go application
 */

import { chromium } from 'playwright'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'
const SCREENSHOT_DIR = 'test-screenshots'

// Create screenshots directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR)
}

async function testApp() {
  console.log('🚀 Starting comprehensive UI/UX testing...\n')

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
    slowMo: 500
  })

  const context = await browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true
  })

  const page = await context.newPage()

  // Track console errors
  const errors = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`[${new Date().toISOString()}] ${msg.text()}`)
    }
  })

  page.on('pageerror', error => {
    errors.push(`[PAGE ERROR] ${error.message}`)
  })

  try {
    console.log('======================================')
    console.log(' SETUP: Navigate to Home Page')
    console.log('======================================\n')

    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 })
    console.log('✅ Home page loaded')

    // Set Battle Rap topic
    await page.evaluate(() => {
      localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    })
    console.log('✅ Topic set to Battle Rap\n')

    // Test sections
    const sections = [
      { name: 'Command Center', path: '/', selector: 'h1:has-text("Command Center")' },
      { name: 'OUTPOST (Topics)', path: '/studio', selector: 'text=Topics' },
      { name: 'PERIMETER', path: '/perimeter', selector: 'h1:has-text("Signal Monitor")' },
      { name: 'EXTRACTION', path: '/extraction', selector: 'h1:has-text("Entity Map")' },
      { name: 'AUDIT', path: '/audit', selector: 'h1:has-text("Credibility Ledger")' },
      { name: 'TRIBUNAL', path: '/tribunal', selector: 'h1:has-text("Nominations")' },
      { name: 'NEXUS', path: '/nexus', selector: 'h1:has-text("Story Desk")' },
      { name: 'SANCTION', path: '/sanction', selector: 'h1:has-text("Story Workbench")' },
      { name: 'SIGNAL', path: '/signal', selector: 'h1:has-text("Export Center")' },
      { name: 'Studio - Hosts', path: '/studio/hosts', selector: 'h1:has-text("Hosts")' },
      { name: 'Studio - Voices', path: '/studio/voices', selector: 'h1:has-text("Voices")' },
      { name: 'Studio - Templates', path: '/studio/templates', selector: 'h1:has-text("Templates")' },
      { name: 'Studio - Daily Show', path: '/studio/daily-show', selector: 'h1:has-text("Daily Show")' },
      { name: 'Studio - Schedules', path: '/studio/schedules', selector: 'h1:has-text("Daily Show Schedules")' },
      { name: 'Studio - Entities', path: '/studio/entities', selector: 'h1:has-text("Entities")' },
      { name: 'Studio - Research', path: '/studio/research', selector: 'text=Research' },
      { name: 'Settings', path: '/settings', selector: 'h1:has-text("Settings")' },
    ]

    for (const section of sections) {
      console.log('======================================')
      console.log(` Testing: ${section.name}`)
      console.log('======================================\n')

      try {
        // Navigate to section
        await page.goto(`${BASE_URL}${section.path}`, {
          waitUntil: 'networkidle',
          timeout: 30000
        })

        // Wait for expected content
        const hasContent = await page.locator(section.selector).isVisible({ timeout: 5000 }).catch(() => false)

        if (hasContent) {
          console.log(`✅ ${section.name} loaded successfully`)

          // Take screenshot
          const filename = `${SCREENSHOT_DIR}/${section.name.replace(/\s+/g, '-').toLowerCase()}.png`
          await page.screenshot({ path: filename, fullPage: true })
          console.log(`📸 Screenshot: ${filename}`)

        } else {
          console.log(`⚠️ ${section.name} - Expected content not found`)
          const filename = `${SCREENSHOT_DIR}/${section.name.replace(/\s+/g, '-').toLowerCase()}-ERROR.png`
          await page.screenshot({ path: filename, fullPage: true })
          console.log(`📸 Error screenshot: ${filename}`)
        }

        // Check for obvious errors
        const hasError = await page.locator('text=Error').isVisible().catch(() => false)
        const has404 = await page.locator('text=404').isVisible().catch(() => false)
        const hasWarning = await page.locator('text=Please select a topic').isVisible().catch(() => false)

        if (hasError) console.log('❌ Page shows error message')
        if (has404) console.log('❌ Page shows 404')
        if (hasWarning && !section.name.includes('Schedules')) {
          console.log('⚠️ Topic selection warning (may be expected)')
        }

        await page.waitForTimeout(1000)

      } catch (error) {
        console.log(`❌ ${section.name} - Failed to load: ${error.message}`)
        const filename = `${SCREENSHOT_DIR}/${section.name.replace(/\s+/g, '-').toLowerCase()}-CRASH.png`
        await page.screenshot({ path: filename, fullPage: true })
      }

      console.log('')
    }

    console.log('======================================')
    console.log(' Testing Interactive Features')
    console.log('======================================\n')

    // Test Entities page - enrichment feature
    console.log('Testing Entities page enrichment...')
    await page.goto(`${BASE_URL}/studio/entities`, { waitUntil: 'networkidle' })
    const hasEntities = await page.locator('.border-2.border-foreground').first().isVisible().catch(() => false)
    if (hasEntities) {
      console.log('✅ Entities list visible')
      await page.screenshot({ path: `${SCREENSHOT_DIR}/entities-detailed.png`, fullPage: true })
    } else {
      console.log('⚠️ No entities visible')
    }
    console.log('')

    // Test Templates page - create button
    console.log('Testing Templates page...')
    await page.goto(`${BASE_URL}/studio/templates`, { waitUntil: 'networkidle' })
    const hasCreateButton = await page.locator('button:has-text("Create Template")').isVisible().catch(() => false)
    if (hasCreateButton) {
      console.log('✅ Create Template button visible')
    } else {
      console.log('⚠️ Create Template button not found')
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/templates-detailed.png`, fullPage: true })
    console.log('')

    // Test Daily Show wizard
    console.log('Testing Daily Show wizard...')
    await page.goto(`${BASE_URL}/studio/daily-show`, { waitUntil: 'networkidle' })
    const hasWizard = await page.locator('text=Step 1').isVisible().catch(() => false)
    if (hasWizard) {
      console.log('✅ Daily Show wizard visible')
    } else {
      console.log('⚠️ Wizard not found')
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/daily-show-wizard.png`, fullPage: true })
    console.log('')

    // Test Schedules page - create modal
    console.log('Testing Schedules creation modal...')
    await page.goto(`${BASE_URL}/studio/schedules`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    const newScheduleBtn = await page.locator('button:has-text("New Schedule")').isVisible().catch(() => false)
    if (newScheduleBtn) {
      console.log('✅ New Schedule button visible')
      await page.click('button:has-text("New Schedule")')
      await page.waitForTimeout(1000)
      const modalVisible = await page.locator('text=Create New Schedule').isVisible().catch(() => false)
      if (modalVisible) {
        console.log('✅ Schedule creation modal opens')
        await page.screenshot({ path: `${SCREENSHOT_DIR}/schedule-modal.png` })
      } else {
        console.log('❌ Modal did not open')
      }
    } else {
      console.log('❌ New Schedule button not found')
    }
    console.log('')

    console.log('======================================')
    console.log(' Test Summary')
    console.log('======================================\n')

    console.log(`Total sections tested: ${sections.length}`)
    console.log(`Console errors detected: ${errors.length}`)

    if (errors.length > 0) {
      console.log('\n⚠️ Console Errors:\n')
      errors.forEach(err => console.log(`  ${err}`))
    }

    console.log('\n✅ Testing complete! Screenshots saved to:', SCREENSHOT_DIR)
    console.log('\nBrowser will stay open for manual inspection.')
    console.log('Press Ctrl+C to close.\n')

    // Keep browser open
    await page.waitForTimeout(999999999)

  } catch (error) {
    console.error('❌ Test suite failed:', error.message)
    await page.screenshot({ path: `${SCREENSHOT_DIR}/test-suite-error.png`, fullPage: true })
    await browser.close()
    process.exit(1)
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Closing browser...')
  process.exit(0)
})

testApp()
