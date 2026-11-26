import type { CalendarEvent, DrawResult } from '../domain/calendar';
import type { ISODate, MonthKey } from '../domain/dates';
import type { GiftDelivery, NextGift } from '../domain/gifts';
import type { RankingRow } from '../domain/ranking';
import type { LinkStatus, ParticipationCode, PipInfo } from '../domain/status';

export type CycleState = 'parcial' | 'em_validacao' | 'validado' | 'arquivado';
export type RankingMetric = 'acumulado' | 'aptos';

export interface ProgramState {
  analysisMonth: MonthKey | null;
  lastClosedMonth: MonthKey | null;
  drawMonth: MonthKey | null;
  programStart: MonthKey | null;
  syncedAt: string | null;
  isDemo: boolean;
  /** Aviso de defasagem quando a última sincronização falhou. */
  staleWarning: string | null;
}

export interface CycleInfo {
  id: string;
  label: string;
  drawMonth: MonthKey;
  state: CycleState;
  rankingMetric: RankingMetric;
}

export interface Profile {
  handle: string;
  displayName: string | null;
  currentEntryMonth: MonthKey | null;
  linkStatus: LinkStatus;
  linkActive: boolean;
  rankingAuthorized: boolean;
  /** Reconvite sinalizado: confirmar entrada no grupo da NP. */
  needsGroupConfirmation: boolean;
  isStaff: boolean;
}

export interface MonthlyPreview {
  through: ISODate;
  diamonds: number;
  estimatedCoupons: number;
  next: { coupons: number; diamondsRemaining: number } | null;
}

export interface MonthlyCoupons {
  month: MonthKey;
  vinculoEntry: MonthKey | null;
  coupons: number | null;
  closed: boolean;
}

export interface CycleBalance {
  cycleId: string;
  /** Cupons acumulados no ciclo (valor oficial da planilha). */
  accumulated: number | null;
  /** Cupons aptos ao sorteio (só contam quando participação = apto). */
  eligible: number | null;
  /** Cupom de entrada creditado neste ciclo (0 ou 1). */
  entryBonus: number;
  participation: ParticipationCode;
  /** Faixa numérica do sorteio, somente quando validada para o ciclo. */
  numberRange: string | null;
}

export interface MeData {
  profile: Profile;
  program: ProgramState;
  cycles: CycleInfo[];
  balances: CycleBalance[];
  monthly: MonthlyCoupons[];
  monthlyPreview: MonthlyPreview | null;
  pip: PipInfo | null;
  gifts: { deliveries: GiftDelivery[]; next: NextGift | null };
}

export interface RankingResult {
  cycleId: string;
  metric: RankingMetric;
  partial: boolean;
  rows: RankingRow[];
}

export interface SyncRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: 'running' | 'success' | 'failed' | 'unchanged';
  trigger: string;
  message: string | null;
  snapshotId: string | null;
}

export interface ValidationIssue {
  runId: string;
  severity: 'error' | 'warning';
  sheet: string;
  rowRef: string | null;
  code: string;
  message: string;
}

export interface AdminStatus {
  activeSnapshot: { id: string; createdAt: string; activatedAt: string | null; sourceHash: string | null } | null;
  runs: SyncRun[];
  issues: ValidationIssue[];
}

export interface PortalData {
  readonly mode: 'demo' | 'supabase';
  getMe(): Promise<MeData>;
  getRanking(cycleId: string): Promise<RankingResult | null>;
  getCalendar(): Promise<CalendarEvent[]>;
  getResults(): Promise<DrawResult[]>;
  getAdminStatus(): Promise<AdminStatus>;
}

export class AccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessError';
  }
}
