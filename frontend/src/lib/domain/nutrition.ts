export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export type OptionalNutrition = { [Key in keyof Nutrition]: number | null };

/** Fields used from GET /api/products; a full API product is structurally compatible. */
export interface Product extends OptionalNutrition {
  id: string;
  nutrition_basis: 'g' | 'ml' | 'szt.' | null;
  unit_conversions: Record<string, number> | null;
}

export interface Ingredient {
  product_id: string;
  quantity: number | null;
  unit: string;
}

export interface RecipeNutrition extends OptionalNutrition {
  servings: number;
  ingredients: readonly Ingredient[];
}

const liquidMeasures: Record<string, number> = {
  łyżka: 15,
  łyżeczka: 5,
  szklanka: 250,
};
const empty = (): Nutrition => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
const hasValues = (values: OptionalNutrition) =>
  [values.kcal, values.protein, values.carbs, values.fat].some(
    (value) => value !== null,
  );

/** Amount in g, ml or pieces, before division by 100 (or 1 for pieces). */
export function quantityInBasis(
  product: Product,
  quantity: number,
  unit: string,
): number | null {
  const basis = product.nutrition_basis;
  if (basis === null) return null;
  if (unit === basis) return quantity;
  if ((basis === 'g' && unit === 'kg') || (basis === 'ml' && unit === 'l'))
    return quantity * 1000;
  const custom = Object.hasOwn(product.unit_conversions ?? {}, unit)
    ? product.unit_conversions![unit]
    : undefined;
  if (custom !== undefined && Number.isFinite(custom) && custom > 0)
    return quantity * custom;
  if (basis === 'ml' && Object.hasOwn(liquidMeasures, unit))
    return quantity * liquidMeasures[unit];
  return null;
}

/** No rounding until presentation. null means “bez wartości”; zero is real data. */
export function recipeNutrition(
  recipe: RecipeNutrition,
  products: readonly Product[],
): Nutrition | null {
  if (hasValues(recipe)) {
    const protein = recipe.protein ?? 0;
    const carbs = recipe.carbs ?? 0;
    const fat = recipe.fat ?? 0;
    return {
      kcal: recipe.kcal ?? 4 * protein + 4 * carbs + 9 * fat,
      protein,
      carbs,
      fat,
    };
  }
  if (
    !Number.isInteger(recipe.servings) ||
    recipe.servings < 1 ||
    recipe.servings > 50
  ) {
    throw new RangeError('Porcje bazowe muszą być w zakresie 1–50');
  }
  const catalogue = new Map(products.map((product) => [product.id, product]));
  const total = empty();
  let found = false;
  for (const ingredient of recipe.ingredients) {
    if (ingredient.quantity === null || ingredient.unit === 'do smaku')
      continue;
    const product = catalogue.get(ingredient.product_id);
    if (!product || !hasValues(product)) continue;
    const quantity = quantityInBasis(
      product,
      ingredient.quantity,
      ingredient.unit,
    );
    if (quantity === null) continue;
    const factor =
      quantity /
      (product.nutrition_basis === 'szt.' ? 1 : 100) /
      recipe.servings;
    for (const key of ['kcal', 'protein', 'carbs', 'fat'] as const) {
      total[key] += (product[key] ?? 0) * factor;
    }
    found = true;
  }
  return found ? total : null;
}

/** Percentages use energy from macros, independently of manually entered kcal. */
export function energyProportions(
  values: Pick<Nutrition, 'protein' | 'carbs' | 'fat'> | null,
): { protein: number; carbs: number; fat: number } | null {
  if (values === null) return null;
  const energy = 4 * values.protein + 4 * values.carbs + 9 * values.fat;
  if (energy <= 0) return null;
  const protein = Math.round(((4 * values.protein) / energy) * 100);
  const carbs = Math.round(((4 * values.carbs) / energy) * 100);
  return { protein, carbs, fat: 100 - protein - carbs };
}
