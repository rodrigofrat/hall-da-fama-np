/** Faixas de cupons mensais (regulamento). Limites inferiores inclusivos. */
export const COUPON_BANDS = [
  { min: 0, max: 499_999, coupons: 0, label: 'Menos de 500 mil' },
  { min: 500_000, max: 999_999, coupons: 1, label: 'De 500 mil até antes de 1 milhão' },
  { min: 1_000_000, max: 1_499_999, coupons: 2, label: 'De 1 milhão até antes de 1,5 milhão' },
  { min: 1_500_000, max: 1_999_999, coupons: 3, label: 'De 1,5 milhão até antes de 2 milhões' },
  { min: 2_000_000, max: Infinity, coupons: 4, label: 'A partir de 2 milhões' },
] as const;

export const ENTRY_COUPON = 1;

/**
 * Referência das faixas. O portal exibe sempre os cupons CALCULADOS PELA PLANILHA;
 * esta função serve para explicação na tela e para conferência no sincronizador.
 */
export function couponsForDiamonds(diamonds: number): number {
  if (!Number.isFinite(diamonds) || diamonds < 500_000) return 0;
  if (diamonds < 1_000_000) return 1;
  if (diamonds < 1_500_000) return 2;
  if (diamonds < 2_000_000) return 3;
  return 4;
}

export const THREE_MONTH_EXAMPLE = [
  { month: 'Mês 1', diamonds: 1_200_000 },
  { month: 'Mês 2', diamonds: 1_600_000 },
  { month: 'Mês 3', diamonds: 2_000_000 },
].map((r) => ({ ...r, coupons: couponsForDiamonds(r.diamonds) }));
