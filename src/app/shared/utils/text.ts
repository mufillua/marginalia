/** Converts API descriptions that contain HTML into plain paragraphs. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h\d)\s*>/gi, '\n\n')
    .replace(/<\s*li[^>]*>/gi, '• ');
  let text: string;
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
    text = doc.body.textContent ?? '';
  } else {
    text = withBreaks.replace(/<[^>]+>/g, '');
  }
  const cleaned = text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return cleaned || null;
}

/** Lowercase, no accents, no punctuation — for duplicate detection. */
export function normalizeForCompare(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^(the|a|an) /, '')
    .trim();
}

export function splitList(value: string | null | undefined, separator: RegExp = /[,;\n]/): string[] {
  if (!value) return [];
  return uniqueCaseless(
    value
      .split(separator)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function uniqueCaseless(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
    }
  }
  return out;
}

export function nullIfBlank(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function toIntOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

/** Stable small hash for picking a cover colour from a title. */
export function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function authorLine(authors: string[]): string {
  if (authors.length <= 1) return authors[0] ?? '';
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`;
  return `${authors.slice(0, -1).join(', ')} and ${authors[authors.length - 1]}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

/** Upgrades http cover links to https and strips Google's page-curl effect. */
export function secureCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let out = url.trim().replace(/^http:\/\//i, 'https://');
  out = out.replace(/&edge=curl/g, '');
  return /^https:\/\//.test(out) ? out : null;
}

export function isISBN(value: string): boolean {
  const digits = value.replace(/[-\s]/g, '');
  return /^(\d{9}[\dXx]|\d{13})$/.test(digits);
}
