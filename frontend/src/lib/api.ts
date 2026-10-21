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
  source_platform: 'instagram' | 'facebook' | null;
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

async function get<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Brak połączenia z serwerem.');
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
