import { expect, test } from '../frontend/node_modules/@playwright/test';

test('aplikacja się ładuje', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Planer przepisów');
  await expect(page.getByRole('heading', { name: 'Planer przepisów' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});
