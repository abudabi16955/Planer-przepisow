import { expect, test } from '../frontend/node_modules/@playwright/test';

test('powłoka nawigacji działa na telefonie i laptopie', async ({ page }, testInfo) => {
  const desktop = testInfo.project.name === 'laptop';
  await page.goto('/');
  await expect(page).toHaveTitle('Planer przepisów');
  await expect(page.getByRole('heading', { name: 'Przepisy', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  const nav = page.getByRole('navigation', { name: 'Nawigacja' });
  await expect(nav).toBeVisible();
  const bounds = await nav.boundingBox();
  expect(bounds).not.toBeNull();
  if (desktop) {
    expect(bounds!.width).toBe(248);
    expect(bounds!.x).toBe(0);
    await expect(nav.getByText('Planer przepisów')).toBeVisible();
    await nav.getByRole('button', { name: 'Lista zakupów' }).click();
    await expect(page).toHaveURL(/\/zakupy$/);
    await expect(nav.getByRole('button', { name: 'Lista zakupów' })).toHaveAttribute('aria-current', 'page');
  } else {
    expect(bounds!.height).toBe(76);
    expect(bounds!.y + bounds!.height).toBe(844);
    await expect(nav.getByRole('button')).toHaveCount(3);
    await page.goto('/zakupy');
    await expect(nav.getByRole('button', { name: 'Planer' })).toHaveAttribute('aria-current', 'page');
  }
  await nav.getByRole('button', { name: 'Dodaj przepis' }).click();
  await expect(page).toHaveURL(/\/dodaj$/);
  await expect(page.getByRole('heading', { name: 'Dodaj przepis' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Lista zakupów' })).toBeVisible();
  await page.goto('/przepis/abc');
  await expect(page.getByRole('heading', { name: 'Przepis', exact: true })).toBeVisible();
  if (desktop) await expect(nav).toBeVisible();
  else await expect(nav).toHaveCount(0);
});

test('zmiana szerokości przełącza układ przy 1024 px', async ({ page }) => {
  await page.goto('/planer');
  await page.setViewportSize({ width: 1023, height: 900 });
  await expect(page.getByRole('navigation', {name:'Nawigacja'}).getByRole('button', { name: 'Lista zakupów' })).toHaveCount(0);
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect(page.getByRole('navigation', {name:'Nawigacja'}).getByRole('button', { name: 'Lista zakupów' })).toBeVisible();
});
