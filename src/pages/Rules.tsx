import { CalendarDays, ScrollText } from 'lucide-react';
import { COUPON_BANDS } from '../domain/coupons';
import { Accordion, Card, PageHead } from '../ui/components';

export function RulesPage() {
  return (
    <div className="page">
      <PageHead eyebrow="Hall da Fama" title="Regulamento">Resumo das regras do programa. Em caso de dúvida, vale o comunicado oficial da Agência NP.</PageHead>
      <div className="page" style={{ gap: 10 }}>
        <Accordion title="Entrada no Hall" defaultOpen>
          <ul>
            <li><strong>800.000 diamantes</strong> somados em dois meses consecutivos completos.</li>
            <li>A janela anda um mês por vez. A entrada acontece no mês seguinte, após confirmação da agência.</li>
            <li>Participação em outro projeto pode bloquear a entrada, conforme o controle atual.</li>
            <li>Ao entrar, você ganha <strong>+1 cupom de entrada</strong>, uma única vez por entrada efetiva.</li>
          </ul>
        </Accordion>
        <Accordion title="Permanência">
          <ul>
            <li><strong>500.000 diamantes por mês</strong> para permanecer.</li>
            <li>Um mês abaixo da meta coloca o vínculo em recuperação (PIP) no mês seguinte.</li>
            <li>Somente relatórios mensais completos e liberados contam para o fechamento. Relatório ainda não confirmado não significa saída.</li>
          </ul>
        </Accordion>
        <Accordion title="Recuperação (PIP)">
          <ul>
            <li>Para sair da recuperação, cumpra no mesmo mês: <strong>500.000 diamantes, 60 horas de LIVE e 20 dias ativos</strong>.</li>
            <li>O resultado oficial, incluindo eventual eliminação, é publicado pela NP após o fechamento.</li>
            <li>Depois de saída ou eliminação, uma nova entrada exige dois novos meses válidos após a saída. O histórico anterior fica no vínculo antigo.</li>
          </ul>
        </Accordion>
        <Accordion title="Cupons">
          <ul>
            {COUPON_BANDS.map((b) => <li key={b.coupons}>{b.label}: <strong>{b.coupons} {b.coupons === 1 ? 'cupom' : 'cupons'}</strong></li>)}
            <li>Os cupons do mês valem inclusive em meses de PIP ou recuperação, conforme cálculo da planilha.</li>
            <li>O saldo é trimestral e reinicia a cada ciclo. Até a conferência final, os valores podem ser parciais.</li>
          </ul>
        </Accordion>
        <Accordion title="Sorteio e viagens">
          <ul>
            <li>Out–Dez → sorteio em janeiro · Jan–Mar → abril · Abr–Jun → julho · Jul–Set → outubro.</li>
            <li>“Cupons aptos” só contam quando sua participação estiver como <strong>Apto</strong>. Quem está em PIP participa quando apto segundo a planilha.</li>
            <li>Três viagens por trimestre para três ganhadores, cada uma com direito a um acompanhante, voos e hotel inclusos.</li>
            <li>Destinos previstos: Nordeste ou Rio de Janeiro, a confirmar pela agência. Os demais gastos ficam por conta dos ganhadores.</li>
            <li>O ranking compara cupons; a posição não define o ganhador.</li>
          </ul>
        </Accordion>
        <Accordion title="Presentes de 5.000 moedas">
          <ul>
            <li>Primeiro presente: boas-vindas do vínculo, entregue após a entrada.</li>
            <li>Renovação no terceiro mês após o mês da última entrega real (ex.: novembro → fevereiro). Uma entrega atrasada desloca a próxima.</li>
            <li>Quem está em PIP pode receber enquanto o vínculo estiver vigente e os requisitos de fechamento estiverem satisfeitos.</li>
            <li>Saída e eliminação encerram o vínculo. Entregas antigas continuam no seu histórico.</li>
          </ul>
        </Accordion>
        <Accordion title="Benefícios do Hall">
          <ul>
            <li>Visita VIP na sua LIVE pelo menos uma vez por mês.</li>
            <li>Postagem trimestral dos destaques no feed da NP.</li>
            <li>Story mensal com três destaques.</li>
            <li>Placa anual de reconhecimento.</li>
          </ul>
        </Accordion>
      </div>
      <Card title="Datas e comunicados oficiais" icon={CalendarDays} labelledBy="datas-title">
        <p className="muted small">As datas dos benefícios e comunicados serão publicadas aqui e no calendário quando a agência divulgar.</p>
        <p className="tiny muted" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><ScrollText size={14} aria-hidden /> Fonte: regulamento do Hall da Fama da Agência NP.</p>
      </Card>
    </div>
  );
}
