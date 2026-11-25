import { CalendarDays, Clock, Flag, HeartPulse, Timer, Gem } from 'lucide-react';
import { useMe } from '../app/data';
import { monthLabel, monthLabelCap } from '../domain/dates';
import { LINK_STATUS_HELP, PIP_GOALS, resolvePipDisplay } from '../domain/status';
import { Card, ErrorState, Loading, Notice, PageHead } from '../ui/components';
import { LinkStatusPill } from '../ui/status';

const GOAL_ICON = { diamantes: Gem, horas: Timer, dias: CalendarDays };

export function PipPage() {
  const { me, reload } = useMe();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data) return <ErrorState message={me.error ?? 'Erro ao carregar.'} onRetry={reload} />;
  const pip = me.data.pip;
  const view = resolvePipDisplay(pip);
  const inRecovery = view.headline === 'em_recuperacao';

  return (
    <div className="page">
      <PageHead eyebrow="Área pessoal" title="Participação e PIP">Informações visíveis somente para você.</PageHead>
      <Card title="O que é o PIP?" labelledBy="pip-explainer">
        <p className="small muted">
          PIP significa <b>Performance Improvement Plan</b> (Plano de Melhoria de Desempenho).
          No Hall da Fama, é o mês de recuperação. Se você não atingir a meta de permanência,
          tem um mês para cumprir as metas de recuperação e continuar no programa.
        </p>
      </Card>

      <section className="card hero fade-in" aria-labelledby="pip-status">
        <div className="card-head"><h2 id="pip-status"><HeartPulse aria-hidden /> Seu status</h2></div>
        <LinkStatusPill status={view.headline} />
        <p>{view.headline === 'ativo'
          ? 'Parabéns! Você cumpriu a meta de permanência e não está no mês de recuperação.'
          : LINK_STATUS_HELP[view.headline]}</p>
        <div className="stat-row">
          <div className="stat"><span className="label">Mês de referência</span><span className="value">{view.headlineMonth ? monthLabelCap(view.headlineMonth) : 'A confirmar'}</span></div>
          {pip?.recoveryMonth && inRecovery && (
            <div className="stat"><span className="label">Mês para cumprir as metas</span><span className="value">{monthLabelCap(pip.recoveryMonth)}</span></div>
          )}
        </div>
        {view.pendingCurrent && <Notice tone="warn" icon={Clock}>O status do mês atual aguarda fechamento. Até lá, vale o último status confirmado acima.</Notice>}
      </section>

      {inRecovery && (
        <Card title="Metas para sair da recuperação" icon={Flag} labelledBy="metas-title">
          <p className="small muted">As três metas precisam ser cumpridas <b style={{ color: '#fff' }}>no mesmo mês</b>{pip?.recoveryMonth ? ` (${monthLabel(pip.recoveryMonth)})` : ''}:</p>
          <div className="goals">
            {PIP_GOALS.map((g) => {
              const I = GOAL_ICON[g.key];
              return (
                <div key={g.key} className="goal">
                  <I aria-hidden size={22} color="var(--np-pink)" style={{ justifySelf: 'center' }} />
                  <span className="n">{g.value}</span>
                  <span className="small muted">{g.unit}</span>
                </div>
              );
            })}
          </div>
          <p className="tiny muted">O resultado oficial é publicado pela NP após o fechamento do mês.</p>
        </Card>
      )}

      <Card title="Resultado publicado" labelledBy="res-pip">
        {pip?.result ? <p><b>{pip.result}</b>{pip.recoveryMonth ? <span className="muted"> · recuperação de {monthLabel(pip.recoveryMonth)}</span> : null}</p>
          : <p className="muted small">{inRecovery ? 'O resultado será publicado após o fechamento do mês de recuperação.' : 'Nenhum resultado de recuperação publicado.'}</p>}
      </Card>

      <Notice>Estar em recuperação não tira você do sorteio por si só: a participação segue o cálculo oficial da planilha. Confira em Sorteios.</Notice>
    </div>
  );
}
