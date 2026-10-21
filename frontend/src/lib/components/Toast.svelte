<script lang="ts">
  import { toast } from '../toast';

  $effect(() => {
    const current = $toast;
    if (!current) return;
    const timer = setTimeout(() => toast.set(null), 2400);
    return () => clearTimeout(timer);
  });
</script>

{#if $toast}
  <div role="status">{$toast.message}</div>
{/if}

<style>
  div {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: 92px;
    padding: 14px 16px;
    border-radius: 14px;
    background: var(--text);
    color: var(--white);
    font-size: 14px;
    box-shadow: 0 4px 16px rgba(20, 32, 26, 0.3);
  }
  @media (min-width: 1024px) {
    div {
      left: 50%;
      right: auto;
      bottom: 32px;
      margin-left: -200px;
      width: 400px;
      padding: 14px 18px;
      text-align: center;
    }
  }
</style>
