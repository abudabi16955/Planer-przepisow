/** Calendar dates use YYYY-MM-DD, independent of the browser's time zone. */
export function parseISODate(date: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new RangeError('Nieprawidłowa data');
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new RangeError('Nieprawidłowa data');
  }
  return parsed;
}

/** Convert an instant to a calendar date in the configured application time zone. */
export function today(now: Date, timeZone = 'Europe/Warsaw'): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function addDays(date: string, days: number): string {
  if (!Number.isInteger(days))
    throw new RangeError('Liczba dni musi być całkowita');
  const parsed = parseISODate(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function startOfWeek(date: string): string {
  return addDays(date, -((parseISODate(date).getUTCDay() + 6) % 7));
}

export function weekDays(date: string): string[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, day) => addDays(start, day));
}

export function shiftWeek(date: string, weeks: number): string {
  if (!Number.isInteger(weeks))
    throw new RangeError('Liczba tygodni musi być całkowita');
  return addDays(startOfWeek(date), weeks * 7);
}

export function isToday(
  date: string,
  now: Date,
  timeZone = 'Europe/Warsaw',
): boolean {
  parseISODate(date);
  return date === today(now, timeZone);
}

export function formatWeekRange(date: string): string {
  const days = weekDays(date);
  const start = parseISODate(days[0]);
  const end = parseISODate(days[6]);
  const formatter = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
  });
  const month = (value: Date) =>
    formatter.formatToParts(value).find((part) => part.type === 'month')!.value;
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${start.getUTCDate()} ${month(start)} ${start.getUTCFullYear()} – ${end.getUTCDate()} ${month(end)} ${end.getUTCFullYear()}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${start.getUTCDate()} ${month(start)} – ${end.getUTCDate()} ${month(end)}`;
  }
  return `${start.getUTCDate()}–${end.getUTCDate()} ${month(end)}`;
}
