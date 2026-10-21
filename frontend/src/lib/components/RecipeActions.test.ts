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
import RecipeDetails from './RecipeDetails.svelte';
import Recipes from '../../screens/Recipes.svelte';
import { detailRecipe, products } from '../../test/details';
import { toast } from '../toast';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 204 })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const show = () => render(RecipeDetails, { recipe: detailRecipe, products });
async function openDelete() {
  await fireEvent.click(screen.getByRole('button', { name: 'Usuń' }));
  return screen.getByRole('alertdialog');
}

test('Edytuj otwiera adres istniejącego przepisu', async () => {
  show();
  await fireEvent.click(screen.getByRole('button', { name: 'Edytuj' }));
  expect(window.location.pathname).toBe(`/przepis/${detailRecipe.id}/edytuj`);
});
test('potwierdzenie ma właściwy tekst, pułapkę fokusu i Anuluj/Escape nie usuwa', async () => {
  show();
  let dialog = await openDelete();
  expect(dialog.getAttribute('aria-modal')).toBe('true');
  expect(within(dialog).getByRole('heading').textContent).toBe(
    'Usunąć przepis? Zniknie też z planera.',
  );
  const cancel = within(dialog).getByRole('button', { name: 'Anuluj' });
  expect(document.activeElement).toBe(cancel);
  await fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(
    within(dialog).getByRole('button', { name: 'Usuń' }),
  );
  await fireEvent.click(cancel);
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
  dialog = await openDelete();
  await fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
test('potwierdzenie usuwa przez API, wywołuje callback i toast', async () => {
  const onDeleted = vi.fn();
  render(RecipeDetails, { recipe: detailRecipe, products, onDeleted });
  const dialog = await openDelete();
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(detailRecipe.id));
  expect(fetch).toHaveBeenCalledWith(`/api/recipes/${detailRecipe.id}`, {
    method: 'DELETE',
  });
  expect(get(toast)?.message).toBe('Przepis usunięty');
  expect(window.location.pathname).toBe('/');
});
test('błąd usuwania pozostawia szczegóły i pozwala ponowić', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
  show();
  const dialog = await openDelete();
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }));
  expect((await within(dialog).findByRole('alert')).textContent).toBe(
    'Nie udało się usunąć przepisu. Spróbuj ponownie.',
  );
  expect(
    screen.getByRole('heading', { name: detailRecipe.title }),
  ).toBeTruthy();
  expect(
    (within(dialog).getByRole('button', { name: 'Usuń' }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
test('blokuje podwójne usunięcie podczas żądania', async () => {
  let finish!: () => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = () => resolve(new Response(null, { status: 204 }));
      }),
  );
  show();
  const dialog = await openDelete();
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }));
  expect(
    (
      within(dialog).getByRole('button', {
        name: 'Usuwanie…',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeTruthy();
  finish();
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('usunięcie z panelu laptopa na / usuwa kartę i odświeża licznik', async () => {
  vi.mocked(fetch).mockImplementation(async (url, options) =>
    options?.method === 'DELETE'
      ? new Response(null, { status: 204 })
      : new Response(
          JSON.stringify(url === '/api/products' ? products : [detailRecipe]),
        ),
  );
  render(Recipes, { desktop: true });
  await screen.findByRole('button', {
    name: `Pokaż przepis: ${detailRecipe.title}`,
  });
  const dialog = await openDelete();
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Usuń' }));
  await waitFor(() =>
    expect(
      screen.queryByRole('button', {
        name: `Pokaż przepis: ${detailRecipe.title}`,
      }),
    ).toBeNull(),
  );
  expect(screen.getByText('0 przepisów')).toBeTruthy();
  expect(
    screen.queryByRole('heading', { name: detailRecipe.title }),
  ).toBeNull();
});
