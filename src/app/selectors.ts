import { cycleForDrawMonth } from '../domain/cycles';
import type { CycleBalance, CycleInfo, MeData } from '../data/types';

/** Ciclo em destaque: o do próximo sorteio; senão o mais recente com saldo. */
export function currentCycle(me: MeData): CycleInfo | null {
  const drawCycleId = me.program.drawMonth ? cycleForDrawMonth(me.program.drawMonth).id : null;
  const withBalance = new Set(me.balances.map((b) => b.cycleId));
  return (
    me.cycles.find((c) => c.id === drawCycleId && withBalance.has(c.id)) ??
    me.cycles.find((c) => withBalance.has(c.id)) ??
    me.cycles.find((c) => c.id === drawCycleId) ??
    null
  );
}

export function balanceFor(me: MeData, cycleId: string | null | undefined): CycleBalance | null {
  return me.balances.find((b) => b.cycleId === cycleId) ?? null;
}

export function myCycles(me: MeData): CycleInfo[] {
  const ids = new Set(me.balances.map((b) => b.cycleId));
  return me.cycles.filter((c) => ids.has(c.id));
}

export const METRIC_LABEL = { acumulado: 'Cupons acumulados', aptos: 'Cupons aptos ao sorteio' } as const;
