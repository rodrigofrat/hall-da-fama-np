/** @vitest-environment node */
import { buildSnapshot } from '../../sync/build';
import { sampleWorkbooks } from '../../sync/fixtures/sample-workbook';
import { demoSnapshot } from '../../scripts/gen-demo';
import committed from '../../src/data/demo/snapshot.json';

const fresh = () => sampleWorkbooks();

describe('sincronizador: planilha → snapshot', () => {
  const { payload, issues } = buildSnapshot(fresh().main, fresh().aux);
  const errors = issues.filter((i) => i.severity === 'error');

  it('sincroniza somente a prévia do mês em análise para criadores do Hall', () => {
    const { main, aux } = fresh();
    main.tabs['Prévia mensal'] = [
      [], [], [], [],
      ['ID do criador', 'Criador', 'Dados até', 'Diamantes no mês', 'Cupons estimados', 'Próxima faixa de cupons', 'Diamantes que faltam', 'Situação'],
      ['demo_0001', '', '24/11/2026', '900.000', '1', '2', '100.000'],
      ['demo_0002', '', '24/11/2026', '2.000.000', '4', '', ''],
      ['demo_0003', '', '24/10/2026', '0', '0', '1', '500.000'],
      ['fora_do_hall', '', '24/11/2026', '1.500.000', '3', '4', '500.000'],
    ];

    const result = buildSnapshot(main, aux);
    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(result.payload.creators.find((creator) => creator.creator_id === 'demo_0001')?.monthly_preview)
      .toEqual({ through: '2026-11-24', diamonds: 900000, estimatedCoupons: 1, next: { coupons: 2, diamondsRemaining: 100000 } });
    expect(result.payload.creators.find((creator) => creator.creator_id === 'demo_0002')?.monthly_preview)
      .toEqual({ through: '2026-11-24', diamonds: 2000000, estimatedCoupons: 4, next: null });
    expect(result.payload.creators.find((creator) => creator.creator_id === 'demo_0003')?.monthly_preview).toBeUndefined();
    expect(result.payload.creators.some((creator) => creator.creator_id === 'fora_do_hall')).toBe(false);
    expect(result.payload.monthly_coupons).toEqual(payload.monthly_coupons);
    expect(result.payload.ranking_entries).toEqual(payload.ranking_entries);
  });

  it('carga fictícia válida, sem erros', () => expect(errors).toEqual([]));

  it('lê o cenário: análise nov/2026, último fechado out/2026, sorteio jan/2027 sem dia', () => {
    expect(payload.program_state).toMatchObject({ analysis_month: '2026-11', last_closed_month: '2026-10', draw_month: '2027-01' });
    const ev = payload.calendar_events.find((e) => e.event_id === 'sorteio-2026-t4')!;
    expect(ev.confirmed_date).toBeNull();
    expect(ev.expected_month).toBe('2027-01');
  });

  it('IDs como texto e linha "O criador deixou a agência" não gera ID', () => {
    expect(payload.creators.every((c) => typeof c.creator_id === 'string' && c.creator_id.startsWith('demo_'))).toBe(true);
    expect(payload.creators).toHaveLength(10);
  });

  it('PIP projeta somente estado, referência e resultado (sem diamantes/horas/dias)', () => {
    for (const p of payload.pip_status) {
      expect(Object.keys(p).sort()).toEqual(['creator_id', 'last_confirmed_month', 'last_confirmed_status', 'recovery_month', 'reference_month', 'result', 'status']);
    }
    expect(JSON.stringify(payload)).not.toMatch(/diamant|horas|contato|comprovante/i);
  });

  it('PIP em aberto apto participa do sorteio', () => {
    const gabi = payload.cycle_balances.find((b) => b.creator_id === 'demo_0008' && b.cycle_id === '2026-T4')!;
    expect(payload.pip_status.find((p) => p.creator_id === 'demo_0008')!.status).toBe('em_recuperacao');
    expect(gabi.participation).toBe('apto');
    expect(gabi.eligible).toBe(1);
    expect(gabi.entry_bonus).toBe(1);
  });

  it('aguardando fechamento: cupons aptos não contam e status não vira zero', () => {
    const rafa = payload.cycle_balances.find((b) => b.creator_id === 'demo_0010')!;
    expect(rafa.participation).toBe('aguardando_fechamento');
    expect(rafa.eligible).toBe(0);
    const pip = payload.pip_status.find((p) => p.creator_id === 'demo_0010')!;
    expect(pip.status).toBe('aguardando_fechamento');
    const nov = payload.monthly_coupons.find((m) => m.creator_id === 'demo_0010' && m.month === '2026-11')!;
    expect(nov).toMatchObject({ coupons: null, closed: false });
  });

  it('ranking contém só @ e cupons (+ID interno para is_me no servidor)', () => {
    for (const r of payload.ranking_entries) expect(Object.keys(r).sort()).toEqual(['coupons', 'creator_id', 'cycle_id', 'handle']);
  });

  it('ciclos arquivados só existem quando há registro', () => {
    expect(payload.cycles.map((c) => c.cycle_id)).toEqual(['2026-T2', '2026-T3', '2026-T4']);
    expect(payload.cycles.find((c) => c.cycle_id === '2026-T3')!.state).toBe('arquivado');
  });

  it('entrega duplicada vira aviso e não gera entrega extra', () => {
    expect(issues.some((i) => i.code === 'entrega_duplicada')).toBe(true);
    const luna = payload.gift_deliveries.filter((d) => d.creator_id === 'demo_0001' && d.kind === 'boas_vindas');
    expect(luna).toHaveLength(1);
    expect(luna[0].delivered_on).toBe('2026-05-14');
  });

  it('previsão exata só quando registrada; data real e previsão separadas', () => {
    expect(payload.gift_next.find((g) => g.creator_id === 'demo_0009')!.forecast_date).toBe('2027-01-20');
    expect(payload.gift_next.find((g) => g.creator_id === 'demo_0006')!.forecast_date).toBeNull();
    expect(payload.gift_next.find((g) => g.creator_id === 'demo_0006')!.forecast_month).toBe('2027-01'); // entrega atrasada em out → jan
  });

  it('somente eventos publicados entram', () => {
    expect(payload.calendar_events.map((e) => e.event_id)).not.toContain('viagem-2026-t4');
  });

  it('faixa numérica oculta enquanto o ciclo não for validado', () => {
    expect(payload.cycle_balances.every((b) => b.number_range === null)).toBe(true);
  });

  it('é idempotente: mesma planilha → mesmo hash', () => {
    expect(buildSnapshot(fresh().main, fresh().aux).hash).toBe(buildSnapshot(fresh().main, fresh().aux).hash);
  });

  it('dados de demonstração do frontend estão em dia com o pipeline', () => {
    expect(committed.hash).toBe(demoSnapshot().hash);
  });
});

