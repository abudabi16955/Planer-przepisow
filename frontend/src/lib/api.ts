import type { Product, RecipeNutrition } from './domain/nutrition';

export interface FileReference {
  path: string;
  original_name?: string;
  mime_type: string;
  size_bytes: number;
}

export interface Recipe extends RecipeNutrition {
  id: string;
  title: string;
  category: 'sniadanie' | 'obiad' | 'kolacja';
  time_min: number | null;
  source_type: 'manual' | 'pdf' | 'link';
  source_platform: 'instagram' | 'facebook' | 'www' | null;
  source_url: string | null;
  source_description: string | null;
  video: FileReference | null;
  pdf: FileReference | null;
  photo: FileReference | null;
  steps: string[];
  created_at: string;
  updated_at: string;
}

export interface CatalogueProduct extends Product {
  name: string;
  units: string[];
  is_custom: boolean;
  created_at: string;
}

export class ApiError extends Error {
  constructor(public status: number) {
    super('Brak połączenia z serwerem.');
  }
}

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export const getRecipes = (signal?: AbortSignal) =>
  get<Recipe[]>('/api/recipes', signal);
export const getProducts = (signal?: AbortSignal) =>
  get<CatalogueProduct[]>('/api/products', signal);

export function fileUrl(file: FileReference | null): string | null {
  if (
    !file ||
    file.path.includes('\\') ||
    file.path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return null;
  return '/files/' + file.path.split('/').map(encodeURIComponent).join('/');
}

export async function post<T>(
  url: string,
  data: unknown,
  method: 'POST' | 'PUT' = 'POST',
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok)
    throw new Error(
      response.status === 409
        ? 'Produkt o tej nazwie już istnieje.'
        : 'Nie udało się zapisać. Spróbuj ponownie.',
    );
  return response.json() as Promise<T>;
}

export async function upload(file: File): Promise<string> {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/api/uploads', { method: 'POST', body });
  if (!response.ok)
    throw new Error(
      'Nie udało się przesłać pliku. Sprawdź jego typ i rozmiar.',
    );
  const result = (await response.json()) as { upload_id: string };
  return result.upload_id;
}
export const getRecipe = (id: string, signal?: AbortSignal) =>
  get<Recipe>(`/api/recipes/${encodeURIComponent(id)}`, signal);

export const updateRecipe = (id: string, data: unknown) =>
  post<Recipe>(`/api/recipes/${encodeURIComponent(id)}`, data, 'PUT');

export async function deleteRecipe(id: string): Promise<void> {
  const response = await fetch(`/api/recipes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok)
    throw new Error('Nie udało się usunąć przepisu. Spróbuj ponownie.');
}
