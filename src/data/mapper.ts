import type { CalendarEvent, DrawResult, EventStatus, EventType } from '../domain/calendar';
import { monthOf } from '../domain/dates';
import type { GiftKind } from '../domain/gifts';
import type { GiftSituation, LinkStatus, ParticipationCode } from '../domain/status';
import type { BalanceRow, CreatorRow, CycleRow, DeliveryRow, EventRow, GiftNextRow, MonthlyRow, PipRow, ProgramRow, ResultRow } from './rows';
import type { CycleState, MeData, ProgramState, RankingMetric } from './types';

export function mapProgram(row: ProgramRow | null, opts: { isDemo: boolean; syncedAt: string | null; staleWarning: string | null }): ProgramState {
  return {
    analysisMonth: row?.analysis_month ?? null,
    lastClosedMonth: row?.last_closed_month ?? null,
    drawMonth: row?.draw_month ?? null,
    programStart: row?.program_start ?? null,
    syncedAt: opts.syncedAt ?? row?.synced_at ?? null,
    isDemo: opts.isDemo,
    staleWarning: opts.staleWarning,
  };
}

export function mapMe(input: {
  program: ProgramState;
  link: { active: boolean; ranking_authorized: boolean };
  isStaff: boolean;
  creator: CreatorRow | null;
  cycles: CycleRow[];
  balances: BalanceRow[];
  monthly: MonthlyRow[];
  pip: PipRow | null;
  deliveries: DeliveryRow[];
  next: GiftNextRow | null;
}): MeData {
  const c = input.creator;
  const preview = input.link.active ? c?.monthly_preview : null;
  const previewMonth = preview ? monthOf(preview.through) : null;
  const currentPreview = preview && previewMonth && previewMonth === input.program.analysisMonth
    && (!input.program.lastClosedMonth || previewMonth > input.program.lastClosedMonth);
  return {
    program: input.program,
    profile: {
      handle: c?.handle ?? '',
      displayName: c?.display_name ?? null,
      currentEntryMonth: c?.current_entry_month ?? null,
      linkStatus: (c?.link_status as LinkStatus) ?? 'historico_pendente',
      linkActive: input.link.active,
      rankingAuthorized: input.link.active && input.link.ranking_authorized,
      needsGroupConfirmation: !!c?.needs_group_confirmation,
      isStaff: input.isStaff,
    },
    cycles: [...input.cycles]
      .sort((a, b) => b.cycle_id.localeCompare(a.cycle_id))
      .map((r) => ({ id: r.cycle_id, label: r.label, drawMonth: r.draw_month, state: r.state as CycleState, rankingMetric: r.ranking_metric as RankingMetric })),
    balances: input.balances.map((b) => ({
      cycleId: b.cycle_id, accumulated: b.accumulated, eligible: b.eligible, entryBonus: b.entry_bonus,
      participation: b.participation as ParticipationCode, numberRange: b.number_range,
    })),
    monthlyPreview: currentPreview ? preview : null,
    monthly: [...input.monthly].sort((a, b) => b.month.localeCompare(a.month)).map((m) => ({ month: m.month, vinculoEntry: m.vinculo_entry, coupons: m.coupons, closed: m.closed })),
    pip: input.pip
      ? {
          status: input.pip.status as LinkStatus,
          referenceMonth: input.pip.reference_month,
          recoveryMonth: input.pip.recovery_month,
          result: input.pip.result,
          lastConfirmed: input.pip.last_confirmed_status && input.pip.last_confirmed_month
            ? { status: input.pip.last_confirmed_status as LinkStatus, month: input.pip.last_confirmed_month }
            : null,
        }
      : null,
    gifts: {
      deliveries: input.deliveries.map((d) => ({ vinculoEntry: d.vinculo_entry, reference: d.reference, kind: d.kind as GiftKind, deliveredOn: d.delivered_on, coins: d.coins })),
      next: input.next
        ? {
            vinculoEntry: input.next.vinculo_entry, reference: input.next.reference, kind: input.next.kind as GiftKind,
            situation: input.next.situation as GiftSituation, situationRaw: input.next.situation_raw, coins: input.next.coins,
            forecastMonth: input.next.forecast_month, forecastDate: input.next.forecast_date,
          }
        : null,
    },
  };
}

export function mapEvent(r: EventRow): CalendarEvent {
  return {
    id: r.event_id, type: r.type as EventType, title: r.title, cycleId: r.cycle_id, expectedMonth: r.expected_month,
    confirmedDate: r.confirmed_date, confirmedTime: r.confirmed_time, status: r.status as EventStatus,
    tripStart: r.trip_start, tripEnd: r.trip_end, destination: r.destination, details: r.details,
    officialUrl: r.official_url, previousDate: r.previous_date, imageUrl: r.image_url,
  };
}

export function mapResult(r: ResultRow): DrawResult {
  return { id: r.result_id, cycleId: r.cycle_id, title: r.title, drawDate: r.draw_date, publishedOn: r.published_on, winners: r.winners ?? [], notes: r.notes, officialUrl: r.official_url };
}
