import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import Recipes from './Recipes.svelte';
import { recipes, products } from '../test/recipes';

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify(url === '/api/recipes' ? recipes : products),
          { status: 200 },
        ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function load(desktop = false) {
  const view = render(Recipes, { desktop });
  await screen.findByRole('button', { name: /przepis: Owsianka jabłkowa/ });
  return view;
}

const cards = () =>
  screen.queryAllByRole('button', { name: /^(Otwórz|Pokaż) przepis:/ });

test('pobiera przepisy i produkty; licznik i kolejność od najnowszych', async () => {
  await load();
  expect(fetch).toHaveBeenCalledWith(
    '/api/recipes',
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(fetch).toHaveBeenCalledWith('/api/products', expect.anything());
  expect(screen.getByText('4 przepisy')).toBeTruthy();
  expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual([
    'Otwórz przepis: Kurczak teriyaki',
    'Otwórz przepis: Sałatka z fasolą',
    'Otwórz przepis: Zupa pomidorowa',
    'Otwórz przepis: Owsianka jabłkowa',
  ]);
});

test.each([
  ['Wszystkie', 4],
  ['Z wideo', 2],
  ['Śniadania', 1],
  ['Obiady', 2],
  ['Kolacje', 1],
])('filtr %s pokazuje właściwe karty', async (label, count) => {
  await load();
  await fireEvent.click(screen.getByRole('button', { name: label }));
  expect(cards()).toHaveLength(count);
  expect(
    screen.getByRole('button', { name: label }).getAttribute('aria-pressed'),
  ).toBe('true');
  // The header counts the whole catalogue, as in the prototype.
  expect(screen.getByText('4 przepisy')).toBeTruthy();
  if (label === 'Z wideo') {
    expect(screen.queryByRole('button', { name: /Owsianka/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Zupa/ })).toBeNull();
  }
});

test('wyszukiwanie ignoruje wielkość liter i skrajne spacje; łączy się z filtrem', async () => {
  await load();
  await fireEvent.input(
    screen.getByRole('searchbox', { name: 'Szukaj przepisu' }),
    { target: { value: '  JABŁKOWA  ' } },
  );
  expect(cards()).toHaveLength(1);
  expect(cards()[0].getAttribute('aria-label')).toContain('Owsianka jabłkowa');
  await fireEvent.click(screen.getByRole('button', { name: 'Obiady' }));
  expect(screen.getByText('Brak przepisów dla tego filtra.')).toBeTruthy();
  await fireEvent.input(screen.getByRole('searchbox'), {
    target: { value: 'KURCZAK' },
  });
  expect(cards()).toHaveLength(1);
  expect(cards()[0].getAttribute('aria-label')).toContain('Kurczak teriyaki');
});

test('brak wyników wyszukiwania', async () => {
  await load();
  await fireEvent.input(screen.getByRole('searchbox'), {
    target: { value: 'nieistniejący' },
  });
  expect(cards()).toHaveLength(0);
  expect(screen.getByText('Brak przepisów dla tego filtra.')).toBeTruthy();
});

test('pusta baza pokazuje 0 przepisów i tekst prototypu', async () => {
  vi.mocked(fetch).mockImplementation(async () => new Response('[]'));
  render(Recipes, { desktop: false });
  expect(
    await screen.findByText('Brak przepisów dla tego filtra.'),
  ).toBeTruthy();
  expect(screen.getByText('0 przepisów')).toBeTruthy();
});

test.each(['network', 'http'])(
  'błąd %s pokazuje komunikat połączenia, nie pustą bazę',
  async (kind) => {
    vi.mocked(fetch).mockImplementation(async () => {
      if (kind === 'network') throw new TypeError('offline');
      return new Response('{}', { status: 500 });
    });
    render(Recipes, { desktop: false });
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Brak połączenia z serwerem.',
    );
    expect(screen.queryByText('Brak przepisów dla tego filtra.')).toBeNull();
  },
);

test('kcal pochodzą z domeny, brak wartości nie pokazuje kcal, ręczny nie ma plakietki', async () => {
  await load();
  const dinner = screen.getByRole('button', {
    name: 'Otwórz przepis: Kurczak teriyaki',
  });
  expect(within(dinner).getByText('330 kcal · 25 min')).toBeTruthy();
  expect(within(dinner).getByText('Instagram')).toBeTruthy();
  expect(within(dinner).getByLabelText('Z wideo')).toBeTruthy();
  const supper = screen.getByRole('button', {
    name: 'Otwórz przepis: Sałatka z fasolą',
  });
  expect(within(supper).getByText('15 min')).toBeTruthy();
  expect(within(supper).queryByText(/kcal/)).toBeNull();
  expect(within(supper).getByText('Facebook')).toBeTruthy();
  const breakfast = screen.getByRole('button', {
    name: 'Otwórz przepis: Owsianka jabłkowa',
  });
  expect(within(breakfast).getByText('PDF')).toBeTruthy();
  expect(breakfast.querySelector('img')?.getAttribute('src')).toBe(
    '/files/photos/cover.jpg',
  );
  const manual = screen.getByRole('button', {
    name: 'Otwórz przepis: Zupa pomidorowa',
  });
  expect(
    within(manual).queryByText(/Instagram|Facebook|PDF|kcal|min/),
  ).toBeNull();
});

test('na telefonie karta otwiera trasę szczegółów', async () => {
  await load();
  expect(screen.queryByRole('complementary')).toBeNull();
  await fireEvent.click(cards()[0]);
  expect(window.location.pathname).toBe('/przepis/dinner');
});

test('na laptopie zaznacza kartę i aktualizuje panel, bez opuszczania listy', async () => {
  await load(true);
  const panel = screen.getByRole('complementary', {
    name: 'Szczegóły przepisu',
  });
  expect(
    within(panel).getByRole('heading', { name: 'Kurczak teriyaki' }),
  ).toBeTruthy();
  const card = screen.getByRole('button', {
    name: 'Pokaż przepis: Zupa pomidorowa',
  });
  await fireEvent.click(card);
  expect(card.getAttribute('aria-pressed')).toBe('true');
  expect(
    within(panel).getByRole('heading', { name: 'Zupa pomidorowa' }),
  ).toBeTruthy();
  expect(window.location.pathname).toBe('/');
  await fireEvent.click(screen.getByRole('button', { name: 'Śniadania' }));
  expect(
    within(panel).getByRole('heading', { name: 'Owsianka jabłkowa' }),
  ).toBeTruthy();
});

test('zmiana układu zachowuje filtr i wyszukiwanie', async () => {
  const view = await load();
  await fireEvent.input(screen.getByRole('searchbox'), {
    target: { value: 'Kurczak' },
  });
  await view.rerender({ desktop: true });
  expect(screen.getByRole('complementary')).toBeTruthy();
  expect(cards()).toHaveLength(1);
  expect(screen.getByRole('searchbox')).toHaveProperty('value', 'Kurczak');
});

test('anuluje żądania po opuszczeniu ekranu', async () => {
  const view = await load();
  const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
  view.unmount();
  await waitFor(() => expect(signal?.aborted).toBe(true));
});
