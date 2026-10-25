import { importPlatform, ImportRequestError } from './importApi';
import type { Recipe } from './api';

export interface WebIngredient {
  raw: string;
  qty: number | null;
  unit: string;
  name: string;
  product_id: string | null;
  match: 'exact' | 'fuzzy' | 'none';
  unit_ok: boolean | null;
}
export interface ReviewIngredient extends WebIngredient {
  confirmed: boolean;
  skipped: boolean;
}
export interface WebDraft {
  title: string;
  category: Recipe['category'] | null;
  time_min: number | null;
  servings: number | null;
  steps: string[];
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  ingredients: WebIngredient[];
  photo_url: string | null;
  source_url: string;
  source_host: string;
  notes: string[];
}
export function recipeLink(
  value: string,
): { kind: 'social' | 'web'; host: string } | null {
  try {
    if (!/^https?:\/\//i.test(value) || /[\s\\]/.test(value)) return null;
    const url = new URL(value);
    if (
      url.username ||
      url.password ||
      (url.port && !['80', '443'].includes(url.port))
    )
      return null;
    const social = [
      'instagram.com',
      'www.instagram.com',
      'facebook.com',
      'www.facebook.com',
      'm.facebook.com',
      'fb.watch',
    ].includes(url.hostname);
    if (social && !importPlatform(value)) return null;
    return { kind: social ? 'social' : 'web', host: url.hostname };
  } catch {
    return null;
  }
}
export function reviewIngredients(draft: WebDraft): ReviewIngredient[] {
  return draft.ingredients.map((row) => ({
    ...row,
    confirmed: row.match === 'exact',
    skipped: false,
  }));
}
export function readyIngredient(row: ReviewIngredient): boolean {
  return (
    !!row.product_id &&
    row.confirmed &&
    row.unit_ok === true &&
    (row.unit === 'do smaku' ||
      (row.qty !== null && Number.isFinite(row.qty) && row.qty > 0))
  );
}
export function webImportError(code: string): string {
  switch (code) {
    case 'no_recipe':
      return 'Na tej stronie nie znalazłem przepisu. Dodaj go ręcznie.';
    case 'blocked_host':
    case 'unsupported_url':
      return 'Nie mogę otworzyć tego adresu.';
    case 'too_large':
      return 'Strona jest za duża.';
    case 'unavailable':
      return 'Pobieranie ze stron jest chwilowo niedostępne.';
    case 'network':
      return 'Brak połączenia z serwerem.';
    default:
      return 'Nie udało się pobrać strony.';
  }
}
export async function requestWebImport(
  url: string,
  signal: AbortSignal,
): Promise<WebDraft> {
  const response = await fetch('/api/web-import', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ImportRequestError(
      response.status === 503
        ? 'unavailable'
        : body?.detail?.code || 'fetch_failed',
    );
  }
  return response.json();
}

/** Round the editable presentation, retaining the original quantity until the user edits it. */
export function formatImportAmount(value: number | null): string {
  if (value === null) return '';
  return new Intl.NumberFormat('pl-PL', {
    useGrouping: false,
    maximumFractionDigits:
      Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 8 : 2,
  }).format(value);
}
