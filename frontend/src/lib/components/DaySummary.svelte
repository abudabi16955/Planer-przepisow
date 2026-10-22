<script lang="ts">
  import { onMount } from 'svelte';
  import {
    summarizeDay,
    type DailyGoal,
    type PlanEntry,
    type PlannedRecipe,
  } from '../domain/day';
  import type { Product } from '../domain/nutrition';
  import { getGoal, putGoal } from '../goalApi';
  import { modalFocus } from '../modal';
  import GoalFields from './GoalFields.svelte';
  let {
    date,
    entries,
    recipes,
    products,
    desktop = false,
  }: {
    date: string;
    entries: readonly PlanEntry[];
    recipes: readonly PlannedRecipe[];
    products: readonly Product[];
    desktop?: boolean;
  } = $props();
  let goal = $state<DailyGoal | null>(null);
  let values = $state<Record<keyof DailyGoal, string>>({
    kcal: '',
    protein: '',
    carbs: '',
    fat: '',
  });
  let editing = $state(false);
  let loading = $state(true);
  let loadError = $state(false);
  let saveError = $state(false);
  let saving = $state(false);
  let revision = 0,
    savedRevision = 0;
  const summary = $derived(
    goal ? summarizeDay(date, entries, recipes, products, goal) : null,
  );
  const colors = {
    kcal: '#1C6B47',
    protein: '#14201A',
    carbs: '#3F8F68',
    fat: '#A9D1BB',
  };
  async function load(signal?: AbortSignal) {
    loading = true;
    loadError = false;
    try {
      const result = await getGoal(signal);
      if (!signal?.aborted) {
        goal = result;
        values = {
          kcal: String(result.kcal),
          protein: String(result.protein),
          carbs: String(result.carbs),
          fat: String(result.fat),
        };
      }
    } catch {
      if (!signal?.aborted) loadError = true;
    } finally {
      if (!signal?.aborted) loading = false;
    }
  }
  onMount(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  });
  async function persist() {
    if (saving || !goal) return;
    saving = true;
    saveError = false;
    try {
      while (savedRevision < revision) {
        const current = revision;
        const snapshot = { ...goal };
        await putGoal(snapshot);
        savedRevision = current;
      }
    } catch {
      saveError = true;
    } finally {
      saving = false;
    }
  }
  function change(key: keyof DailyGoal, value: string) {
    if (!goal) return;
    values = { ...values, [key]: value };
    const number = Number(value.replace(',', '.'));
    const normalized = Number.isFinite(number) && number >= 0 ? number : 0;
    goal = { ...goal, [key]: normalized };
    revision++;
    void persist();
  }
  function done() {
    if (saving) return;
    if (saveError) {
      void persist();
      return;
    }
    editing = false;
  }
</script>

<section
  class="summary"
  class:desktop
  aria-label="Podsumowanie dnia"
  aria-busy={loading}
