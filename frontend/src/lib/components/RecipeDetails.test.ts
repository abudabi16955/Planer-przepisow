import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/svelte';
import { afterEach, expect, test } from 'vitest';
import RecipeDetails from './RecipeDetails.svelte';
import { detailRecipe, products } from '../../test/details';

afterEach(cleanup);

function show(recipe = detailRecipe, desktop = false) {
  return render(RecipeDetails, { recipe, products, desktop });
}

test('nagłówek, plakietki i makro na 1 porcję', () => {
  show();
  expect(
    screen.getByRole('heading', { name: 'Domowe placki', level: 1 }),
  ).toBeTruthy();
  expect(screen.getByText('Źródło: Ręcznie')).toBeTruthy();
  expect(screen.getByText('25 min')).toBeTruthy();
  const macro = screen.getByRole('region', { name: 'Wartości na 1 porcję' });
  expect(within(macro).getByText('330')).toBeTruthy();
  expect(within(macro).getByText('na 1 porcję')).toBeTruthy();
  expect(
    screen.getByRole('img', { name: 'Białko 24% · węgle 48% · tłuszcze 28%' }),
  ).toBeTruthy();
});

test('skaluje ilości w UI, do smaku bez zmian; makro nadal na 1 porcję', async () => {
  show();
  expect(
    screen.getByRole('button', { name: 'Mąka pszenna, 100 g' }),
  ).toBeTruthy();
  await fireEvent.click(screen.getByRole('button', { name: 'Więcej porcji' }));
  expect(screen.getByLabelText('Liczba porcji').textContent).toBe('3');
  expect(
    screen.getByRole('button', { name: 'Mąka pszenna, 150 g' }),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sól, do smaku' })).toBeTruthy();
  expect(
    within(
      screen.getByRole('region', { name: 'Wartości na 1 porcję' }),
    ).getByText('330'),
  ).toBeTruthy();
});

test('licznik zatrzymuje się na 1 i 12', async () => {
  show();
  await fireEvent.click(screen.getByRole('button', { name: 'Mniej porcji' }));
  expect(screen.getByRole('button', { name: 'Mniej porcji' })).toHaveProperty(
    'disabled',
    true,
  );
  expect(
    screen.getByRole('button', { name: 'Mąka pszenna, 50 g' }),
  ).toBeTruthy();
  for (let i = 0; i < 11; i++)
    await fireEvent.click(
      screen.getByRole('button', { name: 'Więcej porcji' }),
    );
  expect(screen.getByLabelText('Liczba porcji').textContent).toBe('12');
  expect(screen.getByRole('button', { name: 'Więcej porcji' })).toHaveProperty(
    'disabled',
    true,
  );
});

test('bazę większą niż 12 ogranicza w liczniku, zachowuje poprawny przelicznik', () => {
  show({ ...detailRecipe, servings: 50 });
  expect(screen.getByLabelText('Liczba porcji').textContent).toBe('12');
  expect(
    screen.getByRole('button', { name: 'Mąka pszenna, 24 g' }),
  ).toBeTruthy();
});

test('odhaczanie jest lokalne, przetrwa zmianę zakładki i resetuje się po ponownym otwarciu', async () => {
  const view = show();
  const ingredient = screen.getByRole('button', {
    name: 'Mąka pszenna, 100 g',
  });
  await fireEvent.click(ingredient);
  expect(ingredient.getAttribute('aria-pressed')).toBe('true');
  await fireEvent.click(screen.getByRole('tab', { name: 'Przygotowanie' }));
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(screen.getByText('Usmaż placki.')).toBeTruthy();
  await fireEvent.click(screen.getByRole('tab', { name: 'Składniki' }));
  expect(
    screen
      .getByRole('button', { name: 'Mąka pszenna, 100 g' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
  view.unmount();
  show();
  expect(
    screen
      .getByRole('button', { name: 'Mąka pszenna, 100 g' })
      .getAttribute('aria-pressed'),
  ).toBe('false');
});

test('zakładki mają prawidłowe role i obsługują strzałki oraz Home/End', async () => {
  show();
  await fireEvent.keyDown(screen.getByRole('tab', { name: 'Składniki' }), {
    key: 'ArrowRight',
  });
  expect(
    screen
      .getByRole('tab', { name: 'Przygotowanie' })
      .getAttribute('aria-selected'),
  ).toBe('true');
  expect(screen.getByRole('tabpanel', { name: 'Przygotowanie' })).toBeTruthy();
  await fireEvent.keyDown(screen.getByRole('tab', { name: 'Przygotowanie' }), {
    key: 'End',
  });
  expect(screen.getByText('Własny przepis bez źródła.')).toBeTruthy();
  await fireEvent.keyDown(screen.getByRole('tab', { name: 'Źródło' }), {
    key: 'Home',
  });
  expect(screen.getByRole('tabpanel', { name: 'Składniki' })).toBeTruthy();
});

test('brak danych pokazuje — i pusty pasek, zera są rzeczywistymi wartościami', () => {
  const view = show({
    ...detailRecipe,
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    ingredients: [],
  });
  expect(screen.getAllByText('—')).toHaveLength(4);
  expect(
    screen.getByRole('img', { name: 'Brak proporcji energii' }),
  ).toBeTruthy();
  view.unmount();
  show({ ...detailRecipe, kcal: 0, protein: 0, carbs: 0, fat: 0 });
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.queryByText('—')).toBeNull();
});

test('wylicza makro z produktów, gdy wartości ręczne są puste', () => {
  show({ ...detailRecipe, kcal: null, protein: null, carbs: null, fat: null });
  expect(
    within(
      screen.getByRole('region', { name: 'Wartości na 1 porcję' }),
    ).getByText('182'),
  ).toBeTruthy();
});

test('PDF pokazuje nazwę, polską datę/rozmiar i bezpieczny link do zapisanego pliku', async () => {
  show({
    ...detailRecipe,
    source_type: 'pdf',
    pdf: {
      path: 'pdfs/test.pdf',
      original_name: 'placki.pdf',
      mime_type: 'application/pdf',
      size_bytes: Math.round(1.2 * 1024 ** 2),
    },
  });
  await fireEvent.click(screen.getByRole('tab', { name: 'Źródło' }));
  expect(screen.getByText('placki.pdf')).toBeTruthy();
  expect(screen.getByText('1,2 MB · zapisano 3 paź 2026')).toBeTruthy();
  const link = screen.getByRole('link', { name: 'Otwórz oryginalny PDF' });
  expect(link.getAttribute('href')).toBe('/files/pdfs/test.pdf');
  expect(link.getAttribute('target')).toBe('_blank');
  expect(link.getAttribute('rel')).toContain('noopener');
});

test('opis posta pozostaje tekstem, wideo i oryginał mają właściwe adresy', async () => {
  const description = '<script>window.bad = true</script>';
  const { container } = show({
    ...detailRecipe,
    source_type: 'link',
    source_platform: 'instagram',
    source_url: 'https://www.instagram.com/reel/example',
    source_description: description,
    video: {
      path: 'videos/test.mp4',
      mime_type: 'video/mp4',
      size_bytes: Math.round(21.3 * 1024 ** 2),
    },
  });
  await fireEvent.click(screen.getByRole('tab', { name: 'Źródło' }));
  expect(screen.getByText(description)).toBeTruthy();
  expect(container.querySelector('script')).toBeNull();
  expect(screen.getByLabelText('Wideo przepisu').getAttribute('src')).toBe(
    '/files/videos/test.mp4',
  );
  expect(
    screen
      .getByRole('link', { name: 'Otwórz oryginał (Instagram)' })
      .getAttribute('href'),
  ).toBe('https://www.instagram.com/reel/example');
  expect(screen.getByText('Wideo zapisane w aplikacji · 21,3 MB')).toBeTruthy();
});

test('nie tworzy linku do niebezpiecznego URL', async () => {
  show({
    ...detailRecipe,
    source_type: 'link',
    source_platform: 'instagram',
    source_url: 'javascript:alert(1)',
  });
  await fireEvent.click(screen.getByRole('tab', { name: 'Źródło' }));
  expect(screen.queryByRole('link')).toBeNull();
});

test('panel laptopa używa h2, ukrywa Wróć i tekst pomocniczy telefonu', () => {
  show(detailRecipe, true);
  expect(
    screen.getByRole('heading', { name: 'Domowe placki', level: 2 }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Wróć' })).toBeNull();
  expect(screen.queryByText(/Kliknij składnik/)).toBeNull();
});
