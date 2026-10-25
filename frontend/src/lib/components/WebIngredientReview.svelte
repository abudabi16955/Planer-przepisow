<script lang="ts">
  import type { CatalogueProduct } from '../api';
  import {
    formatImportAmount,
    readyIngredient,
    type ReviewIngredient,
  } from '../webImport';
  import IngredientPicker from './IngredientPicker.svelte';
  let {
    rows = $bindable<ReviewIngredient[]>([]),
    products = $bindable<CatalogueProduct[]>([]),
  } = $props();
  const uid = $props.id();
  const activeRows = $derived(rows.filter((row) => !row.skipped));
  const approvedCount = $derived(activeRows.filter(readyIngredient).length);
  let amounts = $state<Record<number, string>>({});
  let editingProduct = $state<number | null>(null);
  let editing = $state<{ index: number; create: boolean } | null>(null);
  function accept(
    index: number,
    ingredient: { product_id: string; quantity: number | null; unit: string },
  ) {
    delete amounts[index];
    rows[index] = {
      ...rows[index],
      product_id: ingredient.product_id,
      qty: ingredient.quantity,
      unit: ingredient.unit || 'do smaku',
      unit_ok: true,
      confirmed: false,
    };
    editing = null;
  }
  function updateImportRowsForProduct(updated: CatalogueProduct) {
    rows = rows.map((row, i) => {
      if (row.product_id === updated.id && row.unit_ok === false) {
        if (updated.units.includes(row.unit) || row.unit === 'do smaku') {
          delete amounts[i];
          return {
            ...row,
            unit_ok: true,
          };
        }
        if (row.quantity_variants && row.quantity_variants.length > 0) {
          const match = row.quantity_variants.find(
            (v: { qty: number | null; unit: string }) =>
              updated.units.includes(v.unit),
          );
          if (match) {
            delete amounts[i];
            return {
              ...row,
              unit: match.unit,
              qty: match.qty,
              unit_ok: true,
            };
          }
        }
      }
      return row;
    });
  }
</script>