>
  {#if loadError}<p role="alert">Brak połączenia z serwerem.</p>
    <button class="edit" onclick={() => load()}>Spróbuj ponownie</button>{/if}
  {#if summary}
    {#each summary.rows as row (row.key)}<div
        class="row"
        role="group"
        aria-label={row.label}
      >
        <div class="row-top">
          <strong
            ><span class="dot" style:background={colors[row.key]}
            ></span>{row.label}</strong
          ><span><b>{row.eatenText}</b> / <span>{row.goalText}</span></span>
        </div>
        <div
          class="bar"
          role="progressbar"
          aria-label={row.label}
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={row.progress}
        >
          <span
            style:width={`${row.progress}%`}
            style:background={colors[row.key]}
          ></span>
        </div>
        <p class:over={row.state === 'exceeded'}>{row.message}</p>
      </div>{/each}
    {#if summary.proportions}<div class="proportions">
        <strong>Proporcje z kalorii</strong>
        <div
          class="shares"
          role="img"
          aria-label={summary.dayShareText ?? undefined}
        >
          {#each ['protein', 'carbs', 'fat'] as key (key)}<span
              style:width={`${summary.proportions[key as 'protein' | 'carbs' | 'fat']}%`}
              style:background={colors[key as 'protein' | 'carbs' | 'fat']}
            ></span>{/each}
        </div>
        <p>{summary.dayShareText}</p>
        <p class="muted">{summary.goalShareText}</p>
      </div>{/if}
    <p class="caption">Suma z zaplanowanych posiłków, po 1 porcji każdy.</p>
    {#if saveError && (!editing || desktop)}<p role="alert">
        Brak połączenia z serwerem.
      </p>
      <button class="edit" onclick={persist}>Spróbuj ponownie</button>{/if}
    <button
      class="edit"
      aria-expanded={editing}
      onclick={() => (editing = !editing)}
      >{desktop
        ? editing
          ? 'Ukryj edycję celu'
          : 'Zmień cel dzienny'
        : 'Zmień cel'}</button
    >
    {#if desktop && editing}<div class="editor">
        <p>Wartości przykładowe. Wpisz własne, np. od dietetyka.</p>
        <GoalFields {values} onchange={change} />
      </div>{/if}
  {/if}
</section>
{#if editing && !desktop}
  <div class="overlay">
    <button
      class="backdrop"
      tabindex="-1"
      aria-label="Zamknij"
      disabled={saving}
      onclick={done}
    ></button>
    <div
      class="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Dzienne zapotrzebowanie"
      tabindex="-1"
      use:modalFocus={{ close: done, locked: () => saving }}
    >
      <header>
        <h2>Dzienne zapotrzebowanie</h2>
        <button aria-label="Zamknij" disabled={saving} onclick={done}>×</button>
      </header>
      <p>
        Wartości przykładowe. Wpisz własne, np. od dietetyka. Zmiany działają od
        razu.
      </p>
      <GoalFields {values} onchange={change} />
      {#if saveError}<p role="alert">Brak połączenia z serwerem.</p>{/if}
      <button class="done" disabled={saving} onclick={done}>Gotowe</button>
    </div>
  </div>
{/if}

<style>
  .summary {
    margin-top: 16px;
    padding: 4px 16px 16px;
    border-radius: 18px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
  }
  .row {
    margin-top: 12px;
  }
  .row-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    font-size: 14px;
  }
  .row-top > strong {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .dot {
    width: 10px;
    height: 10px;
    display: block;
    flex: none;
    border-radius: 3px;
  }
  .bar {
    height: 8px;
    margin-top: 6px;
    border-radius: 4px;
    background: var(--gray);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 8px;
    border-radius: 4px;
  }
  .row p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--muted);
    font-weight: 500;
  }
  .row .over,
  [role='alert'] {
    color: var(--warning);
  }
  .proportions {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--border);
    font-size: 14px;
  }
  .shares {
    display: flex;
    height: 10px;
    margin-top: 8px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--gray);
  }
  .proportions p {
    font-size: 13px;
    margin: 6px 0 0;
  }
  .proportions .muted {
    color: var(--muted);
    margin-top: 2px;
  }
  .caption {
    font-size: 12px;
    color: var(--muted);
    margin: 16px 0 0;
  }
  .edit {
    min-height: 44px;
    color: var(--accent);
    font-weight: 700;
    font-size: 14px;
    text-align: left;
  }
  .editor {
    margin-top: 4px;
    padding: 12px;
    border-radius: 14px;
    background: var(--background);
  }
  .editor p {
    margin: 0 0 8px;
    font-size: 13px;
    color: var(--muted);
  }
  .desktop.summary {
    margin: 0;
    padding: 0;
    background: none;
    box-shadow: none;
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
    background: rgba(20, 32, 26, 0.5);
    width: 100%;
  }
  .sheet {
    position: relative;
    width: 100%;
    max-height: 90dvh;
    overflow: auto;
    padding: 16px 16px 24px;
    border-radius: 24px 24px 0 0;
    background: var(--background);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  h2 {
    font-family: var(--font-heading);
    font-size: 20px;
    margin: 0;
  }
  header button {
    width: 44px;
    height: 44px;
    flex: none;
    font-size: 28px;
  }
  .sheet > p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  .done {
    width: 100%;
    height: 52px;
    margin-top: 16px;
    border-radius: 16px;
    background: var(--accent);
    color: white;
    font-weight: 700;
    font-size: 16px;
  }
  .done:disabled {
    background: var(--disabled);
    color: var(--muted);
  }
</style>
