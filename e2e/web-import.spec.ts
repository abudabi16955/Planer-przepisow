import { expect, test } from '../frontend/node_modules/@playwright/test';

test('WWW → przegląd składników → zapis → Oryginalna strona', async ({ page, request }) => {
  test.setTimeout(60_000);
  const title = `WWW ${crypto.randomUUID()}`;
  const productName = `Przyprawa ${crypto.randomUUID()}`;
  const products = await (await request.get('/api/products')).json();
  const eggs = products.find((p: { name: string }) => p.name === 'Jajka');
  const milk = products.find((p: { name: string }) => p.name === 'Mleko 2%');
  const source = 'https://recipes.example/synthetic-recipe';
  let id: string | undefined;
  await page.route('**/api/web-import', async route => {
    expect(route.request().postDataJSON()).toEqual({ url: source });
    await route.fulfill({ json: {
      title, category: 'obiad', servings: 2, time_min: 35,
      steps: ['Ugotuj.', 'Podaj.'], kcal: 250, protein: 10, carbs: 20, fat: 5,
      source_url: source, source_host: 'recipes.example', photo_url: null,
      notes: ['Sprawdź ilości. <script>window.evil=true</script>'],
      ingredients: [
        { raw: '2 jajka', name: 'Jajka', qty: 2, unit: 'szt.', product_id: eggs.id, match: 'exact', unit_ok: true },
        { raw: '100 mleka', name: 'Mleka', qty: 100, unit: 'kg', product_id: milk.id, match: 'fuzzy', unit_ok: false },
        { raw: `5 g ${productName}`, name: productName, qty: 5, unit: 'g', product_id: null, match: 'none', unit_ok: null },
        { raw: 'nieznany dodatek do smaku', name: 'Nieznany dodatek', qty: null, unit: 'do smaku', product_id: null, match: 'none', unit_ok: null },
      ],
    } });
  });
  try {
    await page.goto('/dodaj');
    await page.getByLabel('Link do posta lub reela', { exact: true }).fill(source);
    await page.getByRole('button', { name: 'Pobierz przepis ze strony' }).click();
    await expect(page.getByLabel('Nazwa', { exact: true })).toHaveValue(title);
    await expect(page.getByLabel('Przygotowanie', { exact: true })).toHaveValue('Ugotuj.\nPodaj.');
    await expect(page.getByText('Sprawdź ilości. <script>window.evil=true</script>', { exact: true })).toBeVisible();
    const save = page.getByRole('button', { name: 'Zapisz przepis', exact: true });
    await expect(save).toBeDisabled();
    const fuzzy = page.getByRole('group', { name: 'Składnik 2', exact: true });
    await fuzzy.getByRole('button', { name: 'ml: Mleko 2%', exact: true }).click();
    await fuzzy.getByRole('button', { name: 'Zatwierdź składnik' }).click();
    const newRow = page.getByRole('group', { name: 'Składnik 3', exact: true });
    await newRow.getByRole('button', { name: `Dodaj „${productName}” jako nowy produkt`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Nowy produkt' });
    await expect(dialog.getByLabel('Nazwa produktu')).toHaveValue(productName);
    await dialog.getByRole('button', { name: 'Zapisz produkt', exact: true }).click();
    await newRow.getByRole('button', { name: 'Dodaj składnik', exact: true }).click();
    await page.getByRole('group', { name: 'Składnik 4', exact: true }).getByRole('button', { name: 'Pomiń składnik: Nieznany dodatek', exact: true }).click();
    await expect(save).toBeEnabled();
    const created = page.waitForResponse(response => response.url().endsWith('/api/recipes') && response.request().method() === 'POST');
    await save.click();
    const response = await created;
    expect(response.status()).toBe(201);
    const recipe = await response.json(); id = recipe.id;
    expect(recipe.source_platform).toBe('www'); expect(recipe.ingredients).toHaveLength(3);
    await expect(page).toHaveURL(`/przepis/${id}`);
    await expect(page.getByRole('status').filter({ hasText: 'Przepis zapisany' })).toBeVisible();
    await page.getByRole('tab', { name: 'Źródło', exact: true }).click();
    await expect(page.getByText('Oryginalna strona', { exact: true })).toBeVisible();
    const original = page.getByRole('link', { name: 'Otwórz oryginał', exact: true });
    await expect(original).toHaveAttribute('href', source);
    await expect(original).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(original).toHaveAttribute('target', '_blank');
    await page.reload();
    await page.getByRole('tab', { name: 'Źródło', exact: true }).click();
    await expect(page.getByText('Oryginalna strona', { exact: true })).toBeVisible();
  } finally { if (id) await request.delete(`/api/recipes/${id}`); }
});
