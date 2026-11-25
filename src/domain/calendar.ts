import { dateLong, daysBetween, monthLabel, monthOf, type ISODate, type MonthKey } from './dates';
import { plural } from './text';

export type EventType = 'sorteio' | 'resultado' | 'viagem';
export type EventStatus = 'previsto' | 'confirmado' | 'remarcado' | 'realizado' | 'aguardando_divulgacao' | 'cancelado';

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  sorteio: 'Sorteio',
  resultado: 'Divulgação do resultado',
  viagem: 'Viagem',
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  previsto: 'Previsto',
  confirmado: 'Confirmado',
  remarcado: 'Remarcado',
  realizado: 'Realizado',
  aguardando_divulgacao: 'Aguardando divulgação',
  cancelado: 'Cancelado',
};

export interface CalendarEvent {
  id: string;
  type: EventType;
  title: string;
  cycleId: string | null;
  /** Mês previsto. Uma data "01/mm/aaaa" na planilha é referência de MÊS. */
  expectedMonth: MonthKey | null;
  /** Data oficial confirmada pela agência (somente da tabela "Calendário do portal"). */
  confirmedDate: ISODate | null;
  /** Horário, somente se publicado. Nunca inventado. */
  confirmedTime: string | null;
  status: EventStatus;
  tripStart: ISODate | null;
  tripEnd: ISODate | null;
  destination: string | null;
  details: string | null;
  officialUrl: string | null;
  /** Data anterior em caso de remarcação. */
  previousDate: ISODate | null;
  imageUrl?: string | null;
}

export interface DrawResult {
  id: string;
  cycleId: string;
  title: string;
  drawDate: ISODate | null;
  publishedOn: ISODate | null;
  winners: string[];
  notes: string | null;
  officialUrl: string | null;
}

export type TimingKind = 'mes' | 'futuro' | 'hoje' | 'aguardando' | 'passado' | 'em_andamento' | 'cancelado' | 'sem_data';

export interface EventTiming {
  kind: TimingKind;
  headline: string;
  daysLeft: number | null;
  whenText: string;
}

/** Texto de quando o evento acontece, sem inventar dia ou horário. */
export function eventWhen(ev: CalendarEvent): string {
  if (ev.type === 'viagem' && ev.tripStart) {
    return ev.tripEnd && ev.tripEnd !== ev.tripStart
      ? `${dateLong(ev.tripStart)} a ${dateLong(ev.tripEnd)}`
      : dateLong(ev.tripStart);
  }
  if (ev.confirmedDate) return dateLong(ev.confirmedDate) + (ev.confirmedTime ? `, às ${ev.confirmedTime}` : '');
  if (ev.expectedMonth) return `${monthLabel(ev.expectedMonth)} · dia a confirmar`;
  return 'Data a confirmar';
}

/**
 * Situação temporal de um evento, com "hoje" em America/Sao_Paulo.
 * Sem data confirmada → nunca há contador (o dia 01 de referência é ignorado).
 */
