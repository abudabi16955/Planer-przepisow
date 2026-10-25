<script lang="ts">
  import { onMount, onDestroy, untrack } from 'svelte';
  import { fileUrl, type Recipe } from '../api';
  import {
    requestImport,
    readImport,
    importPlatform,
    ImportRequestError,
    type ImportJob,
  } from '../importApi';
  import {
    recipeLink,
    requestWebImport,
    webImportError,
    type WebDraft,
  } from '../webImport';
  import { formatFileSize } from '../domain/format';
  import { showToast } from '../toast';
  let {
    initialRecipe,
    active = true,
    disabled = false,
    onchange,
    onweb = () => {},
  }: {
    initialRecipe?: Recipe;
    active?: boolean;
    disabled?: boolean;
    onchange: (job: ImportJob | null) => void;
    onweb?: (draft: WebDraft | null) => void;
  } = $props();
  let url = $state(untrack(() => initialRecipe?.source_url || ''));
  let enabled = $state<boolean | null>(null);
  let webEnabled = $state(false);
  let webDone = $state(false);
  let configError = $state(false);
  let maxVideoMb = $state(300);
  let job = $state<ImportJob | null>(null);
  let changed = $state(false);
  let busy = $state(false);
  let error = $state('');
  let generation = 0;
  let controller: AbortController | undefined;
  let configController: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const link = $derived(recipeLink(url));
  const isWeb = $derived(link?.kind === 'web');
  const platform = $derived(importPlatform(url));
  const existing = $derived(!changed && initialRecipe?.video);
  function cancel() {
    generation += 1;
    controller?.abort();
    clearTimeout(timer);
  }
  function reset() {
    cancel();
    job = null;
    busy = false;
    error = '';
    changed = true;
    onchange(null);
    onweb(null);
    webDone = false;
  }
  async function config() {
    configController?.abort();
    const request = new AbortController();
    configController = request;
    configError = false;
    try {
      const response = await fetch('/api/config', { signal: request.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (request.signal.aborted) return;
      enabled = result.import_enabled === true;
      webEnabled = result.web_import_enabled === true;
      if (Number.isFinite(result.max_video_mb) && result.max_video_mb > 0)
        maxVideoMb = result.max_video_mb;
    } catch {
      if (!request.signal.aborted) configError = true;
    }
  }
  onMount(() => {
    void config();
  });
  onDestroy(() => {
    cancel();
    configController?.abort();
  });
  $effect(() => {
    if (!active) {
      cancel();
      if (busy) {
        busy = false;
        job = null;
        onchange(null);
        onweb(null);
      }
    }
  });
  function failed(code: string) {
    busy = false;
    error = isWeb
      ? webImportError(code)
      : code === 'too_large'
        ? `Wideo jest za duże (limit ${maxVideoMb} MB).`
        : code === 'unavailable'
          ? 'Pobieranie z linku jest chwilowo niedostępne.'
          : code === 'network'
            ? 'Brak połączenia z serwerem.'
            : 'Nie udało się pobrać wideo. Post może być prywatny lub usunięty.';
  }
  function accept(result: ImportJob, token: number) {
    if (token !== generation) return;
    if (result.status === 'failed') {
      failed(result.error_code || 'private_or_missing');
      return;
    }
    if (result.status === 'done') {
      if (!result.video) {
        failed('private_or_missing');
        return;
      }
      job = result;
      busy = false;
      onchange(result);
      return;
    }
    timer = setTimeout(() => {
      void poll(result.id, token);
    }, 1000);
  }
  async function poll(id: string, token: number) {
    try {
      accept(await readImport(id, controller!.signal), token);
    } catch {
      if (token === generation) failed('network');
    }
  }
  async function start() {
    if (!link) {
      showToast('Wklej poprawny link do przepisu');
      return;
    }
    if (!(isWeb ? webEnabled : enabled) || disabled || busy) return;
    reset();
    busy = true;
    controller = new AbortController();
    const token = generation;
    try {
      if (isWeb) {
        const draft = await requestWebImport(url, controller.signal);
        if (token !== generation) return;
        busy = false;
        webDone = true;
        onweb(draft);
      } else accept(await requestImport(url, controller.signal), token);
    } catch (reason) {
      if (token === generation)
        failed(reason instanceof ImportRequestError ? reason.code : 'network');
    }
  }
</script>

<div class="link-import" hidden={!active}>
  <label
    >Link do posta lub reela<input
      type="url"
      value={url}
      disabled={!active || disabled}
      oninput={(event) => {
        url = event.currentTarget.value;
        reset();
      }}
    /></label
  >
  <p class="note">
    Instagram, Facebook (posty publiczne) lub strona z przepisem
  </p>
  {#if enabled === false && !existing && !isWeb}<p>
      Pobieranie z linku jest chwilowo niedostępne.
    </p>{/if}
  {#if isWeb && !webEnabled && enabled !== null}<p>
      Pobieranie ze stron jest chwilowo niedostępne.
    </p>{/if}
  {#if configError}<div role="alert">
      Brak połączenia z serwerem.<button type="button" onclick={config}
        >Spróbuj ponownie</button
      >
    </div>
  {:else if busy}<div role="status">
      {isWeb
        ? `Pobieram przepis z ${link?.host}…`
        : `Pobieram wideo z ${platform}…`}
      <div class="track"><span></span></div>
    </div>
  {:else if error}<div class="error" role="alert">
      <p>{error}</p>
      <button type="button" {disabled} onclick={start}>Spróbuj ponownie</button>
    </div>
  {:else if webDone}<p role="status">
      Przejrzyj składniki i uzupełnij przepis.
    </p>
  {:else if job || existing}
    {@const attachment = job?.video || existing}
    <div class="success">
      {#if job?.thumbnail && fileUrl(job.thumbnail)}<img
          src={fileUrl(job.thumbnail)!}
          alt="Miniatura wideo"
        />{/if}
      <div>
        <strong
          >Wideo zapisane · {formatFileSize(attachment!.size_bytes)}</strong
        >
        <p class="note">
          Wykryto: {job
            ? job.platform === 'instagram'
              ? 'Instagram'
              : 'Facebook'
            : platform}
        </p>
        {#if job?.description}<p class="description">
            Opis z posta: „{job.description}”
          </p>{/if}
      </div>
    </div>
  {:else if isWeb ? webEnabled : enabled || (!link && webEnabled)}<button
      class="download"
      type="button"
      {disabled}
      onclick={start}
      >{isWeb || (!enabled && webEnabled)
        ? 'Pobierz przepis ze strony'
        : 'Pobierz wideo i opis'}</button
    >{/if}
</div>

<style>
  .link-import {
    margin-top: 16px;
    padding: 16px;
    border-radius: 18px;
    background: var(--white);
    box-shadow: 0 0 0 1px rgba(20, 32, 26, 0.08);
  }
  label {
    display: block;
    font-weight: 700;
    font-size: 15px;
  }
  input {
    width: 100%;
    height: 48px;
    margin-top: 8px;
    padding: 0 12px;
    border: 1px solid rgba(20, 32, 26, 0.2);
    border-radius: 12px;
    background: var(--white);
    font: inherit;
  }
  .note {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--muted);
  }
  button {
    min-height: 48px;
    padding: 0 16px;
    border-radius: 14px;
    font-weight: 700;
  }
  .download {
    width: 100%;
    margin-top: 14px;
    background: var(--accent);
    color: var(--white);
  }
  [role='status'] {
    margin-top: 14px;
    font-size: 14px;
    font-weight: 500;
  }
  .track {
    height: 6px;
    margin-top: 10px;
    border-radius: 3px;
    background: var(--gray);
    overflow: hidden;
  }
  .track span {
    display: block;
    width: 40%;
    height: 6px;
    border-radius: 3px;
    background: var(--accent);
    animation: loading 1.5s infinite;
  }
  @keyframes loading {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(350%);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .track span {
      animation: none;
    }
  }
  .success {
    display: flex;
    gap: 12px;
    margin-top: 14px;
    padding: 12px;
    border-radius: 14px;
    background: var(--background);
  }
  .success img {
    flex: none;
    width: 56px;
    height: 100px;
    border-radius: 8px;
    object-fit: cover;
  }
  .success strong {
    font-size: 14px;
    color: var(--accent);
  }
  .description {
    font-size: 13px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .error {
    color: var(--warning);
    margin-top: 14px;
  }
  .error button {
    color: var(--accent);
    background: var(--accent-light);
  }
  button:disabled {
    opacity: 0.5;
  }
</style>
