import { expect, test } from 'vitest';
import { clampServings, formatScaledQuantity, scaleQuantity } from './scale';

test.each([
  [100, 4, 2, 200],
  [100, 1, 4, 25],
  [0.5, 3, 2, 0.75],
  [100, 12, 50, 24],
  [1, 1, 3, 1 / 3],
])('skaluje %s × %s / %s', (quantity, servings, base, result) => {
  expect(scaleQuantity(quantity, servings, base)).toBeCloseTo(result);
});

test('do smaku pozostaje bez zmian', () => {
  expect(scaleQuantity(null, 12, 2)).toBeNull();
  expect(formatScaledQuantity(null, '', 12, 2)).toBe('do smaku');
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
  [12, 12],
  [13, 12],
])('licznik %s ogranicza się do %s', (value, result) => {
  expect(clampServings(value)).toBe(result);
});

test.each([0, 13, 1.5, Number.NaN])(
  'odrzuca niepoprawną liczbę porcji %s',
  (value) => {
    expect(() => scaleQuantity(1, value, 2)).toThrow(RangeError);
  },
);

test.each([0, -1, 51, 1.5])('odrzuca niepoprawną bazę porcji %s', (value) => {
  expect(() => scaleQuantity(1, 2, value)).toThrow(RangeError);
});
