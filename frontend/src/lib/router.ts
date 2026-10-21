import { readable } from 'svelte/store';

export type Page =
  'recipes' | 'recipe' | 'add' | 'edit' | 'planner' | 'shopping';
export type Route = { page: Page; id?: string };

export function resolveRoute(path: string): Route {
  const edit = /^\/przepis\/([^/]+)\/edytuj\/?$/.exec(path);
  if (edit) return { page: 'edit', id: edit[1] };
  const recipe = /^\/przepis\/([^/]+)\/?$/.exec(path);
  if (recipe) return { page: 'recipe', id: recipe[1] };
  const pages: Record<string, Page> = {
    '/': 'recipes',
    '/dodaj': 'add',
    '/planer': 'planner',
    '/zakupy': 'shopping',
  };
  return { page: pages[path.replace(/\/$/, '') || '/'] ?? 'recipes' };
}

export const route = readable<Route>({ page: 'recipes' }, (set) => {
  const update = () => set(resolveRoute(window.location.pathname));
  update();
  window.addEventListener('popstate', update);
  window.addEventListener('app:navigate', update);
  return () => {
    window.removeEventListener('popstate', update);
    window.removeEventListener('app:navigate', update);
  };
});

export function navigate(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('app:navigate'));
}
