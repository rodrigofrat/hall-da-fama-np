import { addMonths, monthNameShort, type MonthKey } from './dates';

/**
 * Ciclos trimestrais. Saldo reinicia a cada ciclo.
 * Out–Dez → sorteio em janeiro; Jan–Mar → abril; Abr–Jun → julho; Jul–Set → outubro.
 */
export interface Cycle {
  id: string; // "2026-T4"
  year: number;
  quarter: 1 | 2 | 3 | 4;
  months: [MonthKey, MonthKey, MonthKey];
  drawMonth: MonthKey;
  label: string; // "Out–Dez 2026"
}

export function cycleForMonth(month: MonthKey): Cycle {
  const [y, m] = month.split('-').map(Number);
  const q = (Math.floor((m - 1) / 3) + 1) as 1 | 2 | 3 | 4;
  return buildCycle(y, q);
}

function buildCycle(year: number, quarter: 1 | 2 | 3 | 4): Cycle {
  const first = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}`;
  const months: [MonthKey, MonthKey, MonthKey] = [first, addMonths(first, 1), addMonths(first, 2)];
  const startM = (quarter - 1) * 3 + 1;
  const label = `${cap(monthNameShort(startM))}–${cap(monthNameShort(startM + 2))} ${year}`;
  return { id: `${year}-T${quarter}`, year, quarter, months, drawMonth: addMonths(months[2], 1), label };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function cycleById(id: string): Cycle | null {
  const m = /^(\d{4})-T([1-4])$/.exec(id);
  return m ? buildCycle(Number(m[1]), Number(m[2]) as 1 | 2 | 3 | 4) : null;
}

/** Ciclo cujo sorteio acontece no mês informado (jan/2027 → 2026-T4). */
export function cycleForDrawMonth(drawMonth: MonthKey): Cycle {
  return cycleForMonth(addMonths(drawMonth, -1));
}

export function cycleContains(cycle: Cycle, month: MonthKey): boolean {
  return cycle.months.includes(month);
}

/** Saldo parcial quando algum mês do ciclo ainda não foi fechado. */
export function isCyclePartial(cycle: Cycle, lastClosedMonth: MonthKey | null): boolean {
  if (!lastClosedMonth) return true;
  return cycle.months[2] > lastClosedMonth;
}
