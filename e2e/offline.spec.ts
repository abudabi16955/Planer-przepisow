import { expect, test } from '../frontend/node_modules/@playwright/test';

test('PWA: powłoka offline, brak cache danych i błąd zapisu bez sieci', async ({ page, context, request }) => {
  const title = `Offline ${crypto.randomUUID()}`;
  const upload = await request.post('/api/uploads', { multipart: { file: { name: 'source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nfixture') } } });
  expect(upload.status()).toBe(201);
  const created = await request.post('/api/recipes', { data: { title, category: 'obiad', servings: 2, source_type: 'pdf', pdf_upload_id: (await upload.json()).upload_id } });
  expect(created.status()).toBe(201);
  const recipe = await created.json();
  try {
    await page.goto('/');
    await page.getByPlaceholder('Szukaj przepisu').fill(title);
    await expect(page.getByRole('button', { name: new RegExp(title) }).first()).toBeVisible();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    expect(await page.evaluate(async () => (await fetch('/api/recipes', { cache: 'no-store' })).status)).toBe(200);
    const manifest = await (await request.get('/manifest.webmanifest')).json();
    expect(manifest.name).toBe('Planer przepisów'); expect(manifest.display).toBe('standalone');
    expect(await page.evaluate(async (path) => (await fetch('/files/' + path)).status, recipe.pdf.path)).toBe(200);
    const cached = await page.evaluate(async () => {
      const keys = await caches.keys();
      return (await Promise.all(keys.map(async (key) => (await (await caches.open(key)).keys()).map((entry) => new URL(entry.url).pathname)))).flat();
    });
    expect(cached).toContain('/index.html');
    expect(cached.some(path => /^\/(api|files)(\/|$)/.test(path))).toBe(false);
    await context.setOffline(true);
    await page.goto('/planer?week=2028-01-03');
    await expect(page.getByRole('heading', { name: 'Planer', exact: true })).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'Brak połączenia z serwerem.' }).first()).toBeVisible();
    await page.goto('/dodaj');
    await page.getByRole('tab', { name: 'Ręcznie', exact: true }).click();
    await page.getByLabel('Nazwa', { exact: true }).fill('Bez sieci');
    await page.getByLabel('Porcje', { exact: true }).fill('2');
    const attempted = page.waitForRequest(req => req.url().endsWith('/api/recipes') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Zapisz przepis', exact: true }).click();
    await attempted;
    await expect(page.getByRole('alert').filter({ hasText: 'Brak połączenia z serwerem.' }).first()).toBeVisible();
    expect(await page.evaluate(async () => fetch('/api/products', { cache: 'no-store' }).then(() => true).catch(() => false))).toBe(false);
    expect(await page.evaluate(async (path) => fetch('/files/' + path, { cache: 'no-store' }).then(() => true).catch(() => false), recipe.pdf.path)).toBe(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dodaj przepis', exact: true })).toBeVisible();
  } finally {
    await context.setOffline(false);
    await request.delete(`/api/recipes/${recipe.id}`);
  }
});
