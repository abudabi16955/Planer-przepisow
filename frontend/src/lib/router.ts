import { readable } from 'svelte/store';

export type Page =
  'recipes' | 'recipe' | 'add' | 'edit' | 'planner' | 'shopping';
export type Route = { page: Page; id?: string; week?: string };

export function resolveRoute(path: string): Route {
  const [pathname, query = ''] = path.split('?');
  path = pathname;
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
  const page = pages[path.replace(/\/$/, '') || '/'] ?? 'recipes';
  const week = new URLSearchParams(query).get('week');
  return {
    page,
    ...(week && (page === 'planner' || page === 'shopping') ? { week } : {}),
  };
}

export const route = readable<Route>({ page: 'recipes' }, (set) => {
  const update = () =>
    set(resolveRoute(window.location.pathname + window.location.search));
  update();
  window.addEventListener('popstate', update);
  window.addEventListener('app:navigate', update);
  return () => {
    window.removeEventListener('popstate', update);
    window.removeEventListener('app:navigate', update);
  };
});

export function navigate(path: string): void {
  if (window.location.pathname + window.location.search === path) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('app:navigate'));
}
