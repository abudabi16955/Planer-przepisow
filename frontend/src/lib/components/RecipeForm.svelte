<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import {
    getProducts,
    post,
    upload,
    type Recipe,
    type CatalogueProduct,
  } from '../api';
  import { recipeNutrition } from '../domain/nutrition';
  import { formatNumber } from '../domain/format';
  import { formatFileSize } from '../domain/format';
  import { resizePhoto } from '../photo';
  import { navigate } from '../router';
  import { showToast } from '../toast';
  import IngredientPicker from './IngredientPicker.svelte';
  let {
    initialRecipe,
    onSave = (data: unknown) => post<Recipe>('/api/recipes', data),
  }: { initialRecipe?: Recipe; onSave?: (data: unknown) => Promise<Recipe> } =
    $props();
  let title = $state(untrack(() => initialRecipe?.title ?? ''));
  let category = $state(untrack(() => initialRecipe?.category ?? 'sniadanie'));
  let time = $state(untrack(() => initialRecipe?.time_min?.toString() ?? ''));
  let servings = $state(
    untrack(() => initialRecipe?.servings.toString() ?? ''),
  );
  let source = $state<string>(
    untrack(() => initialRecipe?.source_type ?? 'link'),
  );
  let steps = $state(untrack(() => initialRecipe?.steps.join('\n') ?? ''));
  let ingredients = $state<
    { product_id: string; quantity: number | null; unit: string }[]
  >(untrack(() => (initialRecipe ? [...initialRecipe.ingredients] : [])));
  let products = $state<CatalogueProduct[]>([]);
  let values = $state(
    untrack(() =>
      [
        initialRecipe?.kcal,
        initialRecipe?.protein,
        initialRecipe?.carbs,
        initialRecipe?.fat,
      ].map((v) => v?.toString() ?? ''),
    ),
  );
  let pdf = $state<File | null>(null);
  let pdfInput: HTMLInputElement | undefined = $state();
  let photo = $state<File | null>(null);
  let pending = $state(false);
  let error = $state('');
  const number = (value: string) =>
    value.trim() ? Number(value.replace(',', '.')) : null;
  const valid = $derived(
    title.trim() &&
      Number.isInteger(number(servings)) &&
      number(servings)! >= 1 &&
      number(servings)! <= 50 &&
      (!time.trim() || (Number.isInteger(number(time)) && number(time)! > 0)) &&
      values.every(
        (v) => !v.trim() || (Number.isFinite(number(v)) && number(v)! >= 0),
      ) &&
      (source === 'manual' ||
        (source === 'pdf' && (pdf || initialRecipe?.pdf))),
  );
  const calculated = $derived(
    Number.isInteger(number(servings)) &&
      number(servings)! >= 1 &&
      number(servings)! <= 50
      ? recipeNutrition(
          {
            servings: number(servings) || 1,
            ingredients,
            kcal: null,
            protein: null,
            carbs: null,
            fat: null,
          },
          products,
        )
      : null,
  );
  const hints = $derived(
    calculated
      ? [
          calculated.kcal,
          calculated.protein,
          calculated.carbs,
          calculated.fat,
        ].map(formatNumber)
      : ['', '', '', ''],
  );
  onMount(() => {
    const controller = new AbortController();
    getProducts(controller.signal)
      .then((result) => (products = result))
      .catch((e) => {
        if (!controller.signal.aborted)
          error =
            e instanceof TypeError ? 'Brak połączenia z serwerem.' : e.message;
      });
    return () => controller.abort();
  });
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!valid || pending) return;
    pending = true;
    error = '';
    try {
      const pdfId = source === 'pdf' && pdf ? await upload(pdf) : undefined;
      const photoId = photo
        ? await upload(await resizePhoto(photo))
        : undefined;
      const saved = await onSave({
        title: title.trim(),
        category,
        time_min: number(time),
        servings: number(servings),
        source_type: source,
        steps: steps
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        ingredients,
        kcal: number(values[0]),
        protein: number(values[1]),
        carbs: number(values[2]),
        fat: number(values[3]),
        pdf_upload_id: pdfId,
        photo_upload_id: photoId,
      });
      showToast('Przepis zapisany');
      navigate(`/przepis/${saved.id}`);
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

<form onsubmit={save}>
  <header>
    <h1>Dodaj przepis</h1>
    <button class="primary save" disabled={!valid || pending} type="submit"
      >{pending ? 'Zapisywanie…' : 'Zapisz przepis'}</button
    >
  </header>
  <div class="fields">
    <section class="source">
      <div class="tabs" role="tablist" aria-label="Źródło przepisu">
        {#each [['link', 'Link'], ['pdf', 'PDF'], ['manual', 'Ręcznie']] as [value, label] (value)}<button
            type="button"
            role="tab"
            aria-selected={source === value}
            onclick={() => (source = value)}>{label}</button
          >{/each}
      </div>
      {#if source === 'link'}<p>
          Pobieranie z linku jest chwilowo niedostępne.
        </p>{:else if source === 'manual'}<p>
          Własny przepis bez źródła. Wypełnij pola poniżej.
        </p>{:else}<label class="file"
          >Wybierz plik PDF<input
            type="file"
            accept="application/pdf,.pdf"
            bind:this={pdfInput}
            onchange={(event) => (pdf = event.currentTarget.files?.[0] ?? null)}
          /></label
        >{#if pdf}<p>
            {pdf.name} · {formatFileSize(pdf.size)} · zapisze się razem z przepisem
            <button
              type="button"
              aria-label="Usuń plik"
              onclick={() => {
                pdf = null;
                if (pdfInput) pdfInput.value = '';
              }}>×</button
            >
          </p>{/if}{/if}
    </section>
    <label class="name"
      >Nazwa<input
        bind:value={title}
        placeholder="np. Shakshuka z fetą"
        required
      /></label
    >
    <section class="category">
      <h2>Kategoria</h2>
      <div class="chips">
        {#each [['sniadanie', 'Śniadanie'], ['obiad', 'Obiad'], ['kolacja', 'Kolacja']] as [value, label] (value)}<button
            type="button"
            class:active={category === value}
            aria-pressed={category === value}
            onclick={() => (category = value as Recipe['category'])}
            >{label}</button
          >{/each}
      </div>
    </section>
    <div class="numbers">
      <label
        >Czas (min)<input
          inputmode="numeric"
          bind:value={time}
          placeholder="25"
        /></label
      ><label
        >Porcje<input
          inputmode="numeric"
          bind:value={servings}
          placeholder="2"
          required
        /></label
      >
    </div>
    <div class="ingredients">
      <IngredientPicker bind:products bind:ingredients />
    </div>
    <label class="steps"
      >Przygotowanie<textarea
        rows="4"
        bind:value={steps}
        placeholder="Kolejne kroki, po jednym w linii"></textarea></label
    >
    <section class="nutrition">
      <h2>Wartości na 1 porcję</h2>
      <div class="values">
        {#each ['kcal', 'Białko g', 'Węgle g', 'Tłuszcz g'] as label, i (label)}<label
            >{label}<input
              inputmode="decimal"
              bind:value={values[i]}
              placeholder={hints[i]}
            /></label
          >{/each}
      </div>
    </section>
    <label class="photo file"
      >Dodaj zdjęcie dania<input
        type="file"
        accept="image/*"
        onchange={(event) => (photo = event.currentTarget.files?.[0] ?? null)}
      />{#if photo}<span>{photo.name}</span>{/if}</label
    >
  </div>
  {#if error}<p role="alert">{error}</p>{/if}
</form>

<style>
  form {
    padding: 24px 16px 120px;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }
  h1 {
    margin: 0;
  }
  h2 {
    font-size: 15px;
    margin: 0 0 12px;
  }
  label {
    display: block;
    font-weight: 600;
  }
  input,
  textarea {
    display: block;
    width: 100%;
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--white);
    font: inherit;
    margin-top: 8px;
  }
  .fields {
    display: grid;
    gap: 24px;
    grid-template-areas: 'source' 'name' 'category' 'numbers' 'ingredients' 'steps' 'nutrition' 'photo';
  }
  .source {
    grid-area: source;
  }
  .name {
    grid-area: name;
  }
  .category {
    grid-area: category;
  }
  .numbers {
    grid-area: numbers;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .ingredients {
    grid-area: ingredients;
  }
  .steps {
    grid-area: steps;
  }
  .nutrition {
    grid-area: nutrition;
  }
  .photo {
    grid-area: photo;
  }
  .tabs,
  .chips {
    display: flex;
    gap: 8px;
  }
  .tabs {
    background: var(--gray);
    padding: 4px;
    border-radius: 14px;
  }
  .tabs button {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
  }
  .tabs [aria-selected='true'] {
    background: white;
  }
  .chips button {
    padding: 12px 18px;
    background: var(--gray);
    border-radius: 999px;
  }
  .chips .active {
    background: var(--accent);
    color: white;
  }
  .values {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
  .file {
    border: 1px dashed var(--muted);
    border-radius: 16px;
    padding: 16px;
  }
  .primary {
    background: var(--accent);
    color: white;
    padding: 14px 28px;
    border-radius: 14px;
    min-height: 48px;
  }
  .primary:disabled {
    background: var(--disabled);
    color: var(--muted);
  }
  .save {
    position: fixed;
    bottom: 84px;
    left: 16px;
    right: 16px;
    z-index: 1;
  }
  p[role='alert'] {
    color: var(--warning);
  }
  @media (min-width: 1024px) {
    form {
      padding: 32px;
    }
    .fields {
      grid-template-columns: minmax(0, 1fr) 460px;
      grid-template-areas: 'source ingredients' 'name ingredients' 'category ingredients' 'numbers ingredients' 'steps ingredients' 'nutrition ingredients' 'photo ingredients';
      align-items: start;
    }
    .save {
      position: static;
    }
    .values {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