describe('sincronizador: validações que recusam a carga', () => {
  it('reconhece o cabeçalho e a referência de boas-vindas do registro oficial', () => {
    const wb = fresh();
    const delivery = wb.main.tabs['Registro de entregas'];
    delivery[0][3] = 'Entregue em';
    delivery[1][2] = delivery[3][2] = '01/05/2026';
    delivery[2][2] = '01/08/2026';
    const { payload, issues } = buildSnapshot(wb.main, wb.aux);
    expect(issues.filter((issue) => issue.severity === 'error')).toEqual([]);
    expect(payload.gift_deliveries.filter((gift) => gift.creator_id === 'demo_0001').map((gift) => [gift.kind, gift.delivered_on]))
      .toEqual([['boas_vindas', '2026-05-14'], ['renovacao', '2026-08-20']]);
  });

  it('cabeçalho fora do layout', () => {
    const wb = fresh();
    wb.main.tabs['Hall da Fama'][0][2] = 'Coluna nova';
    const r = buildSnapshot(wb.main, wb.aux);
    expect(r.issues.some((i) => i.severity === 'error' && i.code === 'cabecalho')).toBe(true);
  });
  it('ID numérico/científico (perda de precisão)', () => {
    const wb = fresh();
    wb.main.tabs['Hall da Fama'][1][0] = '7,23457E+18';
    expect(buildSnapshot(wb.main, wb.aux).issues.some((i) => i.code === 'id_invalido')).toBe(true);
  });
  it('ID duplicado', () => {
    const wb = fresh();
    wb.main.tabs['Hall da Fama'].push([...wb.main.tabs['Hall da Fama'][1]]);
    expect(buildSnapshot(wb.main, wb.aux).issues.some((i) => i.severity === 'error' && i.code === 'id_duplicado')).toBe(true);
  });
  it('aba ausente', () => {
    const wb = fresh();
    delete wb.main.tabs['Sorteios'];
    expect(buildSnapshot(wb.main, wb.aux).issues.some((i) => i.code === 'aba_ausente')).toBe(true);
  });
  it('mês liberado vs. relatório pendente: novembro não liberado não fecha nada', () => {
    const { payload } = buildSnapshot(fresh().main, fresh().aux);
    expect(payload.monthly_coupons.filter((m) => m.month === '2026-11').every((m) => !m.closed)).toBe(true);
    expect(payload.monthly_coupons.filter((m) => m.month === '2026-10').every((m) => m.closed)).toBe(true);
  });
  it('planilha auxiliar é opcional', () => {
    const r = buildSnapshot(fresh().main, null);
    expect(r.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(r.payload.calendar_events).toEqual([]);
  });
});
