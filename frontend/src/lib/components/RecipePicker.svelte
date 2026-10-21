<script lang="ts">
  import { ApiError, type Recipe } from '../api';
  import type { Product } from '../domain/nutrition';
  import { recipeMeta } from '../recipeCards';
  import { formatDayHeading } from '../domain/format';
  import { modalFocus } from '../modal';
  import RecipeThumbnail from './RecipeThumbnail.svelte';
  let {
    date,
    slot,
    recipes,
    products,
    desktop = false,
    replacedTitle,
    onselect,
    onclose,
  }: {
    date: string;
    slot: 0 | 1 | 2;
    recipes: readonly Recipe[];
    products: readonly Product[];
    desktop?: boolean;
    replacedTitle?: string;
    onselect: (recipe: Recipe) => Promise<void>;
    onclose: () => void;
  } = $props();
  let pending = $state(false);
  let error = $state('');
  const ordered = $derived(
    [...recipes].sort(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at) ||
        a.id.localeCompare(b.id),
    ),
  );
  const labels = ['Śniadanie', 'Obiad', 'Kolacja'];
  async function choose(recipe: Recipe) {
    if (pending) return;
    pending = true;
    error = '';
    try {
      await onselect(recipe);
    } catch (reason) {
      error =
        reason instanceof ApiError && reason.status === 404
          ? 'Przepis nie istnieje.'
          : 'Brak połączenia z serwerem.';
    } finally {
      pending = false;
    }
  }
</script>

<div class="overlay" class:desktop>
  <button
    type="button"
    class="backdrop"
    tabindex="-1"
    aria-label="Zamknij"
    disabled={pending}
    onclick={onclose}
  ></button>
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Wybierz przepis"
    tabindex="-1"
    class="picker"
    use:modalFocus={{ close: onclose, locked: () => pending }}
  >
    <header>
      <div>
        <h2>Wybierz przepis</h2>
        <p>{formatDayHeading(date).split(',')[0]} · {labels[slot]}</p>
      </div>
      <button
        type="button"
        aria-label="Zamknij"
        disabled={pending}
        onclick={onclose}>×</button
      >
    </header>
    {#if replacedTitle}<p class="note">Zastąpi: {replacedTitle}</p>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="list" aria-busy={pending}>
      {#each ordered as recipe (recipe.id)}<button
          type="button"
          class="choice"
          aria-label={`Wybierz: ${recipe.title}`}
          disabled={pending}
          onclick={() => choose(recipe)}
          ><RecipeThumbnail {recipe} /><span
            ><strong>{recipe.title}</strong><small
              >{recipeMeta(recipe, products)}</small
            ></span
          ></button
        >{/each}
      {#if !ordered.length}<p>Brak przepisów dla tego filtra.</p>{/if}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(20, 32, 26, 0.5);
    width: 100%;
  }
  .picker {
    position: relative;
    width: 100%;
    max-height: 78dvh;
    display: flex;
    flex-direction: column;
    padding: 16px 16px 24px;
    border-radius: 24px 24px 0 0;
    background: var(--background);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 20px;
  }
  p {
    margin: 2px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  header button {
    flex: none;
    width: 44px;
    height: 44px;
    font-size: 28px;
  }
  .note {
    margin: 12px 0 4px;
  }
  .list {
    overflow-y: auto;
    display: grid;
    gap: 8px;
    margin-top: 8px;
    padding: 1px;
  }
  .choice {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 16px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
    text-align: left;
  }
  .choice > span {
    min-width: 0;
  }
  strong {
    font-size: 15px;
    line-height: 1.25;
    display: block;
    overflow-wrap: anywhere;
  }
  small {
    display: block;
    margin-top: 2px;
    font-size: 13px;
    color: var(--muted);
  }
  button:disabled {
    opacity: 0.6;
  }
  [role='alert'] {
    color: var(--warning);
    margin: 12px 0;
  }
  .desktop.overlay {
    align-items: center;
    padding: 24px;
  }
  .desktop .picker {
    width: 640px;
    max-height: min(760px, 90dvh);
    padding: 20px 24px 24px;
    border-radius: 24px;
    box-shadow: 0 12px 40px rgba(20, 32, 26, 0.3);
  }
  .desktop h2 {
    font-size: 22px;
  }
  .desktop .list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
</style>
