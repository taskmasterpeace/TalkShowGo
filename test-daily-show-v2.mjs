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

  console.log('=== Testing Daily Show Wizard - Recent Content ===\n');

  try {
    // Step 1: Navigate to the Daily Show wizard
    console.log('1. Navigating to Daily Show wizard...');
    await page.goto('http://localhost:3000/studio/daily-show', {
      waitUntil: 'networkidle',
      timeout: 30000
    });
    await page.waitForTimeout(2000);

    // Screenshot Step 1
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-step1-template.png'), fullPage: true });
    console.log('   Screenshot: wizard-step1-template.png');

    // Step 2: Click on the first template card (Battle Rap Daily)
    console.log('\n2. Selecting "Battle Rap Daily" template...');

    // Find and click the first template card - it's a button containing the template info
    const templateCard = page.locator('button:has-text("Battle Rap Daily"):has-text("daily")').first();
    await templateCard.click();
    await page.waitForTimeout(500);

    // Verify selection (check for visual indicator)
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-step1-selected.png'), fullPage: true });
    console.log('   Template selected, screenshot: wizard-step1-selected.png');

    // Click Next button
    console.log('   Clicking Next...');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Screenshot Step 2 (Host selection)
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-step2-host.png'), fullPage: true });
    console.log('\n3. Step 2 (Host selection) - screenshot: wizard-step2-host.png');

    // Step 3: Select a host (Maya Sterling)
    console.log('   Selecting "Maya Sterling" host...');
    const hostCard = page.locator('button:has-text("Maya Sterling")').first();
    await hostCard.click();
    await page.waitForTimeout(500);

    // Click Next to go to Topics
    console.log('   Clicking Next to Topics...');
    await page.locator('button:has-text("Next")').click();
    await page.waitForTimeout(1000);

    // Screenshot Step 3 (Topics - initial)
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-step3-topics-initial.png'), fullPage: true });
    console.log('\n4. Step 3 (Topics) - initial screenshot: wizard-step3-topics-initial.png');

    // Analyze Topics page content
    const pageContent = await page.locator('body').textContent();
    console.log('\n5. Analyzing Topics page...');

    // Check what controls are available
    const hasHoursBack = pageContent?.includes('Hours Back');
    const hasSpecificDate = pageContent?.includes('Specific Date');
    const hasScanButton = pageContent?.includes('Scan Sources');
    console.log(`   Hours Back control: ${hasHoursBack}`);
    console.log(`   Specific Date control: ${hasSpecificDate}`);
    console.log(`   Scan Sources button: ${hasScanButton}`);

    // Check for empty state message
    const hasEmptyState = pageContent?.includes('Click "Scan Sources" to discover trending topics');
    console.log(`   Shows empty state: ${hasEmptyState}`);

    // Step 4: Click "Scan Sources" to fetch recent content
    console.log('\n6. Clicking "Scan Sources" to fetch recent content...');
    const scanButton = page.locator('button:has-text("Scan Sources")');

    if (await scanButton.count() > 0) {
      await scanButton.click();
      console.log('   Scanning... (waiting up to 60 seconds for API response)');

      // Wait for loading to complete (either spinner disappears or topics appear)
      try {
        await page.waitForSelector('text=/Score:|engagement_score|selected/i', { timeout: 60000 });
        console.log('   Topics loaded!');
      } catch (e) {
        console.log('   Timeout waiting for topics, taking screenshot anyway...');
      }

      await page.waitForTimeout(2000);
    }

    // Screenshot after scan
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-step3-after-scan.png'), fullPage: true });
    console.log('   Screenshot after scan: wizard-step3-after-scan.png');

    // Step 5: Analyze the results
    console.log('\n7. Analyzing scan results...');

    const updatedContent = await page.locator('body').textContent() || '';

    // Check for topic cards
    const topicHeadlines = await page.locator('h3.font-bold').allTextContents();
    console.log(`   Topic headlines found: ${topicHeadlines.length}`);
    if (topicHeadlines.length > 0) {
      console.log('   Headlines:');
      topicHeadlines.forEach((h, i) => console.log(`     ${i + 1}. ${h.substring(0, 80)}...`));
    }

    // Check for engagement scores
    const scoreMatches = updatedContent.match(/Score:\s*\d+/g) || [];
    console.log(`   Engagement scores: ${scoreMatches.slice(0, 5).join(', ')}`);

    // Check for source indicators (youtube/twitter)
    const hasYoutubeSource = updatedContent.includes('youtube');
    const hasTwitterSource = updatedContent.includes('twitter');
    console.log(`   YouTube sources: ${hasYoutubeSource}`);
    console.log(`   Twitter sources: ${hasTwitterSource}`);

    // Check for checkboxes (topic selection)
    const checkboxes = await page.locator('svg.lucide-check-square, svg.lucide-square').count();
    console.log(`   Topic checkboxes: ${checkboxes}`);

    // Step 6: Check for date information
    console.log('\n8. Checking for date/time information...');

    // Look for relative dates
    const relativeDates = ['hour ago', 'hours ago', 'day ago', 'days ago', 'week ago'];
    for (const dateStr of relativeDates) {
      const pattern = new RegExp(`\\d+\\s*${dateStr}`, 'gi');
      const matches = updatedContent.match(pattern) || [];
      if (matches.length > 0) {
        console.log(`   Found "${dateStr}": ${matches.slice(0, 3).join(', ')}`);
      }
    }

    // Look for "year ago" which would indicate OLD content
    const yearAgoMatches = updatedContent.match(/\d+\s*(year|years)\s*ago/gi) || [];
    if (yearAgoMatches.length > 0) {
      console.log(`   WARNING - OLD CONTENT FOUND: ${yearAgoMatches.join(', ')}`);
    } else {
      console.log('   No "year ago" dates found (good - content appears recent)');
    }

    // Look for absolute dates (December 2025)
    const dec2025 = updatedContent.match(/December\s+\d{1,2},?\s*2025|Dec\s+\d{1,2},?\s*2025|2025-12-\d{2}/gi) || [];
    if (dec2025.length > 0) {
      console.log(`   December 2025 dates: ${dec2025.slice(0, 5).join(', ')}`);
    }

    // Step 7: Check for errors
    console.log('\n9. Checking for errors...');
    const errorElement = await page.locator('.border-destructive').count();
    if (errorElement > 0) {
      const errorText = await page.locator('.border-destructive').textContent();
      console.log(`   Error found: ${errorText}`);
    } else {
      console.log('   No errors displayed');
    }

    // Check for "Please select a niche first" error
    if (updatedContent.includes('Please select a niche first')) {
      console.log('   NOTE: No niche/topic selected - need to select Battle Rap topic first');
    }

    // Step 8: Check for keywords in topics
    console.log('\n10. Checking for battle rap keywords...');
    const battleRapKeywords = ['URL', 'KOTD', 'battle', 'rap', 'battler', 'RBE', 'versus', 'vs'];
    for (const kw of battleRapKeywords) {
      if (updatedContent.toLowerCase().includes(kw.toLowerCase())) {
        console.log(`   Found keyword: "${kw}"`);
      }
    }

    // Final screenshot
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-final-state.png'), fullPage: true });
    console.log('\n11. Final screenshot: wizard-final-state.png');

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Topics found: ${topicHeadlines.length}`);
    console.log(`Has recent content (no "year ago"): ${yearAgoMatches.length === 0}`);
    console.log(`YouTube sources: ${hasYoutubeSource}`);
    console.log(`Twitter sources: ${hasTwitterSource}`);

  } catch (error) {
    console.error('\nTest error:', error.message);
    await page.screenshot({ path: path.join(screenshotDir, 'wizard-error.png'), fullPage: true });
    console.log('Error screenshot saved: wizard-error.png');
  } finally {
    await browser.close();
    console.log('\n=== Test Complete ===');
  }
}

testDailyShowWizard();
