/** Local calendar date as YYYY-MM-DD (not UTC, so "today" matches the reader's day). */
export function todayISO(now = new Date()): string {
  return toISODate(now);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parses YYYY-MM-DD as a local date (avoids the UTC off-by-one). */
export function parseISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

const longFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
const shortFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const dayMonthFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long' });
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const monthYearFormat = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

export const formatLongDate = (value: string | Date | null | undefined): string => {
  const d = value instanceof Date ? value : parseISODate(value) ?? (value ? new Date(value) : null);
  return d && !Number.isNaN(d.getTime()) ? longFormat.format(d) : '';
};

export const formatShortDate = (value: string | Date | null | undefined): string => {
  const d = value instanceof Date ? value : parseISODate(value) ?? (value ? new Date(value) : null);
  return d && !Number.isNaN(d.getTime()) ? shortFormat.format(d) : '';
};

export const formatDayMonth = (value: string | Date): string => {
  const d = value instanceof Date ? value : parseISODate(value);
  return d ? dayMonthFormat.format(d) : '';
};

export const formatWeekday = (d: Date): string => weekdayFormat.format(d);

export const formatMonthYear = (value: string | Date): string => {
  const d = value instanceof Date ? value : parseISODate(value);
  return d ? monthYearFormat.format(d) : '';
};

export const MONTH_INITIALS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(2026, i, 1)),
);

export function greetingFor(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}
