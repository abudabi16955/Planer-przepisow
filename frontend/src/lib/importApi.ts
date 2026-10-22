import { ApiError, type FileReference } from './api';
export interface ImportJob {
  id: string;
  status: 'queued' | 'running' | 'done' | 'failed';
  video: FileReference | null;
  thumbnail: FileReference | null;
  description: string | null;
  title: string | null;
  platform: 'instagram' | 'facebook';
  size_bytes: number | null;
  error_code: string | null;
}
export function importPlatform(value: string): string | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443') ||
      /[\s\\]/.test(value)
    )
      return null;
    if (['instagram.com', 'www.instagram.com'].includes(url.hostname))
      return 'Instagram';
    if (
      [
        'facebook.com',
        'www.facebook.com',
        'm.facebook.com',
        'fb.watch',
      ].includes(url.hostname)
    )
      return 'Facebook';
  } catch {
    /* Invalid URL. */
  }
  return null;
}
export class ImportRequestError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export async function requestImport(
  url: string,
  signal: AbortSignal,
): Promise<ImportJob> {
  const response = await fetch('/api/imports', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ImportRequestError(
      body?.detail?.code ||
        (response.status === 503 ? 'unavailable' : 'network'),
    );
  }
  return response.json();
}
export async function readImport(
  id: string,
  signal: AbortSignal,
): Promise<ImportJob> {
  const response = await fetch(`/api/imports/${encodeURIComponent(id)}`, {
    signal,
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json();
}
