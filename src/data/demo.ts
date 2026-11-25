/**
 * Fonte de DEMONSTRAÇÃO: dados fictícios gerados pelo mesmo pipeline do sincronizador.
 * Usada apenas quando VITE_DATA_MODE=demo.
 */
import { rankEntries } from '../domain/ranking';
import snapshot from './demo/snapshot.json';
import { mapEvent, mapMe, mapProgram, mapResult } from './mapper';
import type { EventRow, ResultRow } from './rows';
import { AccessError, type AdminStatus, type PortalData, type RankingResult } from './types';

const P = snapshot.payload;

export const DEMO_ACCOUNTS = P.creators.map((c) => ({ creatorId: c.creator_id, handle: c.handle }));
export const DEMO_DEFAULT = 'demo_0001';

export class DemoData implements PortalData {
  readonly mode = 'demo' as const;
  constructor(private creatorId: string, private staff = true) {}

  private program() {
    return mapProgram(P.program_state, { isDemo: true, syncedAt: snapshot.synced_at, staleWarning: null });
  }

  async getMe() {
    const id = this.creatorId;
    const creator = P.creators.find((c) => c.creator_id === id) ?? null;
    if (!creator) throw new AccessError('Conta de demonstração não encontrada.');
    const active = creator.link_status !== 'encerrada';
    return mapMe({
      program: this.program(),
      link: { active, ranking_authorized: active },
      isStaff: this.staff,
      creator,
      cycles: P.cycles,
      balances: P.cycle_balances.filter((r) => r.creator_id === id),
      monthly: P.monthly_coupons.filter((r) => r.creator_id === id),
      pip: P.pip_status.find((r) => r.creator_id === id) ?? null,
      deliveries: P.gift_deliveries.filter((r) => r.creator_id === id),
      next: P.gift_next.find((r) => r.creator_id === id) ?? null,
    });
  }

  async getRanking(cycleId: string): Promise<RankingResult | null> {
    const cycle = P.cycles.find((c) => c.cycle_id === cycleId);
    if (!cycle) return null;
    const rows = rankEntries(
      P.ranking_entries.filter((r) => r.cycle_id === cycleId).map((r) => ({ handle: r.handle, coupons: r.coupons, isMe: r.creator_id === this.creatorId })),
    );
    return { cycleId, metric: cycle.ranking_metric as RankingResult['metric'], partial: cycle.state !== 'validado' && cycle.state !== 'arquivado', rows };
  }

  async getCalendar() {
    return (P.calendar_events as unknown as EventRow[]).map(mapEvent);
  }

  async getResults() {
    return (P.draw_results as unknown as ResultRow[]).map(mapResult);
  }

  async getAdminStatus(): Promise<AdminStatus> {
    return {
      activeSnapshot: { id: 'demo', createdAt: snapshot.synced_at, activatedAt: snapshot.synced_at, sourceHash: snapshot.hash.slice(0, 12) },
      runs: [
        { id: 'demo-2', startedAt: snapshot.synced_at, finishedAt: snapshot.synced_at, status: 'success', trigger: 'schedule', message: `${snapshot.issues.length} aviso(s).`, snapshotId: 'demo' },
        { id: 'demo-1', startedAt: '2026-11-25T06:00:00.000Z', finishedAt: '2026-11-25T06:00:20.000Z', status: 'unchanged', trigger: 'schedule', message: 'Sem alterações na planilha.', snapshotId: null },
      ],
      issues: snapshot.issues.map((i) => ({ runId: 'demo-2', severity: i.severity as 'error' | 'warning', sheet: i.sheet, rowRef: i.rowRef, code: i.code, message: i.message })),
    };
  }
}
