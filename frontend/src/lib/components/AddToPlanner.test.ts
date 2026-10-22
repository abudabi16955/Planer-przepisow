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
import AddToPlanner from './AddToPlanner.svelte';
import { detailRecipe } from '../../test/details';
import { toast } from '../toast';
const now = new Date('2026-10-21T10:00:00Z');
beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (options?.method === 'PUT')
        return Response.json({
          date: '2026-10-21',
          slot: 1,
          recipe_id: detailRecipe.id,
        });
      return Response.json(url === '/api/recipes' ? [detailRecipe] : []);
    }),
  ),
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function show(desktop = false, recipe = detailRecipe) {
  render(AddToPlanner, { recipe, desktop, now });
  expect(fetch).not.toHaveBeenCalled();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Dodaj do planera' }),
  );
  const panel = desktop
    ? screen.getByRole('region', { name: 'Dodaj do planera' })
    : screen.getByRole('dialog', { name: 'Dodaj do planera' });
  await waitFor(() =>
    expect(
      (
        within(panel).getByRole('button', {
          name: 'Obiad',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  return panel;
}
test('telefon: bieżący tydzień, domyślny dzień i posiłek, zapis i toast', async () => {
  const panel = await show();
  expect(
    within(panel)
      .getByRole('button', { name: 'Środa 21 października' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    within(panel)
      .getByRole('button', { name: 'Obiad' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(
    within(panel).getByText('To miejsce w planerze jest wolne.'),
  ).toBeTruthy();
  await fireEvent.click(
    within(panel).getByRole('button', { name: 'Czwartek 22 października' }),
  );
  await fireEvent.click(within(panel).getByRole('button', { name: 'Kolacja' }));
  await fireEvent.click(within(panel).getByRole('button', { name: 'Dodaj' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(fetch).toHaveBeenCalledWith(
    '/api/plan/2026-10-22/2',
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ recipe_id: detailRecipe.id }),
    }),
  );
  expect(get(toast)?.message).toBe(`Dodano do planera: ${detailRecipe.title}`);
});
test.each([
  ['sniadanie', 'Śniadanie'],
  ['obiad', 'Obiad'],
  ['kolacja', 'Kolacja'],
] as const)('domyślny posiłek z kategorii %s', async (category, label) => {
  const panel = await show(false, { ...detailRecipe, category });
  expect(
    within(panel)
      .getByRole('button', { name: label })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});
test('laptop: panel w miejscu i notka zastąpienia', async () => {
  vi.mocked(fetch).mockImplementation(async (url) =>
    Response.json(
      url === '/api/recipes'
        ? [{ ...detailRecipe, id: 'old', title: 'Poprzedni przepis' }]
        : [{ date: '2026-10-21', slot: 1, recipe_id: 'old' }],
    ),
  );
  const panel = await show(true);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(within(panel).getByText('Zastąpi: Poprzedni przepis')).toBeTruthy();
  expect(
    screen
      .getByRole('button', { name: 'Zamknij' })
      .getAttribute('aria-expanded'),
  ).toBe('true');
  await fireEvent.click(screen.getByRole('button', { name: 'Zamknij' }));
  expect(screen.queryByRole('region')).toBeNull();
});
test('błąd odczytu blokuje zapis i pozwala ponowić', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));
  render(AddToPlanner, { recipe: detailRecipe, now });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Dodaj do planera' }),
  );
  const panel = screen.getByRole('dialog');
  await within(panel).findByRole('alert');
  expect(
    (within(panel).getByRole('button', { name: 'Dodaj' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  vi.mocked(fetch).mockImplementation(async (url) =>
    Response.json(url === '/api/recipes' ? [detailRecipe] : []),
  );
  await fireEvent.click(
    within(panel).getByRole('button', { name: 'Spróbuj ponownie' }),
  );
  await waitFor(() =>
    expect(
      (
        within(panel).getByRole('button', {
          name: 'Dodaj',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
});
test('błąd PUT zachowuje wybrany cel i nie pokazuje sukcesu', async () => {
  const fetcher = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, options) =>
    options?.method === 'PUT'
      ? Promise.resolve(new Response(null, { status: 404 }))
      : fetcher(url, options),
  );
  const previous = get(toast);
  const panel = await show();
  await fireEvent.click(within(panel).getByRole('button', { name: 'Dodaj' }));
  expect((await within(panel).findByRole('alert')).textContent).toBe(
    'Przepis nie istnieje.',
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(get(toast)).toBe(previous);
});
test('blokuje podwójny zapis i Escape w trakcie PUT', async () => {
  let finish!: (response: Response) => void;
  const fetcher = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, options) =>
    options?.method === 'PUT'
      ? new Promise((resolve) => (finish = resolve))
      : fetcher(url, options),
  );
  const panel = await show();
  await fireEvent.click(within(panel).getByRole('button', { name: 'Dodaj' }));
  expect(
    (within(panel).getByRole('button', { name: 'Dodaj' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await fireEvent.keyDown(panel, { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([, options]) => options?.method === 'PUT'),
  ).toHaveLength(1);
  finish(
    Response.json({ date: '2026-10-21', slot: 1, recipe_id: detailRecipe.id }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
test('zamknięcie arkusza anuluje GET', async () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  render(AddToPlanner, { recipe: detailRecipe, now });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Dodaj do planera' }),
  );
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(signal?.aborted).toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
});
