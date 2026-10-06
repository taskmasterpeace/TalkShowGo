import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

test.describe('Branding Verification Tests', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30000)
  })

  test('Home page displays correct branding', async ({ page }) => {
    // Navigate to home page
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // 1. Check that sidebar shows "TalkShowGo" brand name (NOT "Content Kingdom")
    const brandName = page.getByRole('heading', { name: 'TalkShowGo' })
    await expect(brandName).toBeVisible()

    // Verify "Content Kingdom" is NOT displayed as brand name
    const oldBrandName = page.getByRole('heading', { name: 'Content Kingdom' })
    await expect(oldBrandName).not.toBeVisible()

    // 2. Check that logo.svg is displayed next to the brand name
    const logo = page.locator('img[src="/logo.svg"]')
    await expect(logo).toBeVisible()
    await expect(logo).toHaveAttribute('alt', 'TalkShowGo')

    // 3. Check the topbar avatar shows "TSG" initials
    // Use getByText with exact match to avoid multiple matches
    const avatar = page.getByText('TSG', { exact: true })
    await expect(avatar).toBeVisible()

    // Take screenshot of the sidebar showing the new branding
    const sidebar = page.locator('div.w-64.border-r-2').first()
    await sidebar.screenshot({ path: 'test-screenshots/branding-sidebar.png' })

    // Also take a full page screenshot
    await page.screenshot({ path: 'test-screenshots/branding-full-page.png' })

    console.log('Branding verification passed:')
    console.log('- Brand name "TalkShowGo" is visible in sidebar')
    console.log('- Logo (logo.svg) is displayed')
    console.log('- Avatar shows "TSG" initials')
  })

  test('Sidebar branding elements are properly styled', async ({ page }) => {
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')

    // Check the logo container structure - use first() to get the sidebar logo section
    const logoContainer = page.locator('div.flex.items-center.gap-3.px-4.py-4').first()
    await expect(logoContainer).toBeVisible()

    // Verify logo dimensions
    const logo = page.locator('img[src="/logo.svg"]')
    await expect(logo).toHaveAttribute('width', '40')
    await expect(logo).toHaveAttribute('height', '48')

    // Verify brand name in sidebar using role selector
    const brandName = page.getByRole('heading', { name: 'TalkShowGo' })
    await expect(brandName).toBeVisible()
    await expect(brandName).toHaveText('TalkShowGo')
  })
})
