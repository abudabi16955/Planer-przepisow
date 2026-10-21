import { parseISODate, today } from './week';

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
const forms: Record<string, readonly [string, string, string, string]> = {
  łyżka: ['łyżka', 'łyżki', 'łyżek', 'łyżki'],
  łyżeczka: ['łyżeczka', 'łyżeczki', 'łyżeczek', 'łyżeczki'],
  szklanka: ['szklanka', 'szklanki', 'szklanek', 'szklanki'],
  szczypta: ['szczypta', 'szczypty', 'szczypt', 'szczypty'],
  puszka: ['puszka', 'puszki', 'puszek', 'puszki'],
  ząbek: ['ząbek', 'ząbki', 'ząbków', 'ząbka'],
};

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('pl-PL', {
    useGrouping: false,
    maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 1,
  }).format(value);
}

function pluralIndex(value: number): number {
  if (!Number.isInteger(value)) return 3;
  if (value === 1) return 0;
  return value % 10 >= 2 &&
    value % 10 <= 4 &&
    (value % 100 < 12 || value % 100 > 14)
    ? 1
    : 2;
}

/** quantity=null represents “do smaku”; quantities are never scaled here. */
export function formatQuantity(quantity: number | null, unit: string): string {
  if (quantity === null || unit === 'do smaku') return 'do smaku';
  // Decline the displayed number, so a rounded “1” cannot become “1 łyżki”.
  const displayed = formatNumber(quantity);
  const rounded = Number(displayed.replace(',', '.'));
  const label = forms[unit]?.[pluralIndex(rounded)] ?? unit;
  return label ? `${displayed} ${label}` : displayed;
}

export function formatRecipeCount(count: number): string {
  const labels = ['przepis', 'przepisy', 'przepisów'];
  return `${formatNumber(count)} ${labels[pluralIndex(count)] ?? 'przepisu'}`;
}

/** File sizes use 1024 bytes per KB and 1024 KB per MB. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 ** 2) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  const megabytes = new Intl.NumberFormat('pl-PL', {
    useGrouping: false,
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(bytes / 1024 ** 2);
  return `${megabytes} MB`;
}

function calendarDate(value: string | Date, timeZone: string): Date {
  return parseISODate(
    typeof value === 'string' ? value : today(value, timeZone),
  );
}

export function formatDate(
  value: string | Date,
  timeZone = 'Europe/Warsaw',
): string {
  const date = calendarDate(value, timeZone);
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatDayHeading(
  value: string | Date,
  timeZone = 'Europe/Warsaw',
): string {
  const label = new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(calendarDate(value, timeZone));
  return label.charAt(0).toLocaleUpperCase('pl-PL') + label.slice(1);
}
