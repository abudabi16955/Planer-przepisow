import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import RecipeForm from './RecipeForm.svelte';
import IngredientPicker from './IngredientPicker.svelte';
import { products, recipes } from '../../test/recipes';
import { get } from 'svelte/store';
import { toast } from '../toast';

beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => products })),
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const disabled = (name: string) =>
  (screen.getByRole('button', { name }) as HTMLButtonElement).disabled;

test('blokuje Link, pustą nazwę, niepoprawne porcje i czas; zapisuje ręczny przepis', async () => {
  const onSave = vi.fn(async () => recipes[3]);
  render(RecipeForm, { onSave });
  expect(disabled('Zapisz przepis')).toBe(true);
  expect(
    screen.getByText('Pobieranie z linku jest chwilowo niedostępne.'),
  ).toBeTruthy();
  await fireEvent.click(screen.getByRole('tab', { name: 'Ręcznie' }));
  await fireEvent.input(screen.getByLabelText('Nazwa'), {
    target: { value: ' Zupa ' },
  });
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '51' },
  });
  expect(disabled('Zapisz przepis')).toBe(true);
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '3' },
  });
  await fireEvent.input(screen.getByLabelText('Czas (min)'), {
    target: { value: '0' },
  });
  expect(disabled('Zapisz przepis')).toBe(true);
  await fireEvent.input(screen.getByLabelText('Czas (min)'), {
    target: { value: '25' },
  });
  await fireEvent.input(screen.getByLabelText('Przygotowanie'), {
    target: { value: ' Gotuj\n\n Podaj ' },
  });
  await fireEvent.input(screen.getByLabelText('Białko g'), {
    target: { value: '1,5' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Zupa',
        servings: 3,
        time_min: 25,
        source_type: 'manual',
        steps: ['Gotuj', 'Podaj'],
        protein: 1.5,
      }),
    ),
  );
  expect(get(toast)?.message).toBe('Przepis zapisany');
});

test('PDF wymaga pliku i wysyła upload przed zapisem', async () => {
  const fetcher = vi.fn(async (url: string) => ({
    ok: true,
    json: async () =>
      url === '/api/uploads' ? { upload_id: 'upload' } : products,
  }));
  vi.stubGlobal('fetch', fetcher);
  const onSave = vi.fn(async () => recipes[0]);
  render(RecipeForm, { onSave });
  await fireEvent.click(screen.getByRole('tab', { name: 'PDF' }));
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '2' },
  });
  await fireEvent.input(screen.getByLabelText('Nazwa'), {
    target: { value: 'Zupa' },
  });
  expect(disabled('Zapisz przepis')).toBe(true);
  await fireEvent.change(screen.getByLabelText('Wybierz plik PDF'), {
    target: {
      files: [new File(['%PDF-test'], 'zupa.pdf', { type: 'application/pdf' })],
    },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ pdf_upload_id: 'upload', source_type: 'pdf' }),
    ),
  );
});

test('prefill i błąd zapisu zachowują dane i odblokowują ponowną próbę', async () => {
  render(RecipeForm, {
    initialRecipe: recipes[3],
    onSave: vi.fn(async () => {
      throw new Error('Brak połączenia z serwerem.');
    }),
  });
  expect((screen.getByLabelText('Nazwa') as HTMLInputElement).value).toBe(
    'Zupa pomidorowa',
  );
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await screen.findByRole('alert');
  expect(disabled('Zapisz przepis')).toBe(false);
});

