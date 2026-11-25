import { AlertTriangle, Database, RefreshCw } from 'lucide-react';
import { useAdmin, useMe } from '../app/data';
import { dateTimeSP } from '../domain/dates';
import { Card, ErrorState, Freshness, Loading, Notice, PageHead, Pill, type Tone } from '../ui/components';

const RUN: Record<string, { label: string; tone: Tone }> = {
  success: { label: 'Atualizado', tone: 'ok' },
  unchanged: { label: 'Sem alterações', tone: 'dim' },
  failed: { label: 'Falhou', tone: 'warn' },
  running: { label: 'Em andamento', tone: 'neutral' },
};

export function AdminPage() {
  const { me } = useMe();
  const admin = useAdmin();
  if (me.loading && !me.data) return <Loading />;
  if (!me.data?.profile.isStaff) return <ErrorState message="Esta área é exclusiva da equipe da Agência NP." />;
  if (admin.loading && !admin.data) return <Loading />;
  if (!admin.data) return <ErrorState message={admin.error ?? 'Erro ao carregar.'} />;
  const { activeSnapshot, runs, issues } = admin.data;
  const errors = issues.filter((i) => i.severity === 'error');
  const lastFailed = runs[0]?.status === 'failed';

  return (
    <div className="page">
      <PageHead eyebrow="Equipe NP" title="Administração">Estado da sincronização com a planilha. As operações do Hall continuam na planilha.</PageHead>
      {lastFailed && <Notice tone="warn">A última sincronização falhou. O portal segue exibindo a última versão válida.</Notice>}
      <div className="grid-2">
        <Card title="Versão publicada" icon={Database} labelledBy="snap-title">
          {activeSnapshot ? (
            <div className="stat-row">
              <div className="stat"><span className="label">Ativada em</span><span className="value">{activeSnapshot.activatedAt ? dateTimeSP(activeSnapshot.activatedAt) : '—'}</span></div>
              <div className="stat"><span className="label">Assinatura</span><span className="value small">{activeSnapshot.sourceHash ?? '—'}</span></div>
            </div>
          ) : <p className="muted">Nenhuma versão ativa. Rode a sincronização.</p>}
          <Freshness program={me.data.program} />
        </Card>
        <Card title="Validação da última execução" icon={AlertTriangle} labelledBy="val-title">
          <div className="stat-row">
            <div className="stat"><span className="label">Erros</span><span className="mid-number">{errors.length}</span></div>
            <div className="stat"><span className="label">Avisos</span><span className="mid-number">{issues.length - errors.length}</span></div>
          </div>
          <p className="tiny muted">Erros bloqueiam a publicação; avisos não. Corrija na planilha e rode de novo.</p>
        </Card>
      </div>

      <Card title="Execuções recentes" icon={RefreshCw} labelledBy="runs-title">
        <div className="scroll-x">
          <table className="admin">
            <thead><tr><th scope="col">Início</th><th scope="col">Situação</th><th scope="col">Origem</th><th scope="col">Mensagem</th></tr></thead>
            <tbody>{runs.map((r) => (
              <tr key={r.id}><td>{dateTimeSP(r.startedAt)}</td><td><Pill tone={RUN[r.status]?.tone}>{RUN[r.status]?.label ?? r.status}</Pill></td><td>{r.trigger === 'schedule' ? 'Agendada' : 'Manual'}</td><td className="muted">{r.message ?? ''}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </Card>

      {issues.length > 0 && (
        <Card title="Itens para revisar" labelledBy="issues-title">
          <div className="scroll-x">
            <table className="admin">
              <thead><tr><th scope="col">Tipo</th><th scope="col">Aba / célula</th><th scope="col">Descrição</th></tr></thead>
              <tbody>{issues.map((i, k) => (
                <tr key={k}><td><Pill tone={i.severity === 'error' ? 'warn' : 'dim'}>{i.severity === 'error' ? 'Erro' : 'Aviso'}</Pill></td><td>{i.sheet}{i.rowRef ? `!${i.rowRef}` : ''}</td><td className="muted">{i.message}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
