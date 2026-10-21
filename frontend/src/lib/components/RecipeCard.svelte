<script lang="ts">
  import { fileUrl, type Recipe } from '../api';
  import type { Product } from '../domain/nutrition';
  import { paletteForRecipe, recipeMeta } from '../recipeCards';

  let {
    recipe,
    products,
    desktop,
    selected = false,
    onselect,
  }: {
    recipe: Recipe;
    products: readonly Product[];
    desktop: boolean;
    selected?: boolean;
    onselect: () => void;
  } = $props();
  let failedSource = $state<string | null>(null);
  const colors = $derived(paletteForRecipe(recipe.id));
  const image = $derived(fileUrl(recipe.photo));
  const meta = $derived(recipeMeta(recipe, products));
  const source = $derived(
    recipe.source_type === 'pdf'
      ? 'PDF'
      : recipe.source_type === 'link'
        ? recipe.source_platform === 'instagram'
          ? 'Instagram'
          : recipe.source_platform === 'facebook'
            ? 'Facebook'
            : null
        : null,
  );
</script>

<button
  class:desktop
  class:selected={desktop && selected}
  aria-label={`${desktop ? 'Pokaż' : 'Otwórz'} przepis: ${recipe.title}`}
  aria-pressed={desktop ? selected : undefined}
  onclick={onselect}
>
  <span class="cover" style:--tint={colors.tint} style:--ink={colors.ink}>
    {#if image && image !== failedSource}
      <img
        src={image}
        alt=""
        loading="lazy"
        onerror={() => {
          failedSource = image;
        }}
      />
    {:else}
      <svg class="plate" viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          opacity="0.5"
        />
        <circle
          cx="50"
          cy="50"
          r="27"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          opacity="0.35"
        />
        <path
          d="M36 52c0-9 8-17 17-15 9 2 14 10 11 18-3 8-12 11-20 9-5-1-8-6-8-12z"
          fill="currentColor"
          opacity="0.4"
        />
      </svg>
    {/if}
    {#if source}<span class="source">{source}</span>{/if}
    {#if recipe.video}
      <span class="video" aria-label="Z wideo">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"
          ><path d="M8 5v14l11-7z" fill="currentColor" /></svg
        >
      </span>
    {/if}
  </span>
  <span class="content">
    <span class="title">{recipe.title}</span>
    {#if meta}<span class="meta">{meta}</span>{/if}
  </span>
</button>

<style>
  button {
    display: block;
    min-width: 0;
    background: var(--white);
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
  }
  button.selected {
    box-shadow: 0 0 0 2px var(--accent);
  }
  .cover {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 118px;
    background: var(--tint);
    color: var(--ink);
  }
  .plate {
    width: 76px;
    height: 76px;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .source {
    position: absolute;
    left: 8px;
    top: 8px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--white);
    color: var(--text);
    font-size: 12px;
    font-weight: 500;
    line-height: 18px;
  }
  .video {
    position: absolute;
    right: 8px;
    bottom: 8px;
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: var(--text);
    color: var(--white);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .content {
    display: block;
    padding: 10px 12px 12px;
  }
  .title {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    font-weight: 700;
    font-size: 15px;
    line-height: 1.25;
  }
  .meta {
    display: block;
    margin-top: 6px;
    font-size: 13px;
    color: var(--muted);
  }
  .desktop .cover {
    height: 128px;
  }
  .desktop .plate {
    width: 84px;
    height: 84px;
  }
  .desktop .content {
    padding: 12px 14px 14px;
  }
</style>
