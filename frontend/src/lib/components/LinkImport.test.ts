import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/svelte';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import RecipeForm from './RecipeForm.svelte';
import LinkImport from './LinkImport.svelte';
import RecipeDetails from './RecipeDetails.svelte';
import { toast } from '../toast';
import { products, recipes } from '../../test/recipes';
import type { ImportJob } from '../importApi';
const url = 'https://www.instagram.com/reel/example/';
const done: ImportJob = {
  id: 'job',
  status: 'done',
  platform: 'instagram',
  title: 'Z importu',
  description: '<script>alert(1)</script> <img src=x onerror=alert(2)>',
  size_bytes: 19293798,
  error_code: null,
  video: {
    path: 'tmp/video.mp4',
    mime_type: 'video/mp4',
    size_bytes: 19293798,
  },
  thumbnail: {
    path: 'tmp/thumb.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 500,
  },
};
let enabled: boolean;
let failure: string | null;
let gets: number;
beforeEach(() => {
  enabled = true;
  failure = null;
  gets = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      if (input === '/api/config')
        return Response.json({ import_enabled: enabled, max_video_mb: 42 });
      if (input === '/api/products') return Response.json(products);
      if (input === '/api/imports')
        return Response.json({ ...done, status: 'queued', video: null });
      if (input === '/api/imports/job') {
        gets += 1;
        return Response.json(
          failure
            ? { ...done, status: 'failed', error_code: failure }
            : { ...done, status: gets > 1 ? 'done' : 'running' },
        );
      }
      throw new Error(`Unexpected request: ${input}`);
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function start() {
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: url },
  });
  vi.useFakeTimers();
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz wideo i opis' }),
  );
}
async function finish() {
  await act(() => vi.advanceTimersByTimeAsync(2000));
}

test('formularz odpytywany co sekundę: blokada zapisu, miniatura, nazwa i przypięcie joba', async () => {
  const onSave = vi.fn(async () => recipes[0]);
  const view = render(RecipeForm, { onSave });
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '2' },
  });
  await start();
  expect(
    (
      screen.getByRole('button', {
        name: 'Zapisz przepis',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  expect(screen.getByText('Pobieram wideo z Instagram…')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(999));
  expect(gets).toBe(0);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(gets).toBe(1);
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByText('Wideo zapisane · 18,4 MB')).toBeTruthy();
  expect(screen.getByText('Wykryto: Instagram')).toBeTruthy();
  expect(screen.getByText('Okładka z wideo · zmień zdjęcie')).toBeTruthy();
  expect((screen.getByLabelText('Nazwa') as HTMLInputElement).value).toBe(
    'Z importu',
  );
  expect(view.container.querySelector('script')).toBeNull();
  expect(view.container.querySelector('img[onerror]')).toBeNull();
  expect(screen.getByText(`Opis z posta: „${done.description}”`)).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Zapisz przepis' }));
  await tick();
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ import_job_id: 'job', source_type: 'link' }),
  );
});

test('nie nadpisuje wpisanej nazwy, a zmiana URL unieważnia pobrany wynik', async () => {
  render(RecipeForm);
  await fireEvent.input(screen.getByLabelText('Nazwa'), {
    target: { value: 'Moja nazwa' },
  });
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '2' },
  });
  await start();
  await finish();
  expect((screen.getByLabelText('Nazwa') as HTMLInputElement).value).toBe(
    'Moja nazwa',
  );
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: url + 'changed' },
  });
  expect(screen.queryByText('Wideo zapisane · 18,4 MB')).toBeNull();
  expect(
    (
      screen.getByRole('button', {
        name: 'Zapisz przepis',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});

test.each([
  'https://evil.test/post',
  'http://instagram.com/p/x',
  'https://instagram.com.evil.test/x',
  'https://user@instagram.com/p/x',
  'https://facebook.com:444/x',
])('zły link %s: toast bez POST', async (value) => {
  render(LinkImport, { onchange: vi.fn() });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz wideo i opis' }),
  );
  expect(get(toast)?.message).toBe('Wklej link z Instagrama lub Facebooka');
  expect(
    vi.mocked(fetch).mock.calls.some(([input]) => input === '/api/imports'),
  ).toBe(false);
});

test.each([
  [
    'private_or_missing',
    'Nie udało się pobrać wideo. Post może być prywatny lub usunięty.',
  ],
  [
    'timeout',
    'Nie udało się pobrać wideo. Post może być prywatny lub usunięty.',
  ],
  ['too_large', 'Wideo jest za duże (limit 42 MB).'],
  ['unavailable', 'Pobieranie z linku jest chwilowo niedostępne.'],
])('błąd %s i ponowienie', async (code, message) => {
  failure = code;
  render(LinkImport, { onchange: vi.fn() });
  await start();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.getByRole('alert').textContent).toContain(message);
  failure = null;
  await fireEvent.click(
    screen.getByRole('button', { name: 'Spróbuj ponownie' }),
  );
  await finish();
  expect(screen.getByText('Wideo zapisane · 18,4 MB')).toBeTruthy();
});

