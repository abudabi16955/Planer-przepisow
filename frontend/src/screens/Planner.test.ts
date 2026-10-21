import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Planner from './Planner.svelte';
import { recipes, products } from '../test/recipes';
import type { PlanEntry } from '../lib/domain/day';
import { get } from 'svelte/store';
import { toast } from '../lib/toast';

const now = new Date('2026-10-21T10:00:00Z');
let plan: PlanEntry[];
beforeEach(() => {
  window.history.replaceState(null, '', '/planer');
  plan = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/recipes') return Response.json(recipes);
      if (url === '/api/products') return Response.json(products);
      if (url.startsWith('/api/plan?')) return Response.json(plan);
      const [, date, slot] = /\/api\/plan\/([^/]+)\/(\d)/.exec(url)!;
      if (options?.method === 'PUT') {
        const entry = {
          date,
          slot: Number(slot) as 0 | 1 | 2,
          recipe_id: JSON.parse(options.body as string).recipe_id,
        };
        plan = [
          ...plan.filter((p) => p.date !== date || p.slot !== entry.slot),
          entry,
        ];
        return Response.json(entry);
      }
      plan = plan.filter((p) => p.date !== date || p.slot !== Number(slot));
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function show(desktop = false) {
  const view = render(Planner, { desktop, now });
  await waitFor(() =>
    expect(
      (
        screen.getAllByRole('button', {
          name: 'Dodaj przepis: Obiad',
        })[0] as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  return view;
}

test('telefon: bieżący tydzień, siedem dni, trzy sloty, Dziś i puste zakupy', async () => {
  await show();
  expect(screen.getByText('19–25 października · 0 z 21 posiłków')).toBeTruthy();
  expect(
    screen.getByRole('heading', { name: 'Środa, 21 października' }),
  ).toBeTruthy();
  expect(screen.getByText('Dziś')).toBeTruthy();
  expect(
    screen.getByText('Paski od góry: śniadanie, obiad, kolacja.'),
  ).toBeTruthy();
  expect(
    screen.getAllByRole('button', { name: /Dodaj przepis:/ }),
  ).toHaveLength(3);
  expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  expect(
    (screen.getByRole('button', { name: /Lista zakupów/ }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByText('Najpierw zaplanuj posiłki')).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Piątek 23 października' }),
  );
  expect(
    screen.getByRole('heading', { name: 'Piątek, 23 października' }),
  ).toBeTruthy();
  expect(screen.queryByText('Dziś')).toBeNull();
});

test('wybór, toast, zastępowanie zajętego slotu i idempotentne usunięcie', async () => {
  await show();
  screen.getByRole('button', { name: 'Dodaj przepis: Obiad' }).focus();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Dodaj przepis: Obiad' }),
  );
  let dialog = screen.getByRole('dialog', { name: 'Wybierz przepis' });
  expect(within(dialog).getByText('Środa · Obiad')).toBeTruthy();
  await fireEvent.click(
    within(dialog).getByRole('button', {
      name: `Wybierz: ${recipes[0].title}`,
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(plan).toEqual([
    { date: '2026-10-21', slot: 1, recipe_id: recipes[0].id },
  ]);
  expect(document.activeElement?.getAttribute('aria-label')).toBe(
    'Dodaj przepis: Obiad',
  );
  expect(get(toast)?.message).toBe(`Dodano do planera: ${recipes[0].title}`);
  expect(screen.getByText('19–25 października · 1 z 21 posiłków')).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Dodaj przepis: Obiad' }),
  );
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText(`Zastąpi: ${recipes[0].title}`)).toBeTruthy();
  await fireEvent.click(
    within(dialog).getByRole('button', {
      name: `Wybierz: ${recipes[3].title}`,
    }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(plan).toHaveLength(1);
  expect(plan[0].recipe_id).toBe(recipes[3].id);
  await fireEvent.click(
    screen.getByRole('button', { name: `Usuń z planera: ${recipes[3].title}` }),
  );
  await waitFor(() =>
    expect(
      screen.getByText('19–25 października · 0 z 21 posiłków'),
    ).toBeTruthy(),
  );
  expect(plan).toEqual([]);
  expect(fetch).toHaveBeenCalledWith('/api/plan/2026-10-21/1', {
    method: 'DELETE',
  });
});

test('laptop: siedem kolumn, 21 kafli, dzień i otwarcie szczegółów', async () => {
  plan = [{ date: '2026-10-21', slot: 1, recipe_id: recipes[0].id }];
  await show(true);
  expect(
    screen.getAllByRole('group', { name: /^(Śniadanie|Obiad|Kolacja)$/ }),
  ).toHaveLength(21);
  expect(
    screen.getByRole('complementary', { name: 'Podsumowanie dnia' }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Zmień cel' })).toBeNull();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Czwartek 22 października' }),
  );
  expect(
    screen.getByRole('heading', { name: 'Czwartek, 22 października' }),
  ).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: `Otwórz przepis: ${recipes[0].title}` }),
  );
  expect(window.location.pathname).toBe(`/przepis/${recipes[0].id}`);
});

test('lista zakupów przenosi wybrany tydzień w query', async () => {
  plan = [{ date: '2026-10-21', slot: 1, recipe_id: recipes[0].id }];
  await show();
  await fireEvent.click(screen.getByRole('button', { name: /Lista zakupów/ }));
  expect(window.location.pathname + window.location.search).toBe(
    '/zakupy?week=2026-10-19',
  );
});

test('zmiana tygodnia, przełom roku i anulowanie starego pobierania', async () => {
  let finish!: (value: Response) => void;
  const defaultFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, options) =>
    String(url).startsWith('/api/plan?week=2026-10-19')
      ? new Promise((resolve) => (finish = resolve))
      : defaultFetch(url, options),
  );
  const view = render(Planner, { desktop: false, now });
  await waitFor(() => expect(finish).toBeTypeOf('function'));
  const firstCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) => String(url).includes('/api/plan?'))!;
  await view.rerender({ desktop: false, now, week: '2026-12-28' });
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Dodaj przepis: Obiad',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(firstCall[1]?.signal?.aborted).toBe(true);
  expect(
    screen.getByText('28 grudnia 2026 – 3 stycznia 2027 · 0 z 21 posiłków'),
  ).toBeTruthy();
  expect(screen.queryByText('Dziś')).toBeNull();
  finish(
    Response.json([{ date: '2026-10-21', slot: 1, recipe_id: recipes[0].id }]),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole('button', {
        name: `Otwórz przepis: ${recipes[0].title}`,
      }),
    ).toBeNull(),
  );
  await fireEvent.click(
    screen.getByRole('button', { name: 'Następny tydzień' }),
  );
  expect(window.location.search).toBe('?week=2027-01-04');
});

