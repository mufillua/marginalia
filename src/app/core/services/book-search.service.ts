import { Injectable } from '@angular/core';
import { env } from '../config/env';
import { BookSearchResult } from '../models/models';
import { htmlToText, isISBN, secureCoverUrl, titleCase, uniqueCaseless } from '../../shared/utils/text';
import { AppError } from './app-error';

export type SearchSource = 'google_books' | 'open_library';

export interface SearchOutcome {
  results: BookSearchResult[];
  source: SearchSource;
  /** True when the preferred source failed and we used the other one. */
  fellBack: boolean;
  fallbackReason?: string;
}

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes';
const OPEN_LIBRARY = 'https://openlibrary.org';
const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org/b/id';
const MAX_RESULTS = 20;
const CACHE_LIMIT = 40;

// Open Library subjects that describe the edition or access, not the book.
const NOISY_SUBJECTS =
  /accessible book|protected daisy|in library|large type|lending library|open library|nyt:|new york times|reading level|award|staff picks|fiction, general|general$|^fiction in english|translations into|^english |internet archive|long now|^\d|overdrive/i;

interface GoogleVolume {
  id: string;
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: { type: string; identifier: string }[];
    pageCount?: number;
    categories?: string[];
    imageLinks?: Partial<Record<'smallThumbnail' | 'thumbnail' | 'small' | 'medium' | 'large' | 'extraLarge', string>>;
  };
}

interface OpenLibraryDoc {
  key: string;
  title?: string;
  subtitle?: string;
  author_name?: string[];
  first_publish_year?: number;
  publisher?: string[];
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
}

/**
 * Book metadata from Google Books, with Open Library as a fallback.
 * Nothing is invented: missing fields stay empty for the reader to fill in.
 */
@Injectable({ providedIn: 'root' })
export class BookSearchService {
  private readonly cache = new Map<string, SearchOutcome>();

