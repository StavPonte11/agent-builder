import { test, expect } from '@playwright/test';

test('has title and login redirect', async ({ page }) => {
    await page.goto('/');
    // Platform redirects to /login if unauthenticated by default
    await expect(page).toHaveURL(/.*login/);

    // Minimal check that the login page renders
    await expect(page.getByRole('heading', { name: /Welcome/i })).toBeVisible();
});
