/**
 * Número em formato pt-BR vindo da planilha ("1.234.567", "1.234,50", "R$ 10", "12%").
 * Retorna null para vazio/inválido. Nunca use para IDs (IDs são sempre texto).
 */
export function parseBRNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim().replace(/\s|R\$|%/g, '');
  if (!s || s === '-' || s === '—') return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /^-?\d+,\d+$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (!/^-?\d+(\.\d+)?$/.test(s)) {
    return null;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function parseIntBR(value: unknown): number | null {
  const n = parseBRNumber(value);
  return n === null ? null : Math.trunc(n);
}

/**
 * ID do criador SEMPRE como texto. Rejeita notação científica ou decimais,
 * que indicam que a célula virou número na planilha e perdeu precisão.
 */
export function parseCreatorId(value: unknown): { id: string | null; error?: string } {
  if (value === null || value === undefined) return { id: null };
  if (typeof value === 'number') {
    return { id: null, error: 'ID lido como número; formate a coluna como texto na planilha.' };
  }
  const s = String(value).trim().replace(/^'/, '');
  if (!s) return { id: null };
  if (/e\+?\d+$/i.test(s) || /[.,]\d/.test(s)) {
    return { id: null, error: `ID "${s}" parece numérico/científico; formate a coluna como texto.` };
  }
  if (!/^[A-Za-z0-9_\-]+$/.test(s)) return { id: null, error: `ID "${s}" contém caracteres inválidos.` };
  return { id: s };
}
