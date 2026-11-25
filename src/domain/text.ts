/** Normaliza texto vindo da planilha para comparações: minúsculas, sem acentos, espaços simples. */
export function norm(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** "@Fulana", "fulana", " FULANA " → "fulana". */
export function normalizeHandle(value: string): string {
  return norm(value).replace(/^@+/, '').replace(/\s/g, '');
}

export function displayHandle(value: string): string {
  const h = String(value ?? '').trim().replace(/^@+/, '');
  return h ? `@${h}` : '';
}

const nf = new Intl.NumberFormat('pt-BR');
export const formatInt = (n: number) => nf.format(n);

export function plural(n: number, one: string, many: string): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`;
}
