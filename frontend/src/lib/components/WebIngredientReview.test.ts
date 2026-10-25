import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import RecipeForm from './RecipeForm.svelte';
import { products, recipes } from '../../test/recipes';
import { webDraft } from '../../test/webDraft';
import type { WebDraft } from '../webImport';
let draft: WebDraft;
beforeEach(() => {
  draft = structuredClone(webDraft);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/config')
        return Response.json({
          import_enabled: true,
          web_import_enabled: true,
        });
      if (url === '/api/products') return Response.json(products);
      if (url === '/api/web-import') return Response.json(draft);
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function load() {
  render(RecipeForm, { onSave: vi.fn(async () => recipes[0]) });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: draft.source_url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz przepis ze strony' }),
  );
  await screen.findByRole('heading', { name: 'Przegląd składników' });
}
const row = (index: number) =>
  screen.getByRole('group', { name: `Składnik ${index}` });
const save = () =>
  screen.getByRole('button', { name: 'Zapisz przepis' }) as HTMLButtonElement;

test('oba stany mają tekst, wyróżnienie wiersza i nazwane przyciski; niezgodna jednostka czeka', async () => {
  draft.ingredients = [
    draft.ingredients[0],
    { ...draft.ingredients[0], match: 'fuzzy' },
    { ...draft.ingredients[0], unit: 'kg', unit_ok: false },
    draft.ingredients[1],
  ];
  await load();
  expect(screen.getByText('Zatwierdzone: 1 z 4')).toBeTruthy();
  expect(row(1).classList.contains('approved')).toBe(true);
  expect(within(row(1)).getByText('✓ zatwierdzony')).toBeTruthy();
  expect(within(row(1)).queryByText('sprawdź')).toBeNull();
  expect(row(1).getAttribute('aria-describedby')).toBe(
    within(row(1)).getByText('✓ zatwierdzony').id,
  );
  for (const index of [2, 3, 4]) {
    expect(row(index).classList.contains('pending')).toBe(true);
    expect(within(row(index)).getByText('sprawdź')).toBeTruthy();
  }
  const confirm = within(row(2)).getByRole('button', {
    name: 'Zatwierdź składnik: Produkt',
  });
  expect(confirm.classList.contains('primary')).toBe(true);
  expect(
    (
      within(row(3)).getByRole('button', {
        name: 'Zatwierdź składnik: Produkt',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(
    within(row(4)).getByRole('button', { name: 'Pomiń składnik: Nieznany' }),
  ).toBeTruthy();
  expect(save().disabled).toBe(true);
});

test('cofnięcie exact ponownie blokuje zapis, zatwierdzenie odblokowuje; edycja ilości i jednostki zachowuje stan', async () => {
  draft.ingredients = [draft.ingredients[0]];
  await load();
  expect(save().disabled).toBe(false);
  await fireEvent.click(
    screen.getByRole('button', { name: 'Cofnij zatwierdzenie: Produkt' }),
  );
  expect(screen.getByText('Zatwierdzone: 0 z 1')).toBeTruthy();
  expect(within(row(1)).getByText('sprawdź')).toBeTruthy();
  expect(save().disabled).toBe(true);
  await fireEvent.click(
    screen.getByRole('button', { name: 'Zatwierdź składnik: Produkt' }),
  );
  expect(screen.getByText('Zatwierdzone: 1 z 1')).toBeTruthy();
  expect(within(row(1)).queryByText('sprawdź')).toBeNull();
  expect(save().disabled).toBe(false);
  await fireEvent.input(screen.getByLabelText('Ilość: Produkt'), {
    target: { value: '250' },
  });
  await fireEvent.click(
    within(row(1)).getByRole('button', { name: 'do smaku: Produkt' }),
  );
  expect(screen.getByText('Zatwierdzone: 1 z 1')).toBeTruthy();
  expect(
    within(row(1)).getByRole('button', {
      name: 'Cofnij zatwierdzenie: Produkt',
    }),
  ).toBeTruthy();
  expect(save().disabled).toBe(false);
});

test.each(['exact', 'fuzzy', 'none'] as const)(
  'wybór %s wymaga jawnego zatwierdzenia i zachowuje przycisk',
  async (match) => {
    draft.ingredients = [
      {
        ...draft.ingredients[0],
        match,
        product_id: match === 'none' ? null : 'product',
      },
    ];
    await load();
    await fireEvent.click(
      within(row(1)).getByRole('button', { name: 'Wybierz produkt: Produkt' }),
    );
    await fireEvent.click(
      within(row(1)).getByRole('option', { name: /Produkt/ }),
    );
    expect(within(row(1)).getByText('sprawdź')).toBeTruthy();
    expect(screen.getByText('Zatwierdzone: 0 z 1')).toBeTruthy();
    expect(save().disabled).toBe(true);
    await fireEvent.click(
      within(row(1)).getByRole('button', {
        name: 'Zatwierdź składnik: Produkt',
      }),
    );
    expect(within(row(1)).queryByText('sprawdź')).toBeNull();
    expect(within(row(1)).getByText('✓ zatwierdzony')).toBeTruthy();
    expect(screen.getByText('Zatwierdzone: 1 z 1')).toBeTruthy();
    expect(save().disabled).toBe(false);
  },
);

test('licznik wyklucza pominięte i usunięte wiersze z obu liczb', async () => {
  await load();
  expect(screen.getByText('Zatwierdzone: 1 z 2')).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pomiń składnik: Nieznany' }),
  );
  expect(screen.getByText('Zatwierdzone: 1 z 1')).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Usuń składnik: Produkt' }),
  );
  expect(screen.getByText('Zatwierdzone: 0 z 0')).toBeTruthy();
  expect(save().disabled).toBe(false);
});