export function eventTiming(ev: CalendarEvent, today: ISODate, hasResult = false): EventTiming {
  const whenText = eventWhen(ev);
  if (ev.status === 'cancelado') return { kind: 'cancelado', headline: 'Cancelado', daysLeft: null, whenText };

  if (ev.type === 'viagem' && ev.tripStart) {
    const toStart = daysBetween(today, ev.tripStart);
    const end = ev.tripEnd ?? ev.tripStart;
    if (toStart > 0) return { kind: 'futuro', headline: countdown(toStart), daysLeft: toStart, whenText };
    if (daysBetween(today, end) >= 0) return { kind: 'em_andamento', headline: toStart === 0 ? 'Começa hoje' : 'Em andamento', daysLeft: 0, whenText };
    return { kind: 'passado', headline: 'Concluída', daysLeft: null, whenText };
  }

  const date = ev.confirmedDate;
  if (!date) {
    if (ev.expectedMonth) {
      const label = ev.type === 'sorteio' ? 'Previsto para' : ev.type === 'resultado' ? 'Divulgação prevista para' : 'Prevista para';
      return { kind: 'mes', headline: `${label} ${monthLabel(ev.expectedMonth)} · dia a confirmar`, daysLeft: null, whenText };
    }
    return { kind: 'sem_data', headline: 'Data a confirmar', daysLeft: null, whenText };
  }

  const d = daysBetween(today, date);
  if (d > 0) return { kind: 'futuro', headline: countdown(d), daysLeft: d, whenText };
  if (d === 0) return { kind: 'hoje', headline: ev.confirmedTime ? `É hoje, às ${ev.confirmedTime}` : 'É hoje', daysLeft: 0, whenText };
  if (ev.type === 'sorteio') {
    return hasResult
      ? { kind: 'passado', headline: 'Resultado divulgado', daysLeft: null, whenText }
      : { kind: 'aguardando', headline: 'Aguardando resultado', daysLeft: null, whenText };
  }
  return { kind: 'passado', headline: ev.type === 'resultado' ? 'Divulgado' : 'Concluído', daysLeft: null, whenText };
}

function countdown(days: number): string {
  return days === 1 ? 'Falta 1 dia' : `Faltam ${plural(days, 'dia', 'dias')}`;
}

/** Mês efetivo de um evento (para agrupar no calendário). */
export function eventMonth(ev: CalendarEvent): MonthKey | null {
  if (ev.type === 'viagem' && ev.tripStart) return monthOf(ev.tripStart);
  if (ev.confirmedDate) return monthOf(ev.confirmedDate);
  return ev.expectedMonth;
}

export function sortEvents(list: CalendarEvent[]): CalendarEvent[] {
  const key = (e: CalendarEvent) => (e.type === 'viagem' && e.tripStart) || e.confirmedDate || (e.expectedMonth ? `${e.expectedMonth}-99` : '9999');
  return [...list].sort((a, b) => key(a).localeCompare(key(b)) || a.title.localeCompare(b.title));
}

/**
 * Próximo sorteio: o mais próximo ainda não concluído. Se nenhum evento estiver
 * publicado, usa o mês do sorteio da planilha (somente mês).
 */
export function nextDraw(
  events: CalendarEvent[],
  results: DrawResult[],
  today: ISODate,
  fallbackDrawMonth: MonthKey | null,
  fallbackCycleId: string | null,
): CalendarEvent | null {
  const currentMonth = monthOf(today);
  const resultCycles = new Set(results.map((r) => r.cycleId));
  const open = sortEvents(events.filter((e) => e.type === 'sorteio' && e.status !== 'cancelado')).filter((e) => {
    if (e.cycleId && resultCycles.has(e.cycleId)) return false;
    if (e.confirmedDate) return true; // futuro, hoje ou aguardando resultado
    return !!e.expectedMonth && e.expectedMonth >= currentMonth;
  });
  if (open.length) return open[0];
  if (!fallbackDrawMonth || fallbackDrawMonth < currentMonth) return null;
  return {
    id: `auto-${fallbackDrawMonth}`,
    type: 'sorteio',
    title: 'Sorteio do Hall da Fama',
    cycleId: fallbackCycleId,
    expectedMonth: fallbackDrawMonth,
    confirmedDate: null,
    confirmedTime: null,
    status: 'previsto',
    tripStart: null,
    tripEnd: null,
    destination: null,
    details: null,
    officialUrl: null,
    previousDate: null,
  };
}

/** "Próximo sorteio previsto para janeiro de 2027 · dia a confirmar" etc. */
export function nextDrawSentence(ev: CalendarEvent, today: ISODate, hasResult = false): string {
  const t = eventTiming(ev, today, hasResult);
  if (t.kind === 'mes') return `Próximo sorteio previsto para ${monthLabel(ev.expectedMonth!)} · dia a confirmar`;
  return t.headline;
}
