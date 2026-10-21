import { expect, test } from '../frontend/node_modules/@playwright/test';

for (const newProduct of [false, true]) {
  test(newProduct ? 'dodaj produkt i użyj go w przepisie' : 'dodaj przepis ręcznie', async ({ page, request }) => {
    await page.goto('/dodaj');
    await page.getByRole('tab', { name: 'Ręcznie' }).click();
    const title = `Zupa e2e ${crypto.randomUUID()}`;
    await page.getByLabel('Nazwa', { exact: true }).fill(title);
    await page.getByLabel('Porcje', { exact: true }).fill('3');
    await page.getByLabel('Przygotowanie').fill('Ugotuj\nPodaj');
    if (newProduct) {
      const name = `Sumak ${crypto.randomUUID()}`;
      await page.getByRole('combobox').fill(name);
      await page.getByRole('button', { name: `Nie ma na liście? Dodaj „${name}” jako nowy produkt` }).click();
      const panel = page.getByRole('dialog', { name: 'Nowy produkt' });
      await expect(panel).toBeVisible();
      await panel.getByRole('button', { name: 'Zapisz produkt' }).click();
      await expect(panel).toHaveCount(0);
      await expect(page.getByRole('status')).toContainText(`Dodano produkt do bazy: ${name}`);
      await page.getByRole('button', { name: 'do smaku', exact: true }).click();
      await page.getByRole('button', { name: 'Dodaj składnik', exact: true }).click();
      await expect(page.getByRole('button', { name: `Usuń składnik: ${name}` })).toBeVisible();
    }
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/recipes') && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Zapisz przepis' }).click();
    const response = await responsePromise;
    expect(response.status()).toBe(201);
    const recipe = await response.json();
    try {
      await expect(page).toHaveURL(`/przepis/${recipe.id}`);
      await expect(page.getByRole('status')).toHaveText('Przepis zapisany');
      await expect(page.getByRole('heading', {name: title, exact: true})).toBeVisible();
      await page.getByRole('tab', {name: 'Przygotowanie', exact: true}).click();
      await expect(page.getByText('Ugotuj', {exact: true})).toBeVisible();
      await page.getByRole('tab', {name: 'Składniki', exact: true}).click();
      const saved = await request.get(`/api/recipes/${recipe.id}`);
      expect(await saved.json()).toMatchObject({ title, servings: 3, steps: ['Ugotuj', 'Podaj'], source_type: 'manual' });
      expect(recipe.ingredients.length).toBe(newProduct ? 1 : 0);
    } finally {
      await request.delete(`/api/recipes/${recipe.id}`);
    }
  });
}
