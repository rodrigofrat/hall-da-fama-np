/**
 * Mapa da planilha "Hall da Fama — Controle de status, PIP e sorteios".
 * Somente as colunas necessárias são lidas. Colunas com contato (Hall da Fama!I),
 * comprovantes (Registro de entregas!G) e métricas individuais do PIP (D:F) ficam FORA.
 *
 * `expect` = palavra-chave (sem acento, minúscula) que o cabeçalho da coluna deve conter.
 * Ajuste `headerRow` se o cabeçalho real estiver em outra linha — o sincronizador
 * recusa a carga se o layout divergir.
 */
export interface TabSpec {
  tab: string;
  ranges: string[];
  headerRow: number;
  columns: Record<string, { col: string; expect: string[] }>;
}

export const MAIN_TABS = {
  hall: {
    tab: 'Hall da Fama',
    ranges: ['A:H', 'J:J'],
    headerRow: 1,
    columns: {
      id: { col: 'A', expect: ['id'] },
      handle: { col: 'B', expect: ['criador'] },
      entry: { col: 'C', expect: ['entrada'] },
      status: { col: 'D', expect: ['status'] },
      prevDiamonds: { col: 'E', expect: ['diamante'] }, // só para conferência das faixas; nunca exportado
      monthCoupons: { col: 'F', expect: ['cupo'] },
      cycleCoupons: { col: 'G', expect: ['cupo'] },
      drawMonth: { col: 'H', expect: ['sorteio'] },
      notice: { col: 'J', expect: [''] },
    },
  },
  sorteios: {
    tab: 'Sorteios',
    ranges: ['A:I'],
    headerRow: 1,
    columns: {
      id: { col: 'A', expect: ['id'] },
      handle: { col: 'B', expect: ['criador'] },
      entry: { col: 'C', expect: ['entrada'] },
      cutStatus: { col: 'D', expect: ['status'] },
      accumulated: { col: 'E', expect: ['acumulad'] },
      participation: { col: 'F', expect: ['particip'] },
      situation: { col: 'G', expect: ['situa'] },
      eligible: { col: 'H', expect: ['apto'] },
      range: { col: 'I', expect: ['faixa'] },
    },
  },
  pip: {
    tab: 'PIP',
    ranges: ['A:C', 'G:G'],
    headerRow: 1,
    columns: {
      id: { col: 'A', expect: ['id'] },
      handle: { col: 'B', expect: ['criador'] },
      recoveryMonth: { col: 'C', expect: ['recupera'] },
      result: { col: 'G', expect: ['resultado'] },
    },
  },
  presentes: {
    tab: 'Presentes',
    ranges: ['A:J'],
    headerRow: 1,
    columns: {
      id: { col: 'A', expect: ['id'] },
      handle: { col: 'B', expect: ['criador'] },
      entry: { col: 'C', expect: ['entrada'] },
      reference: { col: 'D', expect: ['referencia'] },
      kind: { col: 'E', expect: ['tipo'] },
      situation: { col: 'F', expect: ['situa'] },
      coins: { col: 'G', expect: ['moeda'] },
      nextRenewal: { col: 'H', expect: ['renova'] },
      lastClosedStatus: { col: 'I', expect: ['status'] },
      entryAtClose: { col: 'J', expect: ['entrada'] },
    },
  },
  entregas: {
    tab: 'Registro de entregas',
    ranges: ['A:F'],
    headerRow: 1,
    columns: {
      id: { col: 'A', expect: ['id'] },
      entry: { col: 'B', expect: ['entrada'] },
      reference: { col: 'C', expect: ['referencia'] },
      deliveredOn: { col: 'D', expect: ['entregue em', 'data'] },
      handle: { col: 'E', expect: ['criador'] },
      coins: { col: 'F', expect: ['moeda'] },
    },
  },
  meses: {
    tab: 'Meses',
    ranges: ['A:I'],
    headerRow: 1,
    columns: {
      month: { col: 'A', expect: ['mes'] },
      complete: { col: 'B', expect: ['complet'] },
      released: { col: 'H', expect: ['liberad'] },
      check: { col: 'I', expect: ['confer'] },
    },
  },
} satisfies Record<string, TabSpec>;

/** Dados calculados da prévia. A área de colagem a partir de K fica fora da leitura. */
export const MONTHLY_PREVIEW: TabSpec = {
  tab: 'Prévia mensal',
  ranges: ['A1:H1005'],
  headerRow: 5,
  columns: {
    id: { col: 'A', expect: ['id'] },
    through: { col: 'C', expect: ['dados ate'] },
    diamonds: { col: 'D', expect: ['diamantes no mes'] },
    estimatedCoupons: { col: 'E', expect: ['cupons estimados'] },
    nextCoupons: { col: 'F', expect: ['proxima faixa'] },
    diamondsRemaining: { col: 'G', expect: ['diamantes que faltam'] },
  },
};

/** Células avulsas de Configurações. */
export const CONFIG_CELLS = {
  tab: 'Configurações',
  range: 'A1:E30',
  programStart: 'B4',
  analysisMonth: 'B5',
  drawMonth: 'B6',
  lastCompleteMonth: 'B28',
};

/** Histórico: blocos mensais de 12 colunas; meses na linha 5, campos na linha 7. */
export const HISTORY = {
  tab: 'Histórico',
  range: 'A1:LD1007',
  monthRow: 5,
  fieldRow: 7,
  firstDataRow: 8,
  idCol: 'A',
  handleCol: 'B',
  blockWidth: 12,
  fields: {
    monthCoupons: ['cupons do mes', 'cupons mensais', 'cupom do mes'],
    accumulated: ['cupons do ciclo', 'acumulad'],
    status: ['status'],
    vinculo: ['vinculo', 'entrada'],
  },
};

/** Planilha auxiliar privada (opcional). Cabeçalhos por NOME, linha 1. */
export const AUX_TABS = {
  calendario: 'Calendário do portal',
  resultados: 'Resultados do portal',
  previsoes: 'Previsões de presentes',
  ciclos: 'Ciclos do portal',
};

export function colIndex(col: string): number {
  let n = 0;
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function cellRef(ref: string): { row: number; col: number } {
  const m = /^([A-Z]+)(\d+)$/.exec(ref)!;
  return { col: colIndex(m[1]), row: Number(m[2]) - 1 };
}
