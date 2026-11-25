import { normalizeHandle } from './text';

export interface RankInput {
  handle: string;
  coupons: number | null;
  isMe?: boolean;
}

export interface RankingRow {
  handle: string;
  coupons: number;
  position: number;
  isMe: boolean;
  tied: boolean;
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/**
 * Classificação por cupons (desc). Empate compartilha a posição (1, 1, 3…)
 * e, para estabilidade, ordena alfabeticamente pelo @ dentro do empate.
 * Linhas sem valor (null) ficam fora — dado ausente não vira zero.
 */
export function rankEntries(list: RankInput[]): RankingRow[] {
  const valid = list.filter((r) => typeof r.coupons === 'number' && Number.isFinite(r.coupons)) as Array<
    RankInput & { coupons: number }
  >;
  valid.sort(
    (a, b) =>
      b.coupons - a.coupons ||
      collator.compare(normalizeHandle(a.handle), normalizeHandle(b.handle)) ||
      (a.handle < b.handle ? -1 : a.handle > b.handle ? 1 : 0),
  );
  const counts = new Map<number, number>();
  for (const r of valid) counts.set(r.coupons, (counts.get(r.coupons) ?? 0) + 1);
  let position = 0;
  let prev: number | null = null;
  return valid.map((r, i) => {
    if (r.coupons !== prev) {
      position = i + 1;
      prev = r.coupons;
    }
    return { handle: r.handle, coupons: r.coupons, position, isMe: !!r.isMe, tied: (counts.get(r.coupons) ?? 0) > 1 };
  });
}

/** Busca por @: aceita maiúsculas/minúsculas, acentos e entrada com ou sem @. */
export function searchRanking<T extends { handle: string }>(rows: T[], query: string): T[] {
  const q = normalizeHandle(query);
  if (!q) return rows;
  return rows.filter((r) => normalizeHandle(r.handle).includes(q));
}

export function findByHandle<T extends { handle: string }>(rows: T[], handle: string): T | undefined {
  const q = normalizeHandle(handle);
  return rows.find((r) => normalizeHandle(r.handle) === q);
}

export interface Comparison {
  me: RankingRow;
  other: RankingRow;
  /** Cupons do outro menos os meus. */
  difference: number;
  /** Cupons que faltam para igualar (0 se já igual ou à frente). */
  toTie: number;
  /** Cupons que faltam para ultrapassar (0 se já à frente). */
  toPass: number;
  relation: 'atras' | 'empatado' | 'a_frente';
}

/** Compara dois participantes DO MESMO ranking (mesmo ciclo e mesma métrica). */
export function compareRows(rows: RankingRow[], otherHandle: string): Comparison | null {
  const me = rows.find((r) => r.isMe);
  const other = findByHandle(rows, otherHandle);
  if (!me || !other || other === me) return null;
  const difference = other.coupons - me.coupons;
  return {
    me,
    other,
    difference,
    toTie: Math.max(0, difference),
    toPass: difference >= 0 ? difference + 1 : 0,
    relation: difference > 0 ? 'atras' : difference === 0 ? 'empatado' : 'a_frente',
  };
}
