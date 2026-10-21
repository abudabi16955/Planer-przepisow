import { expect, test } from '../frontend/node_modules/@playwright/test';

test('szczegóły przepisu z prawdziwym API: skalowanie, odhaczanie i zakładki', async ({ page, request }) => {
  const response = await request.get('http://127.0.0.1:8000/api/products');
  const catalogue = await response.json();
  const eggs = catalogue.find((product: { name: string }) => product.name === 'Jajka');
  const created = await request.post('http://127.0.0.1:8000/api/recipes', { data: {
    title: 'Test szczegółów ' + Date.now(), category: 'sniadanie', servings: 2, source_type: 'manual',
    ingredients: [{ product_id: eggs.id, quantity: 2, unit: 'szt.' }], steps: ['Wymieszaj.', 'Usmaż.'],
  } });
  expect(created.status()).toBe(201);
  const recipe = await created.json();
  try {
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.getByRole('heading', { name: recipe.title })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jajka, 2 szt.' })).toBeVisible();
    await page.getByRole('button', { name: 'Więcej porcji' }).click();
    const ingredient = page.getByRole('button', { name: 'Jajka, 3 szt.' });
    await ingredient.click();
    await expect(ingredient).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('tab', { name: 'Przygotowanie' }).click();
    await expect(page.getByText('Usmaż.', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Źródło' }).click();
    await expect(page.getByText('Własny przepis bez źródła.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Jajka, 2 szt.' })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await request.delete(`http://127.0.0.1:8000/api/recipes/${recipe.id}`);
  }
});
