<script lang="ts">
  import { untrack } from 'svelte';
  import { post, type CatalogueProduct } from '../api';
  import { formatQuantity } from '../domain/format';
  import { showToast } from '../toast';
  let {
    initialSearch = '',
    initialUnit = 'g',
    initialAmount = '',
    initialQuantity,
    initialCreate = false,
    initialEdit,
    editorOnly = false,
    onclose = () => {},
    onadd,
    products = $bindable<CatalogueProduct[]>([]),
    ingredients = $bindable<
      { product_id: string; quantity: number | null; unit: string }[]
    >([]),
  }: {
    products?: CatalogueProduct[];
    ingredients?: {
      product_id: string;
      quantity: number | null;
      unit: string;
    }[];
    initialSearch?: string;
    initialUnit?: string;
    initialAmount?: string;
    initialQuantity?: number | null;
    initialCreate?: boolean;
    initialEdit?: CatalogueProduct;
    editorOnly?: boolean;
    onclose?: () => void;
    onadd?: (ingredient: {
      product_id: string;
      quantity: number | null;
      unit: string;
    }) => void;
  } = $props();
  const uid = $props.id();
  let query = $state(untrack(() => initialSearch));
  let selected = $state<CatalogueProduct | null>(null);
  let unit = $state('');
  let amountChanged = $state(false);
  let amount = $state(untrack(() => initialAmount));
  let expanded = $state(untrack(() => !!initialSearch && !initialCreate));
  let activeIndex = $state(-1);
  let editing = $state<CatalogueProduct | null>(
    untrack(() => initialEdit ?? null),
  );
  let creating = $state(untrack(() => initialCreate || !!initialEdit));
  let name = $state(untrack(() => initialEdit?.name ?? initialSearch));
  let units = $state<string[]>(
    untrack(() =>
      initialEdit
        ? [...initialEdit.units]
        : [initialUnit && initialUnit !== 'do smaku' ? initialUnit : 'g'],
    ),
  );
  let basis = $state(
    untrack(() => (initialEdit ? (initialEdit.nutrition_basis ?? '') : 'g')),
  );
  let values = $state(
    untrack(() =>
      [
        initialEdit?.kcal,
        initialEdit?.protein,
        initialEdit?.carbs,
        initialEdit?.fat,
      ].map((value) => value?.toString() ?? ''),
    ),
  );
  let error = $state('');
  let pending = $state(false);
  const options = [
    'g',
    'kg',
    'ml',
    'l',
    'szt.',
    'łyżeczka',
    'łyżka',
    'szklanka',
    'szczypta',
  ];
  const labels = ['kcal', 'Białko g', 'Węgle g', 'Tłuszcz g'];
  const number = (value: string): number | null => {
    const parsed = value.trim() ? Number(value.replace(',', '.')) : NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const matches = $derived(
    products
      .filter((p) =>
        p.name
          .toLocaleLowerCase('pl')
          .includes(query.trim().toLocaleLowerCase('pl')),
      )
      .slice(0, 6),
  );
  const duplicate = $derived(
    products.some(
      (p) =>
        p.id !== editing?.id &&
        p.name.toLocaleLowerCase('pl') === name.trim().toLocaleLowerCase('pl'),
    ),
  );
  const canAdd = $derived(
    selected &&
      (unit === '' || (Number.isFinite(number(amount)) && number(amount)! > 0)),
  );
  function focusPanel(node: HTMLElement) {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    if (window.innerWidth < 1024) document.body.style.overflow = 'hidden';
    node.querySelector<HTMLInputElement>('input')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!pending) closePanel();
        return;
      }
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
        event.preventDefault();
        void saveProduct();
        return;
      }
      if (event.key !== 'Tab' || window.innerWidth >= 1024) return;
      const targets = [
        ...node.querySelectorAll<HTMLElement>('button:not(:disabled),input'),
      ];
      const first = targets[0],
        last = targets[targets.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    node.addEventListener('keydown', keydown);
    return {
      destroy() {
        node.removeEventListener('keydown', keydown);
        document.body.style.overflow = previousOverflow;
        previous?.focus();
      },
    };
  }
  function choose(product: CatalogueProduct) {
    selected = product;
    query = product.name;
    unit =
      initialUnit === 'do smaku'
        ? ''
        : product.units.includes(initialUnit)
          ? initialUnit
          : product.units[0];
    amount = initialAmount;
    amountChanged = false;
    expanded = false;
  }
  function add() {
    if (!selected || !canAdd) return;
    if (onadd) {
      onadd({
        product_id: selected.id,
        quantity:
          unit === ''
            ? null
            : !amountChanged && initialQuantity !== undefined
              ? initialQuantity
              : number(amount),
        unit,
      });
      return;
    }
    ingredients = [
      ...ingredients,
      {
        product_id: selected.id,
        quantity:
          unit === ''
            ? null
            : !amountChanged && initialQuantity !== undefined
              ? initialQuantity
              : number(amount),
        unit,
      },
    ];
    selected = null;
    query = '';
    amount = '';
    expanded = false;
  }
  function closePanel() {
    creating = false;
    editing = null;
    if (editorOnly) onclose();
  }
  function editProduct(product: CatalogueProduct) {
    editing = product;
    name = product.name;
    units = [...product.units];
    basis = product.nutrition_basis ?? '';
    values = [product.kcal, product.protein, product.carbs, product.fat].map(
      (value) => value?.toString() ?? '',
    );
    error = '';
    expanded = false;
    creating = true;
  }
  function openProduct() {
    editing = null;
    name = query.trim();
    units = [initialUnit && initialUnit !== 'do smaku' ? initialUnit : 'g'];
    basis = 'g';
    values = ['', '', '', ''];
    error = '';
    creating = true;
    expanded = false;
  }
  async function saveProduct() {
    if (
      !name.trim() ||
      duplicate ||
      !units.length ||
      pending ||
      (!basis && values.some((value) => number(value) !== null))
    )
      return;
    const target = editing;
    pending = true;
    error = '';
    try {
      const product = await post<CatalogueProduct>(
        target
          ? `/api/products/${encodeURIComponent(target.id)}`
          : '/api/products',
        {
          name: name.trim(),
          ...(target ? {} : { units }),
          nutrition_basis: target
            ? basis || null
            : values.some((v) => number(v) !== null)
              ? basis
              : null,
          kcal: number(values[0]),
          protein: number(values[1]),
          carbs: number(values[2]),
          fat: number(values[3]),
        },
        target ? 'PUT' : 'POST',
      );
      if (target) {
        products = products.map((item) =>
          item.id === product.id ? product : item,
        );
        if (selected?.id === product.id) {
          selected = product;
          query = product.name;
        }
        showToast(`Zapisano produkt: ${product.name}`);
      } else {
        products = [...products, product];
        choose(product);
        showToast(`Dodano produkt do bazy: ${product.name}`);
      }
      closePanel();
    } catch (e) {
      error =
        e instanceof Error && !(e instanceof TypeError)
          ? e.message
          : 'Brak połączenia z serwerem.';
    } finally {
      pending = false;
    }
  }
