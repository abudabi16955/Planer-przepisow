import { formatQuantity } from './format';

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 50;

/** Counter limits apply to displayed servings, matching the recipe's base range (1–50). */
export function clampServings(servings: number): number {
  if (!Number.isInteger(servings))
    throw new RangeError('Porcje muszą być całkowite');
  return Math.max(MIN_SERVINGS, Math.min(MAX_SERVINGS, servings));
}

export function scaleQuantity(
  quantity: number | null,
  servings: number,
  baseServings: number,
): number | null {
  if (
    !Number.isInteger(baseServings) ||
    baseServings < MIN_SERVINGS ||
    baseServings > MAX_SERVINGS
  ) {
    throw new RangeError(
      `Porcje bazowe muszą być w zakresie ${MIN_SERVINGS}–${MAX_SERVINGS}`,
    );
  }
  if (clampServings(servings) !== servings)
    throw new RangeError(
      `Porcje muszą być w zakresie ${MIN_SERVINGS}–${MAX_SERVINGS}`,
    );
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
