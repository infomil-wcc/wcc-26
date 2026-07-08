import { test, expect } from '@playwright/test';

test.describe('Visual Tests', () => {
  test('Login page visual regression', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
    
    // Wait for any animations to settle
    await page.waitForLoadState('networkidle');
    
    // Take a screenshot of the entire page and compare it to the baseline
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Home page visual regression', async ({ page }) => {
    // Note: Since the app requires login, you might need to authenticate first,
    // or test a public route. If there's a public dashboard, test it here.
    
    // As a placeholder, we just visit the root.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('home-page.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
    });
  });
});
