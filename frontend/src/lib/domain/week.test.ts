import { expect, test } from 'vitest';
import {
  addDays,
  formatWeekRange,
  isToday,
  parseISODate,
  shiftWeek,
  startOfWeek,
  today,
  weekDays,
} from './week';

test.each([
  ['2026-10-19', '2026-10-19'],
  ['2026-10-21', '2026-10-19'],
  ['2026-10-25', '2026-10-19'],
  ['2026-11-01', '2026-10-26'],
  ['2027-01-01', '2026-12-28'],
])('poniedziałek dla %s', (date, expected) =>
  expect(startOfWeek(date)).toBe(expected),
);

test('tydzień ma siedem kolejnych dni od poniedziałku do niedzieli', () => {
  expect(weekDays('2026-10-21')).toEqual([
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ]);
});

test('przesuwanie tygodnia w obie strony przez przełom roku i miesiąca', () => {
  expect(shiftWeek('2026-12-30', 1)).toBe('2027-01-04');
  expect(shiftWeek('2027-01-04', -1)).toBe('2026-12-28');
  expect(shiftWeek('2026-10-21', 1)).toBe('2026-10-26');
  expect(shiftWeek('2026-10-21', -1)).toBe('2026-10-12');
});

test.each([
  ['2026-10-21', '19–25 października'],
  ['2025-10-29', '27 października – 2 listopada'],
  ['2026-12-31', '28 grudnia 2026 – 3 stycznia 2027'],
])('zakres tygodnia %s', (date, expected) =>
  expect(formatWeekRange(date)).toBe(expected),
);

test.each([
  ['2026-10-18T22:30:00Z', '2026-10-19', '2026-10-19'],
  ['2026-03-28T23:30:00Z', '2026-03-29', '2026-03-23'],
  ['2026-03-29T00:59:59Z', '2026-03-29', '2026-03-23'],
  ['2026-03-29T01:00:00Z', '2026-03-29', '2026-03-23'],
  ['2026-03-29T22:30:00Z', '2026-03-30', '2026-03-30'],
  ['2026-10-25T00:59:59Z', '2026-10-25', '2026-10-19'],
  ['2026-10-25T01:00:00Z', '2026-10-25', '2026-10-19'],
  ['2026-10-25T23:30:00Z', '2026-10-26', '2026-10-26'],
  ['2026-12-31T23:30:00Z', '2027-01-01', '2026-12-28'],
])('dziś i tydzień w Warszawie dla %s', (instant, date, monday) => {
  const now = new Date(instant);
  expect(today(now)).toBe(date);
  expect(startOfWeek(today(now))).toBe(monday);
  expect(isToday(date, now)).toBe(true);
  expect(isToday(addDays(date, -1), now)).toBe(false);
});

test('strefa aplikacji jest konfigurowalna', () => {
  const now = new Date('2026-10-18T22:30:00Z');
  expect(today(now, 'UTC')).toBe('2026-10-18');
  expect(isToday('2026-10-19', now, 'UTC')).toBe(false);
});

test('dni kalendarzowe zachowują ciągłość przez obie zmiany czasu i rok przestępny', () => {
  expect(weekDays('2026-03-29')).toHaveLength(7);
  expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
});

test.each(['2026-02-29', '2026-13-01', '2026-04-31', '21.10.2026'])(
  'odrzuca niepoprawną datę %s',
  (date) => {
    expect(() => parseISODate(date)).toThrow(RangeError);
  },
);
