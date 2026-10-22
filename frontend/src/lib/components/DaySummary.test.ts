import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import DaySummary from './DaySummary.svelte';
import { detailRecipe, products } from '../../test/details';
import type { DailyGoal, PlanEntry } from '../domain/day';
const initial = { kcal: 2000, protein: 100, carbs: 250, fat: 65 };
const props = {
  date: '2026-10-21',
  entries: [
    { date: '2026-10-21', slot: 1, recipe_id: detailRecipe.id },
  ] as PlanEntry[],
  recipes: [detailRecipe],
  products,
};
let goal: DailyGoal;
beforeEach(() => {
  goal = { ...initial };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, options) => {
      if (options?.method === 'PUT') goal = JSON.parse(options.body as string);
      return Response.json(goal);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
async function show(desktop = false) {
  const view = render(DaySummary, { ...props, desktop });
  await screen.findByRole('button', {
    name: desktop ? 'Zmień cel dzienny' : 'Zmień cel',
  });
  return view;
}
test('cztery wiersze, paski, proporcje i podpis', async () => {
  await show();
  const row = screen.getByRole('group', { name: 'Kalorie' });
  expect(within(row).getByText('330 kcal')).toBeTruthy();
  expect(within(row).getByText('Brakuje 1670 kcal')).toBeTruthy();
  expect(
    within(row).getByRole('progressbar').getAttribute('aria-valuenow'),
  ).toBe('17');
  expect(screen.getAllByRole('progressbar')).toHaveLength(4);
  expect(
    screen.getByText('Białko 24% · węgle 48% · tłuszcze 28%'),
  ).toBeTruthy();
  expect(screen.getByText('W celu: 20% · 50% · 30%')).toBeTruthy();
  expect(
    screen.getByText('Suma z zaplanowanych posiłków, po 1 porcji każdy.'),
  ).toBeTruthy();
});
test('aktualizuje sumy po zmianie planu i wybranego dnia', async () => {
  const view = await show();
  await view.rerender({
    ...props,
    entries: [...props.entries, { ...props.entries[0], slot: 2 }],
  });
  expect(
    within(screen.getByRole('group', { name: 'Kalorie' })).getByText(
      '660 kcal',
    ),
  ).toBeTruthy();
  await view.rerender({ ...props, date: '2026-10-22' });
  expect(
    within(screen.getByRole('group', { name: 'Kalorie' })).getByText('0 kcal'),
  ).toBeTruthy();
  expect(screen.queryByText('Proporcje z kalorii')).toBeNull();
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('telefon: arkusz prefill, natychmiastowy PUT, zero i Gotowe', async () => {
  await show();
  await fireEvent.click(screen.getByRole('button', { name: 'Zmień cel' }));
  const dialog = screen.getByRole('dialog', {
    name: 'Dzienne zapotrzebowanie',
  });
  expect(
    (within(dialog).getByLabelText('Kalorie (kcal)') as HTMLInputElement).value,
  ).toBe('2000');
  await fireEvent.input(within(dialog).getByLabelText('Kalorie (kcal)'), {
    target: { value: '0' },
  });
  expect(
    within(screen.getByRole('group', { name: 'Kalorie' })).getByText(
      'brak celu',
    ),
  ).toBeTruthy();
  await waitFor(() => expect(goal.kcal).toBe(0));
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Gotowe',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Gotowe' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
test('laptop: panel w miejscu, przecinek, walidacja i niepełne makro', async () => {
  await show(true);
  await fireEvent.click(
    screen.getByRole('button', { name: 'Zmień cel dzienny' }),
  );
  expect(screen.queryByRole('dialog')).toBeNull();
  await fireEvent.input(screen.getByLabelText('Białko (g)'), {
    target: { value: '12,5' },
  });
  await waitFor(() => expect(goal.protein).toBe(12.5));
  await fireEvent.input(screen.getByLabelText('Tłuszcze (g)'), {
    target: { value: '-10' },
  });
  await waitFor(() => expect(goal.fat).toBe(0));
  expect(
    screen.getByText('Uzupełnij cele makro, żeby zobaczyć docelowe proporcje.'),
  ).toBeTruthy();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Ukryj edycję celu' }),
  );
  expect(screen.queryByLabelText('Białko (g)')).toBeNull();
});
test('szybkie zmiany zapisuje kolejno, ostatni pełny zestaw wygrywa', async () => {
  let finish!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(async (_url, options) => {
    if (options?.method === 'PUT')
      return new Promise((resolve) => (finish = resolve));
    return Response.json(initial);
  });
  await show(true);
  await fireEvent.click(
    screen.getByRole('button', { name: 'Zmień cel dzienny' }),
  );
  await fireEvent.input(screen.getByLabelText('Kalorie (kcal)'), {
    target: { value: '1800' },
  });
  await fireEvent.input(screen.getByLabelText('Białko (g)'), {
    target: { value: '120' },
  });
  expect(
    vi.mocked(fetch).mock.calls.filter(([, o]) => o?.method === 'PUT'),
  ).toHaveLength(1);
  finish(Response.json({ ...initial, kcal: 1800 }));
  await waitFor(() =>
    expect(
      vi.mocked(fetch).mock.calls.filter(([, o]) => o?.method === 'PUT'),
    ).toHaveLength(2),
  );
  const last = vi.mocked(fetch).mock.calls.at(-1)![1]!;
  expect(JSON.parse(last.body as string)).toEqual({
    ...initial,
    kcal: 1800,
    protein: 120,
  });
  finish(Response.json({ ...initial, kcal: 1800, protein: 120 }));
});
test('błąd zapisu nie oznacza sukcesu, Gotowe ponawia zapis', async () => {
  let fail = true;
  vi.mocked(fetch).mockImplementation(async (_url, options) =>
    options?.method === 'PUT' && fail
      ? new Response(null, { status: 500 })
      : Response.json(initial),
  );
  await show();
  await fireEvent.click(screen.getByRole('button', { name: 'Zmień cel' }));
  const dialog = screen.getByRole('dialog');
  await fireEvent.input(within(dialog).getByLabelText('Kalorie (kcal)'), {
    target: { value: '1900' },
  });
  await within(dialog).findByRole('alert');
  fail = false;
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Gotowe' }));
  await waitFor(() => expect(within(dialog).queryByRole('alert')).toBeNull());
  await fireEvent.click(within(dialog).getByRole('button', { name: 'Gotowe' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
test('nie pokazuje fałszywego celu, gdy GET zawiedzie', async () => {
  vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 503 }));
  render(DaySummary, props);
  await screen.findByRole('alert');
  expect(screen.queryByRole('progressbar')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Zmień cel' })).toBeNull();
});
