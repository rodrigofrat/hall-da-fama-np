/**
 * Gestão de acesso (executar localmente pela equipe, com a chave secreta — NUNCA no navegador).
 *
 *   npm run admin:link -- convidar  email@x.com 7234567890123456789
 *   npm run admin:link -- corrigir  email@x.com 7234567890123456789   # troca o ID vinculado
 *   npm run admin:link -- historico email@x.com                         # conta antiga: só o próprio histórico, sem ranking
 *   npm run admin:link -- revogar   email@x.com                         # remove todo acesso
 *   npm run admin:link -- equipe    email@x.com                         # acesso à página de administração
 *   npm run admin:link -- listar
 *
 * Requer SUPABASE_URL e SUPABASE_SECRET_KEY no ambiente.
 */
import { createClient } from '@supabase/supabase-js';
import { parseCreatorId } from '../../src/domain/numbers';

const [cmd, email, rawId] = process.argv.slice(2);
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_SECRET_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function findUser(addr: string) {
  const target = addr.trim().toLowerCase();
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(addr: string) {
  const existing = await findUser(addr);
  if (existing) return existing;
  const { data, error } = await db.auth.admin.createUser({ email: addr.trim().toLowerCase(), email_confirm: true });
  if (error) throw error;
  return data.user;
}

function id(): string {
  const r = parseCreatorId(rawId);
  if (!r.id) throw new Error(r.error ?? 'Informe o ID do criador (texto).');
  return r.id;
}

async function main() {
  switch (cmd) {
    case 'convidar':
    case 'corrigir': {
      const u = await ensureUser(email);
      const creator = id();
      // desativa outra conta ativa vinculada ao mesmo criador
      await db.from('account_links').update({ active: false, ranking_authorized: false }).eq('creator_id', creator).neq('user_id', u.id);
      const { error } = await db.from('account_links').upsert({
        user_id: u.id, creator_id: creator, active: true, ranking_authorized: true, history_authorized: true, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      console.log(`✓ ${email} vinculado. Peça para entrar no portal com este e-mail (código de 6 dígitos).`);
      break;
    }
    case 'historico': {
      const u = await findUser(email);
      if (!u) throw new Error('Conta não encontrada.');
      const { error } = await db.from('account_links').update({ active: false, ranking_authorized: false, history_authorized: true, updated_at: new Date().toISOString() }).eq('user_id', u.id);
      if (error) throw error;
      console.log('✓ Conta mantida só com acesso ao próprio histórico.');
      break;
    }
    case 'revogar': {
      const u = await findUser(email);
      if (!u) throw new Error('Conta não encontrada.');
      await db.from('account_links').delete().eq('user_id', u.id);
      await db.from('staff').delete().eq('user_id', u.id);
      await db.auth.admin.signOut(u.id).catch(() => {});
      console.log('✓ Acesso revogado. Sessões existentes expiram em até 1 hora (ou apague o usuário no painel para efeito imediato).');
      break;
    }
    case 'equipe': {
      const u = await ensureUser(email);
      const { error } = await db.from('staff').upsert({ user_id: u.id });
      if (error) throw error;
      console.log('✓ Acesso de equipe concedido (somente página de administração).');
      break;
    }
    case 'listar': {
      const { data, error } = await db.from('account_links').select('user_id, active, ranking_authorized, history_authorized, updated_at');
      if (error) throw error;
      console.table(data);
      break;
    }
    default:
      console.log('Comandos: convidar | corrigir | historico | revogar | equipe | listar');
  }
}

main().catch((e) => {
  console.error('Erro:', e.message ?? e);
  process.exit(1);
});
