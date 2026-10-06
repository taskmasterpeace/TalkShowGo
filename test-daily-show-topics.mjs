import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const screenshotDir = 'C:/Users/taskm/OneDrive/Documents/contentkingdom/test-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function testDailyShowTopics() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('=== Testing Daily Show Wizard - Full Flow ===\n');

  try {
    // Step 1: Navigate to the Daily Show wizard
    console.log('1. Navigating to Daily Show wizard...');
    await page.goto('http://localhost:3000/studio/daily-show', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(1000);

    // Screenshot Step 1
    await page.screenshot({ path: path.join(screenshotDir, 'step1-template.png'), fullPage: true });
    console.log('   Screenshot: step1-template.png');

    // Step 2: Select "Battle Rap Daily" template and click Next
    console.log('\n2. Selecting "Battle Rap Daily" template...');

    // Click on the Battle Rap Daily card (first card)
    const dailyCard = page.locator('text=Battle Rap Daily').first();
    await dailyCard.click();
    await page.waitForTimeout(500);

    // Click Next button
    console.log('   Clicking Next button...');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Screenshot Step 2 (Host selection)
    await page.screenshot({ path: path.join(screenshotDir, 'step2-host.png'), fullPage: true });
    console.log('   Screenshot: step2-host.png');

    // Check what's on this page
    const step2Headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`   Step 2 headings: ${step2Headings.slice(0, 5).join(', ')}`);

    // Step 3: Select a host and click Next
    console.log('\n3. Selecting a host...');

    // Look for host options
    const hostCards = await page.locator('[class*="host"], [class*="Host"], [class*="card"], [class*="Card"]').count();
    console.log(`   Host cards found: ${hostCards}`);

    // Try to click on first host option or just click Next if no selection needed
    const mayaOption = page.locator('text=Maya').first();
    if (await mayaOption.count() > 0) {
      await mayaOption.click();
      console.log('   Selected Maya host');
    } else {
      // Try any clickable host element
      const hostElement = page.locator('[class*="host"], [class*="Host"]').first();
      if (await hostElement.count() > 0) {
        await hostElement.click();
        console.log('   Clicked first host element');
      }
    }

    await page.waitForTimeout(500);

    // Click Next to go to Topics step
    console.log('   Clicking Next to go to Topics...');
    await page.locator('button:has-text("Next")').click();

    // Wait for topics to load - this might trigger API calls
    console.log('   Waiting for topics to load (this may take a few seconds)...');
    await page.waitForTimeout(5000);

    // Screenshot Step 3 (Topics)
    await page.screenshot({ path: path.join(screenshotDir, 'step3-topics.png'), fullPage: true });
    console.log('   Screenshot: step3-topics.png');

    // Step 4: Analyze the Topics page
    console.log('\n4. Analyzing Topics page...');

    // Get all headings
    const topicsHeadings = await page.locator('h1, h2, h3, h4').allTextContents();
    console.log(`   Headings: ${topicsHeadings.filter(h => h.trim()).slice(0, 10).join(' | ')}`);

    // Check for loading state
    const isLoading = await page.locator('text=/loading|Loading|Scanning|fetching|Fetching/i').count();
    if (isLoading > 0) {
      console.log('   Page is still loading, waiting more...');
      await page.waitForTimeout(10000);
      await page.screenshot({ path: path.join(screenshotDir, 'step3-topics-after-wait.png'), fullPage: true });
    }

    // Look for "Propose Topics" or "Scan" button
    const proposeBtn = page.locator('button:has-text("Propose"), button:has-text("Scan"), button:has-text("Find"), button:has-text("Get")');
    const proposeBtnCount = await proposeBtn.count();
    console.log(`   Propose/Scan buttons: ${proposeBtnCount}`);

    if (proposeBtnCount > 0) {
      const btnText = await proposeBtn.first().textContent();
      console.log(`   Found button: "${btnText}"`);

      // Click the button
      console.log(`   Clicking "${btnText}"...`);
      await proposeBtn.first().click();

      // Wait for API response
      console.log('   Waiting for topic proposals (up to 30 seconds)...');
      await page.waitForTimeout(15000);

      await page.screenshot({ path: path.join(screenshotDir, 'step3-after-propose.png'), fullPage: true });
      console.log('   Screenshot: step3-after-propose.png');
    }

    // Step 5: Look for content/videos/topics
    console.log('\n5. Looking for content items...');

    // Get all visible text
    const bodyText = await page.locator('body').textContent();

    // Look for any video/topic cards
    const cards = await page.locator('[class*="card"], [class*="Card"], [class*="topic"], [class*="Topic"], [class*="story"], [class*="Story"]').count();
    console.log(`   Content cards: ${cards}`);

    // Look for checkboxes (topic selection)
    const checkboxes = await page.locator('input[type="checkbox"], [role="checkbox"]').count();
    console.log(`   Checkboxes (for topic selection): ${checkboxes}`);

    // Look for video titles
    const titles = await page.locator('h3, h4, [class*="title"], [class*="Title"]').allTextContents();
    const contentTitles = titles.filter(t => t && t.trim().length > 10 && t.trim().length < 300);
    console.log(`   Content titles found: ${contentTitles.length}`);
    if (contentTitles.length > 0) {
      console.log('   Sample titles:');
      contentTitles.slice(0, 5).forEach(t => console.log(`     - ${t.trim().substring(0, 100)}`));
    }

    // Step 6: Check for dates
    console.log('\n6. Checking for date indicators...');

    // Look for relative dates (these could be good if recent, or bad if "1 year ago")
    const relativeDates = [
      'hour ago', 'hours ago',
      'day ago', 'days ago',
      'week ago', 'weeks ago',
      'month ago', 'months ago',
      'year ago', 'years ago'
    ];

    for (const dateStr of relativeDates) {
      const matches = (bodyText.match(new RegExp(`\\d+\\s*${dateStr}`, 'gi')) || []);
      if (matches.length > 0) {
        console.log(`   Found "${dateStr}": ${matches.slice(0, 3).join(', ')}`);
      }
    }

    // Look for absolute dates (December 2025, etc.)
    const decemberMatches = bodyText.match(/December\s+\d{1,2},?\s*\d{4}|Dec\s+\d{1,2},?\s*\d{4}/gi) || [];
    if (decemberMatches.length > 0) {
      console.log(`   December dates: ${decemberMatches.slice(0, 5).join(', ')}`);
    }

    // Look for 2025 dates
    const dates2025 = bodyText.match(/\d{1,2}\/\d{1,2}\/2025|\d{4}-12-\d{2}|2025-\d{2}-\d{2}/gi) || [];
    if (dates2025.length > 0) {
      console.log(`   2025 dates: ${dates2025.slice(0, 5).join(', ')}`);
    }

    // Step 7: Check for YouTube channel names
    console.log('\n7. Checking for YouTube sources...');
    const youtubeChannels = ['URLTV', 'KOTD', 'RBE', 'JayBlac', 'Algorithm', 'No Studio', 'Rare Breed'];
    for (const channel of youtubeChannels) {
      if (bodyText && bodyText.includes(channel)) {
        console.log(`   Found channel: ${channel}`);
      }
    }

    // Step 8: Check for "no content" or error messages
    console.log('\n8. Checking for error/empty states...');
    const emptyStates = ['no topics', 'no content', 'no results', 'nothing found', 'no videos', 'no data'];
    for (const state of emptyStates) {
      if (bodyText && bodyText.toLowerCase().includes(state)) {
        console.log(`   Found empty state: "${state}"`);
      }
    }

    const errors = await page.locator('text=/error|Error|failed|Failed/i').allTextContents();
    if (errors.length > 0) {
      console.log(`   Errors: ${errors.slice(0, 3).join(' | ')}`);
    }

    // Final full page screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'step3-topics-final.png'), fullPage: true });
    console.log('\n9. Final screenshot: step3-topics-final.png');

    // Try scrolling to see more content
    console.log('\n10. Scrolling to check for more content...');
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotDir, 'step3-topics-scrolled.png'), fullPage: true });
    console.log('    Screenshot: step3-topics-scrolled.png');

  } catch (error) {
    console.error('\nTest error:', error.message);
    await page.screenshot({ path: path.join(screenshotDir, 'error-daily-show.png'), fullPage: true });
    console.log('Error screenshot saved: error-daily-show.png');
  } finally {
    await browser.close();
    console.log('\n=== Test Complete ===');
  }
}

testDailyShowTopics();
