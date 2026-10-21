import { expect, test } from '../frontend/node_modules/@playwright/test';

for (const pdf of [false, true]) {
  test(pdf ? 'edycja zachowuje pliki i podmienia PDF nowym uploadem' : 'edycja i usuwanie przepisu z potwierdzeniem', async ({ page, request }, testInfo) => {
    const title = `Edycja e2e ${crypto.randomUUID()}`;
    const uploadIds: Record<string, string> = {};
    if (pdf) {
      for (const [field, name, mimeType, buffer] of [
        ['pdf_upload_id', 'pierwszy.pdf', 'application/pdf', Buffer.from('%PDF-1.7\noriginal')],
        ['photo_upload_id', 'danie.png', 'image/png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aH1cAAAAASUVORK5CYII=', 'base64')],
      ] as const) {
        const response = await request.post('/api/uploads', { multipart: { file: { name, mimeType, buffer } } });
        expect(response.status()).toBe(201);
        uploadIds[field] = (await response.json()).upload_id;
      }
    }
    const response = await request.post('/api/recipes', { data: { title, category: 'obiad', servings: 4, time_min: 25, source_type: pdf ? 'pdf' : 'manual', steps: ['Wymieszaj', 'Ugotuj'], kcal: 350, protein: 12, carbs: 30, fat: 10, ingredients: [], ...uploadIds } });
    expect(response.status()).toBe(201);
    const original = await response.json();
    try {
      await page.goto(`/przepis/${original.id}`);
      await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Edytuj', exact: true }).click();
      await expect(page).toHaveURL(`/przepis/${original.id}/edytuj`);
      await expect(page.getByLabel('Nazwa', { exact: true })).toHaveValue(title);
      await expect(page.getByLabel('Porcje', { exact: true })).toHaveValue('4');
      await expect(page.getByLabel('Przygotowanie')).toHaveValue('Wymieszaj\nUgotuj');
      if (pdf) {
        await expect(page.getByText('pierwszy.pdf', { exact: false })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Ręcznie' })).toBeDisabled();
      }
      const changedTitle = title + ' zmieniony';
      await page.getByLabel('Nazwa', { exact: true }).fill(changedTitle);
      await page.getByLabel('Porcje', { exact: true }).fill('5');
      await page.getByRole('button', { name: 'Zapisz przepis' }).click();
      await expect(page).toHaveURL(`/przepis/${original.id}`);
      await expect(page.getByRole('status').filter({ hasText: 'Przepis zapisany' })).toBeVisible();
      await expect(page.getByRole('heading', { name: changedTitle, exact: true })).toBeVisible();
      const saved = await (await request.get(`/api/recipes/${original.id}`)).json();
      expect(saved).toMatchObject({ title: changedTitle, servings: 5, steps: original.steps, kcal: 350, protein: 12 });
      expect(saved.pdf).toEqual(original.pdf);
      expect(saved.photo).toEqual(original.photo);
      let finalPdfPath = original.pdf?.path;
      if (pdf) {
        await page.getByRole('button', { name: 'Edytuj', exact: true }).click();
        await page.getByLabel('Wybierz plik PDF').setInputFiles({ name: 'nowy.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\nreplacement') });
        await page.getByRole('button', { name: 'Zapisz przepis' }).click();
        await expect(page).toHaveURL(`/przepis/${original.id}`);
        const replaced = await (await request.get(`/api/recipes/${original.id}`)).json();
        expect(replaced.pdf.original_name).toBe('nowy.pdf');
        expect(replaced.pdf.path).not.toBe(original.pdf.path);
        expect(replaced.photo).toEqual(original.photo);
        expect((await request.get(`/files/${original.pdf.path}`)).status()).toBe(404);
        finalPdfPath = replaced.pdf.path;
      }
      // Select from the catalogue to cover deletion from a desktop panel on '/'.
      await page.goto('/');
      const prefix = testInfo.project.name === 'laptop' ? 'Pokaż' : 'Otwórz';
      await page.getByRole('button', { name: `${prefix} przepis: ${changedTitle}`, exact: true }).click();
      await page.getByRole('button', { name: 'Usuń', exact: true }).click();
      let dialog = page.getByRole('alertdialog', { name: 'Usunąć przepis? Zniknie też z planera.' });
      await dialog.getByRole('button', { name: 'Anuluj' }).click();
      expect((await request.get(`/api/recipes/${original.id}`)).status()).toBe(200);
      await page.getByRole('button', { name: 'Usuń', exact: true }).click();
      dialog = page.getByRole('alertdialog');
      await dialog.getByRole('button', { name: 'Usuń', exact: true }).click();
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('status').filter({ hasText: 'Przepis usunięty' })).toBeVisible();
      await expect(page.getByRole('button', { name: `${prefix} przepis: ${changedTitle}`, exact: true })).toHaveCount(0);
      expect((await request.get(`/api/recipes/${original.id}`)).status()).toBe(404);
      if (pdf) {
        expect((await request.get(`/files/${finalPdfPath}`)).status()).toBe(404);
        expect((await request.get(`/files/${original.photo.path}`)).status()).toBe(404);
      }
    } finally {
      await request.delete(`/api/recipes/${original.id}`);
    }
  });
}
