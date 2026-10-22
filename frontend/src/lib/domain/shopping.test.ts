import { describe, expect, it } from 'vitest';
import {
  activeShoppingPresets,
  presetDays,
  shoppingList,
  type ShoppingRecipe,
} from './shopping';
import type { PlanEntry } from './day';

const products = [
  { id: 'a', name: 'Cebula' },
  { id: 'b', name: 'Sól' },
];
const recipe: ShoppingRecipe = {
  id: 'r',
  servings: 2,
  ingredients: [
    { product_id: 'a', quantity: 1, unit: 'szt.' },
    { product_id: 'a', quantity: 100, unit: 'g' },
    { product_id: 'a', quantity: 1, unit: 'kg' },
    { product_id: 'b', quantity: null, unit: '' },
  ],
};
const entries: PlanEntry[] = [
  { date: '2026-12-28', slot: 0, recipe_id: 'r' },
  { date: '2026-12-28', slot: 1, recipe_id: 'r' },
  { date: '2026-12-29', slot: 0, recipe_id: 'r' },
];
const list = (plan = entries, days = ['2026-12-28'], recipes = [recipe]) =>
  shoppingList(plan, days, recipes, products);

describe('shopping quantities', () => {
  it('uses one portion per entry and rounds half a piece upward', () => {
    expect(
      list(entries.slice(0, 1)).find((row) => row.unit === 'szt.'),
    ).toEqual({
      key: 'a|szt.',
      product_id: 'a',
      name: 'Cebula',
      unit: 'szt.',
      quantity: 1,
    });
    expect(
      list(entries.slice(0, 1)).find((row) => row.unit === 'g')?.quantity,
    ).toBe(50);
  });
  it('counts repeated recipes, filters days and rounds only after aggregation', () => {
    expect(list().find((row) => row.unit === 'szt.')?.quantity).toBe(1);
    expect(
      list(entries, ['2026-12-28', '2026-12-29']).find(
        (row) => row.unit === 'szt.',
      )?.quantity,
    ).toBe(2);
    expect(list().find((row) => row.unit === 'g')?.quantity).toBe(100);
  });
  it('keeps different units separate and taste unique per product', () => {
    expect(
      list()
        .map((row) => row.key)
        .sort(),
    ).toEqual(['a|g', 'a|kg', 'a|szt.', 'b|do-smaku']);
    expect(list().find((row) => row.unit === 'kg')?.quantity).toBe(1);
    expect(list().find((row) => row.key === 'b|do-smaku')?.quantity).toBeNull();
  });
  it.each([
    [1.00009, 1],
    [1.00011, 2],
    [0.5, 1],
    [2, 2],
  ])('uses tolerance for %s pieces', (quantity, expected) => {
    const adjusted = {
      ...recipe,
      servings: 1,
      ingredients: [{ product_id: 'a', quantity, unit: 'szt.' }],
    };
    expect(
      list(entries.slice(0, 1), ['2026-12-28'], [adjusted])[0].quantity,
    ).toBe(expected);
  });
  it('handles empty plans, no selected days and missing references', () => {
    expect(list([])).toEqual([]);
    expect(list(entries, [])).toEqual([]);
    expect(list(entries, ['2026-12-28'], [])).toEqual([]);
    expect(shoppingList(entries, ['2026-12-28'], [recipe], [])).toEqual([]);
  });
  it('keeps taste and quantified rows for the same product separate', () => {
    const mixed = {
      ...recipe,
      ingredients: [
        ...recipe.ingredients,
        { product_id: 'b', quantity: 2, unit: 'g' },
      ],
    };
    expect(
      list(entries, ['2026-12-28'], [mixed])
        .filter((row) => row.product_id === 'b')
        .map((row) => row.quantity),
    ).toEqual([null, 2]);
  });
  it('sorts with Polish collation without mutating inputs', () => {
    const names = ['Żyto', 'Łosoś', 'Ziemniaki', 'Cebula', 'Limonka'];
    const catalogue = names.map((name, index) => ({ id: String(index), name }));
    const ingredients = catalogue.map((product) => ({
      product_id: product.id,
      quantity: 1,
      unit: 'g',
    }));
    const source = [{ ...recipe, ingredients }];
    const before = JSON.stringify(source);
    expect(
      shoppingList(entries, ['2026-12-28'], source, catalogue).map(
        (row) => row.name,
      ),
    ).toEqual(['Cebula', 'Limonka', 'Łosoś', 'Ziemniaki', 'Żyto']);
    expect(JSON.stringify(source)).toBe(before);
  });
});

describe('shopping day presets', () => {
  const now = new Date('2026-12-31T23:30:00Z'); // Friday in Warsaw, Thursday in UTC.
  it('crosses year/month boundaries using Warsaw dates', () => {
    expect(presetDays('2026-12-28', 'Cały tydzień', now)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(presetDays('2026-12-28', 'Od dziś', now)).toEqual([
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(presetDays('2026-12-28', 'Weekend', now)).toEqual([
      '2027-01-02',
      '2027-01-03',
    ]);
    expect(presetDays('2026-12-28', 'Od dziś', now, 'UTC')?.[0]).toBe(
      '2026-12-31',
    );
  });
  it('disables from-today for past and future weeks', () => {
    expect(presetDays('2026-12-21', 'Od dziś', now)).toBeNull();
    expect(presetDays('2027-01-04', 'Od dziś', now)).toBeNull();
  });
  it('detects exact sets, independent of order and duplicates', () => {
    expect(
      activeShoppingPresets(
        '2026-12-28',
        ['2027-01-03', '2027-01-02', '2027-01-02'],
        now,
      ),
    ).toEqual(['Weekend']);
    expect(activeShoppingPresets('2026-12-28', ['2027-01-02'], now)).toEqual(
      [],
    );
    expect(activeShoppingPresets('2026-12-28', [], now)).toEqual([]);
    const days = presetDays('2026-12-28', 'Cały tydzień', now)!;
    expect(activeShoppingPresets('2026-12-28', days, now)).toEqual([
      'Cały tydzień',
    ]);
  });
  it('supports overlapping presets and DST weekends', () => {
    expect(
      activeShoppingPresets(
        '2026-12-28',
        ['2027-01-02', '2027-01-03'],
        new Date('2027-01-02T12:00:00Z'),
      ),
    ).toEqual(['Od dziś', 'Weekend']);
    expect(
      presetDays('2026-03-23', 'Od dziś', new Date('2026-03-28T23:30:00Z')),
    ).toEqual(['2026-03-29']);
  });
});
