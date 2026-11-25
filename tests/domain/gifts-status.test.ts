import { buildGiftTimeline, dedupeDeliveries, expectedNextGift, forecastText, receivedText, referenceKind, type GiftDelivery, type NextGift } from '../../src/domain/gifts';
import { parseGiftSituation, parseLinkStatus, parseParticipation, resolvePipDisplay } from '../../src/domain/status';

const d = (vinculoEntry: string, reference: string, deliveredOn: string): GiftDelivery => ({
  vinculoEntry, reference, kind: referenceKind(reference), deliveredOn, coins: 5000,
});

describe('presentes de 5.000 moedas', () => {
  it('primeira entrega usa a data REAL de boas-vindas, não a data de ingresso', () => {
    const t = buildGiftTimeline([d('2026-06', 'Boas-vindas', '2026-06-18'), d('2026-06', 'Renovação set/2026', '2026-09-22')], '2026-06');
    expect(t.firstCurrent?.deliveredOn).toBe('2026-06-18');
    expect(t.lastReceived?.deliveredOn).toBe('2026-09-22');
    expect(receivedText(t.firstCurrent!)).toBe('Recebido em 18 de junho de 2026');
  });
  it('boas-vindas pendente: sem primeiro presente', () => {
    const t = buildGiftTimeline([], '2026-11');
    expect(t.firstCurrent).toBeNull();
    expect(expectedNextGift('2026-11', [])).toEqual({ month: '2026-11', kind: 'boas_vindas' });
  });
  it('renovação no 3º mês após a entrega real (novembro → fevereiro)', () => {
    expect(expectedNextGift('2026-08', [{ deliveredOn: '2026-11-10' }]).month).toBe('2027-02');
  });
  it('entrega atrasada desloca a próxima renovação', () => {
    // devida em fevereiro, recebida em abril → próxima em julho
    expect(expectedNextGift('2026-08', [{ deliveredOn: '2026-11-10' }, { deliveredOn: '2027-04-03' }]).month).toBe('2027-07');
  });
  it('reentrada: histórico por vínculo, primeiro do vínculo atual e do programa', () => {
    const t = buildGiftTimeline(
      [d('2025-03', 'Boas-vindas', '2025-03-20'), d('2025-03', 'Renovação', '2025-06-20'), d('2026-09', 'Boas-vindas', '2026-09-25')],
      '2026-09',
    );
    expect(t.vinculos.map((v) => v.entry)).toEqual(['2026-09', '2025-03']);
    expect(t.firstCurrent?.deliveredOn).toBe('2026-09-25');
    expect(t.firstProgram?.deliveredOn).toBe('2025-03-20');
    expect(t.total).toBe(3);
  });
  it('duplicidade não cria entrega extra', () => {
    const rows = [
      { creatorId: '1', vinculoEntry: '2026-06', reference: 'Boas-vindas', deliveredOn: '2026-06-20' },
      { creatorId: '1', vinculoEntry: '2026-06', reference: 'boas-vindas ', deliveredOn: '2026-06-18' },
    ];
    const r = dedupeDeliveries(rows);
    expect(r.unique).toHaveLength(1);
    expect(r.unique[0].deliveredOn).toBe('2026-06-18');
    expect(r.duplicates).toHaveLength(1);
  });
  it('previsão com mês sem dia e data exata somente quando registrada', () => {
    const n: NextGift = { vinculoEntry: '2026-08', reference: 'Renovação', kind: 'renovacao', situation: 'agendado', situationRaw: null, coins: 5000, forecastMonth: '2027-02', forecastDate: null };
    expect(forecastText(n)).toBe('Previsão: fevereiro de 2027 · dia a confirmar');
    expect(forecastText({ ...n, forecastDate: '2027-02-12' })).toBe('Previsão: 12 de fevereiro de 2027');
  });
  it('data real e previsão nunca aparecem trocadas', () => {
    const real = d('2026-08', 'Boas-vindas', '2026-08-15');
    const n: NextGift = { vinculoEntry: '2026-08', reference: 'Renovação', kind: 'renovacao', situation: 'agendado', situationRaw: null, coins: 5000, forecastMonth: '2026-11', forecastDate: null };
    expect(receivedText(real)).toMatch(/^Recebido em/);
    expect(forecastText(n)).toMatch(/^Previsão:/);
    expect(forecastText(n)).not.toContain('15 de agosto');
  });
  it('"Disponível" não significa recebido', () => {
    expect(parseGiftSituation('Disponível para entrega')).toBe('disponivel');
    expect(parseGiftSituation('Revisar continuidade')).toBe('revisar_continuidade');
    expect(parseGiftSituation('Aguardando fechamento')).toBe('aguardando_fechamento');
  });
});

describe('status, PIP e participação', () => {
  it('normaliza participação', () => {
    expect(parseParticipation('Apto')).toBe('apto');
    expect(parseParticipation('Não apto')).toBe('fora');
    expect(parseParticipation('Sem cupons')).toBe('sem_cupons');
    expect(parseParticipation('Aguardando fechamento')).toBe('aguardando_fechamento');
    expect(parseParticipation('')).toBe('desconhecido');
  });
  it('normaliza status do vínculo', () => {
    expect(parseLinkStatus('PIP')).toBe('em_recuperacao');
    expect(parseLinkStatus('Em recuperação')).toBe('em_recuperacao');
    expect(parseLinkStatus('Recuperado')).toBe('recuperado');
    expect(parseLinkStatus('Eliminado')).toBe('encerrada');
    expect(parseLinkStatus('Ativo')).toBe('ativo');
  });
  it('fechamento pendente preserva o último status confirmado', () => {
    const r = resolvePipDisplay({ status: 'aguardando_fechamento', referenceMonth: '2026-11', recoveryMonth: null, result: null, lastConfirmed: { status: 'em_recuperacao', month: '2026-10' } });
    expect(r).toEqual({ headline: 'em_recuperacao', headlineMonth: '2026-10', pendingCurrent: true });
  });
  it('dado ausente não vira "fora do PIP"', () => {
    expect(resolvePipDisplay(null).headline).toBe('historico_pendente');
  });
});
