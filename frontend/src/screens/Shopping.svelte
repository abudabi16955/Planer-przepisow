<script lang="ts">
  import { onMount } from 'svelte';
  import {
    getRecipes,
    getProducts,
    type Recipe,
    type CatalogueProduct,
  } from '../lib/api';
  import { getPlan } from '../lib/planApi';
  import { getShoppingChecks, setShoppingCheck } from '../lib/shoppingApi';
  import {
    shoppingList,
    shoppingPresets,
    presetDays,
    activeShoppingPresets,
    type ShoppingPreset,
  } from '../lib/domain/shopping';
  import { weekMealCounts, type PlanEntry } from '../lib/domain/day';
  import {
    today,
    startOfWeek,
    weekDays,
    shiftWeek,
    formatWeekRange,
    parseISODate,
  } from '../lib/domain/week';
  import { formatQuantity, formatDayHeading } from '../lib/domain/format';
  import { navigate } from '../lib/router';

  let {
    desktop,
    week,
    now = new Date(),
  }: { desktop: boolean; week?: string; now?: Date } = $props();
  const weekStart = $derived.by(() => {
    try {
      return startOfWeek(week || today(now));
    } catch {
      return startOfWeek(today(now));
    }
  });
  const days = $derived(weekDays(weekStart));
  let selected = $derived(weekDays(weekStart));
  let recipes = $state<Recipe[]>([]);
  let products = $state<CatalogueProduct[]>([]);
  let entries = $state<PlanEntry[]>([]);
  let checks = $state<Record<string, boolean>>({});
  let pending = $state<string[]>([]);
  let loading = $state(true);
  let loadError = $state(false);
  let writeError = $state(false);
  let refresh = $state(0);
  const counts = $derived(weekMealCounts(weekStart, entries));
  const meals = $derived(
    selected.reduce((sum, day) => sum + (counts.days[day] || 0), 0),
  );
  const items = $derived(shoppingList(entries, selected, recipes, products));
  const purchased = $derived(items.filter((item) => checks[item.key]).length);
  const active = $derived(activeShoppingPresets(weekStart, selected, now));
  const letters = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  onMount(() => {
    const update = () => {
      if (!pending.length) refresh += 1;
    };
    window.addEventListener('focus', update);
    return () => window.removeEventListener('focus', update);
  });
  $effect(() => {
    const requestedWeek = weekStart;
    void refresh;
    const controller = new AbortController();
    loading = true;
    loadError = false;
    writeError = false;
    Promise.all([
      getRecipes(controller.signal),
      getProducts(controller.signal),
      getPlan(requestedWeek, controller.signal),
      getShoppingChecks(requestedWeek, controller.signal),
    ])
      .then(([list, catalog, plan, saved]) => {
        if (controller.signal.aborted) return;
        recipes = list;
        products = catalog;
        entries = plan;
        checks = Object.fromEntries(
          saved.map((check) => [check.item_key, check.checked]),
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) loadError = true;
      })
      .finally(() => {
        if (!controller.signal.aborted) loading = false;
      });
    return () => controller.abort();
  });
  function pick(preset: ShoppingPreset) {
    const result = presetDays(weekStart, preset, now);
    if (result) selected = result;
  }
  function toggleDay(day: string) {
    selected = selected.includes(day)
      ? selected.filter((value) => value !== day)
      : [...selected, day];
  }
  async function toggle(key: string) {
    const requestedWeek = weekStart;
    const token = `${requestedWeek}|${key}`;
    if (pending.includes(token) || loading) return;
    pending = [...pending, token];
    writeError = false;
    try {
      const result = await setShoppingCheck(requestedWeek, key, !checks[key]);
      if (requestedWeek === weekStart)
        checks = { ...checks, [key]: result.checked };
    } catch {
      if (requestedWeek === weekStart) writeError = true;
    } finally {
      pending = pending.filter((value) => value !== token);
    }
  }
</script>

