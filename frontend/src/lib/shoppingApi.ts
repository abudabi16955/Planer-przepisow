import { ApiError } from './api';

export interface ShoppingCheck {
  week_start: string;
  item_key: string;
  checked: boolean;
}
export async function getShoppingChecks(
  week: string,
  signal?: AbortSignal,
): Promise<ShoppingCheck[]> {
  const response = await fetch(
    `/api/shopping-checks?week=${encodeURIComponent(week)}`,
    { signal },
  );
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}
export async function setShoppingCheck(
  week: string,
  key: string,
  checked: boolean,
): Promise<ShoppingCheck> {
  const response = await fetch('/api/shopping-checks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ week_start: week, item_key: key, checked }),
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}
