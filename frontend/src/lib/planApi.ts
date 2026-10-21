import { ApiError } from './api';
import type { PlanEntry } from './domain/day';

export async function getPlan(
  week: string,
  signal?: AbortSignal,
): Promise<PlanEntry[]> {
  const response = await fetch(`/api/plan?week=${encodeURIComponent(week)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}

export async function setPlanEntry(
  date: string,
  slot: PlanEntry['slot'],
  recipeId: string,
): Promise<PlanEntry> {
  const response = await fetch(
    `/api/plan/${encodeURIComponent(date)}/${slot}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipe_id: recipeId }),
    },
  );
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}

export async function removePlanEntry(
  date: string,
  slot: PlanEntry['slot'],
): Promise<void> {
  const response = await fetch(
    `/api/plan/${encodeURIComponent(date)}/${slot}`,
    { method: 'DELETE' },
  );
  if (!response.ok) throw new ApiError(response.status);
}
