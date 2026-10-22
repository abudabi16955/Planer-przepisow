import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, expect, test, vi } from 'vitest';
import { buildWorker } from '../../pwa';
import { registerServiceWorker } from './serviceWorker';
const template = readFileSync(resolve('worker/sw.js'), 'utf8');
const directories: string[] = [];
afterEach(() => {
  directories.forEach((path) => rmSync(path, { recursive: true, force: true }));
  directories.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function directory() {
  const path = mkdtempSync(resolve('.pwa-test-'));
  directories.push(path);
  mkdirSync(resolve(path, 'assets'));
  mkdirSync(resolve(path, 'api'));
  mkdirSync(resolve(path, 'files'));
  writeFileSync(resolve(path, 'index.html'), '<html>shell</html>');
  writeFileSync(resolve(path, 'assets/main.js'), 'app');
  writeFileSync(resolve(path, 'api/data.js'), 'private');
  writeFileSync(resolve(path, 'files/data.png'), 'private');
  return path;
}
function harness() {
  const events = new Map<string, (event: unknown) => void>();
  const cache = {
    addAll: vi.fn(async () => {}),
    match: vi.fn(async () => new Response('cached shell')),
  };
  const caches = {
    open: vi.fn(async () => cache),
    keys: vi.fn(async () => ['other-app', 'planer-shell-old']),
    delete: vi.fn(async () => true),
  };
  const self = {
    addEventListener: (name: string, callback: (event: unknown) => void) =>
      events.set(name, callback),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
    location: { origin: 'https://example.test' },
  };
  const fetch = vi.fn(async () => new Response('network'));
  runInNewContext(buildWorker(directory(), template), {
    self,
    caches,
    fetch,
    URL,
    Response,
    Set,
  });
  function dispatch(type: string, properties: Record<string, unknown> = {}) {
    let result: Promise<unknown> | undefined;
    events.get(type)!({
      ...properties,
      waitUntil: (promise: Promise<unknown>) => {
        result = promise;
      },
      respondWith: (promise: Promise<unknown>) => {
        result = promise;
      },
    });
    return result;
  }
  function request(
    path: string,
    options: { method?: string; mode?: string; headers?: Headers } = {},
  ) {
    return dispatch('fetch', {
      request: {
        url: new URL(path, self.location.origin).href,
        method: 'GET',
        mode: 'cors',
        headers: new Headers(),
        ...options,
      },
    });
  }
  return { cache, caches, self, fetch, dispatch, request };
}

test('install precaches only shell files and activates after a complete download', async () => {
  const h = harness();
  await h.dispatch('install');
  expect(h.cache.addAll.mock.calls[0]).toEqual([
    ['/assets/main.js', '/index.html'],
  ]);
  expect(h.self.skipWaiting).toHaveBeenCalledOnce();
  h.cache.addAll.mockRejectedValueOnce(new Error('offline'));
  await expect(h.dispatch('install')).rejects.toThrow('offline');
  expect(h.self.skipWaiting).toHaveBeenCalledTimes(1);
});
test('activation removes obsolete app caches without touching other caches', async () => {
  const h = harness();
  await h.dispatch('activate');
  expect(h.caches.delete).toHaveBeenCalledExactlyOnceWith('planer-shell-old');
  expect(h.self.clients.claim).toHaveBeenCalledOnce();
});
test.each([
  '/api',
  '/api/recipes?week=1',
  '/files',
  '/files/video.mp4',
  'https://outside.test/assets/main.js',
])('bypasses %s entirely', (path) => {
  const h = harness();
  expect(h.request(path)).toBeUndefined();
  expect(h.fetch).not.toHaveBeenCalled();
  expect(h.caches.open).not.toHaveBeenCalled();
});
test('does not intercept writes, ranges or unknown assets', () => {
  const h = harness();
  expect(h.request('/api/recipes', { method: 'POST' })).toBeUndefined();
  expect(
    h.request('/assets/main.js', {
      headers: new Headers({ Range: 'bytes=0-9' }),
    }),
  ).toBeUndefined();
  expect(h.request('/unknown.png')).toBeUndefined();
});
test('navigation uses network online and shell offline, without caching responses', async () => {
  const h = harness();
  expect(
    await (
      (await h.request('/planer?week=2027-01-04', {
        mode: 'navigate',
      })) as Response
    ).text(),
  ).toBe('network');
  expect(h.cache.match).not.toHaveBeenCalled();
  h.fetch.mockRejectedValueOnce(new TypeError('offline'));
  expect(
    await (
      (await h.request('/dodaj', { mode: 'navigate' })) as Response
    ).text(),
  ).toBe('cached shell');
  expect(h.cache.match).toHaveBeenCalledWith('/index.html');
});
test('immutable build assets are read from the current shell cache', async () => {
  const h = harness();
  await h.request('/assets/main.js');
  expect(h.cache.match).toHaveBeenCalledWith('/assets/main.js');
  expect(h.fetch).not.toHaveBeenCalled();
});
test('build version changes with app bytes, manifest or worker logic', () => {
  const path = directory();
  const first = buildWorker(path, template);
  expect(buildWorker(path, template)).toBe(first);
  writeFileSync(resolve(path, 'assets/main.js'), 'new app');
  expect(buildWorker(path, template)).not.toBe(first);
  const second = buildWorker(path, template);
  writeFileSync(resolve(path, 'manifest.webmanifest'), '{}');
  expect(buildWorker(path, template)).not.toBe(second);
  expect(buildWorker(path, template + '\n// new behavior')).not.toBe(
    buildWorker(path, template),
  );
});
test('manifest matches the app name, theme and installable icon sizes', () => {
  const manifest = JSON.parse(
    readFileSync(resolve('public/manifest.webmanifest'), 'utf8'),
  );
  expect(manifest.name).toBe('Planer przepisów');
  expect(manifest.display).toBe('standalone');
  const css = readFileSync(resolve('src/styles/tokens.css'), 'utf8');
  expect(css).toContain(`--accent: ${manifest.theme_color}`);
  expect(css).toContain(`--background: ${manifest.background_color}`);
  for (const icon of manifest.icons) {
    const data = readFileSync(resolve('public/' + icon.src));
    expect(`${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`).toBe(
      icon.sizes,
    );
  }
});
test.each([false, true])(
  'first claim stays silent and a new controller reloads once (existing=%s)',
  async (existing) => {
    let changed!: () => void;
    const update = vi.fn(async () => {});
    const register = vi.fn(async () => ({ update }));
    vi.stubGlobal('navigator', {
      serviceWorker: {
        controller: existing ? {} : null,
        register,
        addEventListener: (_name: string, handler: () => void) => {
          changed = handler;
        },
      } as unknown as ServiceWorkerContainer,
    });
    const reload = vi.fn();
    registerServiceWorker(reload);
    await Promise.resolve();
    expect(register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' });
    if (!existing) {
      changed();
      expect(reload).not.toHaveBeenCalled();
    }
    changed();
    changed();
    expect(reload).toHaveBeenCalledOnce();
  },
);
