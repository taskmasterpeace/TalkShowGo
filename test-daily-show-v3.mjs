import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const screenshotDir = 'C:/Users/taskm/OneDrive/Documents/contentkingdom/test-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

async function testDailyShowWizard() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  console.log('=== Testing Daily Show Wizard - With Topic Selection ===\n');

  try {
    // Step 1: Navigate to the Daily Show wizard
    console.log('1. Navigating to Daily Show wizard...');
    await page.goto('http://localhost:3000/studio/daily-show', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(3000);  // Wait for topics to load

    // Screenshot initial state
    await page.screenshot({ path: path.join(screenshotDir, 'v3-01-initial.png'), fullPage: true });
    console.log('   Screenshot: v3-01-initial.png');

    // Step 2: Check for topic selector in the header/shell
    console.log('\n2. Looking for topic/niche selector...');

    // Look for the topic selector button (shows "Select Topic" or a topic name)
    const topicSelector = page.locator('button:has-text("Select Topic"), button:has-text("Battle Rap"), button:has-text("Loading")');
    const selectorCount = await topicSelector.count();
    console.log(`   Topic selector buttons found: ${selectorCount}`);

    if (selectorCount > 0) {
      const selectorText = await topicSelector.first().textContent();
      console.log(`   Current selection: "${selectorText}"`);

      // If it says "Select Topic" or we need to change it
      if (selectorText?.includes('Select Topic') || !selectorText?.includes('Battle Rap')) {
        console.log('   Opening topic dropdown...');
        await topicSelector.first().click();
        await page.waitForTimeout(500);

        await page.screenshot({ path: path.join(screenshotDir, 'v3-02-topic-dropdown.png'), fullPage: true });
        console.log('   Screenshot: v3-02-topic-dropdown.png');

        // Look for Battle Rap option in the dropdown
        const battleRapOption = page.locator('button:has-text("Battle Rap")');
        if (await battleRapOption.count() > 0) {
          console.log('   Selecting "Battle Rap" topic...');
          await battleRapOption.first().click();
          await page.waitForTimeout(1000);
        } else {
          // List available topics
          const topicButtons = await page.locator('button').allTextContents();
          const topicNames = topicButtons.filter(t => t && t.length > 2 && t.length < 50 && !t.includes('Next') && !t.includes('Back'));
          console.log(`   Available topics: ${topicNames.slice(0, 10).join(', ')}`);
        }
      }
    }

    // Verify topic is now selected
    await page.waitForTimeout(500);
    const currentTopic = await page.locator('button:has-text("Battle Rap")').first().textContent();
    console.log(`   Topic now: "${currentTopic}"`);

    // Step 3: Select template and proceed
    console.log('\n3. Selecting template...');

    // Click on the Battle Rap Daily template card
    const templateCard = page.locator('button:has-text("Battle Rap Daily"):has-text("daily")').first();
    await templateCard.click();
    await page.waitForTimeout(500);

    // Click Next
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Step 4: Select host
    console.log('\n4. Selecting host...');
    const hostCard = page.locator('button:has-text("Maya Sterling")').first();
    await hostCard.click();
    await page.waitForTimeout(500);

    // Click Next to Topics
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(screenshotDir, 'v3-03-topics-initial.png'), fullPage: true });
    console.log('   Screenshot: v3-03-topics-initial.png');

    // Step 5: Click "Scan Sources"
    console.log('\n5. Clicking "Scan Sources"...');
    const scanButton = page.locator('button:has-text("Scan Sources")');

    if (await scanButton.count() > 0) {
      await scanButton.click();
      console.log('   Scanning sources (waiting up to 90 seconds)...');

      // Wait for loading spinner to appear
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(screenshotDir, 'v3-04-scanning.png'), fullPage: true });
      console.log('   Screenshot: v3-04-scanning.png');

      // Wait for results - look for either error message, topics, or timeout
      try {
        // Wait for either error OR topics to appear
        await Promise.race([
          page.waitForSelector('.border-destructive', { timeout: 90000 }),  // Error
          page.waitForSelector('text=/Score:/i', { timeout: 90000 }),  // Topics loaded
          page.waitForSelector('text=/0 of/i', { timeout: 90000 }),  // Topics count
          page.waitForSelector('[class*="CheckSquare"], [class*="Square"]', { timeout: 90000 })  // Checkboxes
        ]);
      } catch (e) {
        console.log('   Timeout waiting for response');
      }

      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(screenshotDir, 'v3-05-after-scan.png'), fullPage: true });
    console.log('   Screenshot: v3-05-after-scan.png');

    // Step 6: Analyze results
    console.log('\n6. Analyzing results...');

    const pageContent = await page.locator('body').textContent() || '';

    // Check for error
    const errorElement = page.locator('.border-destructive');
    if (await errorElement.count() > 0) {
      const errorText = await errorElement.textContent();
      console.log(`   ERROR FOUND: ${errorText}`);
    }

    // Check for topics
    const topicHeadlines = await page.locator('h3.font-bold').allTextContents();
    console.log(`   Topic headlines found: ${topicHeadlines.length}`);

    if (topicHeadlines.length > 0) {
      console.log('   Headlines:');
      topicHeadlines.forEach((h, i) => console.log(`     ${i + 1}. ${h.substring(0, 100)}`));
    }

    // Check for sources
    const youtubeCount = (pageContent.match(/youtube/gi) || []).length;
    const twitterCount = (pageContent.match(/twitter/gi) || []).length;
    console.log(`   YouTube mentions: ${youtubeCount}`);
    console.log(`   Twitter mentions: ${twitterCount}`);

    // Check for dates
    console.log('\n7. Checking for date indicators...');

    // Look for relative dates (recent is good)
    const recentDates = [
      { pattern: /\d+\s*hour(s)?\s*ago/gi, label: 'hours ago' },
      { pattern: /\d+\s*day(s)?\s*ago/gi, label: 'days ago' },
    ];

    for (const { pattern, label } of recentDates) {
      const matches = pageContent.match(pattern) || [];
      if (matches.length > 0) {
        console.log(`   Recent dates (${label}): ${matches.slice(0, 3).join(', ')}`);
      }
    }

    // Check for old dates (bad - year ago)
    const yearAgo = pageContent.match(/\d+\s*(year|years)\s*ago/gi) || [];
    if (yearAgo.length > 0) {
      console.log(`   WARNING - OLD CONTENT: ${yearAgo.join(', ')}`);
    } else {
      console.log('   No old "year ago" dates found (good!)');
    }

    // Check for Dec 2025 dates
    const dec2025 = pageContent.match(/Dec(ember)?\s+\d{1,2},?\s*2025|2025-12-\d{2}/gi) || [];
    if (dec2025.length > 0) {
      console.log(`   December 2025 dates found: ${dec2025.slice(0, 5).join(', ')}`);
    }

    // Step 8: Try to get source details
    console.log('\n8. Looking for source details...');

    // Look for source cards with video/tweet info
    const sourceCards = await page.locator('[class*="source"], [class*="Source"]').count();
    console.log(`   Source cards: ${sourceCards}`);

    // Look for battle rap keywords
    const keywords = ['URL', 'KOTD', 'RBE', 'battle', 'battler', 'JayBlac', 'Algorithm'];
    const foundKeywords = keywords.filter(kw => pageContent.toLowerCase().includes(kw.toLowerCase()));
    console.log(`   Battle rap keywords found: ${foundKeywords.join(', ')}`);

    // Final screenshots
    await page.screenshot({ path: path.join(screenshotDir, 'v3-06-final.png'), fullPage: true });
    console.log('\n9. Final screenshot: v3-06-final.png');

    // Scroll down to see more content
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotDir, 'v3-07-scrolled.png'), fullPage: true });
    console.log('   Scrolled screenshot: v3-07-scrolled.png');

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Topics discovered: ${topicHeadlines.length}`);
    console.log(`Recent content (no "year ago"): ${yearAgo.length === 0 ? 'YES' : 'NO - found old content'}`);
    console.log(`Battle rap keywords present: ${foundKeywords.length > 0 ? 'YES' : 'NO'}`);

  } catch (error) {
    console.error('\nTest error:', error.message);
    await page.screenshot({ path: path.join(screenshotDir, 'v3-error.png'), fullPage: true });
    console.log('Error screenshot saved: v3-error.png');
  } finally {
    await browser.close();
    console.log('\n=== Test Complete ===');
  }
}

testDailyShowWizard();
