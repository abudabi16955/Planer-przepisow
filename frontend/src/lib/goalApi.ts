import { ApiError } from './api';
import type { DailyGoal } from './domain/day';
export async function getGoal(signal?: AbortSignal): Promise<DailyGoal> {
  const response = await fetch('/api/goal', {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(response.status);
  const goal: DailyGoal = await response.json();
  if (
    !['kcal', 'protein', 'carbs', 'fat'].every(
      (key) =>
        typeof goal[key as keyof DailyGoal] === 'number' &&
        Number.isFinite(goal[key as keyof DailyGoal]) &&
        goal[key as keyof DailyGoal] >= 0,
    )
  )
    throw new ApiError(502);
  return goal;
}
export async function putGoal(goal: DailyGoal): Promise<DailyGoal> {
  const response = await fetch('/api/goal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(goal),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}
