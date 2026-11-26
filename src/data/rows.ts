import type { MonthlyPreview } from './types';

/** Linhas como existem no banco (snake_case). Compartilhado por Supabase e demonstração. */
export interface ProgramRow { analysis_month: string | null; last_closed_month: string | null; draw_month: string | null; program_start: string | null; synced_at?: string | null }
export interface CycleRow { cycle_id: string; label: string; draw_month: string; state: string; ranking_metric: string }
export interface CreatorRow { creator_id: string; handle: string; display_name: string | null; current_entry_month: string | null; link_status: string; needs_group_confirmation: boolean; monthly_preview?: MonthlyPreview | null }
export interface BalanceRow { creator_id: string; cycle_id: string; accumulated: number | null; eligible: number | null; entry_bonus: number; participation: string; number_range: string | null }
export interface MonthlyRow { creator_id: string; month: string; vinculo_entry: string | null; coupons: number | null; closed: boolean }
export interface PipRow { creator_id: string; status: string; reference_month: string | null; recovery_month: string | null; result: string | null; last_confirmed_status: string | null; last_confirmed_month: string | null }
export interface DeliveryRow { creator_id: string; vinculo_entry: string; reference: string; kind: string; delivered_on: string; coins: number }
export interface GiftNextRow { creator_id: string; vinculo_entry: string; reference: string; kind: string; situation: string; situation_raw: string | null; coins: number; forecast_month: string | null; forecast_date: string | null }
export interface EventRow { event_id: string; type: string; title: string; cycle_id: string | null; expected_month: string | null; confirmed_date: string | null; confirmed_time: string | null; status: string; trip_start: string | null; trip_end: string | null; destination: string | null; details: string | null; official_url: string | null; previous_date: string | null; image_url: string | null }
export interface ResultRow { result_id: string; cycle_id: string; title: string; draw_date: string | null; published_on: string | null; winners: string[]; notes: string | null; official_url: string | null }
