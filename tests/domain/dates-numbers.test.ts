import {
  addMonths, daysBetween, parseSheetDate, parseSheetMonth, parseSheetTime, todayInSaoPaulo, monthLabel,
} from '../../src/domain/dates';
import { parseBRNumber, parseCreatorId } from '../../src/domain/numbers';

describe('datas pt-BR', () => {
  it('converte dd/mm/aaaa explicitamente (sem Date.parse ambíguo)', () => {
    expect(parseSheetDate('03/11/2026')).toBe('2026-11-03');
    expect(parseSheetDate('3/1/27')).toBe('2027-01-03');
    expect(parseSheetDate('31/02/2026')).toBeNull();
    expect(parseSheetDate('')).toBeNull();
  });
  it('número de série do Sheets vira data local sem deslocamento', () => {
    expect(parseSheetDate(46327)).toBe('2026-11-01');
  });
  it('célula de mês descarta o dia 01 de referência', () => {
    expect(parseSheetMonth('01/01/2027')).toBe('2027-01');
    expect(parseSheetMonth('jan/2027')).toBe('2027-01');
    expect(parseSheetMonth('Novembro de 2026')).toBe('2026-11');
    expect(parseSheetMonth('março/2027')).toBe('2027-03');
    expect(parseSheetMonth('11/2026')).toBe('2026-11');
    expect(parseSheetMonth('2026-10')).toBe('2026-10');
  });
  it('horário só existe quando publicado', () => {
    expect(parseSheetTime('20:00')).toBe('20:00');
    expect(parseSheetTime('')).toBeNull();
    expect(parseSheetTime('25:00')).toBeNull();
  });
  it('virada da meia-noite em São Paulo', () => {
    // 02:59Z do dia 15 = 23:59 do dia 14 em São Paulo (UTC-3)
    expect(todayInSaoPaulo(new Date('2027-01-15T02:59:00Z'))).toBe('2027-01-14');
    expect(todayInSaoPaulo(new Date('2027-01-15T03:00:00Z'))).toBe('2027-01-15');
  });
  it('aritmética de meses e dias', () => {
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2027-01', -1)).toBe('2026-12');
    expect(daysBetween('2026-12-31', '2027-01-15')).toBe(15);
    expect(monthLabel('2027-01')).toBe('janeiro de 2027');
  });
});

describe('números e IDs', () => {
  it('lê números pt-BR', () => {
    expect(parseBRNumber('1.234.567')).toBe(1234567);
    expect(parseBRNumber('1.234,5')).toBe(1234.5);
    expect(parseBRNumber('500000')).toBe(500000);
    expect(parseBRNumber('')).toBeNull();
    expect(parseBRNumber('abc')).toBeNull();
  });
  it('preserva IDs longos como texto', () => {
    expect(parseCreatorId('7234567890123456789').id).toBe('7234567890123456789');
    expect(parseCreatorId("'7234567890123456789").id).toBe('7234567890123456789');
  });
  it('rejeita IDs que viraram número/científico', () => {
    expect(parseCreatorId('7,23457E+18').error).toBeTruthy();
    expect(parseCreatorId(7234567890123456789).error).toBeTruthy();
  });
});
