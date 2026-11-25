import { CalendarClock, Gift, History, PackageCheck, Sparkles } from 'lucide-react';
import { useMe } from '../app/data';
import { monthLabel } from '../domain/dates';
import { buildGiftTimeline, forecastText, GIFT_COINS, GIFT_KIND_LABEL, receivedText, type GiftDelivery } from '../domain/gifts';
import { GIFT_SITUATION_HELP } from '../domain/status';
import { formatInt } from '../domain/text';
import { Accordion, Card, ErrorState, Loading, Notice, PageHead } from '../ui/components';
import { GiftSituationPill } from '../ui/status';

export function GiftsPage() {
  const { me, reload } = useMe();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data) return <ErrorState message={me.error ?? 'Erro ao carregar.'} onRetry={reload} />;
  const { deliveries, next } = me.data.gifts;
  const t = buildGiftTimeline(deliveries, me.data.profile.currentEntryMonth);
  const showProgramFirst = t.firstProgram && t.firstCurrent && t.firstProgram !== t.firstCurrent;

  return (
    <div className="page">
      <PageHead eyebrow="Área pessoal" title="Meus presentes">Presentes de {formatInt(GIFT_COINS)} moedas. Visível somente para você.</PageHead>

      <div className="grid-2">
        <Card title="Primeiro presente recebido" icon={Sparkles} labelledBy="primeiro-title">
          {t.firstCurrent ? (
            <>
              <p className="mid-number" style={{ fontSize: '1.5rem' }}>{receivedText(t.firstCurrent)}</p>
              <p className="small muted">Boas-vindas do vínculo atual · {formatInt(t.firstCurrent.coins)} moedas</p>
              {showProgramFirst && <p className="small muted">Primeiro no programa: {receivedText(t.firstProgram!).toLowerCase()} (vínculo de {monthLabel(t.firstProgram!.vinculoEntry)}).</p>}
            </>
          ) : <p className="muted">Ainda sem entrega registrada.</p>}
        </Card>

        <section className="card hero fade-in" aria-labelledby="proximo-title">
          <div className="card-head"><h2 id="proximo-title"><CalendarClock aria-hidden /> Próximo presente</h2></div>
          {next ? (
            <>
              <GiftSituationPill situation={next.situation} />
              <p className="countdown" style={{ fontSize: '1.4rem' }}>{forecastText(next) ?? 'Previsão a confirmar'}</p>
              <p className="small muted">{GIFT_KIND_LABEL[next.kind]} · {formatInt(next.coins)} moedas</p>
              <p className="small">{GIFT_SITUATION_HELP[next.situation]}</p>
            </>
          ) : <p className="muted">Sem previsão no momento.</p>}
        </section>
      </div>

      {t.lastReceived && t.total > 1 && (
        <Card title="Último presente recebido" icon={PackageCheck} labelledBy="ultimo-title">
          <p><b>{receivedText(t.lastReceived)}</b></p>
          <p className="small muted">{labelOf(t.lastReceived)} · {formatInt(t.lastReceived.coins)} moedas</p>
        </Card>
      )}

      <Notice>
        Como funciona: o primeiro presente é o de boas-vindas do seu vínculo. Depois, a renovação cai no <b>terceiro mês após o mês da entrega real</b> (ex.: recebido em novembro → próxima renovação em fevereiro). “Disponível” significa apto para entrega, ainda não recebido.
      </Notice>

      {t.total > 0 && (
        <Card title="Histórico de entregas" icon={History} labelledBy="hist-gifts">
          {t.vinculos.filter((v) => v.deliveries.length).map((v, i) => {
            const body = (
              <ol className="timeline">
                {[...v.deliveries].reverse().map((d) => (
                  <li key={d.reference + d.deliveredOn}><b>{receivedText(d)}</b><br /><span className="small muted">{labelOf(d)} · {formatInt(d.coins)} moedas</span></li>
                ))}
              </ol>
            );
            const title = `Vínculo iniciado em ${monthLabel(v.entry)}${v.isCurrent ? ' (atual)' : ''}`;
            return t.vinculos.length > 1 ? <Accordion key={v.entry} title={title} defaultOpen={i === 0}>{body}</Accordion> : <div key={v.entry}>{body}</div>;
          })}
        </Card>
      )}
      {t.total === 0 && <Card title="Histórico" icon={Gift}><p className="muted small">Ainda sem entrega registrada.</p></Card>}
    </div>
  );
}

function labelOf(d: GiftDelivery) {
  return d.kind === 'outro' ? d.reference : `${GIFT_KIND_LABEL[d.kind]}${d.kind === 'renovacao' && /\d/.test(d.reference) ? ` (${d.reference.replace(/renova[cç][aã]o\s*/i, '')})` : ''}`;
}
