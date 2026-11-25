import { ArrowRight, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { loadDemo, useAuth } from '../app/auth';
import logo from '../assets/logo-np.png';
import { Notice } from '../ui/components';

export function LoginPage() {
  const { mode, configError } = useAuth();
  return (
    <div className="login-wrap">
      <main className="login-card fade-in" id="conteudo">
        <div className="login-logo">
          <img src={logo} alt="Agência NP" width={110} height={64} />
          <span className="eyebrow">Agência NP</span>
          <h1>Hall da Fama</h1>
          <p className="muted">Seus cupons, sorteios, viagens e presentes num só lugar.</p>
        </div>
        {configError ? <Notice tone="warn">{configError}</Notice> : mode === 'demo' ? <DemoLogin /> : <EmailLogin />}
        <p className="tiny muted" style={{ textAlign: 'center' }}>
          Acesso exclusivo para criadores convidados pela Agência NP.
        </p>
      </main>
    </div>
  );
}

function EmailLogin() {
  const { requestCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await requestCode(email); setStep('code'); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function submitCode(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { await verifyCode(email, code); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <section className="card" aria-labelledby="login-title">
      <h2 id="login-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><ShieldCheck size={20} color="var(--np-pink)" aria-hidden /> Entrar</h2>
      {step === 'email' ? (
        <form onSubmit={submitEmail} className="page" style={{ gap: 12 }}>
          <div className="field">
            <label htmlFor="email">E-mail cadastrado na NP</label>
            <input id="email" className="input" type="email" inputMode="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
          </div>
          <button className="btn block" disabled={busy || !email}>{busy ? 'Enviando…' : <>Receber código <Mail size={18} aria-hidden /></>}</button>
          <p className="tiny muted">Você vai receber um código de 6 dígitos. Funciona em qualquer navegador, inclusive dentro do WhatsApp.</p>
        </form>
      ) : (
        <form onSubmit={submitCode} className="page" style={{ gap: 12 }}>
          <p className="small muted">Enviamos um código para <b style={{ color: '#fff' }}>{email}</b>. Ele vale por 15 minutos.</p>
          <div className="field">
            <label htmlFor="code">Código de 6 dígitos</label>
            <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
              style={{ letterSpacing: '0.4em', fontSize: 22, textAlign: 'center' }} />
          </div>
          <button className="btn block" disabled={busy || code.length !== 6}>{busy ? 'Entrando…' : <>Entrar <ArrowRight size={18} aria-hidden /></>}</button>
          <button type="button" className="btn secondary block" onClick={() => { setStep('email'); setCode(''); }}>Usar outro e-mail</button>
        </form>
      )}
      {error && <div role="alert"><Notice tone="warn">{error}</Notice></div>}
    </section>
  );
}

function DemoLogin() {
  const { enterDemo } = useAuth();
  const [accounts, setAccounts] = useState<{ creatorId: string; handle: string }[]>([]);
  const [id, setId] = useState('');
  useEffect(() => {
    loadDemo().then((m) => { setAccounts(m.DEMO_ACCOUNTS); setId(m.DEMO_DEFAULT); });
  }, []);
  return (
    <section className="card" aria-labelledby="demo-title">
      <h2 id="demo-title">Entrar na demonstração</h2>
      <Notice tone="warn">Modo demonstração com dados fictícios. Nenhuma informação real é exibida.</Notice>
      <div className="field">
        <label htmlFor="demo-account">Ver o portal como</label>
        <select id="demo-account" className="select" value={id} onChange={(e) => setId(e.target.value)}>
          {accounts.map((a) => <option key={a.creatorId} value={a.creatorId}>{a.handle}</option>)}
        </select>
      </div>
      <button className="btn block" disabled={!id} onClick={() => enterDemo(id)}>Entrar <ArrowRight size={18} aria-hidden /></button>
    </section>
  );
}
