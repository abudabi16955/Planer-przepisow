import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import App from './App.svelte';
import { navigate, resolveRoute } from './lib/router';

let media: MediaQueryList;
let changes: Set<() => void>;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => [] })),
  );
  window.history.replaceState(null, '', '/');
  changes = new Set();
  media = {
    matches: false,
    addEventListener: (_type: string, handler: () => void) =>
      changes.add(handler),
    removeEventListener: (_type: string, handler: () => void) =>
      changes.delete(handler),
  } as unknown as MediaQueryList;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function resize(width: number) {
  Object.defineProperty(media, 'matches', {
    value: width >= 1024,
    configurable: true,
  });
  changes.forEach((handler) => handler());
  await tick();
}

test.each([
  ['/', 'recipes'],
  ['/przepis/abc', 'recipe'],
  ['/dodaj', 'add'],
  ['/planer', 'planner'],
  ['/zakupy', 'shopping'],
])('rozpoznaje trasę %s', (path, page) => {
  expect(resolveRoute(path).page).toBe(page);
  if (page === 'recipe') expect(resolveRoute(path).id).toBe('abc');
});

test.each([
  ['/', 'Przepisy'],
  ['/dodaj', 'Dodaj przepis'],
  ['/planer', 'Planer'],
  ['/zakupy', 'Planer'],
])('aktywna zakładka telefonu dla %s', async (path, label) => {
  window.history.replaceState(null, '', path);
  render(App);
  await tick();
  expect(
    screen.getByRole('button', { name: label }).getAttribute('aria-current'),
  ).toBe('page');
  expect(
    screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('aria-current')),
  ).toHaveLength(1);
});

test('przyciski nawigują przez History API, a popstate przywraca ekran', async () => {
  render(App);
  await fireEvent.click(screen.getByRole('button', { name: 'Dodaj przepis' }));
  expect(window.location.pathname).toBe('/dodaj');
  expect(screen.getByRole('heading', { name: 'Dodaj przepis' })).toBeTruthy();
  window.history.replaceState(null, '', '/');
  window.dispatchEvent(new PopStateEvent('popstate'));
  await tick();
  expect(screen.getByRole('heading', { name: 'Przepisy' })).toBeTruthy();
});

test('pasek dolny znika w szczegółach przepisu', async () => {
  render(App);
  navigate('/przepis/abc');
  await tick();
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(screen.getByRole('heading', { name: 'Przepis' })).toBeTruthy();
});

test('zmiana szerokości przełącza pasek dolny na boczny na granicy 1024 px', async () => {
  render(App);
  await resize(1023);
  expect(screen.queryByText('Planer przepisów')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Lista zakupów' })).toBeNull();
  await resize(1024);
  expect(screen.getByText('Planer przepisów')).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Lista zakupów' }));
  expect(window.location.pathname).toBe('/zakupy');
  expect(
    screen
      .getByRole('button', { name: 'Lista zakupów' })
      .getAttribute('aria-current'),
  ).toBe('page');
  await resize(1023);
  expect(screen.queryByRole('button', { name: 'Lista zakupów' })).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Planer' }).getAttribute('aria-current'),
  ).toBe('page');
});

test.each([
  ['/', 'Przepisy'],
  ['/przepis/abc', 'Przepisy'],
  ['/dodaj', 'Dodaj przepis'],
  ['/planer', 'Planer'],
  ['/zakupy', 'Lista zakupów'],
])('aktywna pozycja paska bocznego dla %s', async (path, label) => {
  window.history.replaceState(null, '', path);
  render(App);
  await resize(1440);
  expect(
    screen.getByRole('button', { name: label }).getAttribute('aria-current'),
  ).toBe('page');
});
