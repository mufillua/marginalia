import { computed, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SyncedRecord } from '../models/models';
import { AppError, toAppError } from '../services/app-error';

export interface TableStoreConfig<TRow extends { id: string }, TModel extends SyncedRecord> {
  table: string;
  fromRow: (row: TRow) => TModel;
}

/** Anything that can absorb a Supabase Realtime row change. */
export interface ChangeSink {
  applyChange(eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow: Record<string, unknown>, oldRow: Record<string, unknown>): void;
}

export interface UpdateOptions {
  /**
   * When set, the update only applies if the row is still at this version.
   * Used for full edit forms so an older edit never overwrites a newer one
   * made on another device.
   */
  expectedVersion?: number;
}

const TOMBSTONE_TTL_MS = 10 * 60 * 1000;

/**
 * Client-side mirror of one table for the signed-in user.
 *
 * - Server is the source of truth: nothing is added locally until the
 *   database confirms it.
 * - Every merge is version-aware, so a slow refetch or a late realtime
 *   event can never replace newer data with older data.
 * - Deleted ids are remembered briefly so an in-flight fetch can't
 *   resurrect them.
 */
export class TableStore<TRow extends { id: string }, TModel extends SyncedRecord> implements ChangeSink {
  private readonly rows = signal<ReadonlyMap<string, TModel>>(new Map());
  private readonly tombstones = new Map<string, number>();
  private readonly insertedAt = new Map<string, number>();

  readonly byId = this.rows.asReadonly();
  readonly all = computed(() => [...this.rows().values()]);
  readonly loaded = signal(false);

  constructor(
    private readonly client: () => SupabaseClient,
    private readonly config: TableStoreConfig<TRow, TModel>,
  ) {}

  get(id: string | null | undefined): TModel | undefined {
    return id ? this.rows().get(id) : undefined;
  }

  clear(): void {
    this.rows.set(new Map());
    this.tombstones.clear();
    this.insertedAt.clear();
    this.loaded.set(false);
  }

  /** Loads every row the current user can see (RLS limits this to their own). */
  async fetchAll(): Promise<void> {
    const startedAt = Date.now();
    const { data, error } = await this.client().from(this.config.table).select('*');
    if (error) throw toAppError(error, 'load your library');
    this.pruneTombstones();

    const current = this.rows();
    const next = new Map<string, TModel>();
    for (const row of (data ?? []) as TRow[]) {
      if (this.tombstones.has(row.id)) continue;
      const incoming = this.config.fromRow(row);
      const local = current.get(row.id);
      next.set(row.id, local && local.version > incoming.version ? local : incoming);
    }
    // Keep rows created locally after this fetch began (the response can't include them).
    for (const [id, local] of current) {
      if (!next.has(id) && (this.insertedAt.get(id) ?? 0) >= startedAt) next.set(id, local);
    }
    this.rows.set(next);
    this.loaded.set(true);
  }

  /** Applies a Supabase Realtime postgres_changes payload. */
  applyChange(eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow: Record<string, unknown>, oldRow: Record<string, unknown>): void {
    if (eventType === 'DELETE') {
      const id = typeof oldRow?.['id'] === 'string' ? oldRow['id'] : null;
      if (id && this.rows().has(id)) this.removeLocal(id);
      return;
    }
    const id = typeof newRow?.['id'] === 'string' ? newRow['id'] : null;
    if (!id || this.tombstones.has(id)) return;
    this.upsertLocal(this.config.fromRow(newRow as unknown as TRow));
  }

  async insert(row: Partial<TRow>, action = 'save it'): Promise<TModel> {
    const { data, error } = await this.client().from(this.config.table).insert(row as never).select().single();
    if (error) throw toAppError(error, action);
    const model = this.config.fromRow(data as TRow);
    this.insertedAt.set(model.id, Date.now());
    this.upsertLocal(model);
    return model;
  }

  async upsert(row: Partial<TRow>, onConflict: string, action = 'save it'): Promise<TModel> {
    const { data, error } = await this.client()
      .from(this.config.table)
      .upsert(row as never, { onConflict })
      .select()
      .single();
    if (error) throw toAppError(error, action);
    const model = this.config.fromRow(data as TRow);
    this.insertedAt.set(model.id, Date.now());
    this.upsertLocal(model);
    return model;
  }

  async update(id: string, patch: Partial<TRow>, options: UpdateOptions = {}, action = 'save your changes'): Promise<TModel> {
    let query = this.client().from(this.config.table).update(patch as never).eq('id', id);
    if (options.expectedVersion !== undefined) query = query.eq('version', options.expectedVersion);
    const { data, error } = await query.select();
    if (error) throw toAppError(error, action);

    const rows = (data ?? []) as TRow[];
    if (rows.length === 0) {
      // Either someone changed it first (version moved on) or it was deleted.
      const { data: latest, error: readError } = await this.client()
        .from(this.config.table)
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw toAppError(readError, action);
      if (!latest) {
        this.removeLocal(id);
        throw new AppError('not_found', 'This was deleted on another device, so your changes could not be saved.');
      }
      this.upsertLocal(this.config.fromRow(latest as TRow));
      throw new AppError(
        'conflict',
        'This was changed on another device while you were editing. We loaded the latest version, so please review it and make your change again.',
      );
    }
    const model = this.config.fromRow(rows[0]);
    this.upsertLocal(model);
    return model;
  }

  async remove(id: string, action = 'delete it'): Promise<void> {
    const { error } = await this.client().from(this.config.table).delete().eq('id', id);
    if (error) throw toAppError(error, action);
    this.removeLocal(id);
  }

  /** Inserts or replaces a row locally if it is newer than what we have. */
  upsertLocal(model: TModel): void {
    const local = this.rows().get(model.id);
    if (local && local.version >= model.version) return;
    const next = new Map(this.rows());
    next.set(model.id, model);
    this.rows.set(next);
  }

  /** Removes rows locally whose deletion happened server-side (e.g. cascades). */
  removeLocalWhere(predicate: (model: TModel) => boolean): void {
    const next = new Map(this.rows());
    let changed = false;
    for (const [id, model] of next) {
      if (predicate(model)) {
        next.delete(id);
        this.tombstones.set(id, Date.now());
        changed = true;
      }
    }
    if (changed) this.rows.set(next);
  }

  /** Replaces local rows matching a predicate (used for server-side set-null actions). */
  patchLocalWhere(predicate: (model: TModel) => boolean, patch: (model: TModel) => TModel): void {
    const next = new Map(this.rows());
    let changed = false;
    for (const [id, model] of next) {
      if (predicate(model)) {
        next.set(id, patch(model));
        changed = true;
      }
    }
    if (changed) this.rows.set(next);
  }

  private removeLocal(id: string): void {
    this.tombstones.set(id, Date.now());
    if (!this.rows().has(id)) return;
    const next = new Map(this.rows());
    next.delete(id);
    this.rows.set(next);
  }

  private pruneTombstones(): void {
    const cutoff = Date.now() - TOMBSTONE_TTL_MS;
    for (const [id, at] of this.tombstones) if (at < cutoff) this.tombstones.delete(id);
  }
}
