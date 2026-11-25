import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { rankEntries } from '../domain/ranking';
import { mapEvent, mapMe, mapProgram, mapResult } from './mapper';
import type { BalanceRow, CreatorRow, CycleRow, DeliveryRow, EventRow, GiftNextRow, MonthlyRow, PipRow, ProgramRow, ResultRow } from './rows';
import { AccessError, type AdminStatus, type PortalData, type RankingResult } from './types';

/** Após esse tempo sem sincronizar, o portal avisa que os dados podem estar defasados. */
const STALE_HOURS = 36;

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseConfigured()) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).');
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}

function check<T>(res: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) {
    if (res.error.code === '42501') throw new AccessError('Sua conta não tem acesso a esta área.');
    throw new Error(`Falha ao carregar ${what}.`);
  }
  return res.data as T;
}

export class SupabaseData implements PortalData {
  readonly mode = 'supabase' as const;
  constructor(private db: SupabaseClient = getSupabase()) {}

  async listBrowsableCreators() {
    const canBrowse = check(await this.db.rpc('can_browse_creators'), 'permissão de consulta');
    if (!canBrowse) return null;
    const creators: { creator_id: string; handle: string }[] = [];
    const pageSize = 500;
    for (let start = 0; ; start += pageSize) {
      const page = check(await this.db.from('creators').select('creator_id, handle')
        .eq('in_current_hall', true).order('creator_id').range(start, start + pageSize - 1), 'criadores');
      creators.push(...page);
      if (page.length < pageSize) break;
    }
    return creators.sort((a, b) => a.handle.localeCompare(b.handle, 'pt-BR'));
  }

  async getMe(viewedCreatorId?: string) {
    const db = this.db;
    const [link, staff, program] = await Promise.all([
      db.from('account_links').select('creator_id, active, ranking_authorized, history_authorized').maybeSingle(),
      db.from('staff').select('user_id').maybeSingle(),
      db.from('program_state').select('analysis_month, last_closed_month, draw_month, program_start, synced_at').maybeSingle(),
    ]);
    const ownLink = check(link, 'conta') as { creator_id: string; active: boolean; ranking_authorized: boolean; history_authorized: boolean } | null;
    const creatorId = viewedCreatorId ?? ownLink?.creator_id;
    const l = viewedCreatorId ? { active: true, ranking_authorized: true } : ownLink;
    const isStaff = !!check(staff, 'equipe');
    if (!creatorId || !l || (!l.active && !ownLink?.history_authorized)) {
      if (isStaff) return this.staffOnly(check(program, 'programa') as ProgramRow | null);
      throw new AccessError('Sua conta ainda não está vinculada a um criador do Hall da Fama. Fale com a equipe da NP.');
    }
    const p = check(program, 'programa') as ProgramRow | null;
    if (!p) throw new Error('Os dados do Hall ainda não foram publicados. Tente novamente mais tarde.');

    const [creator, cycles, balances, monthly, pip, deliveries, next] = await Promise.all([
      db.from('creators').select('creator_id, handle, display_name, current_entry_month, link_status, needs_group_confirmation').eq('creator_id', creatorId).maybeSingle(),
      db.from('cycles').select('cycle_id, label, draw_month, state, ranking_metric'),
      db.from('cycle_balances').select('creator_id, cycle_id, accumulated, eligible, entry_bonus, participation, number_range').eq('creator_id', creatorId),
      db.from('monthly_coupons').select('creator_id, month, vinculo_entry, coupons, closed').eq('creator_id', creatorId).order('month', { ascending: false }).limit(60),
      db.from('pip_status').select('creator_id, status, reference_month, recovery_month, result, last_confirmed_status, last_confirmed_month').eq('creator_id', creatorId).maybeSingle(),
      db.from('gift_deliveries').select('creator_id, vinculo_entry, reference, kind, delivered_on, coins').eq('creator_id', creatorId).order('delivered_on').limit(200),
      db.from('gift_next').select('creator_id, vinculo_entry, reference, kind, situation, situation_raw, coins, forecast_month, forecast_date').eq('creator_id', creatorId).maybeSingle(),
    ]);
    const selectedCreator = check(creator, 'perfil') as CreatorRow | null;
    if (viewedCreatorId && !selectedCreator) throw new AccessError('Este painel está indisponível.');
    return mapMe({
      program: mapProgram(p, { isDemo: false, syncedAt: p.synced_at ?? null, staleWarning: staleness(p.synced_at) }),
      link: l,
      isStaff,
      creator: selectedCreator,
      cycles: check(cycles, 'ciclos') as CycleRow[],
      balances: check(balances, 'cupons') as BalanceRow[],
      monthly: check(monthly, 'histórico') as MonthlyRow[],
      pip: check(pip, 'participação') as PipRow | null,
      deliveries: check(deliveries, 'presentes') as DeliveryRow[],
      next: check(next, 'próximo presente') as GiftNextRow | null,
    });
  }

