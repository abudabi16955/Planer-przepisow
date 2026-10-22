<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { getRecipes, ApiError, type Recipe } from '../api';
  import { getPlan, setPlanEntry } from '../planApi';
  import type { PlanEntry } from '../domain/day';
  import { today, startOfWeek } from '../domain/week';
  import { modalFocus } from '../modal';
  import { showToast } from '../toast';
  import PlanTargetFields from './PlanTargetFields.svelte';
  import Icon from './Icon.svelte';
  let {
    recipe,
    desktop = false,
    now,
  }: { recipe: Recipe; desktop?: boolean; now?: Date } = $props();
  const initialSlot = (category: Recipe['category']) =>
    ({ sniadanie: 0, obiad: 1, kolacja: 2 })[category] as 0 | 1 | 2;
  let opened = $state(false),
    loading = $state(false),
    saving = $state(false),
    error = $state('');
  let date = $state(untrack(() => today(now ?? new Date())));
  let week = $state(untrack(() => startOfWeek(date)));
  let slot = $state<0 | 1 | 2>(untrack(() => initialSlot(recipe.category)));
  let entries = $state<PlanEntry[]>([]);
  let recipes = $state<Recipe[]>([]);
  let controller: AbortController | undefined;
  const existing = $derived(
    entries.find((entry) => entry.date === date && entry.slot === slot),
  );
  const title = $derived(
    existing?.recipe_id === recipe.id
      ? recipe.title
      : recipes.find((item) => item.id === existing?.recipe_id)?.title,
  );
  const note = $derived(
    existing ? `Zastąpi: ${title ?? '…'}` : 'To miejsce w planerze jest wolne.',
  );
  function close() {
    if (saving) return;
    opened = false;
    controller?.abort();
  }
  async function load() {
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    loading = true;
    error = '';
    try {
      const [plan, list] = await Promise.all([
        getPlan(week, signal),
        getRecipes(signal),
      ]);
      if (!signal.aborted) {
        entries = plan;
        recipes = list;
      }
    } catch {
      if (!signal.aborted) error = 'Brak połączenia z serwerem.';
    } finally {
      if (!signal.aborted) loading = false;
    }
  }
  function toggle() {
    if (opened) {
      close();
      return;
    }
    date = today(now ?? new Date());
    week = startOfWeek(date);
    slot = initialSlot(recipe.category);
    opened = true;
    entries = [];
    void load();
  }
  async function save() {
    if (loading || saving || error) return;
    saving = true;
    try {
      await setPlanEntry(date, slot, recipe.id);
      opened = false;
      showToast(`Dodano do planera: ${recipe.title}`);
    } catch (reason) {
      error =
        reason instanceof ApiError && reason.status === 404
          ? 'Przepis nie istnieje.'
          : 'Brak połączenia z serwerem.';
    } finally {
      saving = false;
    }
  }
  onDestroy(() => controller?.abort());
</script>

<div class="action" class:desktop>
  {#if desktop && opened}<section
      class="panel"
      aria-label="Dodaj do planera"
      aria-busy={loading}
    >
      <PlanTargetFields
        {week}
        bind:date
        bind:slot
        disabled={loading || saving}
      />
      {#if !loading && !error}<p>{note}</p>{/if}
      {#if error}<p role="alert">{error}</p>
        <button class="retry" disabled={saving} onclick={load}
          >Spróbuj ponownie</button
        >{/if}
      <button
        class="confirm"
        disabled={loading || saving || !!error}
        onclick={save}>Dodaj do wybranego dnia</button
      >
    </section>{/if}
  <button
    class="toggle"
    class:open={desktop && opened}
    aria-expanded={opened}
    disabled={saving}
    onclick={toggle}
    ><Icon kind="planner" size={20} />{desktop && opened
      ? 'Zamknij'
      : 'Dodaj do planera'}</button
  >
</div>
{#if opened && !desktop}<div class="overlay">
    <button
      class="backdrop"
      tabindex="-1"
      aria-label="Zamknij"
      disabled={saving}
      onclick={close}
    ></button>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Dodaj do planera"
      tabindex="-1"
      aria-busy={loading}
      use:modalFocus={{ close, locked: () => saving }}
    >
      <header>
        <div>
          <h2>Dodaj do planera</h2>
          <p>{recipe.title}</p>
        </div>
        <button aria-label="Zamknij" disabled={saving} onclick={close}>×</button
        >
      </header>
      <PlanTargetFields
        {week}
        bind:date
        bind:slot
        disabled={loading || saving}
      />
      {#if !loading && !error}<p class="note">{note}</p>{/if}
      {#if error}<p role="alert">{error}</p>
        <button class="retry" onclick={load}>Spróbuj ponownie</button>{/if}
      <button
        class="confirm"
        disabled={loading || saving || !!error}
        onclick={save}>Dodaj</button
      >
    </div>
  </div>{/if}

<style>
  .action {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 2;
    padding: 12px 16px 16px;
    background: var(--background);
    border-top: 1px solid var(--border);
  }
  .toggle {
    width: 100%;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border-radius: 16px;
    background: var(--accent);
    color: white;
    font-weight: 700;
    font-size: 16px;
  }
  .toggle.open {
    background: var(--gray);
    color: var(--text);
  }
  .desktop.action {
    position: static;
    flex: none;
    padding: 12px 24px 20px;
  }
  .panel {
    margin-bottom: 12px;
    padding: 14px;
    border-radius: 16px;
    background: var(--white);
    box-shadow: 0 0 0 1px var(--border);
  }
  .panel p,
  .note {
    margin: 12px 2px 0;
    font-size: 13px;
    color: var(--muted);
  }
  .confirm {
    width: 100%;
    height: 52px;
    margin-top: 12px;
    border-radius: 16px;
    background: var(--accent);
    color: white;
    font-weight: 700;
    font-size: 16px;
  }
  .panel .confirm {
    height: 48px;
    margin-top: 10px;
    border-radius: 14px;
    font-size: 15px;
  }
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
    width: 100%;
    background: rgba(20, 32, 26, 0.5);
  }
  .sheet {
    position: relative;
    width: 100%;
    max-height: 90dvh;
    overflow-y: auto;
    padding: 16px 16px 24px;
    border-radius: 24px 24px 0 0;
    background: var(--background);
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 20px;
  }
  header p {
    margin: 2px 0 0;
    font-size: 14px;
    color: var(--muted);
  }
  header > div {
    min-width: 0;
  }
  header button {
    flex: none;
    width: 44px;
    height: 44px;
    font-size: 28px;
  }
  [role='alert'] {
    color: var(--warning) !important;
    font-size: 14px;
  }
  .retry {
    min-height: 44px;
    color: var(--accent);
    font-weight: 700;
  }
  button:disabled {
    background: var(--disabled);
    color: var(--muted);
  }
</style>
