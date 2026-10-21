import { writable } from 'svelte/store';

export const toast = writable<{ message: string } | null>(null);

export function showToast(message: string): void {
  toast.set({ message });
}
