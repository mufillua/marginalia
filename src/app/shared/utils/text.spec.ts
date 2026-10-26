import { describe, expect, it } from 'vitest';
import { authorLine, htmlToText, isISBN, normalizeForCompare, secureCoverUrl, splitList } from './text';
import { parseISODate, toISODate } from './dates';

describe('text utilities', () => {
  it('turns API HTML descriptions into plain paragraphs', () => {
    expect(htmlToText('<p>One <b>bold</b> line.</p><p>Two&amp;three</p>')).toBe('One bold line.\n\nTwo&three');
    expect(htmlToText(null)).toBeNull();
  });

  it('normalizes titles for duplicate checks', () => {
    expect(normalizeForCompare('The Remains of the Day')).toBe(normalizeForCompare('remains of the day'));
    expect(normalizeForCompare('Les Misérables')).toBe('les miserables');
  });

  it('upgrades cover links to https and strips the page curl', () => {
    expect(secureCoverUrl('http://books.google.com/x?id=1&edge=curl&zoom=1')).toBe('https://books.google.com/x?id=1&zoom=1');
    expect(secureCoverUrl('javascript:alert(1)')).toBeNull();
  });

  it('recognises ISBN-10 and ISBN-13', () => {
    expect(isISBN('978-0-14-143954-9')).toBe(true);
    expect(isISBN('014143954X')).toBe(true);
    expect(isISBN('middlemarch')).toBe(false);
  });

  it('formats author lists', () => {
    expect(authorLine(['A'])).toBe('A');
    expect(authorLine(['A', 'B'])).toBe('A and B');
    expect(authorLine(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('splits and de-duplicates lists', () => {
    expect(splitList('Fiction, fiction; Poetry')).toEqual(['Fiction', 'Poetry']);
  });

  it('treats YYYY-MM-DD as a local date (no off-by-one)', () => {
    const d = parseISODate('2026-03-01')!;
    expect(d.getDate()).toBe(1);
    expect(toISODate(d)).toBe('2026-03-01');
  });
});
