import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Shopping from './Shopping.svelte';
import { tick } from 'svelte';
import { recipes, products } from '../test/recipes';
import type { PlanEntry } from '../lib/domain/day';
import type { ShoppingCheck } from '../lib/shoppingApi';

const now = new Date('2026-10-21T10:00:00Z');
const recipe = {
  ...recipes[0],
  ingredients: [{ product_id: 'product', quantity: 100, unit: 'g' }],
  servings: 2,
};
let plan: PlanEntry[];
let checks: ShoppingCheck[];
let failWrite: boolean;
beforeEach(() => {
  window.history.replaceState(null, '', '/zakupy?week=2026-10-19');
  plan = [{ date: '2026-10-21', slot: 1, recipe_id: recipe.id }];
  checks = [{ week_start: '2026-10-19', item_key: 'removed|g', checked: true }];
  failWrite = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/recipes') return Response.json([recipe]);
      if (url === '/api/products') return Response.json(products);
      if (url.startsWith('/api/plan?'))
        return Response.json(
          plan.filter(
            (entry) =>
              url.endsWith('2026-10-19') && entry.date === '2026-10-21',
          ),
        );
      if (options?.method === 'PUT') {
        if (failWrite) return new Response(null, { status: 500 });
        const value = JSON.parse(options.body as string) as ShoppingCheck;
        checks = [
          ...checks.filter(
            (check) =>
              check.week_start !== value.week_start ||
              check.item_key !== value.item_key,
          ),
          value,
        ];
        return Response.json(value);
      }
      return Response.json(
        checks.filter((check) => url.endsWith(check.week_start)),
      );
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function show(desktop = false) {
  const view = render(Shopping, { desktop, week: '2026-10-19', now });
  await screen.findByRole('button', { name: 'Produkt, 50 g' });
  return view;
}

test.each([false, true])(
  'lista i trwały postęp, desktop=%s',
  async (desktop) => {
    await show(desktop);
    expect(
      screen.getByText('19–25 października · Pozycje: 1 · Posiłki: 1'),
    ).toBeTruthy();
    expect(screen.getByText('Kupione: 0 z 1')).toBeTruthy();
    const item = screen.getByRole('button', { name: 'Produkt, 50 g' });
    await fireEvent.click(item);
    await waitFor(() => expect(item.getAttribute('aria-pressed')).toBe('true'));
    expect(screen.getByText('Kupione: 1 z 1')).toBeTruthy();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '1',
    );
    expect(checks.find((check) => check.item_key === 'product|g')).toEqual({
      week_start: '2026-10-19',
      item_key: 'product|g',
      checked: true,
    });
    cleanup();
    await show(desktop);
    expect(
      screen
        .getByRole('button', { name: 'Produkt, 50 g' })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    await fireEvent.click(
      screen.getByRole('button', { name: 'Produkt, 50 g' }),
    );
    await screen.findByText('Kupione: 0 z 1');
  },
);

test('presety, liczby posiłków i dwa puste stany', async () => {
  await show();
  const day = screen.getByRole('button', {
    name: /^Środa, 21 października, zaplanowane posiłki:/,
  });
  expect(day.textContent).toContain('1');
  expect(
    screen
      .getByRole('button', { name: 'Cały tydzień' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  await fireEvent.click(screen.getByRole('button', { name: 'Weekend' }));
  await screen.findByText('W wybranych dniach nie ma zaplanowanych posiłków.');
  expect(
    screen
      .getByRole('button', { name: 'Weekend' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryByRole('progressbar')).toBeNull();
  await fireEvent.click(
    screen.getByRole('button', {
      name: /^Sobota, 24 października, zaplanowane posiłki:/,
    }),
  );
  await fireEvent.click(
    screen.getByRole('button', {
      name: /^Niedziela, 25 października, zaplanowane posiłki:/,
    }),
  );
  await screen.findByText('Wybierz co najmniej jeden dzień.');
  await fireEvent.click(screen.getByRole('button', { name: 'Od dziś' }));
  expect(day.getAttribute('aria-pressed')).toBe('true');
  expect(
    screen
      .getByRole('button', {
        name: /^Poniedziałek, 19 października, zaplanowane posiłki:/,
      })
      .getAttribute('aria-pressed'),
  ).toBe('false');
});

test('zmiana tygodnia resetuje dni i odhaczenia, zachowuje tydzień w powrocie', async () => {
  checks.push({
    week_start: '2026-10-19',
    item_key: 'product|g',
    checked: true,
  });
  const view = await show();
  await fireEvent.click(screen.getByRole('button', { name: 'Weekend' }));
  await fireEvent.click(
    screen.getByRole('button', { name: 'Następny tydzień' }),
  );
  expect(window.location.search).toBe('?week=2026-10-26');
  await view.rerender({ desktop: false, week: '2026-10-26', now });
  await screen.findByText(
    '26 października – 1 listopada · Pozycje: 0 · Posiłki: 0',
  );
  expect(
    (screen.getByRole('button', { name: 'Od dziś' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    screen
      .getByRole('button', { name: 'Cały tydzień' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  await fireEvent.click(
    screen.getByRole('button', { name: 'Poprzedni tydzień' }),
  );
  expect(window.location.search).toBe('?week=2026-10-19');
  await view.rerender({ desktop: false, week: '2026-10-19', now });
  await screen.findByText('Kupione: 1 z 1');
  await fireEvent.click(
    screen.getByRole('button', { name: 'Wróć do planera' }),
  );
  expect(window.location.pathname + window.location.search).toBe(
    '/planer?week=2026-10-19',
  );
});

test('zniknięte pozycje nie liczą się w postępie po odświeżeniu planu', async () => {
  await show();
  await fireEvent.click(screen.getByRole('button', { name: 'Produkt, 50 g' }));
  await screen.findByText('Kupione: 1 z 1');
  plan = [];
  await fireEvent(window, new Event('focus'));
  await screen.findByText('W wybranych dniach nie ma zaplanowanych posiłków.');
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(
    checks.some((check) => check.item_key === 'product|g' && check.checked),
  ).toBe(true);
});

test('nieudany zapis zachowuje stan i pozwala spróbować ponownie', async () => {
  await show();
  failWrite = true;
  await fireEvent.click(screen.getByRole('button', { name: 'Produkt, 50 g' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Kupione: 0 z 1')).toBeTruthy();
  failWrite = false;
  await fireEvent.click(screen.getByRole('button', { name: 'Produkt, 50 g' }));
  await screen.findByText('Kupione: 1 z 1');
  expect(screen.queryByRole('alert')).toBeNull();
});

test('błąd pobierania nie pokazuje fałszywego pustego stanu i ma ponowienie', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
  render(Shopping, { desktop: true, now });
  await screen.findByRole('alert');
  expect(
    screen.queryByText('W wybranych dniach nie ma zaplanowanych posiłków.'),
  ).toBeNull();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Spróbuj ponownie' }),
  );
  await screen.findByRole('button', { name: 'Produkt, 50 g' });
});

test('opóźniony zapis starego tygodnia nie odhacza pozycji w nowym tygodniu', async () => {
  const view = await show();
  const original = vi.mocked(fetch).getMockImplementation()!;
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (input, options) => {
    const url = String(input);
    if (options?.method === 'PUT')
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    if (url === '/api/plan?week=2026-10-26')
      return Response.json([
        { date: '2026-10-26', slot: 1, recipe_id: recipe.id },
      ]);
    return original(input, options);
  });
  const item = screen.getByRole('button', { name: 'Produkt, 50 g' });
  await fireEvent.click(item);
  await fireEvent.click(item);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([, options]) => options?.method === 'PUT'),
  ).toHaveLength(1);
  await view.rerender({ desktop: false, week: '2026-10-26', now });
  await screen.findByText(
    '26 października – 1 listopada · Pozycje: 1 · Posiłki: 1',
  );
  finish(
    Response.json({
      week_start: '2026-10-19',
      item_key: 'product|g',
      checked: true,
    }),
  );
  await tick();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Produkt, 50 g',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  expect(screen.getByText('Kupione: 0 z 1')).toBeTruthy();
});
