<script lang="ts">
  import { fileUrl, type Recipe } from '../api';
  import { paletteForRecipe } from '../recipeCards';
  let { recipe, size = 52 }: { recipe: Recipe; size?: number } = $props();
  let failed = $state<string | null>(null);
  const source = $derived(fileUrl(recipe.photo));
  const colors = $derived(paletteForRecipe(recipe.id));
</script>

<span
  class="thumb"
  style:width={`${size}px`}
  style:height={`${size}px`}
  style:background={colors.tint}
  style:color={colors.ink}
>
  {#if source && source !== failed}<img
      src={source}
      alt=""
      onerror={() => (failed = source)}
    />{:else}<svg
      viewBox="0 0 100 100"
      width="40"
      height="40"
      aria-hidden="true"
      ><circle
        cx="50"
        cy="50"
        r="40"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        opacity="0.5"
      /><circle
        cx="50"
        cy="50"
        r="27"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        opacity="0.35"
      /><path
        d="M36 52c0-9 8-17 17-15 9 2 14 10 11 18-3 8-12 11-20 9-5-1-8-6-8-12z"
        fill="currentColor"
        opacity="0.4"
      /></svg
    >{/if}
</span>

<style>
  .thumb {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    overflow: hidden;
  }
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  svg {
    max-width: 80%;
    max-height: 80%;
  }
</style>
