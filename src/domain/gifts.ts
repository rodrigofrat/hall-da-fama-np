import { addMonths, dateLong, monthLabel, monthOf, type ISODate, type MonthKey } from './dates';
import { GIFT_SITUATION_LABEL, type GiftSituation } from './status';
import { norm } from './text';

export const GIFT_COINS = 5000;

export type GiftKind = 'boas_vindas' | 'renovacao' | 'outro';

export function referenceKind(reference: string): GiftKind {
  const s = norm(reference);
  if (/boas.?vindas|welcome|entrada/.test(s)) return 'boas_vindas';
  if (/renov/.test(s)) return 'renovacao';
  return 'outro';
}

export const GIFT_KIND_LABEL: Record<GiftKind, string> = {
  boas_vindas: 'Boas-vindas',
  renovacao: 'Renovação',
  outro: 'Presente',
};

/** Entrega REAL (Registro de entregas!D:D). */
export interface GiftDelivery {
  /** Mês de entrada do vínculo (chave do vínculo). */
  vinculoEntry: MonthKey;
  reference: string;
  kind: GiftKind;
  deliveredOn: ISODate;
  coins: number;
}

/** Próximo presente: resultado da fórmula da aba Presentes + previsão opcional. */
export interface NextGift {
  vinculoEntry: MonthKey;
  reference: string;
  kind: GiftKind;
  situation: GiftSituation;
  situationRaw: string | null;
  coins: number;
  /** Mês previsto (fórmula). */
  forecastMonth: MonthKey | null;
  /** Data exata prevista, somente se a agência registrou em "Previsões de presentes". */
  forecastDate: ISODate | null;
}

export function deliveryKey(creatorId: string, vinculoEntry: string, reference: string): string {
  return `${creatorId}|${vinculoEntry}|${norm(reference)}`;
}

/** Remove duplicidades pela chave ID + entrada do vínculo + referência (mantém a data mais antiga). */
export function dedupeDeliveries<T extends { creatorId: string; vinculoEntry: string; reference: string; deliveredOn: string }>(
  list: T[],
): { unique: T[]; duplicates: T[] } {
  const byKey = new Map<string, T>();
  const duplicates: T[] = [];
  for (const d of list) {
    const k = deliveryKey(d.creatorId, d.vinculoEntry, d.reference);
    const prev = byKey.get(k);
    if (!prev) byKey.set(k, d);
    else if (d.deliveredOn < prev.deliveredOn) {
      duplicates.push(prev);
      byKey.set(k, d);
    } else duplicates.push(d);
  }
  return { unique: [...byKey.values()], duplicates };
}

export interface GiftTimeline {
  vinculos: { entry: MonthKey; deliveries: GiftDelivery[]; isCurrent: boolean }[];
  firstCurrent: GiftDelivery | null;
  firstProgram: GiftDelivery | null;
  lastReceived: GiftDelivery | null;
  total: number;
}

export function buildGiftTimeline(deliveries: GiftDelivery[], currentEntry: MonthKey | null): GiftTimeline {
  const sorted = [...deliveries].sort((a, b) => a.deliveredOn.localeCompare(b.deliveredOn));
  const groups = new Map<MonthKey, GiftDelivery[]>();
  for (const d of sorted) {
    if (!groups.has(d.vinculoEntry)) groups.set(d.vinculoEntry, []);
    groups.get(d.vinculoEntry)!.push(d);
  }
  if (currentEntry && !groups.has(currentEntry)) groups.set(currentEntry, []);
  const vinculos = [...groups.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([entry, list]) => ({ entry, deliveries: list, isCurrent: entry === currentEntry }));

  const welcomeOf = (entry: MonthKey) => groups.get(entry)?.find((d) => d.kind === 'boas_vindas') ?? null;
  const firstCurrent = currentEntry ? welcomeOf(currentEntry) : null;
  const entries = [...groups.keys()].sort();
  let firstProgram: GiftDelivery | null = null;
  for (const e of entries) {
    const w = welcomeOf(e);
    if (w) {
      firstProgram = w;
      break;
    }
  }
  const currentList = currentEntry ? groups.get(currentEntry) ?? [] : sorted;
  const lastReceived = currentList.length ? currentList[currentList.length - 1] : null;
  return { vinculos, firstCurrent, firstProgram, lastReceived, total: sorted.length };
}

/**
 * Espelho da fórmula ativa da aba Presentes (usado para conferência e testes;
 * em produção o portal exibe o resultado da planilha):
 * - Sem entrega válida no vínculo → referência = mês de entrada, tipo boas-vindas.
 * - Com entrega → renovação no 3º mês após o mês da ÚLTIMA entrega real.
 *   Ex.: recebido em novembro → fevereiro. Entrega atrasada desloca a próxima.
 */
export function expectedNextGift(
  vinculoEntry: MonthKey,
  deliveriesOfVinculo: Pick<GiftDelivery, 'deliveredOn'>[],
): { month: MonthKey; kind: GiftKind } {
  if (!deliveriesOfVinculo.length) return { month: vinculoEntry, kind: 'boas_vindas' };
  const last = deliveriesOfVinculo.map((d) => d.deliveredOn).sort().at(-1)!;
  return { month: addMonths(monthOf(last), 3), kind: 'renovacao' };
}

/** Rótulo da data REAL de recebimento. */
export function receivedText(d: GiftDelivery): string {
  return `Recebido em ${dateLong(d.deliveredOn)}`;
}

/** Rótulo da PREVISÃO — nunca usa a data de recebimento. */
export function forecastText(n: NextGift): string | null {
  if (n.forecastDate) return `Previsão: ${dateLong(n.forecastDate)}`;
  if (n.forecastMonth) return `Previsão: ${monthLabel(n.forecastMonth)} · dia a confirmar`;
  return null;
}

export function situationText(n: NextGift): string {
  return GIFT_SITUATION_LABEL[n.situation];
}
