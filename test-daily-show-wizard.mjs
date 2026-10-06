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

  console.log('=== Testing Daily Show Wizard ===\n');

  try {
    // Step 1: Navigate to the Daily Show wizard
    console.log('1. Navigating to http://localhost:3000/studio/daily-show...');
    await page.goto('http://localhost:3000/studio/daily-show', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit for any dynamic content
    await page.waitForTimeout(2000);

    // Step 2: Take initial screenshot
    const screenshot1 = path.join(screenshotDir, '01-daily-show-initial.png');
    await page.screenshot({ path: screenshot1, fullPage: true });
    console.log(`2. Initial screenshot saved: ${screenshot1}`);

    // Step 3: Analyze the page content
    console.log('\n3. Analyzing page content...');

    // Get page title and heading
    const pageTitle = await page.title();
    console.log(`   Page title: ${pageTitle}`);

    // Look for key elements
    const headings = await page.locator('h1, h2, h3').allTextContents();
    console.log(`   Headings found: ${headings.slice(0, 5).join(', ')}`);

    // Look for any buttons related to proposing topics
    const buttons = await page.locator('button').allTextContents();
    console.log(`   Buttons found: ${buttons.filter(b => b.trim()).slice(0, 10).join(', ')}`);

    // Check for "Propose Topics" or similar button
    const proposeBtn = page.locator('button:has-text("Propose"), button:has-text("Topics"), button:has-text("Generate"), button:has-text("Scan"), button:has-text("Find")');
    const proposeBtnCount = await proposeBtn.count();
    console.log(`   Topic-related buttons: ${proposeBtnCount}`);

    // Step 4: Look for any topic/content cards
    console.log('\n4. Looking for content/topic cards...');

    // Check for cards or list items that might contain videos/topics
    const cards = await page.locator('[class*="card"], [class*="Card"], [class*="topic"], [class*="Topic"]').count();
    console.log(`   Cards found: ${cards}`);

    // Look for dates in the page
    const datePatterns = await page.locator('text=/\\d{1,2}\\s+(hour|day|week|month|year)s?\\s+ago/i').allTextContents();
    console.log(`   Relative dates found: ${datePatterns.slice(0, 5).join(', ')}`);

    const absoluteDates = await page.locator('text=/\\d{4}-\\d{2}-\\d{2}|\\w+\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\/\\d{1,2}\\/\\d{4}/').allTextContents();
    console.log(`   Absolute dates found: ${absoluteDates.slice(0, 5).join(', ')}`);

    // Step 5: Try to find and click "Propose Topics" or similar
    console.log('\n5. Looking for topic proposal functionality...');

    // Check if there's a step indicator
    const steps = await page.locator('[class*="step"], [class*="Step"], [class*="wizard"], [class*="Wizard"]').count();
    console.log(`   Wizard step elements: ${steps}`);

    // Try different selectors for topic proposal
    const proposalSelectors = [
      'button:has-text("Propose Topics")',
      'button:has-text("Generate Topics")',
      'button:has-text("Find Topics")',
      'button:has-text("Scan Sources")',
      'button:has-text("Get Topics")',
      'button:has-text("Next")',
      '[data-testid*="propose"]',
      '[data-testid*="topic"]'
    ];

    for (const selector of proposalSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.count() > 0) {
        const text = await btn.textContent();
        console.log(`   Found button: "${text}" (${selector})`);

        // Click if it seems like a proposal/scan button
        if (text && (text.toLowerCase().includes('propose') ||
                     text.toLowerCase().includes('scan') ||
                     text.toLowerCase().includes('generate') ||
                     text.toLowerCase().includes('find'))) {
          console.log(`   Clicking "${text}"...`);
          await btn.click();
          await page.waitForTimeout(5000); // Wait for API response

          const screenshot2 = path.join(screenshotDir, '02-after-propose-click.png');
          await page.screenshot({ path: screenshot2, fullPage: true });
          console.log(`   Screenshot after click: ${screenshot2}`);
          break;
        }
      }
    }

    // Step 6: Check for video/content data
    console.log('\n6. Checking for video/content data...');

    // Look for YouTube video elements or mentions
    const videoElements = await page.locator('[class*="video"], [class*="Video"], [class*="youtube"], [class*="YouTube"]').count();
    console.log(`   Video-related elements: ${videoElements}`);

    // Look for source mentions (YouTube channels, Twitter)
    const sourceText = await page.locator('text=/URLTV|KOTD|RBE|JayBlac|Algorithm/i').allTextContents();
    console.log(`   Battle rap sources mentioned: ${sourceText.slice(0, 5).join(', ')}`);

    // Get all visible text to analyze for recent content
    const pageText = await page.locator('body').textContent();

    // Look for date indicators
    const recentIndicators = [
      'today', 'yesterday', 'hour ago', 'hours ago', '1 day ago', '2 days ago', '3 days ago',
      'December 2025', 'Dec 2025', '12/2025'
    ];

    console.log('\n7. Checking for recent content indicators...');
    for (const indicator of recentIndicators) {
      if (pageText && pageText.toLowerCase().includes(indicator.toLowerCase())) {
        console.log(`   Found: "${indicator}"`);
      }
    }

    // Check for old content indicators
    const oldIndicators = ['1 year ago', '2 years ago', 'year ago', '6 months ago'];
    console.log('\n8. Checking for OLD content indicators (should NOT be present)...');
    for (const indicator of oldIndicators) {
      if (pageText && pageText.toLowerCase().includes(indicator.toLowerCase())) {
        console.log(`   WARNING - OLD CONTENT: Found "${indicator}"`);
      }
    }

    // Final screenshot
    const screenshot3 = path.join(screenshotDir, '03-final-state.png');
    await page.screenshot({ path: screenshot3, fullPage: true });
    console.log(`\n9. Final screenshot saved: ${screenshot3}`);

    // Print any visible topics or stories
    console.log('\n10. Looking for topic/story titles...');
    const titles = await page.locator('h3, h4, [class*="title"], [class*="Title"]').allTextContents();
    const filteredTitles = titles.filter(t => t && t.trim().length > 5 && t.trim().length < 200);
    console.log(`   Titles found: ${filteredTitles.slice(0, 10).join(' | ')}`);

    // Check for any loading states
    const loading = await page.locator('text=/loading|Loading|Scanning|Processing/i').count();
    console.log(`\n11. Loading indicators: ${loading}`);

    // Check for error messages
    const errors = await page.locator('text=/error|Error|failed|Failed|no data|No data/i').allTextContents();
    if (errors.length > 0) {
      console.log(`\n12. Error messages: ${errors.slice(0, 5).join(' | ')}`);
    }

  } catch (error) {
    console.error('Test error:', error.message);
    const errorScreenshot = path.join(screenshotDir, 'error-screenshot.png');
    await page.screenshot({ path: errorScreenshot, fullPage: true });
    console.log(`Error screenshot saved: ${errorScreenshot}`);
  } finally {
    await browser.close();
    console.log('\n=== Test Complete ===');
  }
}

testDailyShowWizard();
