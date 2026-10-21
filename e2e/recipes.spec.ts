import { expect, test } from '../frontend/node_modules/@playwright/test';
import { recipes, products } from '../frontend/src/test/recipes';

test('lista przepisów: układ telefonu i laptopa z atrapą API', async ({ page }, testInfo) => {
  // This scenario does not depend on the recipe backend from PR #20.
  await page.route('**/api/recipes', (route) => route.fulfill({ json: recipes }));
  await page.route('**/api/products', (route) => route.fulfill({ json: products }));
  await page.goto('/');
  const desktop = testInfo.project.name === 'laptop';
  const cards = page.getByRole('button', { name: /^(Otwórz|Pokaż) przepis:/ });
  await expect(cards).toHaveCount(4);
  const grid = await cards.first().locator('..').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
  expect(grid.split(' ')).toHaveLength(desktop ? 3 : 2);
  const panel = page.getByRole('complementary', { name: 'Szczegóły przepisu' });
  if (desktop) {
    await expect(panel).toBeVisible();
    expect((await panel.boundingBox())?.width).toBe(480);
    await cards.nth(2).click();
    await expect(panel.getByRole('heading', { name: 'Zupa pomidorowa' })).toBeVisible();
  } else {
    await expect(panel).toHaveCount(0);
    await cards.first().click();
    await expect(page).toHaveURL(/\/przepis\/dinner$/);
  }
});
