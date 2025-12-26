/**
 * Playwright - Simple Browser Opener
 * Opens browser in full screen and stays open for manual testing
 */

import { chromium } from 'playwright'

async function openBrowser() {
  console.log('🚀 Launching browser...')

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
    console.log('🌐 Opening Talk Show Go...')
    console.log('')

    // Navigate to home page first
    await page.goto('http://localhost:3000', {
      waitUntil: 'networkidle',
      timeout: 30000
    })

    console.log('✅ Browser opened successfully!')
    console.log('')
    console.log('========================================')
    console.log(' Manual Testing Mode')
    console.log('========================================')
    console.log('')
    console.log('📍 Current URL: http://localhost:3000')
    console.log('📝 Browser is now open and ready for testing')
    console.log('')
    console.log('========================================')
    console.log(' What to Test')
    console.log('========================================')
    console.log('')
    console.log('1. Select a topic (dropdown in top right)')
    console.log('2. Navigate to: /studio/schedules')
    console.log('3. Test the scheduler UI:')
    console.log('   • Click "New Schedule"')
    console.log('   • Create a test schedule')
    console.log('   • Toggle it on/off')
    console.log('   • Click "Run Now"')
    console.log('   • View execution history')
    console.log('   • Delete the schedule')
    console.log('')
    console.log('========================================')
    console.log(' Navigation')
    console.log('========================================')
    console.log('')
    console.log('Home:           http://localhost:3000')
    console.log('Schedules:      http://localhost:3000/studio/schedules')
    console.log('Daily Show:     http://localhost:3000/studio/daily-show')
    console.log('Templates:      http://localhost:3000/studio/templates')
    console.log('Hosts:          http://localhost:3000/studio/hosts')
    console.log('')
    console.log('========================================')
    console.log(' Browser Controls')
    console.log('========================================')
    console.log('')
    console.log('• The browser will stay open indefinitely')
    console.log('• Press Ctrl+C in this terminal to close it')
    console.log('• Or just close the browser window manually')
    console.log('')

    // Navigate to schedules page
    console.log('🔄 Navigating to schedules page...')
    await page.goto('http://localhost:3000/studio/schedules', {
      waitUntil: 'networkidle',
      timeout: 30000
    })
    console.log('✅ At schedules page!')
    console.log('')

    // Take a screenshot
    const screenshotPath = 'schedules-page.png'
    await page.screenshot({ path: screenshotPath, fullPage: true })
    console.log(`📸 Screenshot saved: ${screenshotPath}`)
    console.log('')

    console.log('⏳ Browser is ready. Press Ctrl+C when done testing...')
    console.log('')

    // Wait indefinitely - user can close with Ctrl+C or by closing browser
    await page.waitForTimeout(999999999)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error('')
    console.error('Troubleshooting:')
    console.error('  1. Make sure Next.js is running: npm run dev')
    console.error('  2. Check that you can access http://localhost:3000')
    console.error('  3. Ensure Docker services are running: docker ps')
    console.error('')

    // Take error screenshot
    try {
      await page.screenshot({ path: 'error-screenshot.png', fullPage: true })
      console.log('📸 Error screenshot saved: error-screenshot.png')
    } catch (e) {
      // Ignore screenshot errors
    }

    await browser.close()
    process.exit(1)
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('')
  console.log('👋 Closing browser...')
  process.exit(0)
})

// Run
openBrowser().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})
