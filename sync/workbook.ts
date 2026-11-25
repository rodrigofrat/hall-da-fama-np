/** Representação mínima e independente da API: aba → matriz de células (texto formatado). */
export type Cell = string | number | boolean | null | undefined;
export type Grid = Cell[][];
export interface Workbook {
  /** Valores por aba. Colunas não lidas ficam vazias (undefined). */
  tabs: Record<string, Grid>;
}

export interface Issue {
  severity: 'error' | 'warning';
  sheet: string;
  rowRef: string | null;
  code: string;
  message: string;
}

export class Issues {
  list: Issue[] = [];
  error(sheet: string, rowRef: string | null, code: string, message: string) {
    this.list.push({ severity: 'error', sheet, rowRef, code, message });
  }
  warn(sheet: string, rowRef: string | null, code: string, message: string) {
    this.list.push({ severity: 'warning', sheet, rowRef, code, message });
  }
  get errors() {
    return this.list.filter((i) => i.severity === 'error');
  }
}

/** Mescla leituras de vários intervalos de colunas (ex.: A:H e J:J) numa única grade. */
export function mergeColumnRanges(parts: { startCol: number; values: Cell[][] }[]): Grid {
  const out: Grid = [];
  for (const p of parts) {
    p.values.forEach((row, r) => {
      out[r] ??= [];
      row.forEach((v, c) => (out[r][p.startCol + c] = v));
    });
  }
  return out;
}
