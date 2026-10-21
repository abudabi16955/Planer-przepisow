<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    getRecipes,
    getProducts,
    type Recipe,
    type CatalogueProduct,
  } from '../lib/api';
  import { getPlan, setPlanEntry, removePlanEntry } from '../lib/planApi';
  import type { PlanEntry } from '../lib/domain/day';
  import { weekMealCounts } from '../lib/domain/day';
  import {
    today,
    startOfWeek,
    weekDays,
    shiftWeek,
    parseISODate,
  } from '../lib/domain/week';
  import { formatDayHeading } from '../lib/domain/format';
  import { formatWeekRange } from '../lib/domain/week';
  import { paletteForRecipe } from '../lib/recipeCards';
  import { navigate } from '../lib/router';
  import { showToast } from '../lib/toast';
  import PlanSlot from '../lib/components/PlanSlot.svelte';
  import RecipePicker from '../lib/components/RecipePicker.svelte';
  let {
    desktop,
    week,
    now = new Date(),
  }: { desktop: boolean; week?: string; now?: Date } = $props();
  const currentDate = $derived(today(now));
  const weekStart = $derived.by(() => {
    try {
      return startOfWeek(week || currentDate);
    } catch {
      return startOfWeek(currentDate);
    }
  });
  const days = $derived(weekDays(weekStart));
  let selectedDay = $state(untrack(() => today(now)));
  let recipes = $state<Recipe[]>([]);
  let products = $state<CatalogueProduct[]>([]);
  let entries = $state<PlanEntry[]>([]);
  let catalogLoading = $state(true);
  let planLoading = $state(true);
  let catalogError = $state(false);
  let planError = $state(false);
  let writeError = $state(false);
  let pendingKey = $state<string | null>(null);
  let choosing = $state<{ date: string; slot: 0 | 1 | 2 } | null>(null);
  const counts = $derived(weekMealCounts(weekStart, entries));
  const ready = $derived(
    !catalogLoading &&
      !planLoading &&
      !catalogError &&
      !planError &&
      !pendingKey,
  );
  const labels = ['Śniadanie', 'Obiad', 'Kolacja'];
  const shortDays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  const slots = [0, 1, 2] as const;
  function assigned(day: string, slot: 0 | 1 | 2) {
    const id = entries.find(
      (entry) => entry.date === day && entry.slot === slot,
    )?.recipe_id;
    return recipes.find((recipe) => recipe.id === id);
  }
  function choose(day: string, slot: 0 | 1 | 2) {
    if (!ready) return;
    writeError = false;
    choosing = { date: day, slot };
  }
  function shift(direction: number) {
    navigate(`/planer?week=${shiftWeek(weekStart, direction)}`);
  }
  onMount(() => {
    const controller = new AbortController();
    Promise.all([getRecipes(controller.signal), getProducts(controller.signal)])
      .then(([list, catalog]) => {
        if (!controller.signal.aborted) {
          recipes = list;
          products = catalog;
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) catalogError = true;
      })
      .finally(() => {
        if (!controller.signal.aborted) catalogLoading = false;
      });
    return () => controller.abort();
  });
  $effect(() => {
    const requestedWeek = weekStart;
    selectedDay = weekDays(requestedWeek).includes(currentDate)
      ? currentDate
      : requestedWeek;
    choosing = null;
    entries = [];
    planLoading = true;
    planError = false;
    writeError = false;
    const controller = new AbortController();
    getPlan(requestedWeek, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) entries = result;
      })
      .catch(() => {
        if (!controller.signal.aborted) planError = true;
      })
      .finally(() => {
        if (!controller.signal.aborted) planLoading = false;
      });
    return () => controller.abort();
  });
  async function assign(recipe: Recipe) {
    const target = choosing;
    if (!target) return;
    const entry = await setPlanEntry(target.date, target.slot, recipe.id);
    if (startOfWeek(entry.date) === weekStart)
      entries = [
        ...entries.filter(
          (old) => old.date !== entry.date || old.slot !== entry.slot,
        ),
        entry,
      ];
    choosing = null;
    showToast(`Dodano do planera: ${recipe.title}`);
  }
  async function remove(day: string, slot: 0 | 1 | 2) {
    if (!ready) return;
    pendingKey = `${day}:${slot}`;
    writeError = false;
    try {
      await removePlanEntry(day, slot);
      entries = entries.filter(
        (entry) => entry.date !== day || entry.slot !== slot,
      );
    } catch {
      writeError = true;
    } finally {
      pendingKey = null;
    }
  }
</script>

