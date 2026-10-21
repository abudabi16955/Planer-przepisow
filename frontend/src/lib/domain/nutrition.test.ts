import { expect, test } from 'vitest';
import {
  energyProportions,
  quantityInBasis,
  recipeNutrition,
  type Product,
  type RecipeNutrition,
} from './nutrition';

const product: Product = {
  id: 'p',
  nutrition_basis: 'g',
  kcal: 100,
  protein: 10,
  carbs: 20,
  fat: 5,
  unit_conversions: null,
};
const recipe: RecipeNutrition = {
  servings: 2,
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  ingredients: [{ product_id: 'p', quantity: 200, unit: 'g' }],
};

test('sumuje składniki i dzieli przez bazowe porcje, bez modyfikacji wejścia', () => {
  const input = structuredClone(recipe);
  input.ingredients = [
    ...input.ingredients,
    { product_id: 'p', quantity: 100, unit: 'g' },
  ];
  expect(recipeNutrition(input, [product])).toEqual({
    kcal: 150,
    protein: 15,
    carbs: 30,
    fat: 7.5,
  });
  expect(input.ingredients).toHaveLength(2);
  expect(product.kcal).toBe(100);
});

test.each([
  ['g', 'g', 2, 2],
  ['g', 'kg', 0.5, 500],
  ['ml', 'ml', 2, 2],
  ['ml', 'l', 0.5, 500],
  ['szt.', 'szt.', 2, 2],
  ['ml', 'łyżka', 1, 15],
  ['ml', 'łyżeczka', 1, 5],
  ['ml', 'szklanka', 1, 250],
] as const)('podstawa %s, jednostka %s', (basis, unit, quantity, expected) => {
  expect(
    quantityInBasis({ ...product, nutrition_basis: basis }, quantity, unit),
  ).toBe(expected);
});

test('czosnek 2 ząbki to 10 g', () => {
  const garlic = {
    ...product,
    kcal: 149,
    protein: 6.4,
    carbs: 33.1,
    fat: 0.5,
    unit_conversions: { ząbek: 5 },
  };
  const input = {
    ...recipe,
    servings: 1,
    ingredients: [{ product_id: 'p', quantity: 2, unit: 'ząbek' }],
  };
  const result = recipeNutrition(input, [garlic])!;
  expect(quantityInBasis(garlic, 2, 'ząbek')).toBe(10);
  expect(result.kcal).toBeCloseTo(14.9);
  expect(result.protein).toBeCloseTo(0.64);
  expect(result.carbs).toBeCloseTo(3.31);
  expect(result.fat).toBeCloseTo(0.05);
});

test('mąka 1 szklanka to 150 g', () => {
  const flour = { ...product, kcal: 364, unit_conversions: { szklanka: 150 } };
  expect(quantityInBasis(flour, 1, 'szklanka')).toBe(150);
  expect(
    recipeNutrition(
      {
        ...recipe,
        servings: 1,
        ingredients: [{ product_id: 'p', quantity: 1, unit: 'szklanka' }],
      },
      [flour],
    )?.kcal,
  ).toBe(546);
});

test('jajka liczy na 1 szt., a nie na 100 szt.', () => {
  const eggs = {
    ...product,
    nutrition_basis: 'szt.' as const,
    kcal: 72,
    protein: 6.3,
    carbs: 0.4,
    fat: 4.8,
  };
  expect(
    recipeNutrition(
      {
        ...recipe,
        ingredients: [{ product_id: 'p', quantity: 2, unit: 'szt.' }],
      },
      [eggs],
    ),
  ).toEqual({ kcal: 72, protein: 6.3, carbs: 0.4, fat: 4.8 });
});

test('mleko liczy łyżkę jako 15 ml z wartości na 100 ml', () => {
  const milk = { ...product, nutrition_basis: 'ml' as const, kcal: 50 };
  const result = recipeNutrition(
    {
      ...recipe,
      servings: 1,
      ingredients: [{ product_id: 'p', quantity: 1, unit: 'łyżka' }],
    },
    [milk],
  );
  expect(result?.kcal).toBe(7.5);
});

test('kolejność: podstawa, metryczne, mapa produktu, standardowe miary płynów', () => {
  const custom = {
    ...product,
    unit_conversions: { g: 100, kg: 3, szklanka: 150 },
  };
  expect(quantityInBasis(custom, 2, 'g')).toBe(2);
  expect(quantityInBasis(custom, 2, 'kg')).toBe(2000);
  const liquid = {
    ...product,
    nutrition_basis: 'ml' as const,
    unit_conversions: { ml: 100, l: 3, łyżka: 20 },
  };
  expect(quantityInBasis(liquid, 2, 'ml')).toBe(2);
  expect(quantityInBasis(liquid, 2, 'l')).toBe(2000);
  expect(quantityInBasis(liquid, 1, 'łyżka')).toBe(20);
  expect(quantityInBasis(liquid, 1, 'łyżeczka')).toBe(5);
});

