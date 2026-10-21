import { expect, test } from '../frontend/node_modules/@playwright/test';

test('lista → szczegóły z prawdziwym API: skalowanie, odhaczanie i zakładki', async ({ page, request }, testInfo) => {
  const desktop = testInfo.project.name === 'laptop';
  const response = await request.get('http://127.0.0.1:8000/api/products');
  const catalogue = await response.json();
  const eggs = catalogue.find((product: { name: string }) => product.name === 'Jajka');
  const created = await request.post('http://127.0.0.1:8000/api/recipes', { data: {
    title: `Test szczegółów ${testInfo.project.name} ${Date.now()}`, category: 'sniadanie', servings: 2, source_type: 'manual',
    ingredients: [{ product_id: eggs.id, quantity: 2, unit: 'szt.' }], steps: ['Wymieszaj.', 'Usmaż.'],
  } });
  expect(created.status()).toBe(201);
  const recipe = await created.json();
  try {
    await page.goto('/');
    const card = page.getByRole('button', { name: `${desktop ? 'Pokaż' : 'Otwórz'} przepis: ${recipe.title}` });
    await card.click();
    const details = page.getByRole('article', { name: 'Szczegóły przepisu' });
    await expect(details.getByRole('heading', { name: recipe.title })).toBeVisible();
    if (desktop) {
      const panel = page.getByRole('complementary', { name: 'Szczegóły przepisu' });
      expect((await panel.boundingBox())?.width).toBe(480);
      await expect(card).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { name: 'Przepisy', exact: true })).toBeVisible();
    } else {
      await expect(page).toHaveURL(new RegExp(`/przepis/${recipe.id}$`));
      await expect(page.getByRole('navigation')).toHaveCount(0);
      await expect(details.getByRole('button', { name: 'Wróć' })).toBeVisible();
    }
    await expect(details.getByRole('button', { name: 'Jajka, 2 szt.' })).toBeVisible();
    await details.getByRole('button', { name: 'Więcej porcji' }).click();
    const ingredient = details.getByRole('button', { name: 'Jajka, 3 szt.' });
    await ingredient.click();
    await expect(ingredient).toHaveAttribute('aria-pressed', 'true');
    await details.getByRole('tab', { name: 'Przygotowanie' }).click();
    await expect(details.getByText('Usmaż.', { exact: true })).toBeVisible();
    await details.getByRole('tab', { name: 'Źródło' }).click();
    await expect(details.getByText('Własny przepis bez źródła.')).toBeVisible();
    await page.goto(`/przepis/${recipe.id}`);
    await expect(details.getByRole('heading', { name: recipe.title })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Jajka, 2 szt.' })).toHaveAttribute('aria-pressed', 'false');
    if (!desktop) {
      await details.getByRole('button', { name: 'Wróć' }).click();
      await expect(page).toHaveURL('http://127.0.0.1:8000/');
      await expect(card).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: 'Przepisy', exact: true })).toBeVisible();
      await expect(card).toHaveAttribute('aria-pressed', 'true');
    }
  } finally {
    await request.delete(`http://127.0.0.1:8000/api/recipes/${recipe.id}`);
  }
});
