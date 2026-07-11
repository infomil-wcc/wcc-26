import { test, expect } from '@playwright/test';

test.describe('Teams Page', () => {
  test('should display the list of teams and allow selecting a team to view its details', async ({ page }) => {
    // 1. Navigate to the teams page
    await page.goto('/teams');

    // 2. Wait for the team list to render
    // The page uses <app-team-list> which renders a grid of buttons.
    const teamList = page.locator('app-team-list');
    await expect(teamList).toBeVisible();

    // 3. Find a team button (e.g., France) and click it
    // Wait for the buttons to appear
    const teamButton = teamList.locator('button').filter({ hasText: 'France' });
    await expect(teamButton).toBeVisible();
    await teamButton.click();

    // 4. Verify that the team details component is displayed
    const teamDetails = page.locator('team-details');
    await expect(teamDetails).toBeVisible();

    // 5. Verify the banner has the team name
    const bannerHeading = teamDetails.locator('.teamBanner h2');
    await expect(bannerHeading).toContainText('FRANCE', { ignoreCase: true });

    // 6. Verify the breadcrumb has updated correctly
    const breadcrumb = page.locator('app-breadcrumb');
    await expect(breadcrumb).toContainText('France');
    
    // 7. Click on the breadcrumb to close team details (using resetTeamSelection)
    // The breadcrumb contains 'Les Equipes' which resets the selection
    const backButton = breadcrumb.locator('a').filter({ hasText: 'Les Equipes' }).first();
    await backButton.click();

    // 8. Verify we are back on the team list
    await expect(teamDetails).not.toBeVisible();
    await expect(teamList).toBeVisible();
  });
});
