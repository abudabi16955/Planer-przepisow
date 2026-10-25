import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { get } from 'svelte/store';
import IngredientPicker from './IngredientPicker.svelte';
import RecipeForm from './RecipeForm.svelte';
import { toast } from '../toast';
import { products, recipes } from '../../test/recipes';
import { webDraft } from '../../test/webDraft';
let conflict: boolean;
let saved: Record<string, unknown> | undefined;
beforeEach(() => {
  conflict = false;
  saved = undefined;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/config')
        return Response.json({
          import_enabled: true,
          web_import_enabled: true,
        });
      if (url === '/api/products') return Response.json(products);
      if (url === '/api/web-import')
        return Response.json({
          ...webDraft,
          ingredients: [webDraft.ingredients[0]],
        });
      if (url === '/api/products/product' && options?.method === 'PUT') {
        saved = JSON.parse(options.body as string);
        return conflict
          ? Response.json(
              { detail: 'Produkt o tej nazwie już istnieje.' },
              { status: 409 },
            )
          : Response.json({ ...products[0], ...saved });
      }
      throw new Error(`Unexpected ${url}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function chooseAndEdit() {
  await fireEvent.input(screen.getByRole('combobox'), {
    target: { value: 'Produkt' },
  });
  await fireEvent.click(screen.getByRole('option', { name: /Produkt/ }));
  await fireEvent.click(
    screen.getByRole('button', { name: 'Edytuj produkt: Produkt' }),
  );
  return within(screen.getByRole('dialog', { name: 'Edytuj produkt' }));
}
test('prefill i zapis aktualizują nazwę od razu, zachowują jednostki i ilość', async () => {
  render(IngredientPicker, { products, initialAmount: '5' });
  const dialog = await chooseAndEdit();
  expect(
    (dialog.getByLabelText('Nazwa produktu') as HTMLInputElement).value,
  ).toBe('Produkt');
  expect((dialog.getByLabelText('kcal') as HTMLInputElement).value).toBe('330');
  expect((dialog.getByLabelText('Białko g') as HTMLInputElement).value).toBe(
    '10',
  );
  expect(
    dialog.getByText('Zmiana dotyczy wszystkich przepisów z tym produktem.'),
  ).toBeTruthy();
  expect(
    dialog.queryByText(
      'W jakich jednostkach go dodajesz? (pierwsza wybrana jest domyślna)',
    ),
  ).toBeNull();
  await fireEvent.input(dialog.getByLabelText('Nazwa produktu'), {
    target: { value: 'Poprawiony produkt' },
  });
  await fireEvent.input(dialog.getByLabelText('kcal'), {
    target: { value: '660' },
  });
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(saved).toEqual({
    name: 'Poprawiony produkt',
    nutrition_basis: 'g',
    kcal: 660,
    protein: 10,
    carbs: 20,
    fat: 2,
  });
  expect(
    screen.getByRole('button', { name: 'Edytuj produkt: Poprawiony produkt' }),
  ).toBeTruthy();
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
    'Poprawiony produkt',
  );
  expect((screen.getByLabelText('Ilość') as HTMLInputElement).value).toBe('5');
  expect(get(toast)?.message).toBe('Zapisano produkt: Poprawiony produkt');
});
test('duplikat blokuje zapis, własna nazwa nie; anulowanie nie wysyła PUT', async () => {
  render(IngredientPicker, {
    products: [...products, { ...products[0], id: 'other', name: 'Inny' }],
  });
  const dialog = await chooseAndEdit();
  const save = dialog.getByRole('button', {
    name: 'Zapisz zmiany',
  }) as HTMLButtonElement;
  expect(save.disabled).toBe(false);
  await fireEvent.input(dialog.getByLabelText('Nazwa produktu'), {
    target: { value: '  INNY  ' },
  });
  expect(save.disabled).toBe(true);
  await fireEvent.input(dialog.getByLabelText('Nazwa produktu'), {
    target: { value: 'PRODUKT' },
  });
  expect(save.disabled).toBe(false);
  await fireEvent.click(dialog.getByRole('button', { name: 'Anuluj' }));
  expect(saved).toBeUndefined();
  expect((screen.getByRole('combobox') as HTMLInputElement).value).toBe(
    'Produkt',
  );
});
test('409 z serwera pozostawia formularz i pokazuje komunikat', async () => {
  conflict = true;
  render(IngredientPicker, { products });
  const dialog = await chooseAndEdit();
  await fireEvent.input(dialog.getByLabelText('Nazwa produktu'), {
    target: { value: 'Nowa nazwa' },
  });
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
  expect(
    await dialog.findByText('Produkt o tej nazwie już istnieje.'),
  ).toBeTruthy();
  expect(screen.getByRole('dialog', { name: 'Edytuj produkt' })).toBeTruthy();
});
test('brak podstawy pozwala wyczyścić odżywienie', async () => {
  render(IngredientPicker, { products });
  const dialog = await chooseAndEdit();
  await fireEvent.click(dialog.getByRole('button', { name: 'brak' }));
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
  await waitFor(() =>
    expect(saved).toEqual({
      name: 'Produkt',
      nutrition_basis: null,
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
    }),
  );
});
test('edycja z dopasowanego wiersza importu odświeża nazwę bez zmiany zatwierdzenia', async () => {
  render(RecipeForm, { onSave: vi.fn(async () => recipes[0]) });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: webDraft.source_url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz przepis ze strony' }),
  );
  await fireEvent.click(
    await screen.findByRole('button', { name: 'Edytuj produkt: Produkt' }),
  );
  const dialog = within(screen.getByRole('dialog', { name: 'Edytuj produkt' }));
  await fireEvent.input(dialog.getByLabelText('Nazwa produktu'), {
    target: { value: 'Nowa nazwa' },
  });
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
  expect(
    await screen.findByRole('button', {
      name: 'Cofnij zatwierdzenie: Nowa nazwa',
    }),
  ).toBeTruthy();
  expect(screen.getByText('Zatwierdzone: 1 z 1')).toBeTruthy();
});
test('podpowiedź makro korzysta z nowych danych produktu bez zapisania kopii do pól przepisu', async () => {
  const recipe = {
    ...recipes[0],
    source_type: 'manual' as const,
    pdf: null,
    video: null,
    source_platform: null,
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    ingredients: [{ product_id: 'product', quantity: 200, unit: 'g' }],
  };
  render(RecipeForm, {
    initialRecipe: recipe,
    onSave: vi.fn(async () => recipe),
  });
  await waitFor(() =>
    expect(
      (screen.getByLabelText('kcal') as HTMLInputElement).placeholder,
    ).toBe('330'),
  );
  const dialog = await chooseAndEdit();
  await fireEvent.input(dialog.getByLabelText('kcal'), {
    target: { value: '660' },
  });
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect((screen.getByLabelText('kcal') as HTMLInputElement).placeholder).toBe(
    '660',
  );
  expect((screen.getByLabelText('kcal') as HTMLInputElement).value).toBe('');
});

test('podczas zapisu nie zamyka edycji przez Anuluj ani Escape', async () => {
  render(IngredientPicker, { products });
  const dialog = await chooseAndEdit();
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz zmiany' }));
  expect(
    (dialog.getByRole('button', { name: 'Anuluj' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await fireEvent.keyDown(dialog.getByLabelText('Nazwa produktu'), {
    key: 'Escape',
  });
  expect(screen.getByRole('dialog', { name: 'Edytuj produkt' })).toBeTruthy();
  resolve(Response.json(products[0]));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
