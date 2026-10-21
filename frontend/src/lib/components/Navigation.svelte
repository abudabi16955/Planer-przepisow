<script lang="ts">
  import { navigate, type Page } from '../router';
  import Icon from './Icon.svelte';

  let { desktop, page }: { desktop: boolean; page: Page } = $props();
  const links = [
    { page: 'recipes', path: '/', label: 'Przepisy', icon: 'recipes' },
    { page: 'planner', path: '/planer', label: 'Planer', icon: 'planner' },
    {
      page: 'shopping',
      path: '/zakupy',
      label: 'Lista zakupów',
      icon: 'shopping',
    },
  ] as const;
</script>

{#if desktop}
  <nav class="sidebar" aria-label="Nawigacja">
    <div class="brand">Planer przepisów</div>
    <div class="links">
      {#each links as link (link.page)}
        <button
          class:active={page === link.page ||
            (link.page === 'recipes' && page === 'recipe')}
          aria-current={page === link.page ||
          (link.page === 'recipes' && page === 'recipe')
            ? 'page'
            : undefined}
          onclick={() => navigate(link.path)}
        >
          <Icon kind={link.icon} size={22} />{link.label}
        </button>
      {/each}
    </div>
    <button
      class="add-desktop"
      aria-current={page === 'add' ? 'page' : undefined}
      onclick={() => navigate('/dodaj')}
    >
      <Icon kind="add" size={20} />Dodaj przepis
    </button>
  </nav>
{:else if page !== 'recipe'}
  <nav class="tabbar" aria-label="Nawigacja">
    <button
      class:active={page === 'recipes'}
      aria-label="Przepisy"
      aria-current={page === 'recipes' ? 'page' : undefined}
      onclick={() => navigate('/')}
    >
      <Icon kind="recipes" />Przepisy
    </button>
    <button
      class:active={page === 'add'}
      aria-label="Dodaj przepis"
      aria-current={page === 'add' ? 'page' : undefined}
      onclick={() => navigate('/dodaj')}
    >
      <span class="add-circle"><Icon kind="add" size={22} /></span>Dodaj
    </button>
    <button
      class:active={page === 'planner' || page === 'shopping'}
      aria-label="Planer"
      aria-current={page === 'planner' || page === 'shopping'
        ? 'page'
        : undefined}
      onclick={() => navigate('/planer')}
    >
      <Icon kind="planner" />Planer
    </button>
  </nav>
{/if}

<style>
  nav {
    background: var(--white);
    flex: none;
  }
  button {
    display: flex;
    align-items: center;
    font-weight: 500;
    color: var(--muted);
  }
  button.active {
    color: var(--accent);
  }
  .sidebar {
    width: 248px;
    height: 100dvh;
    position: sticky;
    top: 0;
    display: flex;
    flex-direction: column;
    padding: 24px 16px;
    border-right: 1px solid var(--border);
  }
  .brand {
    padding: 0 8px;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 22px;
    line-height: 1.2;
    letter-spacing: -0.01em;
  }
  .links {
    margin-top: 28px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .links button {
    height: 48px;
    gap: 12px;
    padding: 0 12px;
    border-radius: 12px;
  }
  .links button.active {
    background: var(--accent-light);
    color: var(--text);
  }
  .add-desktop {
    margin-top: auto;
    min-height: 48px;
    justify-content: center;
    gap: 8px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--white);
    font-weight: 700;
  }
  .tabbar {
    z-index: 2;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: flex-end;
    height: 76px;
    padding: 0 8px 8px;
    border-top: 1px solid var(--border);
  }
  .tabbar button {
    flex: 1;
    height: 60px;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    font-size: 12px;
  }
  .add-circle {
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: var(--accent);
    color: var(--white);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .active .add-circle {
    box-shadow: 0 0 0 3px var(--accent-light);
  }
</style>
