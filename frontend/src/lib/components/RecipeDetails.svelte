<script lang="ts">
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import {
    deleteRecipe,
    fileUrl,
    type Recipe,
    type CatalogueProduct,
  } from '../api';
  import { showToast } from '../toast';
  import { formatDate, formatFileSize, formatNumber } from '../domain/format';
  import { recipeNutrition, energyProportions } from '../domain/nutrition';
  import { clampServings, formatScaledQuantity } from '../domain/scale';
  import { paletteForRecipe } from '../recipeCards';
  import { navigate } from '../router';
  import Icon from './Icon.svelte';

  let {
    recipe,
    products,
    desktop = false,
    onDeleted = () => {},
  }: {
    recipe: Recipe;
    products: readonly CatalogueProduct[];
    desktop?: boolean;
    onDeleted?: (id: string) => void;
  } = $props();
  const uid = $props.id();
  let servings = $state(untrack(() => clampServings(recipe.servings)));
  const checked = new SvelteSet<number>();
  let tab = $state('ingredients');
  let failedImage = $state<string | null>(null);
  let confirming = $state(false);
  let deleting = $state(false);
  let deleteError = $state('');
  function focusConfirmation(node: HTMLElement) {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    node.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleting) confirming = false;
      if (event.key !== 'Tab') return;
      const buttons = [
        ...node.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      ];
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      } else if (!buttons.length) event.preventDefault();
    };
    node.addEventListener('keydown', keydown);
    return {
      destroy() {
        document.body.style.overflow = overflow;
        node.removeEventListener('keydown', keydown);
        previous?.focus();
      },
    };
  }
  async function remove() {
    if (deleting) return;
    deleting = true;
    deleteError = '';
    try {
      await deleteRecipe(recipe.id);
      confirming = false;
      onDeleted(recipe.id);
      showToast('Przepis usunięty');
      navigate('/');
    } catch (reason) {
      deleteError =
        reason instanceof TypeError
          ? 'Brak połączenia z serwerem.'
          : 'Nie udało się usunąć przepisu. Spróbuj ponownie.';
    } finally {
      deleting = false;
    }
  }
  const tabs = [
    ['ingredients', 'Składniki'],
    ['steps', 'Przygotowanie'],
    ['source', 'Źródło'],
  ];
  const colors = $derived(paletteForRecipe(recipe.id));
  const photo = $derived(fileUrl(recipe.photo));
  const pdf = $derived(fileUrl(recipe.pdf));
  const video = $derived(fileUrl(recipe.video));
  const nutrition = $derived(recipeNutrition(recipe, products));
  const proportions = $derived(energyProportions(nutrition));
  const category = {
    sniadanie: 'Śniadanie',
    obiad: 'Obiad',
    kolacja: 'Kolacja',
  };
  const source = $derived(
    recipe.source_type === 'manual'
      ? 'Ręcznie'
      : recipe.source_type === 'pdf'
        ? 'PDF'
        : recipe.source_platform === 'facebook'
          ? 'Facebook'
          : 'Instagram',
  );
  const ingredients = $derived(
    recipe.ingredients.map((ingredient, index) => ({
      ...ingredient,
      index,
      name:
        products.find((product) => product.id === ingredient.product_id)
          ?.name ?? '—',
      amount: formatScaledQuantity(
        ingredient.quantity,
        ingredient.unit,
        servings,
        recipe.servings,
      ),
    })),
  );
  const original = $derived(safeOriginal(recipe.source_url));

  function safeOriginal(value: string | null): URL | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      const hosts = [
        'instagram.com',
        'www.instagram.com',
        'facebook.com',
        'www.facebook.com',
        'm.facebook.com',
        'fb.watch',
      ];
      return url.protocol === 'https:' &&
        hosts.includes(url.hostname) &&
        !url.username &&
        !url.password
        ? url
        : null;
    } catch {
      return null;
    }
  }
  function toggle(index: number) {
    if (checked.has(index)) checked.delete(index);
    else checked.add(index);
  }
  function tabKey(event: KeyboardEvent, index: number) {
    const keys: Record<string, number> = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    const next = keys[event.key];
    tab = tabs[next][0];
    const buttons = (
      event.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next].focus();
  }
</script>

