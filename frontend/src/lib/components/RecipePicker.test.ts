import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import RecipePicker from './RecipePicker.svelte';
import { recipes, products } from '../../test/recipes';
import { ApiError } from '../api';
afterEach(cleanup);
const props = {
  date: '2026-10-21',
  slot: 1 as const,
  recipes,
  products,
  onselect: vi.fn(async () => {}),
  onclose: vi.fn(),
};

test('pusta baza, zamknięcie i Escape', async () => {
  const onclose = vi.fn();
  render(RecipePicker, { ...props, recipes: [], onclose });
  const dialog = screen.getByRole('dialog', { name: 'Wybierz przepis' });
  expect(
    within(dialog).getByText('Brak przepisów dla tego filtra.'),
  ).toBeTruthy();
  await fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(onclose).toHaveBeenCalledOnce();
  await fireEvent.click(
    within(dialog).getByRole('button', { name: 'Zamknij' }),
  );
  expect(onclose).toHaveBeenCalledTimes(2);
});
test('sortuje najnowsze, prezentuje metadane i notkę zastąpienia', () => {
  render(RecipePicker, { ...props, desktop: true, replacedTitle: 'Zupa' });
  expect(screen.getByText('Zastąpi: Zupa')).toBeTruthy();
  const choices = screen.getAllByRole('button', { name: /Wybierz:/ });
  expect(choices[0].getAttribute('aria-label')).toBe(
    `Wybierz: ${recipes[1].title}`,
  );
  expect(screen.getByText('330 kcal · 10 min')).toBeTruthy();
});
test('blokuje ponowny zapis i zamykanie podczas żądania', async () => {
  let finish!: () => void;
  const onselect = vi.fn(
    () => new Promise<void>((resolve) => (finish = resolve)),
  );
  const onclose = vi.fn();
  render(RecipePicker, { ...props, onselect, onclose });
  const dialog = screen.getByRole('dialog');
  await fireEvent.click(
    within(dialog).getByRole('button', {
      name: `Wybierz: ${recipes[0].title}`,
    }),
  );
  expect(
    (
      within(dialog).getByRole('button', {
        name: 'Zamknij',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(onclose).not.toHaveBeenCalled();
  expect(onselect).toHaveBeenCalledOnce();
  finish();
  await waitFor(() =>
    expect(
      (
        within(dialog).getByRole('button', {
          name: 'Zamknij',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
});
test.each([404, 500])(
  'błąd zapisu %s zachowuje wybór i pozwala ponowić',
  async (status) => {
    render(RecipePicker, {
      ...props,
      onselect: vi.fn(async () => {
        throw new ApiError(status);
      }),
    });
    await fireEvent.click(
      screen.getByRole('button', { name: `Wybierz: ${recipes[0].title}` }),
    );
    expect((await screen.findByRole('alert')).textContent).toBe(
      status === 404 ? 'Przepis nie istnieje.' : 'Brak połączenia z serwerem.',
    );
    expect(
      (
        screen.getByRole('button', {
          name: `Wybierz: ${recipes[0].title}`,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
  },
);
test('zatrzymuje fokus w modalu i przywraca go po zamknięciu', async () => {
  const previous = document.createElement('button');
  document.body.append(previous);
  previous.focus();
  const view = render(RecipePicker, props);
  const dialog = screen.getByRole('dialog');
  const close = within(dialog).getByRole('button', { name: 'Zamknij' });
  expect(document.activeElement).toBe(close);
  await fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(
    within(dialog)
      .getAllByRole('button', { name: /Wybierz:/ })
      .at(-1),
  );
  view.unmount();
  expect(document.activeElement).toBe(previous);
  previous.remove();
});