test.each(['łyżka', 'szklanka', 'ml', 'szt.'])(
  'pomija niezamienialne %s dla produktu na 100 g',
  (unit) => {
    expect(quantityInBasis(product, 1, unit)).toBeNull();
    expect(
      recipeNutrition(
        { ...recipe, ingredients: [{ product_id: 'p', quantity: 1, unit }] },
        [product],
      ),
    ).toBeNull();
  },
);

test('pomija do smaku, brak produktu i brak wartości lub podstawy', () => {
  expect(
    recipeNutrition(
      {
        ...recipe,
        ingredients: [{ product_id: 'p', quantity: null, unit: '' }],
      },
      [product],
    ),
  ).toBeNull();
  expect(
    recipeNutrition(
      {
        ...recipe,
        ingredients: [{ product_id: 'p', quantity: 1, unit: 'do smaku' }],
      },
      [product],
    ),
  ).toBeNull();
  expect(recipeNutrition(recipe, [])).toBeNull();
  expect(
    recipeNutrition(recipe, [
      { ...product, kcal: null, protein: null, carbs: null, fat: null },
    ]),
  ).toBeNull();
  expect(
    recipeNutrition(recipe, [{ ...product, nutrition_basis: null }]),
  ).toBeNull();
});

test('pominięte składniki nie usuwają wartości poprawnych składników', () => {
  const input = {
    ...recipe,
    ingredients: [
      ...recipe.ingredients,
      { product_id: 'unknown', quantity: 2, unit: 'g' },
    ],
  };
  expect(recipeNutrition(input, [product])).toEqual({
    kcal: 100,
    protein: 10,
    carbs: 20,
    fat: 5,
  });
});

test('wartości ręczne są na porcję i mają pierwszeństwo nad produktami', () => {
  expect(
    recipeNutrition({ ...recipe, kcal: 500, protein: 1, carbs: 2, fat: 3 }, [
      product,
    ]),
  ).toEqual({ kcal: 500, protein: 1, carbs: 2, fat: 3 });
});

test('puste ręczne kcal liczy jako 4B+4W+9T; brakujące makro to zero', () => {
  expect(
    recipeNutrition({ ...recipe, protein: 10, carbs: 20, fat: 5 }, [product]),
  ).toEqual({ kcal: 165, protein: 10, carbs: 20, fat: 5 });
  expect(recipeNutrition({ ...recipe, protein: 10 }, [product])).toEqual({
    kcal: 40,
    protein: 10,
    carbs: 0,
    fat: 0,
  });
});

test('same ręczne kcal i jawne zera są danymi, nie uruchamiają obliczeń z produktów', () => {
  expect(recipeNutrition({ ...recipe, kcal: 123 }, [product])).toEqual({
    kcal: 123,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  expect(
    recipeNutrition({ ...recipe, kcal: 0, protein: 0 }, [product]),
  ).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('brak składników oznacza bez wartości, ale produkt z zerami (woda) to dane', () => {
  expect(recipeNutrition({ ...recipe, ingredients: [] }, [])).toBeNull();
  expect(
    recipeNutrition(recipe, [
      { ...product, kcal: 0, protein: 0, carbs: 0, fat: 0 },
    ]),
  ).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test('brakujące pola produktu liczą się jako zero; obliczenia zachowują ułamki', () => {
  expect(
    recipeNutrition({ ...recipe, servings: 3 }, [
      { ...product, protein: null, carbs: null, fat: null },
    ])?.kcal,
  ).toBeCloseTo(200 / 3);
});

test('proporcje liczy z energii makro i domyka tłuszczem do 100%', () => {
  expect(energyProportions({ protein: 10, carbs: 20, fat: 5 })).toEqual({
    protein: 24,
    carbs: 48,
    fat: 28,
  });
  expect(energyProportions({ protein: 1, carbs: 1, fat: 0 })).toEqual({
    protein: 50,
    carbs: 50,
    fat: 0,
  });
  expect(energyProportions({ protein: 0, carbs: 0, fat: 1 })).toEqual({
    protein: 0,
    carbs: 0,
    fat: 100,
  });
  expect(
    energyProportions(
      recipeNutrition(
        { ...recipe, kcal: 999, protein: 10, carbs: 20, fat: 5 },
        [],
      ),
    ),
  ).toEqual({ protein: 24, carbs: 48, fat: 28 });
});

test('bez makro nie ma proporcji ani dzielenia przez zero', () => {
  expect(energyProportions(null)).toBeNull();
  expect(energyProportions({ protein: 0, carbs: 0, fat: 0 })).toBeNull();
});
