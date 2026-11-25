/**
 * Planilha FICTÍCIA no mesmo layout da planilha oficial, para desenvolvimento,
 * testes e modo demonstração. Nenhum dado real. IDs prefixados com "demo_".
 * Cenário de validação: mês em análise nov/2026, último relatório liberado out/2026,
 * sorteio em jan/2027 sem dia oficial.
 */
import { couponsForDiamonds } from '../../src/domain/coupons';
import { cycleForMonth } from '../../src/domain/cycles';
import type { Grid, Workbook } from '../workbook';

type Person = {
  id: string; handle: string; entry: string; diamonds: Record<string, number>;
  hallStatus: string; notice?: string;
};

const MONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
const br = (m: string) => `01/${m.slice(5)}/${m.slice(0, 4)}`;
const num = (n: number) => n.toLocaleString('pt-BR');

export const PEOPLE: Person[] = [
  { id: 'demo_0001', handle: 'luna.demo', entry: '2026-05', hallStatus: 'Ativo', diamonds: { '2026-06': 1_100_000, '2026-07': 1_200_000, '2026-08': 1_600_000, '2026-09': 2_100_000, '2026-10': 1_600_000 } },
  { id: 'demo_0002', handle: 'nina.demo', entry: '2026-04', hallStatus: 'Ativo', diamonds: { '2026-06': 1_500_000, '2026-07': 2_200_000, '2026-08': 2_000_000, '2026-09': 2_500_000, '2026-10': 2_400_000 } },
  { id: 'demo_0003', handle: 'theo.demo', entry: '2026-05', hallStatus: 'Ativo', diamonds: { '2026-06': 900_000, '2026-07': 2_100_000, '2026-08': 1_700_000, '2026-09': 1_900_000, '2026-10': 2_050_000 } },
  { id: 'demo_0004', handle: 'vic.demo', entry: '2026-09', hallStatus: 'Ativo', diamonds: { '2026-09': 1_300_000, '2026-10': 2_300_000 } },
  { id: 'demo_0005', handle: 'mel.demo', entry: '2026-07', hallStatus: 'Ativo', diamonds: { '2026-07': 700_000, '2026-08': 1_100_000, '2026-09': 1_200_000, '2026-10': 1_550_000 } },
  { id: 'demo_0006', handle: 'caio.demo', entry: '2026-06', hallStatus: 'Ativo', diamonds: { '2026-06': 600_000, '2026-07': 800_000, '2026-08': 1_000_000, '2026-09': 1_400_000, '2026-10': 1_500_000 } },
  { id: 'demo_0007', handle: 'joao.demo', entry: '2026-08', hallStatus: 'Ativo', diamonds: { '2026-08': 650_000, '2026-09': 700_000, '2026-10': 1_000_000 } },
  { id: 'demo_0008', handle: 'gabi.demo', entry: '2026-10', hallStatus: 'PIP', diamonds: { '2026-10': 450_000 } },
  { id: 'demo_0009', handle: 'bia.demo', entry: '2026-04', hallStatus: 'PIP', diamonds: { '2026-06': 800_000, '2026-07': 1_000_000, '2026-08': 900_000, '2026-09': 1_050_000, '2026-10': 480_000 } },
  { id: 'demo_0010', handle: 'rafa.demo', entry: '2026-11', hallStatus: 'Aguardando fechamento', notice: 'Reconvite: confirmar entrada no grupo da NP', diamonds: {} },
];

/** Cupons do mês e acumulado do ciclo, com +1 de entrada no ciclo da entrada. */
export function couponTrail(p: Person) {
  const out: Record<string, { coupons: number; acc: number; status: string }> = {};
  let cycle = '';
  let acc = 0;
  for (const m of MONTHS) {
    const c = cycleForMonth(m).id;
    if (c !== cycle) {
      cycle = c;
      acc = cycleForMonth(p.entry).id === c ? 1 : 0;
    }
    const d = p.diamonds[m];
    if (d === undefined) continue;
    const coupons = couponsForDiamonds(d);
    acc += coupons;
    out[m] = { coupons, acc, status: d < 500_000 ? 'PIP' : 'Ativo' };
  }
  return out;
}

