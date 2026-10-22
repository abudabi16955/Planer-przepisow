import { expect, test } from '../frontend/node_modules/@playwright/test';

test('planer → lista zakupów: dni, odhaczanie, trwałość i zmiana planu', async ({ page, request }, testInfo) => {
  const desktop = testInfo.project.name === 'laptop';
  const week = desktop ? '2027-05-10' : '2027-05-03';
  const day = desktop ? '2027-05-12' : '2027-05-05';
  const heading = desktop ? 'Środa, 12 maja' : 'Środa, 5 maja';
  const catalog = await (await request.get('/api/products')).json();
  const eggs = catalog.find((product: {name: string}) => product.name === 'Jajka');
  const milk = catalog.find((product: {name: string}) => product.name === 'Mleko 2%');
  const created = await request.post('/api/recipes', { data: {
    title: `Zakupy ${crypto.randomUUID()}`, category: 'obiad', servings: 2,
    ingredients: [{ product_id: eggs.id, quantity: 1, unit: 'szt.' }, { product_id: milk.id, quantity: 200, unit: 'ml' }],
  } });
  expect(created.status()).toBe(201);
  const recipe = await created.json();
  try {
    await page.goto(`/planer?week=${week}`);
    await page.getByRole('button', { name: heading.replace(',', ''), exact: true }).click();
    const target = desktop ? page.getByRole('group', { name: heading, exact: true }).getByRole('group', { name: 'Obiad', exact: true }) : page.getByRole('group', { name: 'Obiad', exact: true });
    await target.getByRole('button', { name: 'Dodaj przepis: Obiad', exact: true }).click();
    await page.getByRole('dialog', { name: 'Wybierz przepis' }).getByRole('button', { name: `Wybierz: ${recipe.title}`, exact: true }).click();
    await page.getByRole('main').getByRole('button', { name: /Lista zakupów/ }).click();
    await expect(page).toHaveURL(`/zakupy?week=${week}`);
    await expect(page.getByRole('heading', { name: 'Lista zakupów', exact: true })).toBeVisible();
    await expect(page.getByText(/Pozycje: 2 · Posiłki: 1/)).toBeVisible();
    const eggRow = page.getByRole('button', { name: 'Jajka, 1 szt.', exact: true });
    const milkRow = page.getByRole('button', { name: 'Mleko 2%, 100 ml', exact: true });
    await expect(eggRow).toBeVisible(); await expect(milkRow).toBeVisible();
    const first = await eggRow.boundingBox(); const second = await milkRow.boundingBox();
    if (desktop) expect(second!.x).toBeGreaterThan(first!.x);
    else expect(second!.y).toBeGreaterThan(first!.y);
    await eggRow.click();
    await expect(page.getByText('Kupione: 1 z 2', { exact: true })).toBeVisible();
    await page.reload();
    await expect(eggRow).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Weekend', exact: true }).click();
    await expect(page.getByText('W wybranych dniach nie ma zaplanowanych posiłków.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cały tydzień', exact: true }).click();
    await expect(eggRow).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Następny tydzień' }).click();
    await expect(page.getByText('W wybranych dniach nie ma zaplanowanych posiłków.', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Od dziś', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Poprzedni tydzień' }).click();
    await expect(eggRow).toHaveAttribute('aria-pressed', 'true');
    if (desktop) {
      await page.getByRole('navigation').getByRole('button', { name: 'Planer', exact: true }).click();
      await page.getByRole('navigation').getByRole('button', { name: 'Lista zakupów', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Lista zakupów', exact: true })).toBeVisible();
      await page.goto(`/zakupy?week=${week}`);
    } else {
      await page.getByRole('button', { name: 'Wróć do planera', exact: true }).click();
      await expect(page).toHaveURL(`/planer?week=${week}`);
      await page.getByRole('main').getByRole('button', { name: /Lista zakupów/ }).click();
    }
    expect((await request.delete(`/api/plan/${day}/1`)).status()).toBe(204);
    await page.reload();
    await expect(page.getByText(/Pozycje: 0 · Posiłki: 0/)).toBeVisible();
    await expect(page.getByRole('progressbar')).toHaveCount(0);
  } finally {
    await request.delete(`/api/plan/${day}/1`);
    await request.delete(`/api/recipes/${recipe.id}`);
    await request.put('/api/shopping-checks', { data: { week_start: week, item_key: `${eggs.id}|szt.`, checked: false } });
  }
});
