import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { afterEach, expect, test, vi } from 'vitest';
import Toast from './Toast.svelte';
import { showToast, toast } from '../toast';

afterEach(() => {
  cleanup();
  toast.set(null);
  vi.useRealTimers();
});

test('toast znika dokładnie po 2,4 s', async () => {
  vi.useFakeTimers();
  render(Toast);
  showToast('Przepis zapisany');
  await tick();
  expect(screen.getByRole('status').textContent).toBe('Przepis zapisany');
  await vi.advanceTimersByTimeAsync(2399);
  expect(screen.getByRole('status')).toBeTruthy();
  await vi.advanceTimersByTimeAsync(1);
  expect(screen.queryByRole('status')).toBeNull();
});

test('kolejny toast, także z tym samym tekstem, dostaje pełne 2,4 s', async () => {
  vi.useFakeTimers();
  render(Toast);
  showToast('Przepis zapisany');
  await tick();
  await vi.advanceTimersByTimeAsync(2000);
  showToast('Przepis zapisany');
  await tick();
  await vi.advanceTimersByTimeAsync(400);
  expect(screen.getByRole('status')).toBeTruthy();
  await vi.advanceTimersByTimeAsync(2000);
  expect(screen.queryByRole('status')).toBeNull();
});
