import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase, SupabaseData, supabaseConfigured } from '../data/supabase';
import type { PortalData } from '../data/types';
import { safeStorage } from './storage';

export type DataMode = 'demo' | 'supabase';
export const DATA_MODE: DataMode = import.meta.env.VITE_DATA_MODE === 'demo' ? 'demo' : 'supabase';
/** Carregado só no modo demonstração: em produção os dados fictícios nem entram no bundle. */
export const loadDemo: () => Promise<typeof import('../data/demo')> =
  import.meta.env.VITE_DATA_MODE === 'demo' ? () => import('../data/demo') : () => Promise.reject(new Error('Modo demonstração desativado.'));

interface AuthState {
  mode: DataMode;
  ready: boolean;
  signedIn: boolean;
  email: string | null;
  data: PortalData | null;
  configError: string | null;
  /** Supabase: envia o código de 6 dígitos por e-mail. */
  requestCode(email: string): Promise<void>;
  /** Supabase: confirma o código recebido. */
  verifyCode(email: string, code: string): Promise<void>;
  /** Demonstração: entra como uma conta fictícia. */
  enterDemo(creatorId: string): void;
  signOut(): Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const DEMO_KEY = 'np-demo-account';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [demoId, setDemoId] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    if (DATA_MODE === 'demo') {
      const id = safeStorage.get(DEMO_KEY);
      setDemoId(id);
      setSignedIn(!!id);
      setReady(true);
      return;
    }
    if (!supabaseConfigured()) {
      setConfigError('O portal ainda não foi configurado. Avise a equipe da Agência NP.');
      setReady(true);
      return;
    }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setEmail(data.session?.user.email ?? null);
      setReady(true);
      // Remove ?code= da URL após o retorno do link mágico (PKCE), mantendo a rota em hash.
      if (window.location.search.includes('code=')) {
        window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      }
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session);
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const requestCode = useCallback(async (addr: string) => {
    const { error } = await getSupabase().auth.signInWithOtp({
      email: addr.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const verifyCode = useCallback(async (addr: string, code: string) => {
    const { error } = await getSupabase().auth.verifyOtp({ email: addr.trim().toLowerCase(), token: code.trim(), type: 'email' });
    if (error) throw new Error(friendlyAuthError(error.message));
  }, []);

  const enterDemo = useCallback((id: string) => {
    safeStorage.set(DEMO_KEY, id);
    setDemoId(id);
    setSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    if (DATA_MODE === 'demo') {
      safeStorage.remove(DEMO_KEY);
      setDemoId(null);
      setSignedIn(false);
      return;
    }
    await getSupabase().auth.signOut();
  }, []);

  const [data, setData] = useState<PortalData | null>(null);
  useEffect(() => {
    if (!signedIn) { setData(null); return; }
    if (import.meta.env.VITE_DATA_MODE === 'demo') {
      let alive = true;
      loadDemo().then((m) => alive && setData(new m.DemoData(demoId ?? m.DEMO_DEFAULT)));
      return () => { alive = false; };
    }
    setData(new SupabaseData());
  }, [signedIn, demoId]);

  const value: AuthState = { mode: DATA_MODE, ready, signedIn, email, data, configError, requestCode, verifyCode, enterDemo, signOut };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}

function friendlyAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('signups not allowed') || m.includes('user not found')) return 'Este e-mail não tem convite ativo. Fale com a equipe da NP.';
  if (m.includes('expired') || m.includes('invalid')) return 'Código inválido ou expirado. Peça um novo código.';
  if (m.includes('rate') || m.includes('seconds')) return 'Aguarde alguns segundos antes de pedir outro código.';
  return 'Não foi possível entrar agora. Tente novamente.';
}
