<script lang="ts">
  import { onMount } from 'svelte';
  import { ApiError, getRecipe, updateRecipe, type Recipe } from '../lib/api';
  import RecipeForm from '../lib/components/RecipeForm.svelte';
  import { navigate } from '../lib/router';
  let { id }: { id: string } = $props();
  let recipe = $state<Recipe | null>(null);
  let error = $state('');
  onMount(() => {
    const controller = new AbortController();
    getRecipe(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) recipe = value;
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

{#if recipe}<RecipeForm
    initialRecipe={recipe}
    onSave={(data) => updateRecipe(id, data)}
  />
{:else}<div class="fallback" aria-busy={!error}>
    <h1>Edytuj przepis</h1>
    {#if error}<p role="alert">{error}</p>{/if}<button
      onclick={() => navigate(`/przepis/${id}`)}>Wróć</button
    >
  </div>{/if}

<style>
  .fallback {
    padding: 24px 16px;
  }
  button {
    min-height: 44px;
    padding: 12px;
  }
</style>
