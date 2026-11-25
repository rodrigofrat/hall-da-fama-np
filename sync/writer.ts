import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SnapshotPayload } from './build';
import type { Issue } from './workbook';

const TABLE_ORDER: (keyof SnapshotPayload)[] = [
  'cycles', 'creators', 'cycle_balances', 'monthly_coupons', 'pip_status', 'gift_deliveries',
  'gift_next', 'ranking_entries', 'calendar_events', 'draw_results', 'program_state',
];

export function serviceClient(url: string, secretKey: string): SupabaseClient {
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function rpc<T>(db: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data as T;
}

export async function beginRun(db: SupabaseClient, trigger: string) {
  return rpc<string>(db, 'sync_begin', { p_trigger: trigger });
}
export async function activeHash(db: SupabaseClient) {
  return rpc<string | null>(db, 'sync_active_hash', {});
}
export async function finishRun(db: SupabaseClient, run: string, status: 'failed' | 'unchanged', message: string) {
  await rpc(db, 'sync_finish', { p_run: run, p_status: status, p_message: message });
}

export async function recordIssues(db: SupabaseClient, run: string, issues: Issue[]) {
  const rows = issues.slice(0, 1000).map((i) => ({ run_id: run, severity: i.severity, sheet: i.sheet, row_ref: i.rowRef, code: i.code, message: i.message }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('validation_issues').insert(rows.slice(i, i + 500));
    if (error) throw new Error(`validation_issues: ${error.message}`);
  }
}

/** Grava o snapshot em staging e ativa. Se qualquer passo falhar, a versão ativa anterior é mantida. */
export async function writeSnapshot(db: SupabaseClient, run: string, hash: string, payload: SnapshotPayload, sources: unknown, message: string) {
  const snapshot = await rpc<string>(db, 'sync_create_snapshot', { p_run: run, p_hash: hash, p_sources: sources });
  for (const table of TABLE_ORDER) {
    const raw = payload[table];
    const rows = (Array.isArray(raw) ? raw : [raw]).map((r) => ({ ...(r as object), snapshot_id: snapshot }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  await rpc(db, 'sync_activate', { p_run: run, p_snapshot: snapshot, p_message: message });
  return snapshot;
}
