import { describe, expect, test } from 'vitest';
import {
  dayMealCount,
  dayTotals,
  goalRow,
  summarizeDay,
  weekMealCounts,
  type PlanEntry,
  type PlannedRecipe,
} from './day';
import { weekDays } from './week';
import type { Product } from './nutrition';

const date = '2026-10-21';
const goal = { kcal: 2000, protein: 100, carbs: 250, fat: 65 };
const manual: PlannedRecipe = {
  id: 'manual',
  servings: 4,
  ingredients: [],
  kcal: 330,
  protein: 10,
  carbs: 20,
  fat: 5,
};
const unknown: PlannedRecipe = {
  ...manual,
  id: 'unknown',
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
};
const meal = (
  slot: 0 | 1 | 2,
  recipe_id = manual.id,
  day = date,
): PlanEntry => ({ date: day, slot, recipe_id });
const products: Product[] = [
  {
    id: 'flour',
    nutrition_basis: 'g',
    kcal: 360,
    protein: 10,
    carbs: 70,
    fat: 2,
    unit_conversions: { szklanka: 150 },
  },
];
const flour: PlannedRecipe = {
  ...unknown,
  id: 'flour-recipe',
  servings: 3,
  ingredients: [{ product_id: 'flour', quantity: 1, unit: 'szklanka' }],
};

function summary(
  entries: readonly PlanEntry[],
  recipes: readonly PlannedRecipe[] = [manual, unknown, flour],
) {
  return summarizeDay(date, entries, recipes, products, goal);
}

describe('suma dnia', () => {
  test('pusty dzień to zero i brak proporcji, bez mutacji wejścia', () => {
    const entries = Object.freeze([]);
    const result = summary(entries);
    expect(result.totals).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.mealCount).toBe(0);
    expect(result.proportions).toBeNull();
    expect(result.dayShareText).toBeNull();
    expect(result.rows[0].message).toBe('Brakuje 2000 kcal');
  });
  test('powtórzony przepis liczy się w każdym slocie, po jednej porcji', () => {
    const entries = Object.freeze([
      meal(0),
      meal(1),
      meal(2, 'manual', '2026-10-22'),
    ]);
    expect(dayTotals(date, entries, [Object.freeze(manual)], [])).toEqual({
      kcal: 660,
      protein: 20,
      carbs: 40,
      fat: 10,
    });
    expect(dayMealCount(date, entries)).toBe(2);
    expect(manual.servings).toBe(4);
  });
  test('przepis bez wartości i brakujące ID dają zero, ale zajmują slot', () => {
    const result = summary([meal(0, 'unknown'), meal(1, 'missing')]);
    expect(result.totals).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
    expect(result.mealCount).toBe(2);
    expect(result.proportions).toBeNull();
  });
  test('sumuje z produktów, stosuje unit_conversions i porcje bazowe bez zaokrąglania', () => {
    const result = summary([meal(0, 'flour-recipe')]);
    expect(result.totals.kcal).toBe(180);
    expect(result.totals.protein).toBe(5);
    expect(result.totals.carbs).toBe(35);
    expect(result.totals.fat).toBe(1);
    const fractional = { ...flour, servings: 7 };
    expect(
      dayTotals(
        date,
        [meal(0, fractional.id), meal(1, fractional.id)],
        [fractional],
        products,
      ).kcal,
    ).toBeCloseTo(1080 / 7);
  });
  test('ręczne wartości mają pierwszeństwo przed składnikami', () => {
    const recipe = { ...flour, kcal: 300, protein: 20, carbs: 10, fat: 4 };
    expect(dayTotals(date, [meal(0, recipe.id)], [recipe], products)).toEqual({
      kcal: 300,
      protein: 20,
      carbs: 10,
      fat: 4,
    });
  });
  test('powtórzona migawka slotu nie tworzy kolejnego posiłku; ostatnia wersja wygrywa', () => {
    const result = summary([meal(0), meal(0, 'unknown')]);
    expect(result.mealCount).toBe(1);
    expect(result.totals.kcal).toBe(0);
  });
  test('jawne zero pozostaje wartością', () => {
    const zero = { ...manual, kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const result = summary([meal(0)], [zero]);
    expect(result.totals.kcal).toBe(0);
    expect(result.proportions).toBeNull();
  });
});