</script>

<section class="ingredients">
  {#if !editorOnly}<h2>Składniki</h2>
    {#each ingredients as ingredient, index (index)}
      <div class="row">
        <span>{products.find((p) => p.id === ingredient.product_id)?.name}</span
        ><span>{formatQuantity(ingredient.quantity, ingredient.unit)}</span
        ><button
          type="button"
          aria-label={`Usuń składnik: ${products.find((p) => p.id === ingredient.product_id)?.name}`}
          onclick={() =>
            (ingredients = ingredients.filter((_, i) => i !== index))}>×</button
        >
      </div>
    {/each}
    <label for={`${uid}-search`}>Dodaj składnik z bazy produktów</label>
    <input
      id={`${uid}-search`}
      role="combobox"
      aria-expanded={expanded}
      aria-controls={`${uid}-results`}
      aria-activedescendant={expanded && activeIndex >= 0
        ? `${uid}-option-${activeIndex}`
        : undefined}
      autocomplete="off"
      placeholder="Szukaj produktu, np. mleko"
      bind:value={query}
      oninput={() => {
        selected = null;
        activeIndex = -1;
        expanded = true;
      }}
      onfocus={() => (expanded = true)}
      onkeydown={(event) => {
        if (event.key === 'Escape') expanded = false;
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          expanded = true;
          activeIndex = Math.max(
            0,
            Math.min(
              matches.length - 1,
              activeIndex + (event.key === 'ArrowDown' ? 1 : -1),
            ),
          );
        } else if (event.key === 'Enter' && expanded) {
          event.preventDefault();
          const match = matches[Math.max(0, activeIndex)];
          if (match) choose(match);
        }
      }}
    />
    {#if expanded}
      <div id={`${uid}-results`} role="listbox" aria-label="Produkty">
        {#each matches as product, index (product.id)}<button
            type="button"
            role="option"
            id={`${uid}-option-${index}`}
            aria-selected={index === activeIndex}
            onclick={() => choose(product)}
            >{product.name}<small>jedn.: {product.units[0]}</small></button
          >{/each}
        {#if !matches.length}<p>Nie ma takiego produktu w bazie.</p>{/if}
      </div>
      <button class="new" type="button" onclick={openProduct}
        >Nie ma na liście? Dodaj „{query.trim()}” jako nowy produkt</button
      >
    {/if}
    {#if selected}
      <button
        type="button"
        class="new"
        aria-label={`Edytuj produkt: ${selected.name}`}
        onclick={() => {
          if (selected) editProduct(selected);
        }}>Edytuj produkt</button
      >
      <div class="chips">
        {#each [...selected.units, ''] as choice (choice)}<button
            type="button"
            class:active={unit === choice}
            onclick={() => (unit = choice)}>{choice || 'do smaku'}</button
          >{/each}
      </div>
      {#if unit}<label
          >Ilość<input
            inputmode="decimal"
            bind:value={amount}
            oninput={() => (amountChanged = true)}
            placeholder="np. 1,5"
          /></label
        >{/if}
      <button type="button" class="primary" disabled={!canAdd} onclick={add}
        >Dodaj składnik</button
      >
    {/if}
  {/if}
  {#if creating}
    <button
      class="backdrop"
      type="button"
      aria-label="Zamknij"
      disabled={pending}
      onclick={closePanel}
    ></button>
    <div
      class="product-panel"
      role="dialog"
      aria-label={editing ? 'Edytuj produkt' : 'Nowy produkt'}
      tabindex="-1"
      use:focusPanel
    >
      <h2>{editing ? 'Edytuj produkt' : 'Nowy produkt'}</h2>
      {#if editing}<p>
          Zmiana dotyczy wszystkich przepisów z tym produktem.
        </p>{/if}
      <button type="button" disabled={pending} onclick={closePanel}
        >Anuluj</button
      >
      <label
        >Nazwa produktu<input
          placeholder="np. Sumak mielony"
          bind:value={name}
        /></label
      >
      {#if duplicate}<p role="alert">Produkt o tej nazwie już istnieje.</p>{/if}
      {#if !editing}<p>
          W jakich jednostkach go dodajesz? (pierwsza wybrana jest domyślna)
        </p>
        <div class="chips">
          {#each options as option (option)}<button
              type="button"
              aria-pressed={units.includes(option)}
              class:active={units.includes(option)}
              onclick={() =>
                (units = units.includes(option)
                  ? units.filter((u) => u !== option)
                  : [...units, option])}>{option}</button
            >{/each}
        </div>
      {/if}
      <h3>Wartości odżywcze (opcjonalnie)</h3>
      <div class="chips">
        {#each editing ? ['', 'g', 'ml', 'szt.'] : ['g', 'ml', 'szt.'] as option (option)}<button
            type="button"
            class:active={basis === option}
            onclick={() => {
              basis = option;
              if (!option) values = ['', '', '', ''];
            }}
            >{option
              ? `na ${option === 'szt.' ? '1' : '100'} ${option}`
              : 'brak'}</button
          >{/each}
      </div>
      <div class="values">
        {#each labels as label, i (label)}<label
            >{label}<input inputmode="decimal" bind:value={values[i]} /></label
          >{/each}
      </div>
      <p>
        Bez wartości odżywczych produkt zapisze się w przepisie, ale nie wliczy
        się do kalorii i makro.
      </p>
      {#if error}<p role="alert">{error}</p>{/if}
      <button
        type="button"
        class="primary"
        disabled={pending ||
          !name.trim() ||
          duplicate ||
          !units.length ||
          (!basis && values.some((value) => number(value) !== null))}
        onclick={saveProduct}
        >{editing ? 'Zapisz zmiany' : 'Zapisz produkt'}</button
      >
    </div>
  {/if}
</section>

<style>
  .backdrop {
    display: none;
  }
  @media (max-width: 1023px) {
    .backdrop {
      display: block;
      position: fixed;
      inset: 0;
      background: #0008;
      z-index: 4;
    }
    .product-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-height: 90dvh;
      overflow: auto;
      background: var(--white);
      padding: 24px 16px !important;
      border-radius: 24px 24px 0 0;
      z-index: 5;
    }
  }
  .ingredients {
    background: var(--white);
    border-radius: 24px;
    padding: 20px;
    align-self: start;
  }
  h2 {
    font-family: var(--font-heading);
    margin: 0 0 16px;
  }
  label {
    display: block;
    font-weight: 600;
    margin: 12px 0 8px;
  }
  input {
    display: block;
    width: 100%;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--white);
    font: inherit;
    margin-top: 6px;
  }
  .row {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  .row span:first-child {
    flex: 1;
  }
  .row button {
    font-size: 24px;
    min-width: 44px;
    min-height: 44px;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0;
  }
  .chips button {
    padding: 10px 14px;
    border-radius: 999px;
    background: var(--gray);
  }
  .chips .active {
    background: var(--accent);
    color: white;
  }
  .primary {
    background: var(--accent);
    color: white;
    padding: 14px 20px;
    border-radius: 12px;
    margin-top: 12px;
  }
  .primary:disabled {
    background: var(--disabled);
    color: var(--muted);
  }
  [role='listbox'] button {
    display: block;
    width: 100%;
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }
  small {
    display: block;
    color: var(--muted);
  }
  .new {
    padding: 14px 0;
    color: var(--accent);
    text-align: left;
  }
  .values {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .product-panel {
    border-top: 1px solid var(--border);
    margin-top: 20px;
    padding-top: 20px;
  }
  [role='alert'] {
    color: var(--warning);
  }
</style>
