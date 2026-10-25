<script lang="ts">
  import type { CatalogueProduct } from '../api';
  import { formatImportAmount, type ReviewIngredient } from '../webImport';
  import IngredientPicker from './IngredientPicker.svelte';
  let {
    rows = $bindable<ReviewIngredient[]>([]),
    products = $bindable<CatalogueProduct[]>([]),
  } = $props();
  let amounts = $state<Record<number, string>>({});
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
  {#each rows as row, index (index)}
    {#if !row.skipped}
      {@const product = products.find((p) => p.id === row.product_id)}
      <div class="review-row" role="group" aria-label={`Składnik ${index + 1}`}>
        <strong>{product?.name || row.name}</strong>
        {#if row.match === 'fuzzy'}<span class="warning">sprawdź</span>{/if}
        <p class="raw">{row.raw}</p>
        {#if product}
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
                aria-pressed={row.unit === unit && row.unit_ok === true}
                onclick={() => {
                  row.unit = unit;
                  row.unit_ok = true;
                }}>{unit}</button
              >
            {/each}
          </div>
          {#if !row.unit_ok}<p role="alert">Wybierz jednostkę produktu.</p>{/if}
          {#if !row.confirmed}<button
              type="button"
              onclick={() => (row.confirmed = true)}>Zatwierdź składnik</button
            >{/if}
          <button
            type="button"
            onclick={() => (editing = { index, create: false })}
            >Wybierz produkt</button
          >
          <button
            type="button"
            aria-label={`Usuń składnik: ${product.name}`}
            onclick={() => (row.skipped = true)}>×</button
          >
        {:else}
          <button
            type="button"
            onclick={() => (editing = { index, create: false })}
            >Wybierz produkt</button
          >
          <button
            type="button"
            onclick={() => (editing = { index, create: true })}
            >Dodaj „{row.name}” jako nowy produkt</button
          >
          <button type="button" onclick={() => (row.skipped = true)}
            >Pomiń</button
          >
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
          <button type="button" onclick={() => (editing = null)}
            >Anuluj wybór</button
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
    padding: 16px 0;
    overflow-wrap: anywhere;
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
