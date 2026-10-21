import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, expect, test, vi } from 'vitest';
import RecipeCard from './RecipeCard.svelte';
import { recipes, products } from '../../test/recipes';
import { paletteForRecipe } from '../recipeCards';

afterEach(cleanup);

test('uszkodzone zdjęcie zastępuje placeholderem', async () => {
  const { container } = render(RecipeCard, {
    recipe: recipes[0],
    products,
    desktop: false,
    onselect: vi.fn(),
  });
  const image = container.querySelector('img')!;
  expect(image).toBeTruthy();
  await fireEvent.error(image);
  expect(container.querySelector('img')).toBeNull();
  expect(
    screen.getByRole('button', { name: /Owsianka jabłkowa/ }),
  ).toBeTruthy();
});

test('kolor placeholdera zależy wyłącznie od ID, nie od kolejności wyświetlania', () => {
  const first = paletteForRecipe('stable-id');
  paletteForRecipe('another-id');
  expect(paletteForRecipe('stable-id')).toEqual(first);
  expect([
    '#EADFC2',
    '#F0CDB0',
    '#D5E3BF',
    '#F5CF9A',
    '#CFE2CC',
    '#C3DCD8',
    '#F2C0B0',
  ]).toContain(first.tint);
});
