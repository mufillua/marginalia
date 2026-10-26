export type AppErrorKind =
  | 'offline'
  | 'network'
  | 'conflict'
  | 'auth'
  | 'validation'
  | 'not_found'
  | 'rate_limit'
  | 'unknown';

/** A user-presentable error. `message` is safe to show in the interface. */
export class AppError extends Error {
  constructor(
    readonly kind: AppErrorKind,
    message: string,
    override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

interface PostgrestLikeError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  status?: number;
}

const looksLikeNetworkFailure = (message: string): boolean =>
  /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message);

/** Converts Supabase/PostgREST/fetch errors into AppError with friendly copy. */
export function toAppError(error: unknown, action = 'save that change'): AppError {
  if (error instanceof AppError) return error;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return new AppError(
      'offline',
      `You're offline, so we couldn't ${action}. Nothing was lost — try again once you're connected.`,
      error,
    );
  }

  const e = (error ?? {}) as PostgrestLikeError;
  const message = e.message ?? String(error ?? '');

  if (looksLikeNetworkFailure(message)) {
    return new AppError(
      'network',
      `We couldn't reach your library to ${action}. Check your connection and try again.`,
      error,
    );
  }

  switch (e.code) {
    case '23514': // check_violation
    case '23502': // not_null_violation
    case '22001': // string too long
    case '22P02': // invalid input syntax
      return new AppError('validation', `Some details didn't look right, so we couldn't ${action}. ${humanizeConstraint(message)}`, error);
    case '23503':
      return new AppError('not_found', `That book is no longer on your shelf, so we couldn't ${action}.`, error);
    case '42501':
      return new AppError('auth', `You don't have permission to ${action}. Try signing in again.`, error);
    case 'PGRST301':
    case 'PGRST303':
      return new AppError('auth', 'Your session has expired. Sign in again to continue.', error);
    case 'PGRST116':
      return new AppError('not_found', 'That item could not be found. It may have been deleted on another device.', error);
  }

  if (e.status === 429) {
    return new AppError('rate_limit', 'Too many requests at once. Wait a moment and try again.', error);
  }

  return new AppError('unknown', `Something went wrong and we couldn't ${action}. Please try again.`, error);
}

function humanizeConstraint(message: string): string {
  if (message.includes('current_page_within_total')) return 'The current page is higher than the total pages.';
  if (message.includes('finished_after_started')) return 'The finish date is before the start date.';
  if (message.includes('cover_url')) return 'Cover links must start with https://.';
  if (message.includes('rating')) return 'Ratings go from half a star to five stars.';
  if (message.includes('published_year')) return 'The publication year looks out of range.';
  return '';
}
