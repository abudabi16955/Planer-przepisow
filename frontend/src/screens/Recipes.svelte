<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getProducts,
    getRecipes,
    type Recipe,
    type CatalogueProduct,
  } from '../lib/api';
  import RecipeCard from '../lib/components/RecipeCard.svelte';
  import RecipeDetails from '../lib/components/RecipeDetails.svelte';
  import { formatRecipeCount } from '../lib/domain/format';
  import { navigate } from '../lib/router';

  let { desktop, recipeId }: { desktop: boolean; recipeId?: string } = $props();
  let recipes = $state<Recipe[]>([]);
  let products = $state<CatalogueProduct[]>([]);
  let query = $state('');
  let filter = $state('all');
  let selectedId = $state<string | null>(null);
  let loading = $state(true);
  let error = $state(false);
  const filters = [
    ['all', 'Wszystkie'],
    ['video', 'Z wideo'],
    ['sniadanie', 'Śniadania'],
    ['obiad', 'Obiady'],
    ['kolacja', 'Kolacje'],
  ];
  const visible = $derived(
    recipes
      .filter(
        (recipe) =>
          recipe.title
            .toLocaleLowerCase('pl-PL')
            .includes(query.trim().toLocaleLowerCase('pl-PL')) &&
          (filter === 'all' ||
            (filter === 'video'
              ? recipe.source_type === 'link' &&
                (recipe.source_platform === 'instagram' ||
                  recipe.source_platform === 'facebook')
              : recipe.category === filter)),
      )
      .sort(
        (a, b) =>
          Date.parse(b.created_at) - Date.parse(a.created_at) ||
          a.id.localeCompare(b.id),
      ),
  );
  const selected = $derived(
    recipeId !== undefined
      ? (recipes.find((recipe) => recipe.id === recipeId) ?? null)
      : (visible.find((recipe) => recipe.id === selectedId) ??
          visible[0] ??
          null),
  );

  onMount(() => {
    const controller = new AbortController();
    Promise.all([getRecipes(controller.signal), getProducts(controller.signal)])
      .then(([loadedRecipes, loadedProducts]) => {
        if (controller.signal.aborted) return;
        recipes = loadedRecipes;
        products = loadedProducts;
      })
      .catch(() => {
        if (!controller.signal.aborted) error = true;
      })
      .finally(() => {
        if (!controller.signal.aborted) loading = false;
      });
    return () => controller.abort();
  });
</script>

<div class="recipes" class:desktop>
  <section aria-label="Przepisy" aria-busy={loading}>
    <header>
      <h1>Przepisy</h1>
      <span class="count">{formatRecipeCount(recipes.length)}</span>
    </header>
    <div class="search">
      <span aria-hidden="true"
        ><svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg
        ></span
      >
      <input
        type="search"
        aria-label="Szukaj przepisu"
        placeholder="Szukaj przepisu"
        bind:value={query}
      />
    </div>
    <div class="filters">
      {#each filters as [value, label] (value)}
        <button
          aria-pressed={filter === value}
          onclick={() => {
            filter = value;
          }}><span>{label}</span></button
        >
      {/each}
    </div>
    <div class="cards">
      {#each visible as recipe (recipe.id)}
        <RecipeCard
          {recipe}
          {products}
          {desktop}
          selected={selected?.id === recipe.id}
          onselect={() => {
            if (desktop) {
              if (recipeId !== undefined)
                navigate(`/przepis/${encodeURIComponent(recipe.id)}`);
              else selectedId = recipe.id;
            } else navigate(`/przepis/${encodeURIComponent(recipe.id)}`);
          }}
        />
      {/each}
    </div>
    {#if error}
      <div class="empty" role="alert">Brak połączenia z serwerem.</div>
    {:else if !loading && visible.length === 0}
      <div class="empty">Brak przepisów dla tego filtra.</div>
    {/if}
  </section>
  {#if desktop}
    <aside aria-label="Szczegóły przepisu">
      {#if selected}
        {#key selected.id}<RecipeDetails
            recipe={selected}
            {products}
            desktop={true}
            onDeleted={(id) => {
              recipes = recipes.filter((recipe) => recipe.id !== id);
              selectedId = null;
            }}
          />{/key}
      {:else if recipeId && !loading && !error}
        <div class="missing">
          <h2>Przepis</h2>
          <p role="alert">Przepis nie istnieje.</p>
        </div>
      {/if}
    </aside>
  {/if}
</div>

<style>
  .desktop {
    display: flex;
    min-height: 100dvh;
  }
  section {
    flex: 1;
    min-width: 0;
    padding: 24px 16px 104px;
  }
  header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }
  .count {
    font-size: 14px;
    color: var(--muted);
    white-space: nowrap;
  }
  .search {
    position: relative;
    margin-top: 16px;
  }
  .search > span {
    position: absolute;
    left: 14px;
    top: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    color: var(--muted);
    pointer-events: none;
  }
  input {
    width: 100%;
    height: 48px;
    border: 1px solid rgba(20, 32, 26, 0.16);
    border-radius: 14px;
    background: var(--white);
    padding: 0 14px 0 44px;
    font: inherit;
    font-size: 16px;
    color: var(--text);
  }
  input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .filters {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin: 8px -16px 0;
    padding: 0 16px;
    scrollbar-width: none;
  }
  .filters::-webkit-scrollbar {
    display: none;
  }
  .filters button {
    flex: none;
    height: 44px;
    display: flex;
    align-items: center;
  }
  .filters span {
    display: block;
    height: 36px;
    line-height: 34px;
    padding: 0 14px;
    border-radius: 18px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--white);
    color: var(--text);
    border: 1px solid rgba(20, 32, 26, 0.16);
  }
  .filters button[aria-pressed='true'] span {
    background: var(--accent);
    color: var(--white);
    border-color: var(--accent);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 8px;
  }
  .empty {
    margin-top: 32px;
    padding: 24px 16px;
    text-align: center;
    color: var(--muted);
    background: var(--white);
    border-radius: 18px;
  }
  .desktop section {
    padding: 32px;
    height: 100dvh;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .desktop .filters {
    flex-wrap: wrap;
    overflow: visible;
    margin: 8px 0 0;
    padding: 0;
  }
  .desktop .cards {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .desktop .empty {
    margin-top: 24px;
    padding: 24px;
  }
  aside {
    flex: none;
    width: 480px;
    height: 100dvh;
    overflow-y: auto;
    border-left: 1px solid var(--border);
    background: var(--background);
  }
  .missing {
    padding: 24px;
  }
  .missing h2 {
    margin: 0;
    padding: 24px;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 28px;
    line-height: 1.1;
  }
</style>
