/**
 * Sincronizador Hall da Fama NP — Google Sheets (somente leitura) → Supabase.
 *
 *   npm run sync                      # produção (variáveis de ambiente / GitHub Secrets)
 *   npm run sync:dry                  # lê a planilha e valida, sem gravar
 *   npm run sync -- --fixture         # usa a planilha fictícia local (sem credenciais)
 *
 * Logs contêm apenas contagens e referências de células — nunca IDs, nomes, contatos ou valores.
 */
import { buildSnapshot } from './build';
import { sampleWorkbooks } from './fixtures/sample-workbook';
import { readWorkbooks } from './sheets-client';
import { activeHash, beginRun, finishRun, recordIssues, serviceClient, writeSnapshot } from './writer';

const args = new Set(process.argv.slice(2));
const dry = args.has('--dry-run');
const useFixture = args.has('--fixture');
const trigger = process.env.SYNC_TRIGGER || (process.env.GITHUB_EVENT_NAME ?? 'manual');

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Variável ${name} não configurada.`);
  return v;
}

async function main() {
  if (useFixture && !dry) throw new Error('A planilha fictícia exige --dry-run.');
  const { main: wb, aux } = useFixture
    ? sampleWorkbooks()
    : await readWorkbooks({
        credentialsJson: need('GOOGLE_SERVICE_ACCOUNT_JSON'),
        mainId: need('HALL_SPREADSHEET_ID'),
        auxId: process.env.PORTAL_AUX_SPREADSHEET_ID || undefined,
      });

  const result = buildSnapshot(wb, aux);
  const errors = result.issues.filter((i) => i.severity === 'error');
  const counts = Object.fromEntries(Object.entries(result.payload).map(([k, v]) => [k, Array.isArray(v) ? v.length : 1]));
  console.log('Contagens:', JSON.stringify(counts));
  console.log(`Validação: ${errors.length} erro(s), ${result.issues.length - errors.length} aviso(s).`);
  for (const i of result.issues.slice(0, 50)) console.log(`  [${i.severity}] ${i.sheet}${i.rowRef ? `!${i.rowRef}` : ''} ${i.code}`);

  if (dry) {
    console.log(errors.length ? 'Dry-run: a carga seria RECUSADA.' : 'Dry-run: a carga seria aceita.');
    process.exitCode = errors.length ? 1 : 0;
    return;
  }

  const db = serviceClient(need('SUPABASE_URL'), need('SUPABASE_SECRET_KEY'));
  const run = await beginRun(db, trigger);
  try {
    await recordIssues(db, run, result.issues);
    if (errors.length) {
      await finishRun(db, run, 'failed', `${errors.length} erro(s) de validação. Última versão válida mantida.`);
      console.error('Carga recusada por erros de validação. Última versão válida mantida.');
      process.exitCode = 1;
      return;
    }
    if ((await activeHash(db)) === result.hash) {
      await finishRun(db, run, 'unchanged', 'Sem alterações na planilha.');
      console.log('Sem alterações. Nada a ativar.');
      return;
    }
    await writeSnapshot(db, run, result.hash, result.payload, result.sources, `${result.issues.length} aviso(s).`);
    console.log('Nova versão ativada.');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishRun(db, run, 'failed', `Falha: ${msg}. Última versão válida mantida.`).catch(() => {});
    throw e;
  }
}

main().catch((e) => {
  console.error('Sincronização falhou:', e instanceof Error ? e.message : e);
  process.exit(1);
});
