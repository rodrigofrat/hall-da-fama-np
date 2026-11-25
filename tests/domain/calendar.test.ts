import { eventTiming, nextDraw, nextDrawSentence, type CalendarEvent } from '../../src/domain/calendar';
import { todayInSaoPaulo } from '../../src/domain/dates';

const base: CalendarEvent = {
  id: 's1', type: 'sorteio', title: 'Sorteio Out–Dez 2026', cycleId: '2026-T4', expectedMonth: '2027-01',
  confirmedDate: null, confirmedTime: null, status: 'previsto', tripStart: null, tripEnd: null,
  destination: null, details: null, officialUrl: null, previousDate: null,
};

describe('calendário', () => {
  it('somente mês: nunca gera contador (dia 01 é referência)', () => {
    const t = eventTiming(base, '2026-11-25');
    expect(t.kind).toBe('mes');
    expect(t.daysLeft).toBeNull();
    expect(nextDrawSentence(base, '2026-11-25')).toBe('Próximo sorteio previsto para janeiro de 2027 · dia a confirmar');
    // mesmo no dia 1º de janeiro, sem data confirmada não há "É hoje"
    expect(eventTiming(base, '2027-01-01').kind).toBe('mes');
  });
  it('data confirmada: Faltam X dias / É hoje / Aguardando resultado', () => {
    const ev = { ...base, confirmedDate: '2027-01-15', status: 'confirmado' as const };
    expect(eventTiming(ev, '2027-01-05').headline).toBe('Faltam 10 dias');
    expect(eventTiming(ev, '2027-01-14').headline).toBe('Falta 1 dia');
    expect(eventTiming(ev, '2027-01-15').headline).toBe('É hoje');
    expect(eventTiming(ev, '2027-01-16').headline).toBe('Aguardando resultado');
    expect(eventTiming(ev, '2027-01-16', true).headline).toBe('Resultado divulgado');
  });
  it('não inventa horário; mostra só quando publicado', () => {
    const ev = { ...base, confirmedDate: '2027-01-15' };
    expect(eventTiming(ev, '2027-01-15').whenText).toBe('15 de janeiro de 2027');
    const withTime = { ...ev, confirmedTime: '20:00' };
    expect(eventTiming(withTime, '2027-01-15').headline).toBe('É hoje, às 20:00');
  });
  it('virada da meia-noite de São Paulo muda o contador', () => {
    const ev = { ...base, confirmedDate: '2027-01-15' };
    const before = todayInSaoPaulo(new Date('2027-01-15T02:59:00Z')); // 23:59 de 14/01 em SP
    const after = todayInSaoPaulo(new Date('2027-01-15T03:00:00Z')); // 00:00 de 15/01 em SP
    expect(eventTiming(ev, before).headline).toBe('Falta 1 dia');
    expect(eventTiming(ev, after).headline).toBe('É hoje');
  });
  it('remarcação reflete nova data e status', () => {
    const ev = { ...base, confirmedDate: '2027-01-22', previousDate: '2027-01-15', status: 'remarcado' as const };
    expect(eventTiming(ev, '2027-01-15').headline).toBe('Faltam 7 dias');
  });
  it('próximo sorteio: usa mês da planilha quando nada foi publicado', () => {
    const ev = nextDraw([], [], '2026-11-25', '2027-01', '2026-T4')!;
    expect(ev.confirmedDate).toBeNull();
    expect(nextDrawSentence(ev, '2026-11-25')).toContain('janeiro de 2027 · dia a confirmar');
  });
  it('próximo sorteio: ignora ciclos com resultado divulgado (histórico)', () => {
    const old = { ...base, id: 'old', cycleId: '2026-T3', expectedMonth: '2026-10', confirmedDate: '2026-10-20', status: 'realizado' as const };
    const ev = nextDraw([old, base], [{ id: 'r', cycleId: '2026-T3', title: 'x', drawDate: '2026-10-20', publishedOn: '2026-10-21', winners: [], notes: null, officialUrl: null }], '2026-11-25', null, null)!;
    expect(ev.id).toBe('s1');
  });
  it('sorteio já ocorrido sem resultado continua como "Aguardando resultado"', () => {
    const ev = { ...base, confirmedDate: '2027-01-15' };
    const n = nextDraw([ev], [], '2027-01-20', null, null)!;
    expect(eventTiming(n, '2027-01-20').headline).toBe('Aguardando resultado');
  });
  it('viagem: contador até o início e "Em andamento"', () => {
    const trip: CalendarEvent = { ...base, id: 'v', type: 'viagem', tripStart: '2027-03-10', tripEnd: '2027-03-14', destination: 'Rio de Janeiro' };
    expect(eventTiming(trip, '2027-03-01').headline).toBe('Faltam 9 dias');
    expect(eventTiming(trip, '2027-03-12').headline).toBe('Em andamento');
    expect(eventTiming(trip, '2027-03-20').headline).toBe('Concluída');
  });
});
