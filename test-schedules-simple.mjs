/**
 * Simple Schedules Test - Sets topic via localStorage first
 */

import { chromium } from 'playwright'

async function testSchedules() {
  console.log('🚀 Starting Simple Schedules Test...')
  console.log('')

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

  try {
    console.log('========================================')
    console.log(' Step 1: Navigate and Set Topic')
    console.log('========================================')
    console.log('')

    // Go to home page first
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ Home page loaded')

    // Set Battle Rap topic in localStorage
    console.log('Setting Battle Rap topic ID in localStorage...')
    await page.evaluate(() => {
      localStorage.setItem('selectedTopicId', '864dbcf4-e1f7-4b1a-86ed-c18007439ad5')
    })
    console.log('✅ Topic ID set')
    console.log('')

    console.log('========================================')
    console.log(' Step 2: Navigate to Schedules')
    console.log('========================================')
    console.log('')

    // Listen for ALL console messages BEFORE navigation
    console.log('Setting up console listeners...')
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      // Show ALL console.log, console.error, and console.warn messages
      console.log(`  [Browser ${type}] ${text}`)
    })

    // Listen for page errors
    page.on('pageerror', error => {
      console.log(`  [Page Error] ${error.message}`)
    })

    await page.goto('http://localhost:3000/studio/schedules', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ Schedules page loaded')

    // Check for React hydration errors immediately
    const hydrationErrors = await page.evaluate(() => {
      const errors = []
      // Check for common React hydration issues
      const hasHydrationError = document.body.innerHTML.includes('Hydration')
      if (hasHydrationError) errors.push('Hydration error detected in HTML')
      return errors
    })
    if (hydrationErrors.length > 0) {
      console.log('⚠️ Hydration issues:', hydrationErrors)
    }

    // Wait longer for topic to load
    console.log('Waiting for topic to load (15 seconds)...')
    await page.waitForTimeout(15000)

    await page.screenshot({ path: 'schedules-test.png', fullPage: true })
    console.log('📸 Screenshot: schedules-test.png')
    console.log('')

    // Check localStorage and window state
    const debugInfo = await page.evaluate(() => {
      return {
        topicId: localStorage.getItem('selectedTopicId'),
        apiUrl: window.location.origin + '/api/topics',
        // Try to access React DevTools if available
        hasReact: typeof window.React !== 'undefined'
      }
    })
    console.log(`localStorage selectedTopicId: ${debugInfo.topicId}`)
    console.log(`API URL would be: ${debugInfo.apiUrl}`)
    console.log(`React loaded: ${debugInfo.hasReact}`)

    // Check the topic selector button text
    const topicButtonText = await page.locator('button').filter({ hasText: 'Loading' }).first().textContent().catch(() => null)
    console.log(`Topic selector button text: ${topicButtonText || '(not found)'}`)

    // Try to fetch topics manually to see if it works
    console.log('')
    console.log('Testing API call from browser...')
    const apiTest = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/topics')
        const data = await res.json()
        return {
          success: true,
          status: res.status,
          topicCount: Array.isArray(data) ? data.length : 0
        }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })
    console.log(`API test: ${JSON.stringify(apiTest)}`)
    console.log('')

    // Check what's visible
    const hasTopicWarning = await page.locator('text=Please select a topic first').isVisible().catch(() => false)
    const hasNewScheduleButton = await page.locator('button:has-text("New Schedule")').isVisible().catch(() => false)
    const hasSchedulesHeading = await page.locator('h1:has-text("Daily Show Schedules")').isVisible().catch(() => false)

    console.log('Page content check:')
    console.log(`  - "Please select topic" warning: ${hasTopicWarning ? 'YES ⚠️' : 'NO ✅'}`)
    console.log(`  - "New Schedule" button: ${hasNewScheduleButton ? 'YES ✅' : 'NO ⚠️'}`)
    console.log(`  - "Daily Show Schedules" heading: ${hasSchedulesHeading ? 'YES ✅' : 'NO ⚠️'}`)
    console.log('')

    if (hasNewScheduleButton) {
      console.log('========================================')
      console.log(' Step 3: Test New Schedule Button')
      console.log('========================================')
      console.log('')

      console.log('Clicking "New Schedule" button...')
      await page.locator('button:has-text("New Schedule")').first().click()
      await page.waitForTimeout(1500)

      await page.screenshot({ path: 'create-modal.png', fullPage: true })
      console.log('📸 Screenshot: create-modal.png')
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
    }

    console.log('========================================')
    console.log(' Test Complete!')
    console.log('========================================')
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

testSchedules()