function t4Accumulated(p: Person) {
  const oct = couponTrail(p)['2026-10'];
  if (oct) return oct.acc;
  return cycleForMonth(p.entry).id === '2026-T4' ? 1 : 0;
}

function hall(): Grid {
  const g: Grid = [['ID', 'Criador', 'Entrada vigente', 'Status do mês', 'Diamantes do mês anterior', 'Cupons do mês', 'Cupons do ciclo', 'Próximo mês de sorteio', undefined, 'Convite/aviso']];
  for (const p of PEOPLE) {
    const oct = p.diamonds['2026-10'];
    g.push([p.id, p.handle, br(p.entry), p.hallStatus, oct === undefined ? '' : num(oct), oct === undefined ? '' : String(couponsForDiamonds(oct)), String(t4Accumulated(p)), '01/01/2027', undefined, p.notice ?? '']);
  }
  g.push(['', 'O criador deixou a agência', '', '', '', '', '', '', undefined, '']);
  return g;
}

function sorteios(): Grid {
  const g: Grid = [['ID', 'Criador', 'Entrada vigente', 'Status no corte', 'Cupons acumulados', 'Participação', 'Situação do ciclo', 'Cupons aptos', 'Faixa numérica']];
  let next = 1;
  for (const p of PEOPLE) {
    const acc = t4Accumulated(p);
    const participation = p.entry === '2026-11' ? 'Aguardando fechamento' : acc === 0 ? 'Sem cupons' : 'Apto';
    const eligible = participation === 'Apto' ? acc : 0;
    const range = eligible ? `${String(next).padStart(4, '0')}–${String(next + eligible - 1).padStart(4, '0')}` : '';
    next += eligible;
    g.push([p.id, p.handle, br(p.entry), p.hallStatus, String(acc), participation, 'Parcial', String(eligible), range]);
  }
  return g;
}

function pip(): Grid {
  return [
    ['ID', 'Criador', 'Mês de recuperação', undefined, undefined, undefined, 'Resultado'],
    ['demo_0008', 'gabi.demo', '01/11/2026', undefined, undefined, undefined, ''],
    ['demo_0009', 'bia.demo', '01/11/2026', undefined, undefined, undefined, ''],
  ];
}

function presentes(): Grid {
  return [
    ['ID', 'Criador', 'Entrada vigente', 'Referência a entregar', 'Tipo', 'Situação', 'Moedas', 'Próxima renovação', 'Último status fechado', 'Entrada no fechamento'],
    ['demo_0001', 'luna.demo', '01/05/2026', 'nov/2026', 'Renovação', 'Disponível', '5.000', '01/11/2026', 'Ativo', '01/05/2026'],
    ['demo_0002', 'nina.demo', '01/04/2026', 'jan/2027', 'Renovação', 'Agendado', '5.000', '01/01/2027', 'Ativo', '01/04/2026'],
    ['demo_0003', 'theo.demo', '01/05/2026', 'nov/2026', 'Renovação', 'Disponível', '5.000', '01/11/2026', 'Ativo', '01/05/2026'],
    ['demo_0004', 'vic.demo', '01/09/2026', 'dez/2026', 'Renovação', 'Agendado', '5.000', '01/12/2026', 'Ativo', '01/09/2026'],
    ['demo_0005', 'mel.demo', '01/07/2026', 'out/2026', 'Renovação', 'Disponível', '5.000', '01/10/2026', 'Ativo', '01/07/2026'],
    ['demo_0006', 'caio.demo', '01/06/2026', 'jan/2027', 'Renovação', 'Agendado', '5.000', '01/01/2027', 'Ativo', '01/06/2026'],
    ['demo_0007', 'joao.demo', '01/08/2026', 'Boas-vindas', 'Boas-vindas', 'Disponível', '5.000', '', 'Ativo', '01/08/2026'],
    ['demo_0008', 'gabi.demo', '01/10/2026', 'jan/2027', 'Renovação', 'Agendado', '5.000', '01/01/2027', 'PIP', '01/10/2026'],
    ['demo_0009', 'bia.demo', '01/04/2026', 'jan/2027', 'Renovação', 'Agendado', '5.000', '01/01/2027', 'PIP', '01/04/2026'],
    ['demo_0010', 'rafa.demo', '01/11/2026', 'Boas-vindas', 'Boas-vindas', 'Aguardando fechamento', '5.000', '', '', ''],
  ];
}