<section aria-label="Przegląd składników">
  <h2>Przegląd składników</h2>
  <p class="review-count" aria-live="polite">
    Zatwierdzone: {approvedCount} z {activeRows.length}
  </p>
  {#each rows as row, index (index)}
    {#if !row.skipped}
      {@const product = products.find((p) => p.id === row.product_id)}
      {@const approved = readyIngredient(row)}
      <div
        class="review-row"
        class:pending={!approved}
        class:approved
        role="group"
        aria-label={`Składnik ${index + 1}`}
        aria-describedby={`${uid}-state-${index}`}
      >
        <strong>{product?.name || row.name}</strong>
        <span
          id={`${uid}-state-${index}`}
          class="state"
          class:warning={!approved}
          class:accepted={approved}
          >{approved ? '✓ zatwierdzony' : 'sprawdź'}</span
        >
        <p class="raw">{row.raw}</p>
        {#if product}
          <button
            type="button"
            class="secondary-accent"
            aria-label={`Edytuj produkt: ${product.name}`}
            onclick={() => {
              editing = null;
              editingProduct = index;
            }}>Edytuj produkt</button
          >
          {#if row.unit !== 'do smaku'}<label
              >Ilość<input
                aria-label={`Ilość: ${product.name}`}
                inputmode="decimal"
                value={amounts[index] ?? formatImportAmount(row.qty)}
                oninput={(event) => {
                  amounts[index] = event.currentTarget.value;
                  const value = Number(
                    event.currentTarget.value.replace(',', '.'),
                  );
                  row.qty =
                    event.currentTarget.value.trim() &&
                    Number.isFinite(value) &&
                    value > 0
                      ? value
                      : null;
                }}
              /></label
            >{/if}
          <div class="chips" aria-label={`Jednostka: ${product.name}`}>
            {#each [...product.units, 'do smaku'] as unit (unit)}
              <button
                type="button"
                aria-label={`${unit}: ${product.name}`}
                aria-pressed={row.unit === unit && row.unit_ok === true}
                onclick={() => {
                  row.unit = unit;
                  row.unit_ok = true;
                }}>{unit}</button
              >
            {/each}
          </div>
          {#if !row.unit_ok}<p role="alert">Wybierz jednostkę produktu.</p>{/if}
          {#if approved}<button
              type="button"
              aria-label={`Cofnij zatwierdzenie: ${product.name}`}
              onclick={() => (row.confirmed = false)}
              >Cofnij zatwierdzenie</button
            >
          {:else}<button
              class="primary"
              type="button"
              aria-label={`Zatwierdź składnik: ${product.name}`}
              disabled={!readyIngredient({ ...row, confirmed: true })}
              onclick={() => (row.confirmed = true)}>Zatwierdź składnik</button
            >{/if}
          <button
            type="button"
            aria-label={`Wybierz produkt: ${product?.name || row.name}`}
            onclick={() => {
              editingProduct = null;
              editing = { index, create: false };
            }}>Wybierz produkt</button
          >
          <button
            type="button"
            aria-label={`Usuń składnik: ${product.name}`}
            onclick={() => (row.skipped = true)}>×</button
          >
        {:else}
          <button
            type="button"
            aria-label={`Wybierz produkt: ${product?.name || row.name}`}
            onclick={() => {
              editingProduct = null;
              editing = { index, create: false };
            }}>Wybierz produkt</button
          >
          <button
            type="button"
            class="secondary-accent"
            aria-label={`Dodaj „${row.name}” jako nowy produkt`}
            onclick={() => {
              editingProduct = null;
              editing = { index, create: true };
            }}>Dodaj „{row.name}” jako nowy produkt</button
          >
          <button
            type="button"
            aria-label={`Pomiń składnik: ${row.name}`}
            onclick={() => (row.skipped = true)}>Pomiń</button
          >
        {/if}
        {#if editingProduct === index && product}
          <IngredientPicker
            bind:products
            initialEdit={product}
            editorOnly
            onsave={(updated) => updateImportRowsForProduct(updated)}
            onclose={() => (editingProduct = null)}
          />
        {/if}
        {#if editing?.index === index}
          {#key editing}
            <IngredientPicker
              bind:products
              initialSearch={row.name}
              initialUnit={row.unit}
              initialAmount={formatImportAmount(row.qty)}
              initialQuantity={row.qty}
              initialCreate={editing.create}
              onselect={(ingredient) => accept(index, ingredient)}
            />
          {/key}
          <button
            type="button"
            aria-label={`Anuluj wybór: ${row.name}`}
            onclick={() => (editing = null)}>Anuluj wybór</button
          >
        {/if}
      </div>
    {/if}
  {/each}
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .review-count {
    margin: 0;
    color: var(--muted);
  }
  .review-row {
    background: var(--white);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border: 1px solid var(--border);
  }
  .review-row.pending {
    border-left: 4px solid var(--warning);
  }
  .review-row.approved {
    border-left: 4px solid var(--accent);
  }
  .state {
    font-size: 13px;
    font-weight: 600;
  }
  .state.warning {
    color: var(--warning);
  }
  .state.accepted {
    color: var(--accent);
  }
  .raw {
    margin: 0;
    color: var(--muted);
    font-style: italic;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .chips button {
    padding: 6px 12px;
    border-radius: 999px;
    background: var(--gray);
    font-size: 13px;
  }
  .chips button[aria-pressed='true'] {
    background: var(--accent);
    color: white;
  }
  label {
    font-weight: 600;
  }
  input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-top: 4px;
    font: inherit;
  }
  .primary {
    background: var(--accent);
    color: white;
    padding: 12px;
    border-radius: 12px;
    font-weight: 700;
  }
  .primary:disabled {
    background: var(--disabled);
    color: var(--muted);
    cursor: default;
  }
  .secondary-accent {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 38px;
    padding: 6px 14px;
    border: 1.5px solid var(--accent);
    border-radius: 10px;
    background: var(--white);
    color: var(--accent);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .secondary-accent:hover {
    background: var(--accent-light);
  }
  [role='alert'] {
    color: var(--warning);
    font-size: 13px;
    margin: 0;
  }
</style>
