<script lang="ts">
  let {
    kind,
    size = 24,
  }: { kind: 'recipes' | 'planner' | 'shopping' | 'add'; size?: number } =
    $props();
</script>

<svg
  viewBox="0 0 24 24"
  width={size}
  height={size}
  fill="none"
  stroke="currentColor"
  stroke-width={kind === 'add' ? 2.2 : 1.9}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if kind === 'recipes'}
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="7" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
    <rect x="13" y="13" width="7" height="7" rx="1.5" />
  {:else if kind === 'planner'}
    <rect x="4" y="5" width="16" height="15" rx="2" />
    <path d="M4 10h16M9 3v4M15 3v4" />
  {:else if kind === 'shopping'}
    <path d="M3 4h2.5l2 11h10l2-8H7" />
    <circle cx="9.5" cy="19.5" r="1.3" /><circle cx="17" cy="19.5" r="1.3" />
  {:else}
    <path d="M12 5v14M5 12h14" />
  {/if}
</svg>
