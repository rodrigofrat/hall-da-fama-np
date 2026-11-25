import { compareRows, rankEntries, searchRanking } from '../../src/domain/ranking';

const rows = rankEntries([
  { handle: 'zeca.live', coupons: 9 },
  { handle: 'Ana_Lives', coupons: 9 },
  { handle: 'bruno', coupons: 12 },
  { handle: 'carla', coupons: 5, isMe: true },
  { handle: 'duda', coupons: 5 },
  { handle: 'semdado', coupons: null },
]);

describe('ranking com empate', () => {
  it('posições compartilhadas e ordem alfabética dentro do empate', () => {
    expect(rows.map((r) => [r.handle, r.position])).toEqual([
      ['bruno', 1],
      ['Ana_Lives', 2],
      ['zeca.live', 2],
      ['carla', 4],
      ['duda', 4],
    ]);
    expect(rows[1].tied).toBe(true);
    expect(rows[0].tied).toBe(false);
  });
  it('dado ausente não vira zero nem entra na lista', () => {
    expect(rows.find((r) => r.handle === 'semdado')).toBeUndefined();
  });
});

describe('busca por @', () => {
  it.each(['@ANA', 'ana', '  @ana_l ', 'ÁNA'])('"%s" encontra @Ana_Lives', (q) => {
    expect(searchRanking(rows, q).map((r) => r.handle)).toContain('Ana_Lives');
  });
});

describe('comparação no mesmo ciclo', () => {
  it('calcula quanto falta para igualar e ultrapassar', () => {
    const c = compareRows(rows, '@bruno')!;
    expect(c.difference).toBe(7);
    expect(c.toTie).toBe(7);
    expect(c.toPass).toBe(8);
    expect(c.relation).toBe('atras');
  });
  it('empatado: falta 0 para igualar e 1 para ultrapassar', () => {
    const c = compareRows(rows, 'DUDA')!;
    expect(c.toTie).toBe(0);
    expect(c.toPass).toBe(1);
    expect(c.relation).toBe('empatado');
  });
  it('à frente: nada falta', () => {
    const lower = rankEntries([{ handle: 'eu', coupons: 10, isMe: true }, { handle: 'x', coupons: 3 }]);
    const c = compareRows(lower, 'x')!;
    expect(c.relation).toBe('a_frente');
    expect(c.toTie).toBe(0);
    expect(c.toPass).toBe(0);
  });
  it('não compara consigo mesmo nem com @ inexistente', () => {
    expect(compareRows(rows, 'carla')).toBeNull();
    expect(compareRows(rows, 'ninguem')).toBeNull();
  });
});