<article class:desktop aria-label="Szczegóły przepisu">
  <div class="hero" style:--tint={colors.tint} style:--ink={colors.ink}>
    {#if photo && photo !== failedImage}
      <img
        src={photo}
        alt=""
        onerror={() => {
          failedImage = photo;
        }}
      />
    {:else}
      <svg class="plate" viewBox="0 0 100 100" aria-hidden="true"
        ><circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          opacity="0.5"
        /><circle
          cx="50"
          cy="50"
          r="27"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          opacity="0.35"
        /><path
          d="M36 52c0-9 8-17 17-15 9 2 14 10 11 18-3 8-12 11-20 9-5-1-8-6-8-12z"
          fill="currentColor"
          opacity="0.4"
        /></svg
      >
    {/if}
    {#if !desktop}<button
        class="back"
        aria-label="Wróć"
        onclick={() => navigate('/')}
        ><svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg
        ></button
      >{/if}
  </div>
  <div class="body">
    <div class="badges">
      <span class="category">{category[recipe.category]}</span>
      {#if recipe.time_min !== null}<span class="time"
          ><svg
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg
          >{recipe.time_min} min</span
        >{/if}
      <span>Źródło: {source}</span>
    </div>
    <svelte:element this={desktop ? 'h2' : 'h1'} class="title"
      >{recipe.title}</svelte:element
    >
    <div class="actions">
      <button
        type="button"
        onclick={() => navigate(`/przepis/${recipe.id}/edytuj`)}>Edytuj</button
      ><button
        type="button"
        class="delete"
        onclick={() => {
          deleteError = '';
          confirming = true;
        }}>Usuń</button
      >
    </div>
    <section class="macro" aria-label="Wartości na 1 porcję">
      <div class="macro-top">
        <div>
          <span class="kcal"
            >{nutrition === null ? '—' : formatNumber(nutrition.kcal)}</span
          ><span class="muted">kcal</span>
        </div>
        <span class="portion">na 1 porcję</span>
      </div>
      <div
        class="bar"
        role="img"
        aria-label={proportions
          ? `Białko ${proportions.protein}% · węgle ${proportions.carbs}% · tłuszcze ${proportions.fat}%`
          : 'Brak proporcji energii'}
      >
        <span
          style:width={`${proportions?.protein ?? 0}%`}
          style:background="#14201A"
        ></span><span
          style:width={`${proportions?.carbs ?? 0}%`}
          style:background="#3F8F68"
        ></span><span
          style:width={`${proportions?.fat ?? 0}%`}
          style:background="#A9D1BB"
        ></span>
      </div>
      <div class="macro-values">
        {#each [['protein', 'Białko', '#14201A'], ['carbs', 'Węglowodany', '#3F8F68'], ['fat', 'Tłuszcze', '#A9D1BB']] as [key, label, color] (key)}
          <div>
            <div class="macro-label">
              <span style:background={color}></span>{label}
            </div>
            <div class="grams">
              {nutrition === null
                ? '—'
                : `${formatNumber(nutrition[key as 'protein' | 'carbs' | 'fat'])} g`}
            </div>
          </div>
        {/each}
      </div>
    </section>
    <div class="tabs" role="tablist" aria-label="Sekcje przepisu">
      {#each tabs as [value, label], index (value)}
        <button
          role="tab"
          id={`${uid}-${value}`}
          aria-controls={`${uid}-panel`}
          aria-selected={tab === value}
          tabindex={tab === value ? 0 : -1}
          onclick={() => {
            tab = value;
          }}
          onkeydown={(event) => tabKey(event, index)}>{label}</button
        >
      {/each}
    </div>
    <div
      class="tab-content"
      role="tabpanel"
      id={`${uid}-panel`}
      aria-labelledby={`${uid}-${tab}`}
      tabindex="0"
    >
      {#if tab === 'ingredients'}
        <div class="servings">
          <span>Porcje</span>
          <div>
            <button
              aria-label="Mniej porcji"
              disabled={servings === 1}
              onclick={() => {
                servings = clampServings(servings - 1);
              }}
              ><svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"><path d="M5 12h14" /></svg
              ></button
            >
            <output aria-label="Liczba porcji" aria-live="polite"
              >{servings}</output
            >
            <button
              aria-label="Więcej porcji"
              disabled={servings === 12}
              onclick={() => {
                servings = clampServings(servings + 1);
              }}><Icon kind="add" size={20} /></button
            >
          </div>
        </div>
        <div class="ingredients">
          {#each ingredients as ingredient (ingredient.index)}
            <button
              class:checked={checked.has(ingredient.index)}
              aria-label={`${ingredient.name}, ${ingredient.amount}`}
              aria-pressed={checked.has(ingredient.index)}
              onclick={() => toggle(ingredient.index)}
            >
              <span class="check" aria-hidden="true"
                >{#if checked.has(ingredient.index)}<svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.6"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
                  >{/if}</span
              >
              <span class="ingredient-name">{ingredient.name}</span><span
                class="amount">{ingredient.amount}</span
              >
            </button>
          {/each}
        </div>
        {#if !desktop}<p class="hint">
            Kliknij składnik, żeby go odhaczyć podczas gotowania. Ilości
            przeliczają się po zmianie liczby porcji.
          </p>{/if}
      {:else if tab === 'steps'}
        <ol class="steps">
          {#each recipe.steps as step, index (index)}<li>
              <span class="step-number" aria-hidden="true">{index + 1}</span
              ><span>{step}</span>
            </li>{/each}
        </ol>
      {:else}
        <div class="sources">
          {#if recipe.source_type === 'manual'}<p>
              Własny przepis bez źródła.
            </p>{/if}
          {#if recipe.source_type === 'pdf' && recipe.pdf && pdf}
            <div class="source-card">
              <div class="pdf-info">
                <span class="pdf-icon" aria-hidden="true"
                  ><svg
                    viewBox="0 0 24 24"
                    width="26"
                    height="26"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></svg
                  ></span
                >
                <div>
                  <strong>{recipe.pdf.original_name ?? 'PDF'}</strong>
                  <div class="file-note">
                    {formatFileSize(recipe.pdf.size_bytes)} · zapisano {formatDate(
                      new Date(recipe.created_at),
                    )}
                  </div>
                </div>
              </div>
              <a
                class="primary"
                href={pdf}
                target="_blank"
                rel="noopener noreferrer">Otwórz oryginalny PDF</a
              >
            </div>
          {/if}
          {#if recipe.source_type === 'link'}
            {#if recipe.video && video}
              <div class="source-card video-card">
                <!-- svelte-ignore a11y_media_has_caption (Imported user videos do not include captions.) -->
                <video
                  src={video}
                  controls
                  playsinline
                  preload="metadata"
                  aria-label="Wideo przepisu"
                ></video>
                <div class="video-note">
                  Wideo zapisane w aplikacji · {formatFileSize(
                    recipe.video.size_bytes,
                  )}
                </div>
              </div>
            {/if}
            {#if original}
              <div class="source-card">
                <div class="file-note">Oryginalny post</div>
                <strong
                  >{original.hostname}/{original.pathname
                    .split('/')
                    .filter(Boolean).length > 1
                    ? original.pathname.split('/')[1] + '/'
                    : ''}…</strong
                >
                <div class="file-note">
                  Zapisano {formatDate(new Date(recipe.created_at))}
                </div>
                <a
                  class="primary"
                  href={original.href}
                  target="_blank"
                  rel="noopener noreferrer">Otwórz oryginał ({source})</a
                >
              </div>
            {/if}
            {#if recipe.source_description}<div class="source-card">
                <strong>Opis z posta</strong>
                <p class="description">{recipe.source_description}</p>
              </div>{/if}
            <p class="hint">
              Kopia wideo jest w aplikacji, więc przepis zostaje nawet wtedy,
              gdy autor usunie lub ukryje post.
            </p>
          {/if}
        </div>
      {/if}
    </div>
  </div>
</article>

{#if confirming}
  <div class="confirm-overlay">
    <div
      class="confirmation"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${uid}-delete-title`}
      tabindex="-1"
      use:focusConfirmation
    >
      <h2 id={`${uid}-delete-title`}>Usunąć przepis? Zniknie też z planera.</h2>
      {#if deleteError}<p role="alert">{deleteError}</p>{/if}
      <div class="confirm-actions">
        <button
          type="button"
          disabled={deleting}
          onclick={() => (confirming = false)}>Anuluj</button
        >
        <button
          type="button"
          class="danger"
          disabled={deleting}
          onclick={remove}>{deleting ? 'Usuwanie…' : 'Usuń'}</button
        >
      </div>
    </div>
  </div>
{/if}

<style>
  .confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    background: #0008;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }
  .confirmation {
    width: 100%;
    max-width: 440px;
    background: var(--white);
    border-radius: 24px;
    padding: 24px;
  }
  .confirmation h2 {
    font-family: var(--font-heading);
    font-size: 24px;
    margin: 0 0 24px;
  }
  .confirmation [role='alert'] {
    color: var(--warning);
  }
  .confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }
  .confirm-actions button {
    padding: 12px 20px;
    min-height: 44px;
    border-radius: 12px;
    background: var(--gray);
  }
  .confirm-actions .danger {
    background: var(--warning);
    color: var(--white);
  }
  .confirm-actions button:disabled {
    background: var(--disabled);
    color: var(--muted);
  }
  .hero {
    position: relative;
    height: 250px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--tint);
    color: var(--ink);
  }
  .plate {
    width: 160px;
    height: 160px;
  }
  .hero img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .back {
    position: absolute;
    left: 12px;
    top: 12px;
    width: 44px;
    height: 44px;
    border-radius: 22px;
    background: var(--white);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(20, 32, 26, 0.2);
  }
  .body {
    position: relative;
    margin-top: -24px;
    padding: 20px 16px 24px;
    border-radius: 24px 24px 0 0;
    background: var(--background);
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .badges > span {
    padding: 4px 12px;
    border-radius: 14px;
    background: var(--gray);
    font-size: 13px;
    font-weight: 500;
  }
  .badges > .category {
    background: var(--accent-light);
  }
  .time {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .title {
    margin: 12px 0 0;
    font-family: var(--font-heading);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .actions button {
    min-height: 44px;
    padding: 0 14px;
    background: var(--white);
    border-radius: 12px;
    opacity: 0.6;
    cursor: default;
  }
  .delete {
    color: var(--warning);
  }
  .macro {
    margin-top: 16px;
    padding: 16px;
    border-radius: 18px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
  }
  .macro-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }
  .macro-top > div {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .kcal {
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 36px;
    line-height: 1;
  }
  .muted {
    color: var(--muted);
  }
  .portion {
    font-size: 13px;
    color: var(--muted);
  }
  .bar {
    display: flex;
    height: 10px;
    margin-top: 14px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--gray);
  }
  .bar span {
    display: block;
    height: 10px;
  }
  .macro-values {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
    margin-top: 14px;
  }
  .macro-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--muted);
  }
  .macro-label > span {
    display: block;
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: none;
  }
  .grams {
    margin-top: 2px;
    font-size: 17px;
    font-weight: 700;
  }
  .tabs {
    display: flex;
    gap: 4px;
    margin-top: 20px;
    padding: 4px;
    border-radius: 16px;
    background: var(--gray);
  }
  .tabs button {
    flex: 1;
    min-width: 0;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
  }
  .tabs button[aria-selected='true'] {
    font-weight: 700;
    background: var(--white);
    box-shadow: 0 1px 3px rgba(20, 32, 26, 0.1);
  }
  .tab-content {
    margin-top: 16px;
  }
  .servings {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .servings > span {
    font-weight: 700;
    font-size: 16px;
  }
  .servings > div {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .servings button {
    width: 44px;
    height: 44px;
    border-radius: 22px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.14);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .servings button:disabled {
    color: var(--disabled);
    cursor: default;
  }
  output {
    min-width: 36px;
    text-align: center;
    font-weight: 700;
    font-size: 18px;
  }
  .ingredients {
    margin-top: 8px;
    border-radius: 18px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
    overflow: hidden;
  }
  .ingredients button {
    width: 100%;
    min-height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
    border-bottom: 1px solid rgba(20, 32, 26, 0.08);
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
    border: 0;
    background: var(--accent);
    color: var(--white);
  }
  .ingredient-name {
    flex: 1;
    min-width: 0;
    font-size: 15px;
  }
  .amount {
    flex: none;
    font-weight: 700;
    font-size: 15px;
  }
  .checked .ingredient-name,
  .checked .amount {
    color: var(--muted);
    text-decoration: line-through;
  }
  .hint {
    margin: 10px 4px 0;
    font-size: 13px;
    color: var(--muted);
  }
  .steps {
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    list-style: none;
  }
  .steps li {
    display: flex;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 18px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
    font-size: 15px;
    line-height: 1.5;
  }
  .step-number {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 14px;
    background: var(--accent-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
  }
  .sources {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sources > p {
    margin: 0 4px;
  }
  .source-card {
    padding: 16px;
    border-radius: 18px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
    overflow-wrap: anywhere;
  }
  .pdf-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .pdf-icon {
    flex: none;
    width: 48px;
    height: 56px;
    border-radius: 8px;
    background: var(--accent-light);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .file-note {
    margin-top: 2px;
    font-size: 13px;
    color: var(--muted);
  }
  .primary {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    margin-top: 14px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--white);
    font-weight: 700;
    text-decoration: none;
  }
  .video-card {
    padding: 12px;
  }
  video {
    display: block;
    height: 360px;
    max-width: 100%;
    width: 100%;
    background: var(--text);
    border-radius: 12px;
    object-fit: contain;
  }
  .video-note {
    margin-top: 12px;
    font-size: 14px;
  }
  .description {
    white-space: pre-wrap;
    margin-bottom: 0;
  }
  .desktop .hero {
    height: 180px;
  }
  .desktop .plate {
    width: 130px;
    height: 130px;
  }
  .desktop .body {
    margin-top: 0;
    padding: 20px 24px 24px;
    border-radius: 0;
  }
  .desktop .kcal {
    font-size: 34px;
  }
  .desktop .ingredients button {
    min-height: 48px;
    padding: 6px 16px;
  }
  .desktop .check {
    width: 22px;
    height: 22px;
    border-radius: 11px;
  }
  .desktop video {
    height: 320px;
  }
</style>
