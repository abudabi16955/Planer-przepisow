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
      confirmed: true,
    };
    editing = null;
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
              onadd={(ingredient) => accept(index, ingredient)}
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
    padding: 20px;
    border-radius: 24px;
    background: var(--white);
    margin-bottom: 16px;
  }
  h2 {
    font: 700 20px var(--font-heading);
    margin: 0 0 16px;
  }
  .review-row {
    border-bottom: 1px solid var(--border);
    padding: 16px 12px;
    border-left: 4px solid transparent;
    border-radius: 12px;
    margin-top: 8px;
    overflow-wrap: anywhere;
  }
  .pending {
    border-left-color: var(--warning);
    background: color-mix(in srgb, var(--warning) 8%, var(--white));
  }
  .approved {
    background: var(--white);
  }
  .accepted {
    color: var(--accent);
  }
  .state {
    margin-left: 8px;
    font-weight: 700;
  }
  .review-count {
    color: var(--muted);
    margin: 0 0 16px;
  }
  button.primary {
    background: var(--accent);
    color: var(--white);
  }
  .primary:disabled {
    opacity: 0.5;
  }
  .raw {
    color: var(--muted);
    font-size: 13px;
    white-space: pre-wrap;
  }
  .warning,
  [role='alert'] {
    color: var(--warning);
  }
  .warning {
    margin-left: 8px;
  }
  label {
    display: block;
    font-weight: 600;
  }
  input {
    display: block;
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    font: inherit;
    margin: 8px 0;
  }
  button {
    min-height: 44px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--accent-light);
    margin: 4px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
  }
  .chips button {
    border-radius: 999px;
    background: var(--gray);
  }
  [aria-pressed='true'] {
    background: var(--accent) !important;
    color: white;
  }
</style>
