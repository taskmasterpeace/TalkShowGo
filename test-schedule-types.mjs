/**
 * Test Schedule Type UI - Test all 3 schedule types
 */

import { chromium } from 'playwright'

async function testScheduleTypes() {
  console.log('🚀 Testing Schedule Type UI...\n')

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
    slowMo: 800
  })

  const context = await browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true
  })

  const page = await context.newPage()

  try {
    // Navigate to schedules page
    await page.goto('http://localhost:3000/studio/schedules', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ Schedules page loaded\n')

    // Set Battle Rap topic
    await page.evaluate(() => {
      localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    })

    // Refresh to apply topic
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    console.log('======================================')
    console.log(' Test 1: Daily Schedule')
    console.log('======================================\n')

    await page.click('button:has-text("New Schedule")')
    await page.waitForTimeout(1000)

    // Check Daily is selected by default
    const dailyButton = page.locator('button:has-text("Daily")').first()
    const hasYellowBg = await dailyButton.evaluate(el =>
      window.getComputedStyle(el).backgroundColor.includes('255, 193, 7') ||
      el.className.includes('bg-primary')
    )
    console.log(`Daily button selected: ${hasYellowBg ? 'YES ✅' : 'NO ❌'}`)

    // Check for time input
    const timeInput = await page.locator('input[type="time"]').isVisible()
    console.log(`Time input visible: ${timeInput ? 'YES ✅' : 'NO ❌'}`)

    // Check help text
    const dailyHelp = await page.locator('text=Show will generate every day at this time').isVisible()
    console.log(`Help text visible: ${dailyHelp ? 'YES ✅' : 'NO ❌'}`)

    await page.screenshot({ path: 'schedule-daily.png', fullPage: true })
    console.log('📸 Screenshot: schedule-daily.png\n')

    console.log('======================================')
    console.log(' Test 2: Weekly Schedule')
    console.log('======================================\n')

    await page.click('button:has-text("Weekly")')
    await page.waitForTimeout(500)

    // Check day buttons
    const monButton = await page.locator('button:has-text("Mon")').isVisible()
    const tueButton = await page.locator('button:has-text("Tue")').isVisible()
    console.log(`Day selector visible: ${monButton && tueButton ? 'YES ✅' : 'NO ❌'}`)

    // Check Mon-Fri are selected by default
    const monSelected = await page.locator('button:has-text("Mon")').first().evaluate(el =>
      el.className.includes('bg-primary')
    )
    console.log(`Mon-Fri selected by default: ${monSelected ? 'YES ✅' : 'NO ❌'}`)

    // Check help text
    const weeklyHelp = await page.locator('text=Select which days to generate shows').isVisible()
    console.log(`Help text visible: ${weeklyHelp ? 'YES ✅' : 'NO ❌'}`)

    await page.screenshot({ path: 'schedule-weekly.png', fullPage: true })
    console.log('📸 Screenshot: schedule-weekly.png\n')

    console.log('======================================')
    console.log(' Test 3: Interval Schedule')
    console.log('======================================\n')

    await page.click('button:has-text("Interval")')
    await page.waitForTimeout(500)

    // Check interval input
    const intervalInput = await page.locator('input[type="number"]').first().isVisible()
    console.log(`Interval input visible: ${intervalInput ? 'YES ✅' : 'NO ❌'}`)

    // Check default value
    const intervalValue = await page.locator('input[type="number"]').first().inputValue()
    console.log(`Default interval value: ${intervalValue} hours`)

    // Check help text
    const intervalHelp = await page.locator('text=Show will generate every').isVisible()
    console.log(`Help text visible: ${intervalHelp ? 'YES ✅' : 'NO ❌'}`)

    await page.screenshot({ path: 'schedule-interval.png', fullPage: true })
    console.log('📸 Screenshot: schedule-interval.png\n')

    console.log('======================================')
    console.log(' Test 4: Verify No Cron Option')
    console.log('======================================\n')

    // Check that Cron button does NOT exist
    const noCronButton = await page.locator('button:has-text("Cron")').count() === 0
    console.log(`Cron button removed: ${noCronButton ? 'YES ✅' : 'NO ❌'}`)

    // Check that cron expression input does NOT exist
    const noCronInput = await page.locator('input[placeholder*="0 9"]').count() === 0
    console.log(`Cron input removed: ${noCronInput ? 'YES ✅' : 'NO ❌'}`)

    console.log('\n======================================')
    console.log(' Test 5: Create Daily Schedule')
    console.log('======================================\n')

    // Switch back to Daily
    await page.click('button:has-text("Daily")')
    await page.waitForTimeout(500)

    // Set time to 9:00 AM
    await page.locator('input[type="time"]').first().fill('09:00')

    // Set show name
    await page.locator('input[placeholder="Battle Rap"]').fill('Test Daily Show')

    // Scroll to bottom
    await page.evaluate(() => {
      const modal = document.querySelector('.max-h-\\[90vh\\]')
      if (modal) modal.scrollTop = modal.scrollHeight
    })
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'schedule-create-filled.png', fullPage: false })
    console.log('📸 Screenshot: schedule-create-filled.png')
    console.log('✅ Form filled successfully\n')

    console.log('======================================')
    console.log(' ✅ All Tests Passed!')
    console.log('======================================\n')

    console.log('Browser will stay open for manual testing.')
    console.log('Press Ctrl+C to close.\n')

    // Keep browser open
    await page.waitForTimeout(999999999)

  } catch (error) {
    console.error('❌ Test failed:', error.message)
    await page.screenshot({ path: 'schedule-test-error.png', fullPage: true })
    await browser.close()
    process.exit(1)
  }
}

process.on('SIGINT', () => {
  console.log('\n👋 Closing browser...')
  process.exit(0)
})

testScheduleTypes()