  async search(rawQuery: string, preferred: SearchSource, signal?: AbortSignal): Promise<SearchOutcome> {
    const query = rawQuery.trim();
    const cacheKey = `${preferred}:${query.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const primary = preferred === 'google_books' ? this.searchGoogle : this.searchOpenLibrary;
    const secondary = preferred === 'google_books' ? this.searchOpenLibrary : this.searchGoogle;
    const secondarySource: SearchSource = preferred === 'google_books' ? 'open_library' : 'google_books';

    let outcome: SearchOutcome;
    try {
      outcome = { results: await primary.call(this, query, signal), source: preferred, fellBack: false };
    } catch (error) {
      if (signal?.aborted) throw error;
      const reason = error instanceof AppError ? error.message : 'The catalogue did not respond.';
      // Try the other catalogue before giving up.
      const results = await secondary.call(this, query, signal);
      outcome = { results, source: secondarySource, fellBack: true, fallbackReason: reason };
    }

    this.cache.set(cacheKey, outcome);
    if (this.cache.size > CACHE_LIMIT) this.cache.delete(this.cache.keys().next().value!);
    return outcome;
  }

  /** Fetches the fuller record (complete description, larger cover, subjects). */
  async details(result: BookSearchResult, signal?: AbortSignal): Promise<BookSearchResult> {
    try {
      if (result.source === 'google_books') {
        const url = new URL(`${GOOGLE}/${encodeURIComponent(result.externalId)}`);
        url.searchParams.set(
          'fields',
          'id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks)',
        );
        if (env.googleBooksApiKey) url.searchParams.set('key', env.googleBooksApiKey);
        const volume = await this.getJson<GoogleVolume>(url, signal);
        const full = this.fromGoogle(volume);
        return mergePreferringFuller(result, full);
      }
      const work = await this.getJson<{ description?: string | { value?: string }; subjects?: string[] }>(
        new URL(`${OPEN_LIBRARY}${result.externalId}.json`),
        signal,
      );
      const description = typeof work.description === 'string' ? work.description : work.description?.value;
      return {
        ...result,
        summary: cleanOpenLibraryDescription(description) ?? result.summary,
        genres: result.genres.length ? result.genres : cleanSubjects(work.subjects ?? []),
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      // The search result is still useful on its own.
      return result;
    }
  }

  private async searchGoogle(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
    const url = new URL(GOOGLE);
    url.searchParams.set('q', isISBN(query) ? `isbn:${query.replace(/[-\s]/g, '')}` : query);
    url.searchParams.set('maxResults', String(MAX_RESULTS));
    url.searchParams.set('printType', 'books');
    url.searchParams.set(
      'fields',
      'items(id,volumeInfo(title,subtitle,authors,publisher,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks))',
    );
    if (env.googleBooksApiKey) url.searchParams.set('key', env.googleBooksApiKey);
    const data = await this.getJson<{ items?: GoogleVolume[] }>(url, signal);
    return dedupeResults((data.items ?? []).map((v) => this.fromGoogle(v)).filter((r) => r.title));
  }

  private async searchOpenLibrary(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
    const url = new URL(`${OPEN_LIBRARY}/search.json`);
    if (isISBN(query)) url.searchParams.set('isbn', query.replace(/[-\s]/g, ''));
    else url.searchParams.set('q', query);
    url.searchParams.set('limit', String(MAX_RESULTS));
    url.searchParams.set(
      'fields',
      'key,title,subtitle,author_name,first_publish_year,publisher,isbn,cover_i,number_of_pages_median,subject',
    );
    const data = await this.getJson<{ docs?: OpenLibraryDoc[] }>(url, signal);
    return dedupeResults((data.docs ?? []).map((d) => this.fromOpenLibrary(d)).filter((r) => r.title));
  }

  private fromGoogle(volume: GoogleVolume): BookSearchResult {
    const info = volume.volumeInfo ?? {};
    const ids = info.industryIdentifiers ?? [];
    const isbn =
      ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier ?? null;
    const links = info.imageLinks ?? {};
    const thumbnail = secureCoverUrl(links.thumbnail ?? links.smallThumbnail);
    const cover = secureCoverUrl(links.medium ?? links.large ?? links.small ?? links.thumbnail ?? links.smallThumbnail);
    return {
      source: 'google_books',
      externalId: volume.id,
      title: (info.title ?? '').trim(),
      subtitle: info.subtitle?.trim() || null,
      authors: uniqueCaseless((info.authors ?? []).map((a) => a.trim()).filter(Boolean)),
      summary: htmlToText(info.description),
      genres: cleanGoogleCategories(info.categories ?? []),
      coverUrl: cover,
      thumbnailUrl: thumbnail ?? cover,
      isbn,
      publisher: info.publisher?.trim() || null,
      publishedYear: parseYear(info.publishedDate),
      pageCount: info.pageCount && info.pageCount > 0 ? info.pageCount : null,
    };
  }

  private fromOpenLibrary(doc: OpenLibraryDoc): BookSearchResult {
    const cover = doc.cover_i ? `${OPEN_LIBRARY_COVERS}/${doc.cover_i}-L.jpg` : null;
    const isbn13 = doc.isbn?.find((i) => i.length === 13) ?? doc.isbn?.[0] ?? null;
    return {
      source: 'open_library',
      externalId: doc.key,
      title: (doc.title ?? '').trim(),
      subtitle: doc.subtitle?.trim() || null,
      authors: uniqueCaseless((doc.author_name ?? []).slice(0, 6)),
      summary: null, // fetched with details()
      genres: cleanSubjects(doc.subject ?? []),
      coverUrl: cover,
      thumbnailUrl: doc.cover_i ? `${OPEN_LIBRARY_COVERS}/${doc.cover_i}-M.jpg` : null,
      isbn: isbn13,
      publisher: doc.publisher?.[0]?.trim() || null,
      publishedYear: doc.first_publish_year ?? null,
      pageCount: doc.number_of_pages_median ?? null,
    };
  }

  private async getJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
    let response: Response;
    try {
      response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AppError('network', "We couldn't reach the book catalogue. Check your connection.", error);
    }
    if (response.status === 429) {
      throw new AppError('rate_limit', 'The catalogue is busy right now (too many searches).');
    }
    if (!response.ok) {
      throw new AppError('unknown', `The catalogue returned an error (${response.status}).`);
    }
    return (await response.json()) as T;
  }
}

function parseYear(value: string | undefined): number | null {
  const match = value?.match(/-?\d{3,4}/);
  return match ? Number(match[0]) : null;
}

function cleanGoogleCategories(categories: string[]): string[] {
  const parts = categories.flatMap((c) => c.split(/\s*\/\s*/)).map((c) => c.trim());
  return uniqueCaseless(parts.filter((p) => p && !/^general$/i.test(p))).slice(0, 5);
}

function cleanSubjects(subjects: string[]): string[] {
  const kept = subjects
    .map((s) => s.trim())
    .filter((s) => s && s.length <= 32 && s.split(/\s+/).length <= 3 && !NOISY_SUBJECTS.test(s))
    .map((s) => titleCase(s.toLowerCase()));
  return uniqueCaseless(kept).slice(0, 5);
}

function cleanOpenLibraryDescription(text: string | undefined): string | null {
  if (!text) return null;
  // Strip Open Library's trailing source notes and markdown links.
  const cleaned = text
    .replace(/\r/g, '')
    .split(/\n-{3,}\n|\n\(\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
  return cleaned || null;
}

function mergePreferringFuller(a: BookSearchResult, b: BookSearchResult): BookSearchResult {
  return {
    ...a,
    summary: (b.summary?.length ?? 0) > (a.summary?.length ?? 0) ? b.summary : a.summary,
    genres: b.genres.length > a.genres.length ? b.genres : a.genres,
    coverUrl: b.coverUrl ?? a.coverUrl,
    isbn: a.isbn ?? b.isbn,
    publisher: a.publisher ?? b.publisher,
    publishedYear: a.publishedYear ?? b.publishedYear,
    pageCount: a.pageCount ?? b.pageCount,
    authors: a.authors.length ? a.authors : b.authors,
  };
}

function dedupeResults(results: BookSearchResult[]): BookSearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = `${r.title.toLowerCase()}|${r.authors[0]?.toLowerCase() ?? ''}|${r.publishedYear ?? ''}|${r.isbn ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
