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
  import { formatFileSize } from '../domain/format';
  import { showToast } from '../toast';
  let {
    initialRecipe,
    active = true,
    disabled = false,
    onchange,
  }: {
    initialRecipe?: Recipe;
    active?: boolean;
    disabled?: boolean;
    onchange: (job: ImportJob | null) => void;
  } = $props();
  let url = $state(untrack(() => initialRecipe?.source_url || ''));
  let enabled = $state<boolean | null>(null);
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
      }
    }
  });
  function failed(code: string) {
    busy = false;
    error =
      code === 'too_large'
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
    if (!platform) {
      showToast('Wklej link z Instagrama lub Facebooka');
      return;
    }
    if (!enabled || disabled || busy) return;
    reset();
    busy = true;
    controller = new AbortController();
    const token = generation;
    try {
      accept(await requestImport(url, controller.signal), token);
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
    Działa tylko z postami publicznymi. Wideo i opis posta zapisują się w
    aplikacji.
  </p>
  {#if enabled === false && !existing}<p>
      Pobieranie z linku jest chwilowo niedostępne.
    </p>{/if}
  {#if configError}<div role="alert">
      Brak połączenia z serwerem.<button type="button" onclick={config}
        >Spróbuj ponownie</button
      >
    </div>
  {:else if busy}<div role="status">
      Pobieram wideo z {platform}…
      <div class="track"><span></span></div>
    </div>
  {:else if error}<div class="error" role="alert">
      <p>{error}</p>
      <button type="button" {disabled} onclick={start}>Spróbuj ponownie</button>
    </div>
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
  {:else if enabled}<button
      class="download"
      type="button"
      {disabled}
      onclick={start}>Pobierz wideo i opis</button
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
