import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import RecipeForm from './RecipeForm.svelte';
import RecipeDetails from './RecipeDetails.svelte';
import RecipeCard from './RecipeCard.svelte';
import LinkImport from './LinkImport.svelte';
import { products, recipes } from '../../test/recipes';
import { webDraft } from '../../test/webDraft';
import type { WebDraft } from '../webImport';
let draft: WebDraft;
let webEnabled: boolean;
let code: string | null;
beforeEach(() => {
  draft = structuredClone(webDraft);
  webEnabled = true;
  code = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/config')
        return Response.json({
          import_enabled: true,
          web_import_enabled: webEnabled,
        });
      if (url === '/api/products' && options?.method === 'POST')
        return Response.json({
          ...products[0],
          id: 'new',
          name: 'Nieznany',
          units: ['szt.'],
        });
      if (url === '/api/products') return Response.json(products);
      if (url === '/api/web-import')
        return code
          ? Response.json({ detail: { code } }, { status: 422 })
          : Response.json(draft);
      throw new Error(`Unexpected ${url}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function load() {
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: draft.source_url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz przepis ze strony' }),
  );
  await screen.findByRole('heading', { name: 'Przegląd składników' });
}
const saveButton = () =>
  screen.getByRole('button', { name: 'Zapisz przepis' }) as HTMLButtonElement;
test('wypełnia formularz, pokazuje surowe uwagi i blokuje nieznane; pominięcie zapisuje WWW', async () => {
  const onSave = vi.fn(async () => recipes[0]);
  render(RecipeForm, { onSave });
  await load();
  expect((screen.getByLabelText('Nazwa') as HTMLInputElement).value).toBe(
    draft.title,
  );
  expect((screen.getByLabelText('Porcje') as HTMLInputElement).value).toBe('4');
  expect((screen.getByLabelText('Czas (min)') as HTMLInputElement).value).toBe(
    '45',
  );
  expect(
    (screen.getByLabelText('Przygotowanie') as HTMLTextAreaElement).value,
  ).toBe('Gotuj.\nPodaj.');
  expect((screen.getByLabelText('kcal') as HTMLInputElement).value).toBe('300');
  expect(screen.getByText(draft.notes[0])).toBeTruthy();
  expect(document.querySelector('img[src="x"]')).toBeNull();
  expect(saveButton().disabled).toBe(true);
  expect(screen.getByText('Zatwierdź albo pomiń 1 składników')).toBeTruthy();
  await fireEvent.input(screen.getByLabelText('Ilość: Produkt'), {
    target: { value: '250' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Pomiń' }));
  await fireEvent.click(saveButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'link',
        source_platform: 'www',
        source_url: draft.source_url,
        ingredients: [{ product_id: 'product', quantity: 250, unit: 'g' }],
      }),
    ),
  );
});
test('zachowuje wpisaną nazwę i pozwala dopasować nieznany produkt istniejącą wyszukiwarką', async () => {
  render(RecipeForm, { onSave: vi.fn() });
  await fireEvent.input(screen.getByLabelText('Nazwa'), {
    target: { value: 'Moja nazwa' },
  });
  await load();
  expect((screen.getByLabelText('Nazwa') as HTMLInputElement).value).toBe(
    'Moja nazwa',
  );
  const row = within(screen.getByRole('group', { name: 'Składnik 2' }));
  await fireEvent.click(row.getByRole('button', { name: 'Wybierz produkt' }));
  await fireEvent.input(row.getByRole('combobox'), {
    target: { value: 'Produkt' },
  });
  await fireEvent.click(row.getByRole('option', { name: /Produkt/ }));
  await fireEvent.click(row.getByRole('button', { name: 'Dodaj składnik' }));
  expect(saveButton().disabled).toBe(false);
});
test('nowy produkt ma nazwę i jednostkę ze szkicu, wraca do zatwierdzonego składnika', async () => {
  render(RecipeForm, { onSave: vi.fn() });
  await load();
  const row = within(screen.getByRole('group', { name: 'Składnik 2' }));
  await fireEvent.click(
    row.getByRole('button', { name: 'Dodaj „Nieznany” jako nowy produkt' }),
  );
  const dialog = within(screen.getByRole('dialog', { name: 'Nowy produkt' }));
  expect(
    (dialog.getByLabelText('Nazwa produktu') as HTMLInputElement).value,
  ).toBe('Nieznany');
  expect(
    dialog.getByRole('button', { name: 'szt.' }).getAttribute('aria-pressed'),
  ).toBe('true');
  await fireEvent.click(dialog.getByRole('button', { name: 'Zapisz produkt' }));
  await fireEvent.click(
    await row.findByRole('button', { name: 'Dodaj składnik' }),
  );
  expect(saveButton().disabled).toBe(false);
});
test('fuzzy i niezgodna jednostka wymagają poprawienia i zatwierdzenia', async () => {
  draft.ingredients = [
    { ...draft.ingredients[0], match: 'fuzzy', unit: 'kg', unit_ok: false },
  ];
  render(RecipeForm, { onSave: vi.fn() });
  await load();
  expect(screen.getByText('sprawdź')).toBeTruthy();
  expect(saveButton().disabled).toBe(true);
  const row = within(screen.getByRole('group', { name: 'Składnik 1' }));
  await fireEvent.click(row.getByRole('button', { name: 'g' }));
  expect(saveButton().disabled).toBe(true);
  await fireEvent.click(
    row.getByRole('button', { name: 'Zatwierdź składnik' }),
  );
  expect(saveButton().disabled).toBe(false);
  await fireEvent.click(
    row.getByRole('button', { name: 'Usuń składnik: Produkt' }),
  );
  expect(saveButton().disabled).toBe(false);
});
test.each([
  ['no_recipe', 'Na tej stronie nie znalazłem przepisu. Dodaj go ręcznie.'],
  ['blocked_host', 'Nie mogę otworzyć tego adresu.'],
  ['unsupported_url', 'Nie mogę otworzyć tego adresu.'],
  ['fetch_failed', 'Nie udało się pobrać strony.'],
  ['timeout', 'Nie udało się pobrać strony.'],
  ['too_large', 'Strona jest za duża.'],
])('komunikat %s i reszta formularza działają', async (failure, message) => {
  code = failure;
  render(RecipeForm, { onSave: vi.fn() });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: draft.source_url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz przepis ze strony' }),
  );
  expect(await screen.findByText(message)).toBeTruthy();
  await fireEvent.click(screen.getByRole('tab', { name: 'Ręcznie' }));
  await fireEvent.input(screen.getByLabelText('Nazwa'), {
    target: { value: 'Ręcznie' },
  });
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '2' },
  });
  expect(saveButton().disabled).toBe(false);
});
test('flaga wyłącza wyłącznie import WWW', async () => {
  webEnabled = false;
  render(LinkImport, { onchange: vi.fn() });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: draft.source_url },
  });
  expect(
    screen.queryByRole('button', { name: 'Pobierz przepis ze strony' }),
  ).toBeNull();
  expect(
    screen.getByText('Pobieranie ze stron jest chwilowo niedostępne.'),
  ).toBeTruthy();
});
test('źródło WWW ma bezpieczny link i plakietkę, nie udaje wideo', async () => {
  const recipe = {
    ...recipes[0],
    source_type: 'link' as const,
    source_platform: 'www' as const,
    source_url: draft.source_url,
    pdf: null,
    video: null,
  };
  const details = render(RecipeDetails, { recipe, products });
  await fireEvent.click(screen.getByRole('tab', { name: 'Źródło' }));
  expect(screen.getByText('Oryginalna strona')).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Otwórz oryginał' }).getAttribute('rel'),
  ).toBe('noopener noreferrer');
  expect(screen.queryByLabelText('Wideo przepisu')).toBeNull();
  details.unmount();
  render(RecipeCard, { recipe, products, desktop: false, onselect: vi.fn() });
  expect(screen.getByText('WWW')).toBeTruthy();
});

test('zdjęcie ze strony przekazuje wyłącznie przy zapisie, bez żądania przeglądarki do obcego hosta', async () => {
  draft.photo_url = 'https://images.example/photo.jpg';
  draft.ingredients = [];
  const onSave = vi.fn(async () => recipes[0]);
  render(RecipeForm, { onSave });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: draft.source_url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz przepis ze strony' }),
  );
  await screen.findByText('Zdjęcie ze strony zapisze się razem z przepisem.');
  expect(
    document.querySelector('img[src="https://images.example/photo.jpg"]'),
  ).toBeNull();
  await fireEvent.click(saveButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ web_photo_url: draft.photo_url }),
    ),
  );
});

test('edycja WWW zachowuje źródło bez ponownego importu', async () => {
  const recipe = {
    ...recipes[0],
    source_type: 'link' as const,
    source_platform: 'www' as const,
    source_url: draft.source_url,
    pdf: null,
    video: null,
  };
  const onSave = vi.fn(async () => recipe);
  render(RecipeForm, { initialRecipe: recipe, onSave });
  await screen.findByRole('button', { name: 'Pobierz przepis ze strony' });
  expect(saveButton().disabled).toBe(false);
  await fireEvent.click(saveButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        source_platform: 'www',
        source_url: draft.source_url,
      }),
    ),
  );
});

test('ułamek pokazuje 0,33 bez utraty dokładnej ilości w zapisie', async () => {
  draft.ingredients = [{ ...draft.ingredients[0], qty: 1 / 3 }];
  const onSave = vi.fn(async () => recipes[0]);
  render(RecipeForm, { onSave });
  await load();
  expect(
    (screen.getByLabelText('Ilość: Produkt') as HTMLInputElement).value,
  ).toBe('0,33');
  await fireEvent.click(saveButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [{ product_id: 'product', quantity: 1 / 3, unit: 'g' }],
      }),
    ),
  );
});

test('edycja liczby dziesiętnej zachowuje wpisywany przecinek', async () => {
  draft.ingredients = [{ ...draft.ingredients[0], qty: 1 / 3 }];
  render(RecipeForm, { onSave: vi.fn() });
  await load();
  const input = screen.getByLabelText('Ilość: Produkt') as HTMLInputElement;
  await fireEvent.input(input, { target: { value: '0,' } });
  expect(input.value).toBe('0,');
  expect(saveButton().disabled).toBe(true);
  await fireEvent.input(input, { target: { value: '0,25' } });
  expect(input.value).toBe('0,25');
  expect(saveButton().disabled).toBe(false);
});

test('wybór produktu pokazuje krótki ułamek i zachowuje dokładną ilość bez edycji', async () => {
  draft.ingredients = [{ ...draft.ingredients[1], qty: 1 / 3, unit: 'g' }];
  const onSave = vi.fn(async () => recipes[0]);
  render(RecipeForm, { onSave });
  await load();
  const row = within(screen.getByRole('group', { name: 'Składnik 1' }));
  await fireEvent.click(row.getByRole('button', { name: 'Wybierz produkt' }));
  await fireEvent.input(row.getByRole('combobox'), {
    target: { value: 'Produkt' },
  });
  await fireEvent.click(row.getByRole('option', { name: /Produkt/ }));
  expect((row.getByLabelText('Ilość') as HTMLInputElement).value).toBe('0,33');
  await fireEvent.click(row.getByRole('button', { name: 'Dodaj składnik' }));
  await fireEvent.click(saveButton());
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ingredients: [{ product_id: 'product', quantity: 1 / 3, unit: 'g' }],
      }),
    ),
  );
});
