import type { PlanEntry } from './day';
import type { Ingredient } from './nutrition';
import { startOfWeek, today, weekDays } from './week';

export interface ShoppingRecipe {
  id: string;
  servings: number;
  ingredients: readonly Ingredient[];
}
export interface ShoppingProduct {
  id: string;
  name: string;
}
export interface ShoppingItem {
  key: string;
  product_id: string;
  name: string;
  unit: string;
  quantity: number | null;
}

/** Quantities remain numeric until presentation; round pieces only after summing. */
export function shoppingList(
  entries: readonly PlanEntry[],
  selectedDays: readonly string[],
  recipes: readonly ShoppingRecipe[],
  products: readonly ShoppingProduct[],
): ShoppingItem[] {
  const selected = new Set(selectedDays);
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const items = new Map<string, ShoppingItem>();
  const slots = new Map(
    entries.map((entry) => [`${entry.date}|${entry.slot}`, entry]),
  );
  for (const entry of slots.values()) {
    if (!selected.has(entry.date)) continue;
    const recipe = recipeById.get(entry.recipe_id);
    if (!recipe || !Number.isFinite(recipe.servings) || recipe.servings <= 0)
      continue;
    for (const ingredient of recipe.ingredients) {
      const product = productById.get(ingredient.product_id);
      if (!product) continue;
      const taste = ingredient.quantity === null;
      if (
        !taste &&
        (!Number.isFinite(ingredient.quantity) || ingredient.quantity! <= 0)
      )
        continue;
      const key = `${product.id}|${taste ? 'do-smaku' : ingredient.unit}`;
      const existing = items.get(key);
      if (existing && !taste) {
        existing.quantity! += ingredient.quantity! / recipe.servings;
      } else if (!existing) {
        items.set(key, {
          key,
          product_id: product.id,
          name: product.name,
          unit: taste ? '' : ingredient.unit,
          quantity: taste ? null : ingredient.quantity! / recipe.servings,
        });
      }
    }
  }
  const collator = new Intl.Collator('pl');
  return [...items.values()]
    .map((item) => ({
      ...item,
      quantity:
        item.unit === 'szt.' && item.quantity !== null
          ? Math.ceil(item.quantity - 0.0001)
          : item.quantity,
    }))
    .sort(
      (a, b) =>
        collator.compare(a.name, b.name) || collator.compare(a.key, b.key),
    );
}

export const shoppingPresets = ['Cały tydzień', 'Od dziś', 'Weekend'] as const;
export type ShoppingPreset = (typeof shoppingPresets)[number];

/** null means that the preset is unavailable for this week. */
export function presetDays(
  week: string,
  preset: ShoppingPreset,
  now: Date,
  timeZone = 'Europe/Warsaw',
): string[] | null {
  const days = weekDays(week);
  if (preset === 'Cały tydzień') return days;
  if (preset === 'Weekend') return days.slice(5);
  const current = today(now, timeZone);
  return startOfWeek(current) === days[0]
    ? days.filter((day) => day >= current)
    : null;
}

/** More than one preset can match (e.g. Weekend and Od dziś on Saturday). */
export function activeShoppingPresets(
  week: string,
  selectedDays: readonly string[],
  now: Date,
  timeZone = 'Europe/Warsaw',
): ShoppingPreset[] {
  const selected = new Set(selectedDays);
  return shoppingPresets.filter((preset) => {
    const days = presetDays(week, preset, now, timeZone);
    return (
      days !== null &&
      days.length === selected.size &&
      days.every((day) => selected.has(day))
    );
  });
}