function entregas(): Grid {
  return [
    ['ID', 'Entrada do vínculo', 'Referência do presente', 'Data real', 'Criador', 'Moedas'],
    ['demo_0001', '01/05/2026', 'Boas-vindas', '14/05/2026', 'luna.demo', '5.000'],
    ['demo_0001', '01/05/2026', 'Renovação ago/2026', '20/08/2026', 'luna.demo', '5.000'],
    ['demo_0001', '01/05/2026', 'Boas-vindas', '15/05/2026', 'luna.demo', '5.000'], // duplicidade proposital
    ['demo_0002', '01/04/2026', 'Boas-vindas', '22/04/2026', 'nina.demo', '5.000'],
    ['demo_0002', '01/04/2026', 'Renovação jul/2026', '18/07/2026', 'nina.demo', '5.000'],
    ['demo_0002', '01/04/2026', 'Renovação out/2026', '16/10/2026', 'nina.demo', '5.000'],
    ['demo_0003', '01/05/2026', 'Boas-vindas', '30/05/2026', 'theo.demo', '5.000'],
    ['demo_0003', '01/05/2026', 'Renovação ago/2026', '28/08/2026', 'theo.demo', '5.000'],
    ['demo_0004', '01/03/2025', 'Boas-vindas', '18/03/2025', 'vic.demo', '5.000'],
    ['demo_0004', '01/03/2025', 'Renovação jun/2025', '20/06/2025', 'vic.demo', '5.000'],
    ['demo_0004', '01/09/2026', 'Boas-vindas', '25/09/2026', 'vic.demo', '5.000'],
    ['demo_0005', '01/07/2026', 'Boas-vindas', '25/07/2026', 'mel.demo', '5.000'],
    ['demo_0006', '01/06/2026', 'Boas-vindas', '20/06/2026', 'caio.demo', '5.000'],
    ['demo_0006', '01/06/2026', 'Renovação set/2026', '05/10/2026', 'caio.demo', '5.000'], // entrega atrasada
    ['demo_0008', '01/10/2026', 'Boas-vindas', '28/10/2026', 'gabi.demo', '5.000'],
    ['demo_0009', '01/04/2026', 'Boas-vindas', '10/04/2026', 'bia.demo', '5.000'],
    ['demo_0009', '01/04/2026', 'Renovação jul/2026', '15/07/2026', 'bia.demo', '5.000'],
    ['demo_0009', '01/04/2026', 'Renovação out/2026', '22/10/2026', 'bia.demo', '5.000'],
  ];
}

function meses(): Grid {
  const g: Grid = [['Mês', 'Importação completa', 'Linhas', 'Criadores', 'Inválidos', 'Duplicados', 'Observação', 'Mês liberado', 'Conferência']];
  for (const m of [...MONTHS, '2026-11']) {
    const ok = m !== '2026-11';
    g.push([br(m), ok ? 'Sim' : 'Não', ok ? '120' : '', ok ? '10' : '', '0', '0', '', ok ? 'Sim' : 'Não', ok ? 'OK' : '']);
  }
  return g;
}

function config(): Grid {
  const g: Grid = Array.from({ length: 30 }, () => []);
  g[3][0] = 'Início do programa'; g[3][1] = '01/04/2026';
  g[4][0] = 'Mês em análise'; g[4][1] = '01/11/2026';
  g[5][0] = 'Mês de sorteio'; g[5][1] = '01/01/2027';
  g[27][0] = 'Último mês completo'; g[27][1] = '01/10/2026';
  return g;
}

