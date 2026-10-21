import {
  energyProportions,
  recipeNutrition,
  type Nutrition,
  type Product,
  type RecipeNutrition,
} from './nutrition';
import { parseISODate, weekDays } from './week';

export interface PlanEntry {
  date: string;
  slot: 0 | 1 | 2;
  recipe_id: string;
}
export type DailyGoal = Nutrition;
export type PlannedRecipe = RecipeNutrition & { id: string };
type Nutrient = keyof Nutrition;
export type GoalState = 'no-goal' | 'remaining' | 'reached' | 'exceeded';
export interface GoalRow {
  key: Nutrient;
  label: string;
  unit: 'kcal' | 'g';
  eaten: number;
  goal: number;
  eatenText: string;
  goalText: string;
  state: GoalState;
  message: string;
  progress: number;
}

const nutrients: readonly Nutrient[] = ['kcal', 'protein', 'carbs', 'fat'];
const labels: Record<Nutrient, string> = {
  kcal: 'Kalorie',
  protein: 'Białko',
  carbs: 'Węglowodany',
  fat: 'Tłuszcze',
};
const nonnegative = (value: number) =>
  Number.isFinite(value) && value > 0 ? value : 0;

/** The API guarantees one row per date/slot; last occurrence wins if snapshots overlap. */
function occupiedSlots(entries: readonly PlanEntry[]): PlanEntry[] {
  return [
    ...new Map(
      entries.map((entry) => [`${entry.date}:${entry.slot}`, entry]),
    ).values(),
  ];
}

export function dayMealCount(
  date: string,
  entries: readonly PlanEntry[],
): number {
  parseISODate(date);
  return occupiedSlots(entries.filter((entry) => entry.date === date)).length;
}

export function weekMealCounts(date: string, entries: readonly PlanEntry[]) {
  const days = Object.fromEntries(
    weekDays(date).map((day) => [day, dayMealCount(day, entries)]),
  );
  const total = Object.values(days).reduce((sum, count) => sum + count, 0);
  return { days, total, caption: `${total} z 21 posiłków` };
}

/** Sum exactly one recipe portion for every occupied meal, including repeated recipes. */
export function dayTotals(
  date: string,
  entries: readonly PlanEntry[],
  recipes: readonly PlannedRecipe[],
  products: readonly Product[],
): Nutrition {
  parseISODate(date);
  const catalogue = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const total: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const entry of occupiedSlots(
    entries.filter((entry) => entry.date === date),
  )) {
    const recipe = catalogue.get(entry.recipe_id);
    const values = recipe ? recipeNutrition(recipe, products) : null;
    if (!values) continue;
    for (const key of nutrients) total[key] += values[key];
  }
  return total;
}

/** Row presentation follows mkGoal in the prototype; sums remain unrounded. */
export function goalRow(key: Nutrient, eaten: number, target: number): GoalRow {
  eaten = nonnegative(eaten);
  const goal = nonnegative(target);
  const unit = key === 'kcal' ? 'kcal' : 'g';
  const difference = Math.round(goal - eaten);
  const state: GoalState =
    goal === 0
      ? 'no-goal'
      : difference === 0
        ? 'reached'
        : difference < 0
          ? 'exceeded'
          : 'remaining';
  const message =
    goal === 0
      ? 'Ustaw cel w „Zmień cel”'
      : difference === 0
        ? 'Cel osiągnięty'
        : difference < 0
          ? `Przekroczono o ${-difference} ${unit}`
          : `Brakuje ${difference} ${unit}`;
  return {
    key,
    label: labels[key],
    unit,
    eaten,
    goal,
    eatenText: `${Math.round(eaten)} ${unit}`,
    goalText: goal === 0 ? 'brak celu' : `${Math.round(goal)} ${unit}`,
    state,
    message,
    progress: goal === 0 ? 0 : Math.min(100, Math.round((eaten / goal) * 100)),
  };
}

export function summarizeDay(
  date: string,
  entries: readonly PlanEntry[],
  recipes: readonly PlannedRecipe[],
  products: readonly Product[],
  goal: DailyGoal,
) {
  const totals = dayTotals(date, entries, recipes, products);
  const proportions = energyProportions(totals);
  const goalProportions =
    goal.protein > 0 &&
    goal.carbs > 0 &&
    goal.fat > 0 &&
    [goal.protein, goal.carbs, goal.fat].every(Number.isFinite)
      ? energyProportions(goal)
      : null;
  return {
    totals,
    mealCount: dayMealCount(date, entries),
    rows: nutrients.map((key) => goalRow(key, totals[key], goal[key])),
    proportions,
    dayShareText: proportions
      ? `Białko ${proportions.protein}% · węgle ${proportions.carbs}% · tłuszcze ${proportions.fat}%`
      : null,
    goalProportions,
    goalShareText: goalProportions
      ? `W celu: ${goalProportions.protein}% · ${goalProportions.carbs}% · ${goalProportions.fat}%`
      : 'Uzupełnij cele makro, żeby zobaczyć docelowe proporcje.',
  };
}
