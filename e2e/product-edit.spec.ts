import { expect, test } from '../frontend/node_modules/@playwright/test';

test('edycja produktu zmienia nazwę i makro istniejącego przepisu', async ({
  page,
  request,
}) => {
  const name = `Produkt ${crypto.randomUUID()}`;
  const editedName = `${name} poprawiony`;
  const productResponse = await request.post('/api/products', {
    data: {
      name,
      units: ['g'],
      nutrition_basis: 'g',
      kcal: 100,
      protein: 1,
      carbs: 2,
      fat: 3,
    },
  });
  expect(productResponse.status()).toBe(201);
  const product = await productResponse.json();
  const response = await request.post('/api/recipes', {
    data: {
      title: `Makro ${crypto.randomUUID()}`,
      category: 'obiad',
      servings: 1,
      ingredients: [{ product_id: product.id, quantity: 100, unit: 'g' }],
    },
  });
  expect(response.status()).toBe(201);
  const recipe = await response.json();
  try {
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.locator('.kcal')).toHaveText('100');
    await page.goto('/dodaj');
    await page.getByRole('tab', { name: 'Ręcznie', exact: true }).click();
    await page.getByRole('combobox').fill(name);
    await page.getByRole('option').filter({ hasText: name }).click();
    const editBtn = page.getByRole('button', {
      name: `Edytuj produkt: ${name}`,
      exact: true,
    });
    await expect(editBtn).toBeVisible();
    const editBox = await editBtn.boundingBox();
    expect(editBox?.height).toBeGreaterThanOrEqual(44);
    await editBtn.click();
    const dialog = page.getByRole('dialog', {
      name: 'Edytuj produkt',
      exact: true,
    });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(
      dialog.getByLabel('Nazwa produktu', { exact: true }),
    ).toBeFocused();
    await expect(
      dialog.getByLabel('Nazwa produktu', { exact: true }),
    ).toHaveValue(name);

    const cancelBtn = dialog.getByRole('button', {
      name: 'Anuluj',
      exact: true,
    });
    await expect(cancelBtn).toBeVisible();
    const cancelBox = await cancelBtn.boundingBox();
    expect(cancelBox?.height).toBeGreaterThanOrEqual(44);

    const closeBtn = dialog.getByRole('button', {
      name: 'Zamknij',
      exact: true,
    });
    await expect(closeBtn).toBeVisible();

    await dialog
      .getByLabel('Nazwa produktu', { exact: true })
      .fill(editedName);
    await dialog.getByLabel('kcal', { exact: true }).fill('200');
    const updated = page.waitForResponse(
      (result) =>
        result.url().endsWith(`/api/products/${product.id}`) &&
        result.request().method() === 'PUT',
    );
    await dialog
      .getByRole('button', { name: 'Zapisz zmiany', exact: true })
      .click();
    expect((await updated).status()).toBe(200);
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveValue(editedName);
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: `Zapisano produkt: ${editedName}` }),
    ).toBeVisible();
    await page.goto(`/przepis/${recipe.id}`);
    await expect(page.locator('.kcal')).toHaveText('200');
    await expect(page.getByText(editedName, { exact: true })).toBeVisible();
    const persisted = await (
      await request.get(`/api/recipes/${recipe.id}`)
    ).json();
    expect(persisted.kcal).toBeNull(); // Computed from current products, never copied on save.
  } finally {
    await request.delete(`/api/recipes/${recipe.id}`);
  }
});

test('modal nowego produktu jest wyśrodkowanym pop-upem, ma czytelny przycisk Anuluj i zamyka się', async ({
  page,
}) => {
  await page.goto('/dodaj');
  await page.getByRole('tab', { name: 'Ręcznie', exact: true }).click();

  const newName = `Nowy produkt ${crypto.randomUUID().slice(0, 8)}`;
  await page.getByRole('combobox').fill(newName);

  const addNewBtn = page.getByRole('button', {
    name: `Nie ma na liście? Dodaj „${newName}” jako nowy produkt`,
    exact: true,
  });
  await expect(addNewBtn).toBeVisible();
  const addBox = await addNewBtn.boundingBox();
  expect(addBox?.height).toBeGreaterThanOrEqual(44);

  // Otwórz modal nowego produktu
  await addNewBtn.click();
  const newDialog = page.getByRole('dialog', {
    name: 'Nowy produkt',
    exact: true,
  });
  await expect(newDialog).toBeVisible();
  await expect(newDialog).toHaveAttribute('aria-modal', 'true');

  // Sprawdź fokus na pierwszym polu
  await expect(
    newDialog.getByLabel('Nazwa produktu', { exact: true }),
  ).toBeFocused();

  // Sprawdź przycisk Anuluj (widoczność i min. 44px)
  const cancelBtn = newDialog.getByRole('button', {
    name: 'Anuluj',
    exact: true,
  });
  await expect(cancelBtn).toBeVisible();
  const cancelBox = await cancelBtn.boundingBox();
  expect(cancelBox?.height).toBeGreaterThanOrEqual(44);

  // Sprawdź przycisk ✕ z aria-label="Zamknij"
  const closeBtn = newDialog.getByRole('button', {
    name: 'Zamknij',
    exact: true,
  });
  await expect(closeBtn).toBeVisible();

  // Zamknij przez Anuluj
  await cancelBtn.click();
  await expect(newDialog).toHaveCount(0);

  // Otwórz ponownie i zamknij przez ✕
  await page.getByRole('combobox').fill(newName);
  await addNewBtn.click();
  await expect(newDialog).toBeVisible();
  await closeBtn.click();
  await expect(newDialog).toHaveCount(0);

  // Otwórz ponownie i zamknij przez Escape
  await page.getByRole('combobox').fill(newName);
  await addNewBtn.click();
  await expect(newDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(newDialog).toHaveCount(0);

  // Otwórz ponownie i zamknij przez kliknięcie tła
  await page.getByRole('combobox').fill(newName);
  await addNewBtn.click();
  await expect(newDialog).toBeVisible();
  await page.locator('.backdrop').click({ position: { x: 10, y: 10 } });
  await expect(newDialog).toHaveCount(0);
});
