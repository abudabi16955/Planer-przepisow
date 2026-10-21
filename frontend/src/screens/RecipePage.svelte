<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ApiError,
    getRecipe,
    getProducts,
    type Recipe,
    type CatalogueProduct,
  } from '../lib/api';
  import RecipeDetails from '../lib/components/RecipeDetails.svelte';
  import { navigate } from '../lib/router';

  let { id, desktop }: { id: string; desktop: boolean } = $props();
  let recipe = $state<Recipe | null>(null);
  let products = $state<CatalogueProduct[]>([]);
  let error = $state<string | null>(null);
  onMount(() => {
    const controller = new AbortController();
    Promise.all([
      getRecipe(id, controller.signal),
      getProducts(controller.signal),
    ])
      .then(([loadedRecipe, loadedProducts]) => {
        if (!controller.signal.aborted) {
          recipe = loadedRecipe;
          products = loadedProducts;
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          error =
            reason instanceof ApiError && reason.status === 404
              ? 'Przepis nie istnieje.'
              : 'Brak połączenia z serwerem.';
      });
    return () => controller.abort();
  });
</script>

<div class="page" class:desktop aria-busy={!recipe && !error}>
  {#if recipe}
    {#key recipe.id}<RecipeDetails {recipe} {products} {desktop} />{/key}
  {:else}
    <div class="fallback">
      <h1>Przepis</h1>
      {#if error}<p role="alert">{error}</p>{/if}<button
        onclick={() => navigate('/')}>Wróć</button
      >
    </div>
  {/if}
</div>

<style>
  .fallback {
    padding: 24px 16px;
  }
  .fallback button {
    min-height: 44px;
    padding: 0 16px;
    background: var(--white);
    border-radius: 12px;
  }
  .desktop {
    width: 480px;
    margin-left: auto;
    border-left: 1px solid var(--border);
    min-height: 100dvh;
  }
</style>
