/**
 * Playwright Test - Schedule Management UI
 * Opens browser in full screen and navigates to schedules page
 */

import { chromium } from 'playwright'

async function testSchedulesUI() {
  console.log('🚀 Starting Playwright test...')
  console.log('📱 Launching Chromium browser...')

  // Launch browser in headed mode (visible)
  const browser = await chromium.launch({
    headless: false,  // Show the browser
    args: [
      '--start-maximized',  // Start maximized
    ]
  })

  // Create context with viewport set to full screen
  const context = await browser.newContext({
    viewport: null,  // null viewport = use window size
    ignoreHTTPSErrors: true
  })

  const page = await context.newPage()

  try {
    console.log('🌐 Navigating to schedules page...')

    // Navigate to schedules page
    await page.goto('http://localhost:3000/studio/schedules', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ Page loaded successfully!')
    console.log('')
    console.log('========================================')
    console.log(' Browser Test Running')
    console.log('========================================')
    console.log('')
    console.log('📍 Current URL:', page.url())
    console.log('📝 Page Title:', await page.title())
    console.log('')

    // Check if we need to select a topic first
    const topicWarning = await page.locator('text=Please select a topic first').isVisible().catch(() => false)

    if (topicWarning) {
      console.log('⚠️  No topic selected - need to select topic first')
      console.log('🔄 Navigating to home to select topic...')

      await page.goto('http://localhost:3000', {
        waitUntil: 'networkidle'
      })

      console.log('✅ At home page - waiting for manual topic selection...')
      console.log('')
      console.log('👉 Please select a topic from the dropdown')
      console.log('   Then this script will navigate to schedules page')
      console.log('')

      // Wait for topic to be selected (check localStorage)
      await page.waitForFunction(() => {
        return localStorage.getItem('selectedTopicId') !== null
      }, { timeout: 60000 })

      console.log('✅ Topic selected!')

      // Navigate back to schedules
      await page.goto('http://localhost:3000/studio/schedules', {
        waitUntil: 'networkidle'
      })
    }

    // Wait for main content to load
    await page.waitForSelector('h1:has-text("Daily Show Schedules")', { timeout: 10000 })
    console.log('✅ Schedules page loaded!')
    console.log('')

    // Check for schedules
    const hasSchedules = await page.locator('[class*="bg-gray-800"]').count() > 1

    if (hasSchedules) {
      const scheduleCount = await page.locator('[class*="bg-gray-800"]').count() - 1 // Subtract header
      console.log(`📊 Found ${scheduleCount} schedule(s)`)
      console.log('')

      // List schedule names
      const scheduleNames = await page.locator('h3[class*="text-xl"]').allTextContents()
      console.log('📋 Schedules:')
      scheduleNames.forEach((name, i) => {
        console.log(`   ${i + 1}. ${name}`)
      })
    } else {
      console.log('📭 No schedules found')
      console.log('💡 You can create a new schedule using the "New Schedule" button')
    }

    console.log('')
    console.log('========================================')
    console.log(' Test Actions Available')
    console.log('========================================')
    console.log('')
    console.log('The browser will stay open for manual testing.')
    console.log('')
    console.log('You can:')
    console.log('  • Click "New Schedule" to create a schedule')
    console.log('  • Toggle schedules on/off')
    console.log('  • Click "Run Now" to test execution')
    console.log('  • View execution history')
    console.log('  • Delete schedules')
    console.log('')
    console.log('Press Ctrl+C in this terminal to close the browser.')
    console.log('')

    // Take a screenshot
    const screenshotPath = 'schedules-ui-screenshot.png'
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`📸 Screenshot saved: ${screenshotPath}`)
    console.log('')

    // Keep browser open for manual interaction
    console.log('⏳ Browser will stay open until you close this terminal...')

    // Wait indefinitely
    await new Promise(() => {})

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('')
    console.error('Troubleshooting:')
    console.error('  1. Make sure Next.js is running: npm run dev')
    console.error('  2. Check that you can access http://localhost:3000')
    console.error('  3. Ensure Docker services are running: docker ps')
    console.error('')

    // Take error screenshot
    await page.screenshot({ path: 'error-screenshot.png', fullPage: true })
    console.log('📸 Error screenshot saved: error-screenshot.png')

    await browser.close()
    process.exit(1)
  }
}

// Run the test
testSchedulesUI().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