test('szuka maksymalnie 6 produktów, wybiera jednostkę i przyjmuje ilość z przecinkiem', async () => {
  render(IngredientPicker, {
    products: Array.from({ length: 8 }, (_, i) => ({
      ...products[0],
      id: String(i),
      name: `Produkt ${i}`,
    })),
  });
  await fireEvent.input(screen.getByRole('combobox'), {
    target: { value: 'PRODUKT' },
  });
  expect(screen.getAllByRole('option')).toHaveLength(6);
  await fireEvent.click(screen.getAllByRole('option')[0]);
  expect(disabled('Dodaj składnik')).toBe(true);
  await fireEvent.input(screen.getByLabelText('Ilość'), {
    target: { value: '1,5' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Dodaj składnik' }));
  expect(screen.getByText('1,5 g')).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Usuń składnik: Produkt 0' }),
  );
  expect(screen.queryByText('1,5 g')).toBeNull();
});

test('nowy produkt waliduje duplikat, zapisuje kolejność jednostek i wybiera produkt', async () => {
  const fetcher = vi.fn(async () => ({
    ok: true,
    json: async () => ({
      ...products[0],
      id: 'new',
      name: 'Sumak',
      units: ['ml', 'g'],
    }),
  }));
  vi.stubGlobal('fetch', fetcher);
  render(IngredientPicker, { products });
  await fireEvent.input(screen.getByRole('combobox'), {
    target: { value: 'Sumak' },
  });
  expect(screen.getByText('Nie ma takiego produktu w bazie.')).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', {
      name: 'Nie ma na liście? Dodaj „Sumak” jako nowy produkt',
    }),
  );
  await fireEvent.input(screen.getByLabelText('Nazwa produktu'), {
    target: { value: 'produkt' },
  });
  expect(disabled('Zapisz produkt')).toBe(true);
  await fireEvent.input(screen.getByLabelText('Nazwa produktu'), {
    target: { value: 'Sumak' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'g' }));
  await fireEvent.click(screen.getByRole('button', { name: 'ml' }));
  await fireEvent.click(screen.getByRole('button', { name: 'g' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz produkt' }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      '/api/products',
      expect.objectContaining({
        body: expect.stringContaining('"units":["ml","g"]'),
      }),
    ),
  );
  expect(get(toast)?.message).toBe('Dodano produkt do bazy: Sumak');
  await fireEvent.click(screen.getByRole('button', { name: 'do smaku' }));
  expect(disabled('Dodaj składnik')).toBe(false);
});

test('klawiatura wybiera produkt i Escape zamyka arkusz bez zapisu', async () => {
  render(IngredientPicker, { products });
  const input = screen.getByRole('combobox');
  await fireEvent.input(input, { target: { value: 'Produkt' } });
  await fireEvent.keyDown(input, { key: 'ArrowDown' });
  expect(input.getAttribute('aria-activedescendant')).toBe('product-option-0');
  await fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.queryByRole('listbox')).toBeNull();
  await fireEvent.input(input, { target: { value: 'Sumak' } });
  await fireEvent.click(
    screen.getByRole('button', {
      name: 'Nie ma na liście? Dodaj „Sumak” jako nowy produkt',
    }),
  );
  await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('konflikt nazwy z serwera zachowuje formularz produktu', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 409 })),
  );
  render(IngredientPicker, { products });
  await fireEvent.input(screen.getByRole('combobox'), {
    target: { value: 'Sumak' },
  });
  await fireEvent.click(
    screen.getByRole('button', {
      name: 'Nie ma na liście? Dodaj „Sumak” jako nowy produkt',
    }),
  );
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz produkt' }));
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Produkt o tej nazwie już istnieje.',
  );
  expect(
    (screen.getByLabelText('Nazwa produktu') as HTMLInputElement).value,
  ).toBe('Sumak');
  expect(disabled('Zapisz produkt')).toBe(false);
});

test('wartości ujemne i nienumeryczne są puste; zero pozostaje wartością', async () => {
  const onSave = vi.fn(async () => recipes[3]);
  render(RecipeForm, { initialRecipe: recipes[3], onSave });
  await fireEvent.input(screen.getByLabelText('kcal'), {
    target: { value: '-20' },
  });
  await fireEvent.input(screen.getByLabelText('Białko g'), {
    target: { value: 'abc' },
  });
  await fireEvent.input(screen.getByLabelText('Węgle g'), {
    target: { value: '0' },
  });
  await fireEvent.input(screen.getByLabelText('Czas (min)'), {
    target: { value: '-1' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        kcal: null,
        protein: null,
        carbs: 0,
        time_min: null,
      }),
    ),
  );
});