test('błąd pobrania blokuje nadpisanie nieznanego planu', async () => {
  const defaultFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, options) =>
    String(url).startsWith('/api/plan?')
      ? Promise.resolve(new Response(null, { status: 503 }))
      : defaultFetch(url, options),
  );
  render(Planner, { desktop: false, now });
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Brak połączenia z serwerem.',
  );
  expect(
    (
      screen.getByRole('button', {
        name: 'Dodaj przepis: Obiad',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test('błąd DELETE zachowuje zajęty slot', async () => {
  plan = [{ date: '2026-10-21', slot: 1, recipe_id: recipes[0].id }];
  const defaultFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, options) =>
    options?.method === 'DELETE'
      ? Promise.resolve(new Response(null, { status: 500 }))
      : defaultFetch(url, options),
  );
  await show();
  await fireEvent.click(
    screen.getByRole('button', { name: `Usuń z planera: ${recipes[0].title}` }),
  );
  await screen.findByRole('alert');
  expect(
    screen.getByRole('button', { name: `Otwórz przepis: ${recipes[0].title}` }),
  ).toBeTruthy();
  expect(plan).toHaveLength(1);
});

test('błąd PUT nie zamyka wyboru ani nie dodaje pozornego posiłku', async () => {
  const defaultFetch = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((url, options) =>
    options?.method === 'PUT'
      ? Promise.resolve(new Response(null, { status: 404 }))
      : defaultFetch(url, options),
  );
  await show();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Dodaj przepis: Obiad' }),
  );
  await fireEvent.click(
    screen.getByRole('button', { name: `Wybierz: ${recipes[0].title}` }),
  );
  expect((await screen.findByRole('alert')).textContent).toBe(
    'Przepis nie istnieje.',
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.getByText('19–25 października · 0 z 21 posiłków')).toBeTruthy();
  expect(plan).toEqual([]);
  vi.mocked(fetch).mockImplementation(defaultFetch);
  await fireEvent.click(
    screen.getByRole('button', { name: `Wybierz: ${recipes[0].title}` }),
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(plan).toHaveLength(1);
});