describe('wiersze celu', () => {
  test('brakuje, osiągnięty, przekroczony i limit paska 100%', () => {
    expect(goalRow('kcal', 1580, 2000)).toMatchObject({
      label: 'Kalorie',
      state: 'remaining',
      message: 'Brakuje 420 kcal',
      progress: 79,
      eatenText: '1580 kcal',
      goalText: '2000 kcal',
    });
    expect(goalRow('protein', 100, 100)).toMatchObject({
      label: 'Białko',
      state: 'reached',
      message: 'Cel osiągnięty',
      progress: 100,
    });
    expect(goalRow('carbs', 285, 250)).toMatchObject({
      label: 'Węglowodany',
      state: 'exceeded',
      message: 'Przekroczono o 35 g',
      progress: 100,
    });
    expect(goalRow('fat', 0, 65)).toMatchObject({
      label: 'Tłuszcze',
      progress: 0,
      message: 'Brakuje 65 g',
    });
  });
  test('brak celu także przy dodatniej sumie: brak dzielenia przez zero', () => {
    expect(goalRow('kcal', 500, 0)).toMatchObject({
      state: 'no-goal',
      goalText: 'brak celu',
      message: 'Ustaw cel w „Zmień cel”',
      progress: 0,
    });
  });
  test.each([-1, NaN, Infinity])(
    'niepoprawny cel %s traktowany jak puste zero',
    (value) => {
      expect(goalRow('protein', 10, value)).toMatchObject({
        goal: 0,
        goalText: 'brak celu',
        progress: 0,
      });
      expect(goalRow('protein', value, 100)).toMatchObject({
        eaten: 0,
        progress: 0,
      });
    },
  );
  test('zaokrągla tylko prezentację, jak mkGoal w prototypie', () => {
    expect(goalRow('protein', 10.25, 20)).toMatchObject({
      eaten: 10.25,
      goal: 20,
      eatenText: '10 g',
      message: 'Brakuje 10 g',
      progress: 51,
    });
    expect(goalRow('protein', 19.8, 20).state).toBe('reached');
  });
});

describe('proporcje energii', () => {
  test('liczy proporcje makro zamiast udziału w ręcznie wpisanych kcal', () => {
    const result = summary([meal(0)]);
    expect(result.proportions).toEqual({ protein: 24, carbs: 48, fat: 28 });
    expect(result.dayShareText).toBe('Białko 24% · węgle 48% · tłuszcze 28%');
    expect(result.goalProportions).toEqual({ protein: 20, carbs: 50, fat: 30 });
    expect(result.goalShareText).toBe('W celu: 20% · 50% · 30%');
    expect(Object.values(result.proportions!).reduce((a, b) => a + b)).toBe(
      100,
    );
  });
  test('same kcal bez makro nie tworzą proporcji', () => {
    const recipe = { ...unknown, kcal: 330 };
    expect(summary([meal(0, recipe.id)], [recipe]).proportions).toBeNull();
  });
  test.each(['protein', 'carbs', 'fat'] as const)(
    'brak celu %s ukrywa docelowe proporcje',
    (key) => {
      const result = summarizeDay(date, [], [], [], { ...goal, [key]: 0 });
      expect(result.goalProportions).toBeNull();
      expect(result.goalShareText).toBe(
        'Uzupełnij cele makro, żeby zobaczyć docelowe proporcje.',
      );
    },
  );
  test('cel kcal nie warunkuje kompletnych celów makro', () => {
    expect(
      summarizeDay(date, [], [], [], { ...goal, kcal: 0 }).goalProportions,
    ).toEqual({ protein: 20, carbs: 50, fat: 30 });
  });
});

describe('licznik posiłków', () => {
  test('liczy zajęte sloty, a nie unikalne przepisy', () => {
    const entries = [
      meal(0),
      meal(1),
      meal(2),
      meal(0, 'manual', '2026-10-22'),
      meal(0, 'manual', '2026-10-26'),
    ];
    expect(weekMealCounts(date, entries)).toMatchObject({
      total: 4,
      caption: '4 z 21 posiłków',
    });
    expect(weekMealCounts(date, entries).days[date]).toBe(3);
    expect(weekMealCounts(date, entries).days['2026-10-22']).toBe(1);
    expect(weekMealCounts(date, entries).days['2026-10-23']).toBe(0);
  });
  test.each(['2026-10-19', '2026-03-23', '2026-12-28', '2026-04-27'])(
    'pełny tydzień %s obejmuje 21 slotów, przełomy i zmianę czasu',
    (week) => {
      const entries = weekDays(week).flatMap((day) =>
        ([0, 1, 2] as const).map((slot) => meal(slot, 'manual', day)),
      );
      expect(weekMealCounts(week, [...entries, ...entries]).caption).toBe(
        '21 z 21 posiłków',
      );
      expect(Object.values(weekMealCounts(week, entries).days)).toEqual([
        3, 3, 3, 3, 3, 3, 3,
      ]);
    },
  );
  test('pusty tydzień', () =>
    expect(weekMealCounts(date, []).caption).toBe('0 z 21 posiłków'));
  test('odrzuca niepoprawną datę', () => {
    expect(() => dayMealCount('2026-02-30', [])).toThrow(RangeError);
    expect(() => dayTotals('invalid', [], [], [])).toThrow(RangeError);
    expect(() => weekMealCounts('2026-02-30', [])).toThrow(RangeError);
  });
});
