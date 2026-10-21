<script lang="ts">
  import type { Recipe } from '../api';
  import { formatNumber } from '../domain/format';
  import { recipeNutrition, type Product } from '../domain/nutrition';
  import { paletteForRecipe, recipeMeta } from '../recipeCards';
  import { navigate } from '../router';
  import RecipeThumbnail from './RecipeThumbnail.svelte';
  let {
    label,
    recipe,
    products,
    desktop = false,
    disabled = false,
    onadd,
    onremove,
  }: {
    label: string;
    recipe?: Recipe;
    products: readonly Product[];
    desktop?: boolean;
    disabled?: boolean;
    onadd: () => void;
    onremove: () => void;
  } = $props();
  const tint = $derived(recipe ? paletteForRecipe(recipe.id).tint : '');
  const nutrition = $derived(recipe ? recipeNutrition(recipe, products) : null);
</script>

<div class="slot" class:desktop role="group" aria-label={label}>
  {#if !desktop}<h3>
      {#if recipe}<button
          type="button"
          {disabled}
          aria-label={`Dodaj przepis: ${label}`}
          onclick={onadd}>{label}</button
        >{:else}{label}{/if}
    </h3>{/if}
  {#if recipe}
    <div class="filled" style:background={desktop ? tint : undefined}>
      {#if desktop}<button
          type="button"
          class="meal"
          {disabled}
          aria-label={`Dodaj przepis: ${label}`}
          onclick={onadd}>{label}</button
        >{/if}
      <button
        class="open"
        type="button"
        aria-label={`Otwórz przepis: ${recipe.title}`}
        onclick={() => {
          if (recipe) navigate(`/przepis/${recipe.id}`);
        }}
      >
        {#if !desktop}<RecipeThumbnail {recipe} size={64} />{/if}<span
          class="text"
          ><strong>{recipe.title}</strong>{#if !desktop}<small
              >{recipeMeta(recipe, products)}</small
            >{/if}</span
        >
      </button>
      <div class="footer">
        {#if desktop}<small
            >{nutrition === null
              ? ''
              : `${formatNumber(nutrition.kcal)} kcal`}</small
          >{/if}<button
          type="button"
          class="remove"
          {disabled}
          aria-label={`Usuń z planera: ${recipe.title}`}
          onclick={onremove}>×</button
        >
      </div>
    </div>
  {:else}<button
      class="empty"
      type="button"
      {disabled}
      aria-label={`Dodaj przepis: ${label}`}
      onclick={onadd}
      ><span aria-hidden="true">+</span>{desktop
        ? label
        : 'Dodaj przepis'}</button
    >{/if}
</div>

<style>
  .slot {
    min-width: 0;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h3 button {
    text-transform: inherit;
    letter-spacing: inherit;
    font-weight: inherit;
    min-height: 44px;
  }
  .filled {
    display: flex;
    align-items: center;
    background: var(--white);
    border-radius: 16px;
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
    overflow: hidden;
  }
  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0 10px 10px;
    text-align: left;
  }
  .text {
    display: block;
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.25;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    display: block;
    margin-top: 4px;
    font-size: 13px;
    color: var(--muted);
  }
  .remove {
    width: 48px;
    height: 64px;
    flex: none;
    font-size: 26px;
    color: var(--muted);
  }
  .empty {
    width: 100%;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 1.5px dashed rgba(20, 32, 26, 0.4);
    border-radius: 16px;
    color: var(--accent);
    font-weight: 700;
  }
  .empty span {
    font-size: 24px;
  }
  .desktop .empty,
  .desktop .filled {
    height: 148px;
    border-radius: 14px;
  }
  .desktop .empty {
    flex-direction: column;
    font-size: 13px;
    gap: 6px;
  }
  .desktop .filled {
    flex-direction: column;
    align-items: stretch;
    box-shadow: none;
  }
  .meal {
    padding: 10px 10px 0;
    text-align: left;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.03em;
    min-height: 44px;
  }
  .desktop .open {
    padding: 4px 10px 0;
    display: block;
    min-height: 0;
  }
  .desktop strong {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    white-space: normal;
    font-size: 14px;
  }
  .desktop .footer {
    flex: none;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 10px;
  }
  .desktop .remove {
    width: 44px;
    height: 44px;
  }
  .desktop small {
    color: var(--text);
    margin: 0;
  }
  button:disabled {
    opacity: 0.6;
  }
</style>
