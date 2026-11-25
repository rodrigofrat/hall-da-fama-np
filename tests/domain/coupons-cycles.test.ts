import { couponsForDiamonds, THREE_MONTH_EXAMPLE } from '../../src/domain/coupons';
import { cycleForDrawMonth, cycleForMonth, isCyclePartial } from '../../src/domain/cycles';

describe('faixas de cupons', () => {
  it.each([
    [0, 0],
    [499_999, 0],
    [500_000, 1],
    [999_999, 1],
    [1_000_000, 2],
    [1_499_999, 2],
    [1_500_000, 3],
    [1_999_999, 3],
    [2_000_000, 4],
    [9_000_000, 4],
  ])('%i diamantes → %i cupons', (d, c) => expect(couponsForDiamonds(d)).toBe(c));

  it('exemplo de três meses soma 9 cupons mensais', () => {
    expect(THREE_MONTH_EXAMPLE.map((r) => r.coupons)).toEqual([2, 3, 4]);
    expect(THREE_MONTH_EXAMPLE.reduce((s, r) => s + r.coupons, 0)).toBe(9);
  });
});

describe('ciclos trimestrais e mudança de trimestre', () => {
  it('Out–Dez → sorteio em janeiro do ano seguinte', () => {
    const c = cycleForMonth('2026-11');
    expect(c.id).toBe('2026-T4');
    expect(c.months).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(c.drawMonth).toBe('2027-01');
    expect(c.label).toBe('Out–Dez 2026');
  });
  it.each([
    ['2027-01', '2027-T1', '2027-04'],
    ['2027-03', '2027-T1', '2027-04'],
    ['2027-04', '2027-T2', '2027-07'],
    ['2027-07', '2027-T3', '2027-10'],
    ['2027-09', '2027-T3', '2027-10'],
    ['2026-12', '2026-T4', '2027-01'],
  ])('%s pertence a %s (sorteio %s)', (m, id, draw) => {
    expect(cycleForMonth(m).id).toBe(id);
    expect(cycleForMonth(m).drawMonth).toBe(draw);
  });
  it('dezembro e janeiro ficam em ciclos diferentes (saldo reinicia)', () => {
    expect(cycleForMonth('2026-12').id).not.toBe(cycleForMonth('2027-01').id);
  });
  it('sorteio de jan/2027 corresponde ao ciclo 2026-T4', () => {
    expect(cycleForDrawMonth('2027-01').id).toBe('2026-T4');
  });
  it('saldo é parcial enquanto o último mês do ciclo não fecha', () => {
    const c = cycleForMonth('2026-11');
    expect(isCyclePartial(c, '2026-10')).toBe(true);
    expect(isCyclePartial(c, '2026-11')).toBe(true);
    expect(isCyclePartial(c, '2026-12')).toBe(false);
    expect(isCyclePartial(c, null)).toBe(true);
  });
});