test('wyłączenie importu nie blokuje ręcznego formularza', async () => {
  enabled = false;
  render(RecipeForm);
  await screen.findByText('Pobieranie z linku jest chwilowo niedostępne.');
  expect(
    screen.queryByRole('button', { name: 'Pobierz wideo i opis' }),
  ).toBeNull();
  await fireEvent.click(screen.getByRole('tab', { name: 'Ręcznie' }));
  await fireEvent.input(screen.getByLabelText('Nazwa'), {
    target: { value: 'Zupa' },
  });
  await fireEvent.input(screen.getByLabelText('Porcje'), {
    target: { value: '2' },
  });
  expect(
    (
      screen.getByRole('button', {
        name: 'Zapisz przepis',
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});

test('zmiana URL i demontaż anulują odpytywanie', async () => {
  const view = render(LinkImport, { onchange: vi.fn() });
  await start();
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: '' },
  });
  await finish();
  expect(gets).toBe(0);
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz wideo i opis' }),
  );
  view.unmount();
  await finish();
  expect(gets).toBe(0);
});

test('szczegóły: natywny odtwarzacz i opis jako zwykły tekst', async () => {
  const recipe = {
    ...recipes[0],
    source_type: 'link' as const,
    source_platform: 'instagram' as const,
    source_url: url,
    source_description: done.description,
    video: done.video,
  };
  const view = render(RecipeDetails, { recipe, products });
  await fireEvent.click(screen.getByRole('tab', { name: 'Źródło' }));
  const video = screen.getByLabelText('Wideo przepisu') as HTMLVideoElement;
  expect(video.controls).toBe(true);
  expect(video.getAttribute('src')).toBe('/files/tmp/video.mp4');
  expect(screen.getByText('Oryginalny post')).toBeTruthy();
  expect(screen.getByText(done.description!)).toBeTruthy();
  expect(view.container.querySelector('script')).toBeNull();
  expect(view.container.querySelector('img[onerror]')).toBeNull();
});

test('spóźniona odpowiedź importu nie przywraca wyniku po zmianie linku', async () => {
  const onchange = vi.fn();
  render(LinkImport, { onchange });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  let resolve!: (value: Response) => void;
  const original = vi.mocked(fetch).getMockImplementation()!;
  vi.mocked(fetch).mockImplementation((input, options) =>
    input === '/api/imports'
      ? new Promise<Response>((finish) => {
          resolve = finish;
        })
      : original(input, options),
  );
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: url },
  });
  await fireEvent.click(
    screen.getByRole('button', { name: 'Pobierz wideo i opis' }),
  );
  await fireEvent.input(screen.getByLabelText('Link do posta lub reela'), {
    target: { value: 'https://facebook.com/reel/123' },
  });
  await act(() => resolve(Response.json(done)));
  expect(screen.queryByText('Wideo zapisane · 18,4 MB')).toBeNull();
  expect(onchange).not.toHaveBeenCalledWith(done);
});

test('błąd sieci pozwala ponowić pobieranie', async () => {
  render(LinkImport, { onchange: vi.fn() });
  await screen.findByRole('button', { name: 'Pobierz wideo i opis' });
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('offline'));
  await start();
  expect(screen.getByRole('alert').textContent).toContain(
    'Brak połączenia z serwerem.',
  );
  await fireEvent.click(
    screen.getByRole('button', { name: 'Spróbuj ponownie' }),
  );
  await finish();
  expect(screen.getByText('Wideo zapisane · 18,4 MB')).toBeTruthy();
});
