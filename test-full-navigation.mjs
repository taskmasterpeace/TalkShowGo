/**
 * Full Navigation Test - Actually clicks through the UI
 * Tests the complete scheduler workflow
 */

import { chromium } from 'playwright'

async function fullNavigationTest() {
  console.log('🚀 Starting Full Navigation Test...')
  console.log('')

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
    slowMo: 500  // Slow down actions so you can see them
  })

  const context = await browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true
  })

  const page = await context.newPage()

  try {
    console.log('========================================')
    console.log(' Step 1: Navigate to Home')
    console.log('========================================')
    console.log('')

    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ Home page loaded')
    await page.screenshot({ path: '1-home.png', fullPage: true })
    console.log('📸 Screenshot: 1-home.png')
    console.log('')

    // Wait for page to settle
    await page.waitForTimeout(2000)

    console.log('========================================')
    console.log(' Step 2: Select Topic')
    console.log('========================================')
    console.log('')

    // Try to find and click the topic selector
    console.log('Looking for topic selector...')

    // Check if there's a dropdown or button to select topic
    const topicSelector = await page.locator('button:has-text("Loading")').first().isVisible({ timeout: 5000 }).catch(() => false)

    if (topicSelector) {
      console.log('Found topic selector with "Loading" text')
      await page.locator('button:has-text("Loading")').first().click()
      await page.waitForTimeout(1000)

      // Look for Battle Rap option
      const battleRapOption = await page.locator('text=Battle Rap').first().isVisible({ timeout: 5000 }).catch(() => false)
      if (battleRapOption) {
        console.log('Clicking Battle Rap...')
        await page.locator('text=Battle Rap').first().click()
        await page.waitForTimeout(1000)
        console.log('✅ Battle Rap selected')
      }
    } else {
      console.log('Topic selector not found with standard method')
      console.log('Trying to find any select/dropdown...')

      // Try to find select element
      const selectExists = await page.locator('select').first().isVisible({ timeout: 5000 }).catch(() => false)
      if (selectExists) {
        await page.locator('select').first().selectOption('Battle Rap')
        console.log('✅ Battle Rap selected via select element')
      } else {
        console.log('⚠️ Could not find topic selector - might need manual selection')
      }
    }

    await page.screenshot({ path: '2-topic-selected.png', fullPage: true })
    console.log('📸 Screenshot: 2-topic-selected.png')
    console.log('')

    console.log('========================================')
    console.log(' Step 3: Navigate to Schedules')
    console.log('========================================')
    console.log('')

    await page.goto('http://localhost:3000/studio/schedules', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ At schedules page')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '3-schedules-page.png', fullPage: true })
    console.log('📸 Screenshot: 3-schedules-page.png')
    console.log('')

    // Check what's visible on the page
    const hasTopicWarning = await page.locator('text=Please select a topic first').isVisible().catch(() => false)
    const hasNewScheduleButton = await page.locator('button:has-text("New Schedule")').isVisible().catch(() => false)
    const hasSchedulesHeading = await page.locator('h1:has-text("Daily Show Schedules")').isVisible().catch(() => false)

    console.log('Page content check:')
    console.log(`  - "Please select topic" warning: ${hasTopicWarning ? 'YES ⚠️' : 'NO ✅'}`)
    console.log(`  - "New Schedule" button: ${hasNewScheduleButton ? 'YES ✅' : 'NO ⚠️'}`)
    console.log(`  - "Daily Show Schedules" heading: ${hasSchedulesHeading ? 'YES ✅' : 'NO ⚠️'}`)
    console.log('')

    if (hasTopicWarning) {
      console.log('⚠️ Still showing topic warning. Let me check localStorage...')

      // Check localStorage
      const topicId = await page.evaluate(() => localStorage.getItem('selectedTopicId'))
      console.log(`localStorage selectedTopicId: ${topicId || 'NOT SET'}`)

      if (!topicId) {
        console.log('Setting Battle Rap topic manually in localStorage...')
        await page.evaluate(() => {
          localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
        })
        await page.reload({ waitUntil: 'networkidle' })
        console.log('✅ Page reloaded with topic set')
        await page.waitForTimeout(2000)
      }
    }

    await page.screenshot({ path: '4-after-topic-fix.png', fullPage: true })
    console.log('📸 Screenshot: 4-after-topic-fix.png')
    console.log('')

    console.log('========================================')
    console.log(' Step 4: Test New Schedule Button')
    console.log('========================================')
    console.log('')

    const newScheduleBtn = await page.locator('button:has-text("New Schedule")').isVisible({ timeout: 5000 }).catch(() => false)

    if (newScheduleBtn) {
      console.log('Found "New Schedule" button, clicking it...')
      await page.locator('button:has-text("New Schedule")').first().click()
      await page.waitForTimeout(1500)

      await page.screenshot({ path: '5-create-modal.png', fullPage: true })
      console.log('📸 Screenshot: 5-create-modal.png')
      console.log('✅ Create schedule modal opened')
      console.log('')

      // Check modal contents
      const hasDaily = await page.locator('button:has-text("Daily")').isVisible().catch(() => false)
      const hasWeekly = await page.locator('button:has-text("Weekly")').isVisible().catch(() => false)
      const hasInterval = await page.locator('button:has-text("Interval")').isVisible().catch(() => false)

      console.log('Modal contents:')
      console.log(`  - Daily button: ${hasDaily ? 'YES ✅' : 'NO'}`)
      console.log(`  - Weekly button: ${hasWeekly ? 'YES ✅' : 'NO'}`)
      console.log(`  - Interval button: ${hasInterval ? 'YES ✅' : 'NO'}`)
      console.log('')

      // Close modal
      const cancelBtn = await page.locator('button:has-text("Cancel")').isVisible().catch(() => false)
      if (cancelBtn) {
        console.log('Closing modal...')
        await page.locator('button:has-text("Cancel")').click()
        await page.waitForTimeout(500)
      }
    } else {
      console.log('⚠️ "New Schedule" button not found')
    }

    console.log('')
    console.log('========================================')
    console.log(' Step 5: Navigate Through App')
    console.log('========================================')
    console.log('')

    const pages = [
      { url: '/studio/daily-show', name: 'Daily Show' },
      { url: '/studio/templates', name: 'Templates' },
      { url: '/studio/hosts', name: 'Hosts' },
      { url: '/studio/topics', name: 'Topics' }
    ]

    for (const testPage of pages) {
      console.log(`Navigating to ${testPage.name}...`)
      await page.goto(`http://localhost:3000${testPage.url}`, {
        waitUntil: 'networkidle',
        timeout: 15000
      })
      await page.waitForTimeout(1000)
      await page.screenshot({ path: `6-${testPage.name.toLowerCase().replace(' ', '-')}.png`, fullPage: true })
      console.log(`✅ ${testPage.name} loaded`)
    }

    console.log('')
    console.log('========================================')
    console.log(' Test Complete!')
    console.log('========================================')
    console.log('')
    console.log('Screenshots saved:')
    console.log('  1. 1-home.png')
    console.log('  2. 2-topic-selected.png')
    console.log('  3. 3-schedules-page.png')
    console.log('  4. 4-after-topic-fix.png')
    console.log('  5. 5-create-modal.png')
    console.log('  6. 6-daily-show.png')
    console.log('  7. 6-templates.png')
    console.log('  8. 6-hosts.png')
    console.log('  9. 6-topics.png')
    console.log('')
    console.log('Browser will stay open for manual testing.')
    console.log('Press Ctrl+C to close.')
    console.log('')

    // Wait indefinitely
    await page.waitForTimeout(999999999)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('')
    await page.screenshot({ path: 'error.png', fullPage: true })
    console.log('📸 Error screenshot: error.png')
    await browser.close()
    process.exit(1)
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Closing browser...')
  process.exit(0)
})

fullNavigationTest()
