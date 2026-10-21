import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import RecipePage from './RecipePage.svelte';
import { detailRecipe, products } from '../test/details';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(url === '/api/products' ? products : detailRecipe),
        ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('pobiera prawdziwy kontrakt GET /api/recipes/:id i produkty', async () => {
  render(RecipePage, { id: detailRecipe.id, desktop: false });
  expect(
    await screen.findByRole('heading', { name: detailRecipe.title }),
  ).toBeTruthy();
  expect(fetch).toHaveBeenCalledWith(
    `/api/recipes/${detailRecipe.id}`,
    expect.anything(),
  );
  expect(fetch).toHaveBeenCalledWith('/api/products', expect.anything());
});

test.each([
  [404, 'Przepis nie istnieje.'],
  [500, 'Brak połączenia z serwerem.'],
])('błąd HTTP %s', async (status, message) => {
  vi.mocked(fetch).mockImplementation(
    async () => new Response('{}', { status }),
  );
  render(RecipePage, { id: detailRecipe.id, desktop: false });
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    message,
  );
  expect(screen.getByRole('button', { name: 'Wróć' })).toBeTruthy();
});
