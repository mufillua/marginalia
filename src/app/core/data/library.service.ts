import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import {
  bookFromRow,
  BookRow,
  goalFromRow,
  GoalRow,
  journalFromRow,
  JournalRow,
  profileFromRow,
  ProfileRow,
  quoteFromRow,
  QuoteRow,
} from '../models/mappers';
import { Book, JournalEntry, Profile, Quote, ReadingGoal } from '../models/models';
import { AppError, toAppError } from '../services/app-error';
import { AuthService } from '../services/auth.service';
import { ConnectivityService } from '../services/connectivity.service';
import { SupabaseService } from '../services/supabase.service';
import { ChangeSink, TableStore } from './table-store';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
export type LiveState = 'off' | 'connecting' | 'live' | 'reconnecting';

const REFRESH_ON_FOCUS_AFTER_MS = 20_000;

/**
 * Cloud sync for the signed-in reader.
 *
 * Loads everything once after sign-in, keeps it current with Supabase
 * Realtime, and refetches when the tab regains focus or the device comes
 * back online (covering anything realtime missed). Signing out wipes the
 * in-memory library immediately.
 */
@Injectable({ providedIn: 'root' })
export class LibraryService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthService);
  private readonly connectivity = inject(ConnectivityService);
  private readonly client = () => this.supabase.client;

  readonly books = new TableStore<BookRow, Book>(this.client, { table: 'books', fromRow: bookFromRow });
  readonly quotes = new TableStore<QuoteRow, Quote>(this.client, { table: 'quotes', fromRow: quoteFromRow });
  readonly journal = new TableStore<JournalRow, JournalEntry>(this.client, {
    table: 'journal_entries',
    fromRow: journalFromRow,
  });
  readonly goals = new TableStore<GoalRow, ReadingGoal>(this.client, {
    table: 'reading_goals',
    fromRow: goalFromRow,
  });

  readonly profile = signal<Profile | null>(null);
  readonly loadState = signal<LoadState>('idle');
  readonly loadError = signal<string | null>(null);
  readonly liveState = signal<LiveState>('off');
  readonly lastSyncedAt = signal<Date | null>(null);
  readonly refreshing = signal(false);
  private readonly pendingWrites = signal(0);
  readonly saving = computed(() => this.pendingWrites() > 0);

  private channel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;
  private lastFetchAt = 0;
  private refreshPromise: Promise<void> | null = null;

  private readonly onVisibility = () => {
    if (document.visibilityState === 'visible' && Date.now() - this.lastFetchAt > REFRESH_ON_FOCUS_AFTER_MS) {
      void this.refresh();
    }
  };
  private readonly onOnline = () => {
    void this.refresh();
    this.resubscribe();
  };

  constructor() {
    effect(() => {
      const userId = this.auth.userId();
      untracked(() => {
        if (userId === this.currentUserId) return;
        this.stop();
        if (userId) void this.start(userId);
      });
    });
  }

  /** Wraps a write so the interface can show a quiet "saving" state. */
  async write<T>(operation: () => Promise<T>, action = 'save that change'): Promise<T> {
    if (!this.connectivity.online()) {
      throw new AppError(
        'offline',
        `You're offline, so we couldn't ${action}. Nothing was lost — try again once you're connected.`,
      );
    }
    this.pendingWrites.update((n) => n + 1);
    try {
      return await operation();
    } catch (error) {
      throw toAppError(error, action);
    } finally {
      this.pendingWrites.update((n) => n - 1);
    }
  }

  async refresh(): Promise<void> {
    if (!this.currentUserId) return;
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshing.set(true);
    this.refreshPromise = (async () => {
      try {
        await Promise.all([
          this.books.fetchAll(),
          this.quotes.fetchAll(),
          this.journal.fetchAll(),
          this.goals.fetchAll(),
          this.loadProfile(),
        ]);
        this.lastFetchAt = Date.now();
        this.lastSyncedAt.set(new Date());
        this.loadError.set(null);
        this.loadState.set('ready');
      } catch (error) {
        const appError = toAppError(error, 'load your library');
        this.loadError.set(appError.message);
        // Keep showing what we already have; only a first load becomes an error state.
        if (this.loadState() !== 'ready') this.loadState.set('error');
      } finally {
        this.refreshing.set(false);
        this.refreshPromise = null;
      }
    })();
    return this.refreshPromise;
  }

  private async start(userId: string): Promise<void> {
    this.currentUserId = userId;
    this.loadState.set('loading');
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('online', this.onOnline);
    this.subscribe(userId);
    await this.refresh();
  }

  private stop(): void {
    this.currentUserId = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('online', this.onOnline);
    if (this.channel) {
      void this.client().removeChannel(this.channel);
      this.channel = null;
    }
    this.books.clear();
    this.quotes.clear();
    this.journal.clear();
    this.goals.clear();
    this.profile.set(null);
    this.loadState.set('idle');
    this.loadError.set(null);
    this.liveState.set('off');
    this.lastSyncedAt.set(null);
  }

  private async loadProfile(): Promise<void> {
    const userId = this.currentUserId;
    if (!userId) return;
    const { data, error } = await this.client().from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    if (data) {
      this.applyProfile(profileFromRow(data as ProfileRow));
      return;
    }
    // The signup trigger normally creates this; fall back if it didn't.
    const displayName = (this.auth.user()?.user_metadata?.['display_name'] as string | undefined) ?? null;
    const { data: created, error: insertError } = await this.client()
      .from('profiles')
      .upsert({ id: userId, display_name: displayName?.slice(0, 60) || null }, { onConflict: 'id' })
      .select()
      .single();
    if (insertError) throw insertError;
    this.applyProfile(profileFromRow(created as ProfileRow));
  }

  applyProfile(profile: Profile): void {
    const current = this.profile();
    if (current && current.id === profile.id && current.version > profile.version) return;
    this.profile.set(profile);
  }

  private resubscribe(): void {
    if (!this.currentUserId) return;
    if (this.channel) {
      void this.client().removeChannel(this.channel);
      this.channel = null;
    }
    this.subscribe(this.currentUserId);
  }

  private subscribe(userId: string): void {
    this.liveState.set('connecting');
    const mine = `user_id=eq.${userId}`;
    type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;

    const route = (store: ChangeSink) => (payload: Payload) =>
      store.applyChange(payload.eventType, payload.new as Record<string, unknown>, payload.old as Record<string, unknown>);

    let channel = this.client().channel(`library:${userId}`);
    const tables: [string, ChangeSink][] = [
      ['books', this.books],
      ['quotes', this.quotes],
      ['journal_entries', this.journal],
      ['reading_goals', this.goals],
    ];
    for (const [table, store] of tables) {
      channel = channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: mine }, route(store))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: mine }, route(store))
        // Delete events can't be filtered; they only carry the id, and we
        // ignore ids we don't have.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, route(store));
    }
    channel = channel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
      (payload: Payload) => this.applyProfile(profileFromRow(payload.new as unknown as ProfileRow)),
    );

    this.channel = channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        const wasReconnecting = this.liveState() === 'reconnecting';
        this.liveState.set('live');
        // Catch up on anything that changed while the connection was down.
        if (wasReconnecting) void this.refresh();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.liveState.set('reconnecting');
      } else if (status === 'CLOSED') {
        if (this.currentUserId) this.liveState.set('reconnecting');
      }
    });
  }
}