  private staffOnly(p: ProgramRow | null) {
    return mapMe({
      program: mapProgram(p, { isDemo: false, syncedAt: p?.synced_at ?? null, staleWarning: staleness(p?.synced_at) }),
      link: { active: false, ranking_authorized: false }, isStaff: true, creator: null,
      cycles: [], balances: [], monthly: [], pip: null, deliveries: [], next: null,
    });
  }

  async getRanking(cycleId: string): Promise<RankingResult | null> {
    const [rows, cycle] = await Promise.all([
      this.db.rpc('get_ranking', { p_cycle_id: cycleId }),
      this.db.from('cycles').select('state, ranking_metric').eq('cycle_id', cycleId).maybeSingle(),
    ]);
    const data = check(rows, 'ranking') as { position_: number; handle: string; coupons: number; is_me: boolean }[];
    const c = check(cycle, 'ciclo') as { state: string; ranking_metric: string } | null;
    if (!c) return null;
    return {
      cycleId,
      metric: c.ranking_metric as RankingResult['metric'],
      partial: c.state !== 'validado' && c.state !== 'arquivado',
      rows: rankEntries(data.map((r) => ({ handle: r.handle, coupons: r.coupons, isMe: r.is_me }))),
    };
  }

  async getCalendar() {
    const r = await this.db.from('calendar_events')
      .select('event_id, type, title, cycle_id, expected_month, confirmed_date, confirmed_time, status, trip_start, trip_end, destination, details, official_url, previous_date, image_url')
      .limit(300);
    return (check(r, 'calendário') as EventRow[]).map(mapEvent);
  }

  async getResults() {
    const r = await this.db.from('draw_results')
      .select('result_id, cycle_id, title, draw_date, published_on, winners, notes, official_url')
      .order('cycle_id', { ascending: false }).limit(100);
    return (check(r, 'resultados') as ResultRow[]).map(mapResult);
  }

  async getAdminStatus(): Promise<AdminStatus> {
    const [snap, runs] = await Promise.all([
      this.db.from('snapshots').select('id, created_at, activated_at, source_hash').eq('status', 'active').maybeSingle(),
      this.db.from('sync_runs').select('id, started_at, finished_at, status, trigger, message, snapshot_id').order('started_at', { ascending: false }).limit(20),
    ]);
    const runList = check(runs, 'execuções') as any[];
    const lastId = runList[0]?.id;
    const issues = lastId
      ? (check(await this.db.from('validation_issues').select('run_id, severity, sheet, row_ref, code, message').eq('run_id', lastId).limit(500), 'validação') as any[])
      : [];
    const s = check(snap, 'versão') as any;
    return {
      activeSnapshot: s ? { id: s.id, createdAt: s.created_at, activatedAt: s.activated_at, sourceHash: s.source_hash?.slice(0, 12) ?? null } : null,
      runs: runList.map((r) => ({ id: r.id, startedAt: r.started_at, finishedAt: r.finished_at, status: r.status, trigger: r.trigger, message: r.message, snapshotId: r.snapshot_id })),
      issues: issues.map((i) => ({ runId: i.run_id, severity: i.severity, sheet: i.sheet, rowRef: i.row_ref, code: i.code, message: i.message })),
    };
  }
}

function staleness(syncedAt: string | null | undefined): string | null {
  if (!syncedAt) return 'Ainda não há registro de sincronização.';
  const hours = (Date.now() - new Date(syncedAt).getTime()) / 3_600_000;
  return hours > STALE_HOURS ? 'Os dados podem estar desatualizados: a última atualização foi há mais de um dia e meio.' : null;
}