<section class="shopping" class:desktop aria-busy={loading}>
  {#if !desktop}<button
      class="back"
      aria-label="Wróć do planera"
      onclick={() => navigate(`/planer?week=${weekStart}`)}>‹</button
    >{/if}
  <h1>Lista zakupów</h1>
  <header>
    <p>
      {formatWeekRange(weekStart)} · Pozycje: {loading || loadError
        ? '—'
        : items.length} · Posiłki: {loading || loadError ? '—' : meals}
    </p>
    <div class="week-controls">
      <button
        aria-label="Poprzedni tydzień"
        onclick={() => navigate(`/zakupy?week=${shiftWeek(weekStart, -1)}`)}
        >‹</button
      >
      <button
        aria-label="Następny tydzień"
        onclick={() => navigate(`/zakupy?week=${shiftWeek(weekStart, 1)}`)}
        >›</button
      >
    </div>
  </header>
  {#if loadError || writeError}<p role="alert">
      Brak połączenia z serwerem.
    </p>{/if}
  {#if loadError}<button class="retry" onclick={() => (refresh += 1)}
      >Spróbuj ponownie</button
    >{/if}
  <div class="layout">
    <div class="controls">
      <div class="card selection">
        <h2>Na które dni kupujesz?</h2>
        <div class="presets">
          {#each shoppingPresets as preset (preset)}<button
              disabled={presetDays(weekStart, preset, now) === null}
              aria-pressed={active.includes(preset)}
              onclick={() => pick(preset)}><span>{preset}</span></button
            >{/each}
        </div>
        <div class="days">
          {#each days as day, index (day)}<button
              aria-label={`${formatDayHeading(day)}, zaplanowane posiłki: ${loading || loadError ? '—' : counts.days[day]}`}
              aria-pressed={selected.includes(day)}
              onclick={() => toggleDay(day)}
            >
              <span>{letters[index]}</span><strong
                >{parseISODate(day).getUTCDate()}</strong
              ><span>{loading || loadError ? '—' : counts.days[day]}</span>
            </button>{/each}
        </div>
        <p class="hint">
          Cyfra pod datą to liczba zaplanowanych posiłków tego dnia.
        </p>
      </div>
      {#if !loading && !loadError && items.length}
        <div class="progress" class:card={desktop}>
          <strong>Kupione: {purchased} z {items.length}</strong>
          <div
            role="progressbar"
            aria-label="Kupione"
            aria-valuemin="0"
            aria-valuemax={items.length}
            aria-valuenow={purchased}
            class="track"
          >
            <span style:width={`${(purchased / items.length) * 100}%`}></span>
          </div>
          {#if desktop}<p class="rules">
              Ilości są zsumowane ze wszystkich wybranych posiłków, po 1 porcji
              każdy. Sztuki zaokrąglone w górę. Ten sam produkt w różnych
              jednostkach jest w osobnych wierszach.
            </p>{/if}
        </div>
      {/if}
    </div>
    <div class="results">
      {#if !loading && !loadError}
        {#if !selected.length}<p class="card empty">
            Wybierz co najmniej jeden dzień.
          </p>
        {:else if !items.length}<p class="card empty">
            W wybranych dniach nie ma zaplanowanych posiłków.
          </p>
        {:else}
          <div class="card rows">
            {#each items as item (item.key)}
              <button
                class:checked={checks[item.key]}
                aria-label={`${item.name}, ${formatQuantity(item.quantity, item.unit)}`}
                aria-pressed={!!checks[item.key]}
                disabled={pending.includes(`${weekStart}|${item.key}`)}
                onclick={() => toggle(item.key)}
              >
                <span class="check" aria-hidden="true"
                  >{checks[item.key] ? '✓' : ''}</span
                ><span class="name">{item.name}</span><strong
                  >{formatQuantity(item.quantity, item.unit)}</strong
                >
              </button>
            {/each}
          </div>
          {#if !desktop}<p class="rules">
              Ilości są zsumowane ze wszystkich zaplanowanych posiłków, po 1
              porcji każdy. Sztuki zaokrąglone w górę. Ten sam produkt w różnych
              jednostkach jest w osobnych wierszach.
            </p>{/if}
        {/if}
      {/if}
    </div>
  </div>
</section>

<style>
  .shopping {
    padding: 12px 16px 104px;
  }
  h1 {
    margin: 4px 0 0;
    font-size: 32px;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 8px;
  }
  header p {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--muted);
  }
  .back,
  .week-controls button {
    width: 44px;
    height: 44px;
    border-radius: 22px;
    font-size: 28px;
  }
  .back {
    margin-left: -8px;
  }
  .week-controls {
    display: flex;
    gap: 8px;
    margin-left: auto;
  }
  .week-controls button {
    background: var(--white);
  }
  .layout {
    margin-top: 16px;
  }
  .card {
    background: var(--white);
    border-radius: 18px;
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
  }
  .selection {
    padding: 12px 12px 8px;
  }
  h2 {
    margin: 0 4px;
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: 700;
  }
  .presets {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin: 4px -12px 0;
    padding: 0 12px;
  }
  .presets button {
    flex: none;
    height: 44px;
    display: flex;
    align-items: center;
  }
  .presets span {
    height: 36px;
    line-height: 34px;
    padding: 0 14px;
    border-radius: 18px;
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--white);
    border: 1px solid var(--border);
  }
  .presets button[aria-pressed='true'] span {
    background: var(--accent);
    color: var(--white);
    border-color: var(--accent);
  }
  button:disabled {
    opacity: 0.5;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
    margin-top: 4px;
  }
  .days button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 8px 0;
    border-radius: 12px;
    border: 1px solid var(--border);
    background: var(--white);
  }
  .days span {
    font-size: 12px;
    color: var(--muted);
  }
  .days strong {
    font-size: 16px;
  }
  .days [aria-pressed='true'] {
    background: var(--accent);
    color: var(--white);
  }
  .days [aria-pressed='true'] span {
    color: rgba(255, 255, 255, 0.85);
  }
  .hint {
    margin: 8px 4px 4px;
    font-size: 12px;
    color: var(--muted);
  }
  .progress {
    margin-top: 16px;
    font-size: 14px;
  }
  .track {
    height: 8px;
    margin-top: 8px;
    border-radius: 4px;
    background: var(--gray);
    overflow: hidden;
  }
  .track span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 4px;
  }
  .results {
    margin-top: 16px;
    min-width: 0;
  }
  .rows {
    overflow: hidden;
    display: grid;
  }
  .rows button {
    width: 100%;
    min-width: 0;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(20, 32, 26, 0.08);
    font-size: 15px;
    text-align: left;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .rows strong {
    flex: none;
  }
  .check {
    flex: none;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    border: 2px solid #8a9a8f;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .checked .check {
    background: var(--accent);
    color: var(--white);
    border-color: var(--accent);
  }
  .checked .name {
    text-decoration: line-through;
  }
  .checked .name,
  .checked strong {
    color: var(--muted);
  }
  .rules {
    margin: 10px 4px 0;
    font-size: 13px;
    color: var(--muted);
  }
  .empty {
    margin: 0;
    padding: 24px 16px;
    text-align: center;
    color: var(--muted);
  }
  [role='alert'] {
    color: var(--warning);
  }
  .retry {
    min-height: 44px;
  }
  .desktop {
    padding: 32px;
  }
  .desktop h1 {
    font-size: 34px;
    margin: 0;
  }
  .desktop .layout {
    display: flex;
    align-items: flex-start;
    gap: 24px;
    margin-top: 24px;
  }
  .desktop .controls {
    flex: none;
    width: 380px;
  }
  .desktop .selection {
    padding: 16px 16px 12px;
  }
  .desktop h2 {
    font-size: 15px;
    margin: 0;
  }
  .desktop .presets {
    flex-wrap: wrap;
    margin: 4px 0 0;
    padding: 0;
  }
  .desktop .progress {
    padding: 16px;
    font-size: 15px;
  }
  .desktop .rules {
    margin-left: 0;
    margin-right: 0;
  }
  .desktop .results {
    flex: 1;
    margin-top: 0;
  }
  .desktop .rows {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .desktop .rows button {
    min-height: 56px;
  }
  .desktop .empty {
    padding: 32px 16px;
  }
</style>
