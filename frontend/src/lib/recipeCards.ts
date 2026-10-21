import type { Recipe } from './api';
import { formatNumber } from './domain/format';
import { recipeNutrition, type Product } from './domain/nutrition';

const palette = [
  { tint: '#EADFC2', ink: '#8A6D2B' },
  { tint: '#F0CDB0', ink: '#9A4F1C' },
  { tint: '#D5E3BF', ink: '#4C6B2A' },
  { tint: '#F5CF9A', ink: '#A35E10' },
  { tint: '#CFE2CC', ink: '#3F6B45' },
  { tint: '#C3DCD8', ink: '#2E6A66' },
  { tint: '#F2C0B0', ink: '#A3412A' },
];

export function paletteForRecipe(id: string) {
  let hash = 0;
  for (const character of id)
    hash = (Math.imul(hash, 31) + character.codePointAt(0)!) >>> 0;
  return palette[hash % palette.length];
}

export function recipeMeta(
  recipe: Recipe,
  products: readonly Product[],
): string {
  const nutrition = recipeNutrition(recipe, products);
  return [
    nutrition === null ? null : `${formatNumber(nutrition.kcal)} kcal`,
    recipe.time_min === null ? null : `${recipe.time_min} min`,
  ]
    .filter((part) => part !== null)
    .join(' · ');
}
