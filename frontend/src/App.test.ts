import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';
import App from './App.svelte';

test('pokazuje nazwę aplikacji', () => {
  render(App);
  expect(
    screen.getByRole('heading', { name: 'Planer przepisów', level: 1 }),
  ).toBeTruthy();
});
