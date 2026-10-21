import { describe, expect, test } from 'vitest';
import {
  formatDate,
  formatDayHeading,
  formatFileSize,
  formatNumber,
  formatQuantity,
  formatRecipeCount,
} from './format';

test.each([
  [0, '0'],
  [0.5, '0,5'],
  [2.5, '2,5'],
  [2, '2'],
  [9.94, '9,9'],
  [9.99, '10'],
  [10, '10'],
  [10.4, '10'],
  [10.5, '11'],
  [140, '140'],
  [1234.2, '1234'],
])('formatuje liczbę %s', (value, expected) =>
  expect(formatNumber(value)).toBe(expected),
);

describe.each([
  ['łyżka', 'łyżka', 'łyżki', 'łyżek', 'łyżki'],
  ['łyżeczka', 'łyżeczka', 'łyżeczki', 'łyżeczek', 'łyżeczki'],
  ['szklanka', 'szklanka', 'szklanki', 'szklanek', 'szklanki'],
  ['szczypta', 'szczypta', 'szczypty', 'szczypt', 'szczypty'],
  ['puszka', 'puszka', 'puszki', 'puszek', 'puszki'],
  ['ząbek', 'ząbek', 'ząbki', 'ząbków', 'ząbka'],
])('odmienia %s', (unit, one, few, many, fraction) => {
  test.each([
    [1, one],
    [2, few],
    [3, few],
    [4, few],
    [5, many],
    [0, many],
    [12, many],
    [14, many],
    [21, many],
    [22, few],
    [24, few],
    [112, many],
    [122, few],
    [0.5, fraction],
  ])('ilość %s', (quantity, form) => {
    expect(formatQuantity(quantity, unit)).toBe(
      `${formatNumber(quantity)} ${form}`,
    );
  });
});

test.each(['g', 'kg', 'ml', 'l', 'szt.'])('nie odmienia %s', (unit) => {
  expect(formatQuantity(0.5, unit)).toBe(`0,5 ${unit}`);
  expect(formatQuantity(12, unit)).toBe(`12 ${unit}`);
});

test('do smaku nie zależy od ilości ani jednostki', () => {
  expect(formatQuantity(null, '')).toBe('do smaku');
  expect(formatQuantity(null, 'g')).toBe('do smaku');
  expect(formatQuantity(4, 'do smaku')).toBe('do smaku');
});

test('odmiana odpowiada liczbie widocznej po zaokrągleniu', () => {
  expect(formatQuantity(1.04, 'łyżka')).toBe('1 łyżka');
  expect(formatQuantity(12.4, 'łyżka')).toBe('12 łyżek');
});

test.each([
  [0, '0 przepisów'],
  [1, '1 przepis'],
  [3, '3 przepisy'],
  [5, '5 przepisów'],
  [12, '12 przepisów'],
  [22, '22 przepisy'],
  [21, '21 przepisów'],
  [112, '112 przepisów'],
])('licznik przepisów: %s', (value, expected) =>
  expect(formatRecipeCount(value)).toBe(expected),
);

test.each([
  [0, '0 KB'],
  [1024, '1 KB'],
  [512 * 1024, '512 KB'],
  [1024 ** 2 - 1, '1024 KB'],
  [1024 ** 2, '1,0 MB'],
  [21.3 * 1024 ** 2, '21,3 MB'],
])('rozmiar pliku %s', (value, expected) =>
  expect(formatFileSize(value)).toBe(expected),
);

test('polskie daty i nagłówki dni', () => {
  expect(formatDate('2026-10-09')).toBe('9 paź 2026');
  expect(formatDayHeading('2026-10-21')).toBe('Środa, 21 października');
  expect(formatDate(new Date('2026-12-31T23:30:00Z'))).toBe('1 sty 2027');
  expect(formatDayHeading(new Date('2026-12-31T23:30:00Z'))).toBe(
    'Piątek, 1 stycznia',
  );
  expect(formatDate(new Date('2026-12-31T23:30:00Z'), 'UTC')).toBe(
    '31 gru 2026',
  );
});

test('wszystkie skróty miesięcy dokładnie według SPEC', () => {
  const months = [
    'sty',
    'lut',
    'mar',
    'kwi',
    'maj',
    'cze',
    'lip',
    'sie',
    'wrz',
    'paź',
    'lis',
    'gru',
  ];
  months.forEach((month, index) => {
    expect(formatDate(`2026-${String(index + 1).padStart(2, '0')}-09`)).toBe(
      `9 ${month} 2026`,
    );
  });
});
