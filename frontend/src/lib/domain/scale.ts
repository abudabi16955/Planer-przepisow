import { formatQuantity } from './format';

/** Counter limits apply to displayed servings, not the recipe's base (1–50). */
export function clampServings(servings: number): number {
  if (!Number.isInteger(servings))
    throw new RangeError('Porcje muszą być całkowite');
  return Math.max(1, Math.min(12, servings));
}

export function scaleQuantity(
  quantity: number | null,
  servings: number,
  baseServings: number,
): number | null {
  if (
    !Number.isInteger(baseServings) ||
    baseServings < 1 ||
    baseServings > 50
  ) {
    throw new RangeError('Porcje bazowe muszą być w zakresie 1–50');
  }
  if (clampServings(servings) !== servings)
    throw new RangeError('Porcje muszą być w zakresie 1–12');
  return quantity === null ? null : (quantity * servings) / baseServings;
}

export function formatScaledQuantity(
  quantity: number | null,
  unit: string,
  servings: number,
  baseServings: number,
): string {
  return formatQuantity(scaleQuantity(quantity, servings, baseServings), unit);
}
