import { expect, test } from '../frontend/node_modules/@playwright/test';

test('Link → import fake → zapis → odtwarzanie wideo i opis źródła', async ({ page, request }) => {
  const title = `Import ${crypto.randomUUID()}`;
  let id: string | undefined;
  try {
    await page.goto('/dodaj');
    await page.getByLabel('Nazwa', { exact: true }).fill(title);
    await page.getByLabel('Porcje', { exact: true }).fill('2');
    const save = page.getByRole('button', { name: 'Zapisz przepis', exact: true });
    await expect(save).toBeDisabled();
    await page.getByLabel('Link do posta lub reela', { exact: true }).fill('https://www.instagram.com/reel/public-example/');
    await page.getByRole('button', { name: 'Pobierz wideo i opis', exact: true }).click();
    await expect(page.getByText(/Wideo zapisane ·/)).toBeVisible();
    await expect(page.getByText('Wykryto: Instagram', { exact: true })).toBeVisible();
    await expect(page.getByText('Opis z posta: „Opis publicznego posta”', { exact: true })).toBeVisible();
    await expect(page.getByText('Okładka z wideo · zmień zdjęcie', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Nazwa', { exact: true })).toHaveValue(title);
    const created = page.waitForResponse(response => response.url().endsWith('/api/recipes') && response.request().method() === 'POST');
    await save.click();
    const response = await created;
    expect(response.status()).toBe(201);
    const recipe = await response.json(); id = recipe.id;
    await expect(page).toHaveURL(`/przepis/${id}`);
    await page.getByRole('tab', { name: 'Źródło', exact: true }).click();
    await expect(page.getByText('Oryginalny post', { exact: true })).toBeVisible();
    await expect(page.getByText('Opis z posta', { exact: true })).toBeVisible();
    await expect(page.getByText('Opis publicznego posta', { exact: true })).toBeVisible();
    const video = page.getByLabel('Wideo przepisu', { exact: true });
    await expect(video).toBeVisible();
    await expect(video).toHaveAttribute('controls', '');
    const range = await request.get(`/files/${recipe.video.path}`, { headers: { Range: 'bytes=0-15' } });
    expect(range.status()).toBe(206);
    expect(range.headers()['content-range']).toMatch(/^bytes 0-15\//);
    await video.evaluate(async element => { const media = element as HTMLVideoElement; media.muted = true; await media.play(); });
    await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeGreaterThan(0);
    await page.reload();
    await page.getByRole('tab', { name: 'Źródło', exact: true }).click();
    await expect(page.getByLabel('Wideo przepisu', { exact: true })).toBeVisible();
  } finally { if (id) await request.delete(`/api/recipes/${id}`); }
});
