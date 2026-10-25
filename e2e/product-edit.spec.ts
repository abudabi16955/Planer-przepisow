import { expect, test } from '../frontend/node_modules/@playwright/test';

test('edycja produktu zmienia nazwę i makro istniejącego przepisu', async ({ page, request }) => {
  const name = `Produkt ${crypto.randomUUID()}`;
  const editedName = `${name} poprawiony`;
  const productResponse = await request.post('/api/products', { data: { name, units: ['g'], nutrition_basis: 'g', kcal: 100, protein: 1, carbs: 2, fat: 3 } });
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();
  const response = await request.post('/api/recipes', { data: { title: `Makro ${crypto.randomUUID()}`, category: 'obiad', servings: 1, ingredients: [{ product_id: product.id, quantity: 100, unit: 'g' }] } });
  expect(response.status()).toBe(201);
  const recipe = await response.json();
  try {
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.locator('.kcal')).toHaveText('100');
    await page.goto('/dodaj');
    await page.getByRole('tab', { name: 'Ręcznie', exact: true }).click();
    await page.getByRole('combobox').fill(name);
    await page.getByRole('option').filter({ hasText: name }).click();
    await page.getByRole('button', { name: `Edytuj produkt: ${name}`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Edytuj produkt', exact: true });
    await expect(dialog.getByLabel('Nazwa produktu', { exact: true })).toHaveValue(name);
    await dialog.getByLabel('Nazwa produktu', { exact: true }).fill(editedName);
    await dialog.getByLabel('kcal', { exact: true }).fill('200');
    const updated = page.waitForResponse(result => result.url().endsWith(`/api/products/${product.id}`) && result.request().method() === 'PUT');
    await dialog.getByRole('button', { name: 'Zapisz zmiany', exact: true }).click();
    expect((await updated).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveValue(editedName);
    await expect(page.getByRole('status').filter({ hasText: `Zapisano produkt: ${editedName}` })).toBeVisible();
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.locator('.kcal')).toHaveText('200');
    await expect(page.getByText(editedName, { exact: true })).toBeVisible();
    const persisted = await (await request.get(`/api/recipes/${recipe.id}`)).json();
    expect(persisted.kcal).toBeNull(); // Computed from current products, never copied on save.
  } finally { await request.delete(`/api/recipes/${recipe.id}`); }
});
