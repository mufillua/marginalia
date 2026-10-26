import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { SupabaseClient } from '@supabase/supabase-js';
import { TableStore } from './table-store';
import { SyncedRecord } from '../models/models';

interface Row extends SyncedRecord {
  title: string;
}

/** A tiny fake of the PostgREST query builder used by TableStore. */
function fakeClient(state: { rows: Row[]; failUpdate?: boolean }) {
  const builder = (table: string) => {
    let filters: [string, unknown][] = [];
    let op: 'select' | 'update' | 'insert' | 'delete' = 'select';
    let payload: Partial<Row> | null = null;
    const run = () => {
      const match = (r: Row) => filters.every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v);
      if (op === 'update') {
        const hit = state.rows.filter(match);
        hit.forEach((r) => Object.assign(r, payload, { version: r.version + 1 }));
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (op === 'insert') {
        const row = { id: 'new', version: 1, createdAt: 'c', updatedAt: 'u', title: '', ...payload } as Row;
        state.rows.push(row);
        return { data: { ...row }, error: null };
      }
      if (op === 'delete') {
        state.rows = state.rows.filter((r) => !match(r));
        return { data: null, error: null };
      }
      return { data: state.rows.filter(match).map((r) => ({ ...r })), error: null };
    };
    const q: Record<string, unknown> = {
      select: () => q,
      insert: (p: Partial<Row>) => ((op = 'insert'), (payload = p), q),
      update: (p: Partial<Row>) => ((op = 'update'), (payload = p), q),
      delete: () => ((op = 'delete'), q),
      eq: (k: string, v: unknown) => ((filters = [...filters, [k, v]]), q),
      single: () => Promise.resolve(run()),
      maybeSingle: () => {
        const res = run() as { data: Row[] };
        return Promise.resolve({ data: res.data[0] ?? null, error: null });
      },
      then: (resolve: (v: unknown) => void) => resolve(run()),
    };
    void table;
    return q;
  };
  return { from: builder } as unknown as SupabaseClient;
}

const row = (id: string, version: number, title = id): Row => ({
  id,
  version,
  title,
  createdAt: '2026-01-01',
  updatedAt: `2026-01-0${version}`,
});

describe('TableStore (version-aware sync)', () => {
  let state: { rows: Row[] };
  let store: TableStore<Row, Row>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    state = { rows: [row('a', 1), row('b', 1)] };
    store = TestBed.runInInjectionContext(
      () => new TableStore<Row, Row>(() => fakeClient(state), { table: 't', fromRow: (r) => ({ ...r }) }),
    );
  });

  it('loads every row', async () => {
    await store.fetchAll();
    expect(store.all().map((r) => r.id).sort()).toEqual(['a', 'b']);
  });

  it('ignores realtime events older than what it has', async () => {
    await store.fetchAll();
    store.applyChange('UPDATE', { ...row('a', 3, 'newest') }, {});
    store.applyChange('UPDATE', { ...row('a', 2, 'older') }, {});
    expect(store.get('a')?.title).toBe('newest');
  });

  it('keeps a newer local row when a slow fetch returns older data', async () => {
    await store.fetchAll();
    store.upsertLocal(row('a', 5, 'local newer'));
    await store.fetchAll(); // server still says version 1
    expect(store.get('a')?.title).toBe('local newer');
  });

  it('does not resurrect a row deleted while a fetch was in flight', async () => {
    await store.fetchAll();
    store.applyChange('DELETE', {}, { id: 'b' });
    await store.fetchAll(); // fake server still returns b
    expect(store.get('b')).toBeUndefined();
  });

  it('refuses a stale edit and loads the newer version instead', async () => {
    await store.fetchAll();
    state.rows[0].version = 4; // edited on another device
    state.rows[0].title = 'from phone';
    await expect(store.update('a', { title: 'from laptop' }, { expectedVersion: 1 })).rejects.toMatchObject({ kind: 'conflict' });
    expect(state.rows[0].title).toBe('from phone');
    expect(store.get('a')?.title).toBe('from phone');
  });

  it('applies an update when the version matches', async () => {
    await store.fetchAll();
    const updated = await store.update('a', { title: 'renamed' }, { expectedVersion: 1 });
    expect(updated.version).toBe(2);
    expect(store.get('a')?.title).toBe('renamed');
  });

  it('clear() forgets everything (used on sign-out)', async () => {
    await store.fetchAll();
    store.clear();
    expect(store.all()).toEqual([]);
    expect(store.loaded()).toBe(false);
  });
});