function historico(): Grid {
  const width = 12;
  const g: Grid = Array.from({ length: 7 }, () => []);
  g[0][0] = 'Histórico mensal (fictício)';
  g[6][0] = 'ID'; g[6][1] = 'Criador';
  const fields = ['Diamantes', 'Horas', 'Dias', 'Presença', 'Vínculo (entrada)', 'Status', 'Cupons do mês', 'Cupons acumulados'];
  MONTHS.forEach((m, i) => {
    const c = 2 + i * width;
    g[4][c] = br(m);
    fields.forEach((f, k) => (g[6][c + k] = f));
  });
  for (const p of PEOPLE) {
    const row: (string | undefined)[] = [p.id, p.handle];
    const trail = couponTrail(p);
    MONTHS.forEach((m, i) => {
      const c = 2 + i * width;
      const t = trail[m];
      if (!t) return;
      row[c] = num(p.diamonds[m]); row[c + 1] = '70'; row[c + 2] = '22'; row[c + 3] = 'Sim';
      row[c + 4] = br(p.entry); row[c + 5] = t.status; row[c + 6] = String(t.coupons); row[c + 7] = String(t.acc);
    });
    g.push(row);
  }
  return g;
}

/** Planilha auxiliar privada (Calendário, Resultados, Previsões, Ciclos). */
function auxTabs(): Record<string, Grid> {
  return {
    'Calendário do portal': [
      ['id', 'tipo', 'titulo', 'ciclo', 'mes_previsto', 'data_confirmada', 'horario', 'status', 'inicio_viagem', 'fim_viagem', 'destino', 'detalhes', 'link_oficial', 'data_anterior', 'imagem_url', 'published'],
      ['sorteio-2026-t3', 'sorteio', 'Sorteio Jul–Set 2026', '2026-T3', '01/10/2026', '20/10/2026', '20:00', 'realizado', '', '', '', 'Sorteio ao vivo na LIVE da NP.', '', '13/10/2026', '', 'sim'],
      ['resultado-2026-t3', 'resultado', 'Resultado Jul–Set 2026', '2026-T3', '01/10/2026', '21/10/2026', '', 'realizado', '', '', '', 'Ganhadores anunciados no feed da NP.', '', '', '', 'sim'],
      ['viagem-2026-t3', 'viagem', 'Viagem dos ganhadores Jul–Set 2026', '2026-T3', '', '', '', 'confirmado', '18/02/2027', '21/02/2027', 'Rio de Janeiro', 'Voos e hotel inclusos, com direito a um acompanhante. Demais gastos por conta dos ganhadores.', '', '', '', 'sim'],
      ['sorteio-2026-t4', 'sorteio', 'Sorteio Out–Dez 2026', '2026-T4', '01/01/2027', '', '', 'previsto', '', '', '', '', '', '', '', 'sim'],
      ['viagem-2026-t4', 'viagem', 'Viagem dos ganhadores Out–Dez 2026', '2026-T4', '01/04/2027', '', '', 'previsto', '', '', '', 'Destino a confirmar pela agência.', '', '', '', 'não'],
    ],
    'Resultados do portal': [
      ['id', 'ciclo', 'titulo', 'data_sorteio', 'data_divulgacao', 'ganhadores', 'observacoes', 'link_oficial', 'published'],
      ['res-2026-t3', '2026-T3', 'Ganhadores Jul–Set 2026', '20/10/2026', '21/10/2026', '@nina.demo; @theo.demo; @luna.demo', 'Três viagens com acompanhante.', '', 'sim'],
    ],
    'Previsões de presentes': [
      ['id_criador', 'entrada_vinculo', 'referencia', 'data_prevista'],
      ['demo_0009', '01/04/2026', 'jan/2027', '20/01/2027'],
    ],
    'Ciclos do portal': [
      ['ciclo', 'estado', 'publicar_faixas'],
      ['2026-T3', 'arquivado', 'não'],
      ['2026-T4', 'parcial', 'não'],
    ],
  };
}

export function sampleWorkbooks(): { main: Workbook; aux: Workbook } {
  return {
    main: {
      tabs: {
        'Hall da Fama': hall(),
        Sorteios: sorteios(),
        PIP: pip(),
        Presentes: presentes(),
        'Registro de entregas': entregas(),
        Meses: meses(),
        'Configurações': config(),
        'Histórico': historico(),
      },
    },
    aux: { tabs: auxTabs() },
  };
}