<div class="planner" class:desktop aria-busy={catalogLoading || planLoading}>
  <section class="content">
    <header>
      <div>
        <h1>Planer</h1>
        <p>{formatWeekRange(weekStart)} · {counts.caption}</p>
      </div>
      {#if desktop}<button
          class="shopping"
          disabled={!ready || !counts.total}
          onclick={() => navigate(`/zakupy?week=${weekStart}`)}
          ><strong>Lista zakupów</strong>{#if !counts.total}<small
              >Najpierw zaplanuj posiłki</small
            >{/if}</button
        >{/if}
    </header>
    <div class="week-controls">
      <button aria-label="Poprzedni tydzień" onclick={() => shift(-1)}>‹</button
      ><button aria-label="Następny tydzień" onclick={() => shift(1)}>›</button>
    </div>
    {#if catalogError || planError || writeError}<p role="alert">
        Brak połączenia z serwerem.
      </p>{/if}
    <div class="board">
      {#each days as day, index (day)}
        <div class="day" role="group" aria-label={formatDayHeading(day)}>
          <button
            class="day-header"
            class:selected={selectedDay === day}
            aria-label={formatDayHeading(day).replace(',', '')}
            aria-pressed={selectedDay === day}
            onclick={() => (selectedDay = day)}
          >
            <span
              >{desktop
                ? formatDayHeading(day).split(',')[0]
                : shortDays[index]}</span
            ><strong>{parseISODate(day).getUTCDate()}</strong>
            {#if !desktop}<span class="bars" aria-hidden="true"
                >{#each slots as slot (slot)}{@const recipe = assigned(
                    day,
                    slot,
                  )}<span
                    style:background={recipe
                      ? paletteForRecipe(recipe.id).tint
                      : selectedDay === day
                        ? 'rgba(255,255,255,.25)'
                        : undefined}
                  ></span>{/each}</span
              >{/if}
          </button>
          {#if desktop}{#each slots as slot (slot)}<PlanSlot
                label={labels[slot]}
                recipe={assigned(day, slot)}
                {products}
                desktop={true}
                disabled={!ready}
                onadd={() => choose(day, slot)}
                onremove={() => remove(day, slot)}
              />{/each}{/if}
        </div>
      {/each}
    </div>
    {#if !desktop}
      <p class="legend">Paski od góry: śniadanie, obiad, kolacja.</p>
      <button
        class="shopping"
        disabled={!ready || !counts.total}
        onclick={() => navigate(`/zakupy?week=${weekStart}`)}
        ><strong>Lista zakupów</strong><small
          >{counts.total
            ? `Wybierz dni · zaplanowane posiłki: ${counts.total}`
            : 'Najpierw zaplanuj posiłki'}</small
        ></button
      >
      <div class="day-title">
        <h2>{formatDayHeading(selectedDay)}</h2>
        {#if selectedDay === currentDate}<span class="today">Dziś</span>{/if}
      </div>
      <div class="summary-space"></div>
      <div class="mobile-slots">
        {#each slots as slot (slot)}<PlanSlot
            label={labels[slot]}
            recipe={assigned(selectedDay, slot)}
            {products}
            disabled={!ready}
            onadd={() => choose(selectedDay, slot)}
            onremove={() => remove(selectedDay, slot)}
          />{/each}
      </div>
    {/if}
  </section>
  {#if desktop}<aside aria-label="Podsumowanie dnia">
      <div class="day-title">
        <h2>{formatDayHeading(selectedDay)}</h2>
        {#if selectedDay === currentDate}<span class="today">Dziś</span>{/if}
      </div>
      <div class="summary-space"></div>
    </aside>{/if}
</div>
{#if choosing}<RecipePicker
    date={choosing.date}
    slot={choosing.slot}
    {recipes}
    {products}
    {desktop}
    replacedTitle={assigned(choosing.date, choosing.slot)?.title}
    onselect={assign}
    onclose={() => (choosing = null)}
  />{/if}

<style>
  .content {
    min-width: 0;
    padding: 24px 16px 104px;
  }
  h1 {
    margin: 0;
  }
  header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }
  header p {
    margin: 4px 0 0;
    font-size: 14px;
    color: var(--muted);
  }
  .week-controls {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin: 12px 0;
  }
  .week-controls button {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--white);
    font-size: 28px;
  }
  .board {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 6px;
    align-items: start;
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .day-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 10px 0;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--white);
  }
  .day-header > span:first-child {
    font-size: 12px;
    color: var(--muted);
  }
  .day-header > strong {
    font-size: 17px;
  }
  .day-header.selected {
    background: var(--accent);
    color: var(--white);
  }
  .day-header.selected > span:first-child {
    color: rgba(255, 255, 255, 0.85);
  }
  .bars {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin-top: 2px;
  }
  .bars > span {
    display: block;
    width: 24px;
    height: 8px;
    border-radius: 4px;
    background: var(--gray);
  }
  .legend {
    margin: 8px 2px 0;
    font-size: 12px;
    color: var(--muted);
  }
  .shopping {
    width: 100%;
    min-height: 64px;
    margin-top: 16px;
    padding: 8px 16px;
    border-radius: 16px;
    background: var(--accent);
    color: var(--white);
    text-align: left;
  }
  .shopping strong {
    display: block;
    font-size: 16px;
  }
  .shopping small {
    display: block;
    margin-top: 2px;
    font-size: 13px;
    opacity: 0.9;
  }
  .shopping:disabled {
    background: var(--disabled);
    color: var(--muted);
  }
  .day-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 20px 0 12px;
  }
  .day-title h2 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: 22px;
    line-height: 1.2;
  }
  .today {
    flex: none;
    padding: 2px 10px;
    border-radius: 12px;
    background: var(--accent-light);
    font-size: 13px;
    font-weight: 700;
  }
  .mobile-slots {
    display: grid;
    gap: 16px;
  }
  [role='alert'] {
    color: var(--warning);
  }
  .desktop {
    display: flex;
    min-height: 100dvh;
  }
  .desktop .content {
    flex: 1;
    padding: 32px 24px 32px 32px;
    overflow-x: auto;
  }
  .desktop .shopping {
    width: auto;
    flex: none;
    margin: 0;
    min-height: 48px;
    padding: 0 18px;
    border-radius: 14px;
  }
  .desktop .day-header {
    height: 64px;
    padding: 0;
  }
  .desktop .day-header > span:first-child {
    font-size: 13px;
  }
  .desktop .day-header > strong {
    font-size: 20px;
  }
  .desktop aside {
    flex: none;
    width: 320px;
    padding: 32px 24px;
    border-left: 1px solid var(--border);
    background: var(--white);
  }
  .desktop aside .day-title {
    margin-top: 0;
  }
</style>
