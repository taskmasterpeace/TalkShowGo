import { test, expect } from '@playwright/test'

test.describe('PERIMETER Page Refresh Button', () => {
  test('should refresh without showing error', async ({ page }) => {
    // Navigate to the perimeter page
    await page.goto('/perimeter')

    // Wait for the page to load completely
    await page.waitForLoadState('networkidle')

    // Take a screenshot before clicking refresh
    await page.screenshot({ path: 'test-screenshots/perimeter-before-refresh.png', fullPage: true })

    // Wait for the Refresh Feed button to be visible
    const refreshButton = page.getByRole('button', { name: /Refresh Feed/i })
    await expect(refreshButton).toBeVisible({ timeout: 10000 })

    // Click the Refresh Feed button
    await refreshButton.click()

    // Wait a bit for the refresh to complete
    await page.waitForTimeout(3000)

    // Take a screenshot after clicking refresh
    await page.screenshot({ path: 'test-screenshots/perimeter-after-refresh.png', fullPage: true })

    // Check that no error message is displayed
    const errorCard = page.locator('text=Failed to refresh')
    const hasError = await errorCard.isVisible().catch(() => false)

    // Verify no "Failed to refresh" error is shown
    expect(hasError).toBe(false)

    // Also check for the general error display card
    const errorDisplay = page.locator('.border-destructive').filter({ hasText: 'Failed' })
    const hasErrorDisplay = await errorDisplay.isVisible().catch(() => false)
    expect(hasErrorDisplay).toBe(false)

    console.log('Test completed successfully - no error displayed after refresh')
  })
})
