import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import EditRecipe from './EditRecipe.svelte';
import RecipeForm from '../lib/components/RecipeForm.svelte';
import { detailRecipe, products } from '../test/details';
import { get } from 'svelte/store';
import { toast } from '../lib/toast';
import { resolveRoute } from '../lib/router';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string, options?: RequestInit) =>
        new Response(
          JSON.stringify(
            url === '/api/products'
              ? products
              : options?.method === 'PUT'
                ? { ...detailRecipe, title: 'Nowy tytuł' }
                : detailRecipe,
          ),
        ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('rozpoznaje adres edycji', () =>
  expect(resolveRoute(`/przepis/${detailRecipe.id}/edytuj`)).toEqual({
    page: 'edit',
    id: detailRecipe.id,
  }));

test('pobiera i wypełnia wszystkie pola, PUT zapisuje i wraca do szczegółów', async () => {
  render(EditRecipe, { id: detailRecipe.id });
  const title = await screen.findByLabelText('Nazwa');
  expect((title as HTMLInputElement).value).toBe(detailRecipe.title);
  expect((screen.getByLabelText('Porcje') as HTMLInputElement).value).toBe('2');
  expect((screen.getByLabelText('Czas (min)') as HTMLInputElement).value).toBe(
    '25',
  );
  expect(
    (screen.getByLabelText('Przygotowanie') as HTMLTextAreaElement).value,
  ).toBe(detailRecipe.steps.join('\n'));
  expect(
    screen.getByRole('button', { name: 'Obiad' }).getAttribute('aria-pressed'),
  ).toBe('true');
  await fireEvent.input(title, { target: { value: 'Nowy tytuł' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      `/api/recipes/${detailRecipe.id}`,
      expect.objectContaining({
        method: 'PUT',
        body: expect.stringContaining('Nowy tytuł'),
      }),
    ),
  );
  expect(window.location.pathname).toBe(`/przepis/${detailRecipe.id}`);
  expect(get(toast)?.message).toBe('Przepis zapisany');
});

test('błąd PUT zachowuje wpisane dane; Anuluj nie zapisuje', async () => {
  vi.mocked(fetch).mockImplementation(
    async (url, options) =>
      new Response(
        JSON.stringify(url === '/api/products' ? products : detailRecipe),
        { status: options?.method === 'PUT' ? 500 : 200 },
      ),
  );
  render(EditRecipe, { id: detailRecipe.id });
  const title = await screen.findByLabelText('Nazwa');
  await fireEvent.input(title, { target: { value: 'Niezapisany' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await screen.findByRole('alert');
  expect((title as HTMLInputElement).value).toBe('Niezapisany');
  expect(
    (
      screen.getByRole('button', {
        name: 'Zapisz przepis',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  const count = vi.mocked(fetch).mock.calls.length;
  await fireEvent.click(screen.getByRole('button', { name: 'Anuluj' }));
  expect(fetch).toHaveBeenCalledTimes(count);
  expect(window.location.pathname).toBe(`/przepis/${detailRecipe.id}`);
});

test.each([404, 500])(
  'błąd pobierania %s nie otwiera pustego formularza',
  async (status) => {
    vi.mocked(fetch).mockImplementation(
      async () => new Response('{}', { status }),
    );
    render(EditRecipe, { id: detailRecipe.id });
    expect((await screen.findByRole('alert')).textContent).toBe(
      status === 404 ? 'Przepis nie istnieje.' : 'Brak połączenia z serwerem.',
    );
    expect(screen.queryByRole('button', { name: 'Zapisz przepis' })).toBeNull();
  },
);

test.each(['pdf', 'link'] as const)(
  'edycja %s zachowuje źródło bez nowego uploadu',
  async (source) => {
    const file = {
      path: `${source}/original`,
      original_name: 'oryginal.pdf',
      mime_type: source === 'pdf' ? 'application/pdf' : 'video/mp4',
      size_bytes: 123,
    };
    const recipe = {
      ...detailRecipe,
      source_type: source,
      pdf: source === 'pdf' ? file : null,
      video: source === 'link' ? file : null,
    };
    const onSave = vi.fn(async () => recipe);
    render(RecipeForm, { initialRecipe: recipe, onSave });
    expect(
      (screen.getByRole('tab', { name: 'Ręcznie' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await fireEvent.click(
      screen.getByRole('button', { name: 'Zapisz przepis' }),
    );
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: source,
          pdf_upload_id: undefined,
          photo_upload_id: undefined,
        }),
      ),
    );
    expect(
      vi.mocked(fetch).mock.calls.every(([url]) => url === '/api/products'),
    ).toBe(true);
  },
);
