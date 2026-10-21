<script lang="ts">
  import { onMount } from 'svelte';
  import Recipes from './screens/Recipes.svelte';
  import RecipeForm from './lib/components/RecipeForm.svelte';
  import Navigation from './lib/components/Navigation.svelte';
  import Toast from './lib/components/Toast.svelte';
  import { route, type Page } from './lib/router';

  let desktop = $state(false);
  const headings: Record<Page, string> = {
    recipes: 'Przepisy',
    recipe: 'Przepis',
    add: 'Dodaj przepis',
    planner: 'Planer',
    shopping: 'Lista zakupów',
  };
  onMount(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => {
      desktop = media.matches;
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
</script>

<div class="shell" class:desktop>
  <Navigation {desktop} page={$route.page} />
  <main
    class:detail={$route.page === 'recipe'}
    class:recipes={$route.page === 'recipes' || $route.page === 'add'}
  >
    {#if $route.page === 'recipes'}
      <Recipes {desktop} />
    {:else if $route.page === 'add'}
      <RecipeForm />
    {:else}
      <h1>{headings[$route.page]}</h1>
    {/if}
  </main>
  <Toast />
</div>

<style>
  .shell {
    min-height: 100dvh;
  }
  .desktop {
    display: flex;
  }
  main {
    flex: 1;
    min-width: 0;
    padding: 24px 16px 104px;
  }
  main.detail {
    padding-bottom: 28px;
  }
  .desktop main {
    padding: 32px;
  }
  main.recipes,
  .desktop main.recipes {
    padding: 0;
  }
</style>
