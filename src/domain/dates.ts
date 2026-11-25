/**
 * Datas do portal.
 * - Datas sem horário são strings ISO "AAAA-MM-DD" (data local, sem fuso).
 * - Meses são "AAAA-MM".
 * - "Hoje" é sempre calculado em America/Sao_Paulo.
 */
export type ISODate = string;
export type MonthKey = string;

export const TIME_ZONE = 'America/Sao_Paulo';

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

export function isISODate(v: unknown): v is ISODate {
  if (typeof v !== 'string') return false;
  const m = ISO_DATE.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export function isMonthKey(v: unknown): boolean {
  if (typeof v !== 'string') return false;
  const m = ISO_MONTH.exec(v);
  return !!m && Number(m[2]) >= 1 && Number(m[2]) <= 12;
}

/** Data de hoje em São Paulo (vira à meia-noite local, não UTC). */
export function todayInSaoPaulo(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function toDayNumber(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, day) / 86_400_000);
}

/** Dias de `from` até `to` (positivo se `to` for depois). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function monthOf(d: ISODate): MonthKey {
  return d.slice(0, 7);
}

export function addMonths(month: MonthKey, n: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

export function monthLabelCap(month: MonthKey): string {
  const s = monthLabel(month);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthShort(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]}/${y}`;
}

export function monthNameShort(m: number): string {
  return MONTHS_SHORT[m - 1];
}

/** "12 de novembro de 2026" */
export function dateLong(d: ISODate): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${day} de ${MONTHS[m - 1]} de ${y}`;
}

/** "12/11/2026" */
export function dateShort(d: ISODate): string {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/** "25/11/2026 às 14:05" a partir de um timestamp ISO completo, exibido em São Paulo. */
export function dateTimeSP(ts: string): string {
  const dt = new Date(ts);
  if (Number.isNaN(dt.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(dt).replace(',', ' às');
}

// ---------- Conversões explícitas de células de planilhas pt-BR ----------

/** Número de série do Google Sheets (dias desde 1899-12-30) → data ISO. */
export function serialToISODate(serial: number): ISODate | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2_958_465) return null;
  const ms = Math.round(Math.floor(serial) * 86_400_000) + Date.UTC(1899, 11, 30);
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** Converte célula de data (dd/mm/aaaa, aaaa-mm-dd ou número de série) em data ISO. */
export function parseSheetDate(value: unknown): ISODate | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return serialToISODate(value);
  const s = String(value).trim();
  if (!s) return null;
  let m = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(s);
  if (m) {
    let y = Number(m[3]);
    if (m[3].length === 2) y += 2000;
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isISODate(iso) ? iso : null;
  }
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    const iso = `${m[1]}-${m[2]}-${m[3]}`;
    return isISODate(iso) ? iso : null;
  }
  return null;
}

/**
 * Converte uma célula que representa MÊS. O dia (normalmente 01) é descartado:
 * "01/01/2027" significa "janeiro de 2027", nunca o dia 1º.
 */
export function parseSheetMonth(value: unknown): MonthKey | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    const d = serialToISODate(value);
    return d ? monthOf(d) : null;
  }
  const s = String(value).trim();
  if (!s) return null;
  const asDate = parseSheetDate(s);
  if (asDate) return monthOf(asDate);
  if (isMonthKey(s)) return s as MonthKey;
  let m = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${m[1].padStart(2, '0')}`;
  const lower = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  m = /^([a-z]+)\.?\s*(?:\/|-|de|\s)\s*(\d{2}|\d{4})$/.exec(lower);
  if (m) {
    const names = MONTHS.map((x) => x.normalize('NFD').replace(/[̀-ͯ]/g, ''));
    let idx = names.indexOf(m[1]);
    if (idx < 0) idx = MONTHS_SHORT.indexOf(m[1].slice(0, 3));
    if (idx >= 0) {
      const y = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
      return `${y}-${String(idx + 1).padStart(2, '0')}`;
    }
  }
  return null;
}

/** "HH:MM" opcional. */
export function parseSheetTime(value: unknown): string | null {
  const s = String(value ?? '').trim();
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${m[2]}`;
}
