import { expect, test } from 'vitest';
import {
  clampServings,
  formatScaledQuantity,
  MAX_SERVINGS,
  MIN_SERVINGS,
  scaleQuantity,
} from './scale';

test.each([
  [100, 4, 2, 200],
  [100, 1, 4, 25],
  [0.5, 3, 2, 0.75],
  [100, 12, 50, 24],
  [100, 14, 14, 100],
  [100, 50, 25, 200],
  [1, 1, 3, 1 / 3],
])('skaluje %s × %s / %s', (quantity, servings, base, result) => {
  expect(scaleQuantity(quantity, servings, base)).toBeCloseTo(result);
});

test('do smaku pozostaje bez zmian', () => {
  expect(scaleQuantity(null, 14, 14)).toBeNull();
  expect(formatScaledQuantity(null, '', 14, 14)).toBe('do smaku');
});

test('formatowanie stosuje odmianę po skalowaniu bez zmiany precyzji obliczeń', () => {
  expect(formatScaledQuantity(1, 'łyżka', 3, 1)).toBe('3 łyżki');
  expect(formatScaledQuantity(1, 'łyżka', 1, 2)).toBe('0,5 łyżki');
  expect(formatScaledQuantity(3, 'szt.', 1, 2)).toBe('1,5 szt.');
});

test.each([
  [0, 1],
  [-1, 1],
  [1, 1],
  [14, 14],
  [50, 50],
  [51, 50],
])('licznik %s ogranicza się do %s', (value, result) => {
  expect(clampServings(value)).toBe(result);
});

test.each([0, -1, 51, 1.5, Number.NaN])(
  'odrzuca niepoprawną liczbę porcji %s',
  (value) => {
    expect(() => scaleQuantity(1, value, 2)).toThrow(RangeError);
  },
);

test.each([0, -1, 51, 1.5])('odrzuca niepoprawną bazę porcji %s', (value) => {
  expect(() => scaleQuantity(1, 2, value)).toThrow(RangeError);
});

test('stałe określają zakres 1–50', () => {
  expect(MIN_SERVINGS).toBe(1);
  expect(MAX_SERVINGS).toBe(50);
});
