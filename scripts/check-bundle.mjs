/**
 * Verifica se o bundle público (dist/) contém segredos ou dados reais.
 * Uso: node scripts/check-bundle.mjs dist [--allow-demo]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'dist';
const allowDemo = process.argv.includes('--allow-demo');
const files = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    statSync(p).isDirectory() ? walk(p) : /\.(js|css|html|json|webmanifest|map|txt)$/.test(f) && files.push(p);
  }
})(dir);

const rules = [
  [/sb_secret_[A-Za-z0-9_-]{8,}/, 'chave secreta do Supabase'],
  [/"role"\s*:\s*"service_role"/, 'JWT service_role'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'chave privada'],
  [/"private_key(_id)?"\s*:/, 'credencial de conta de serviço Google'],
  [/iam\.gserviceaccount\.com/, 'e-mail de conta de serviço Google'],
  [/SUPABASE_SECRET_KEY|GOOGLE_SERVICE_ACCOUNT_JSON/, 'nome de variável secreta'],
  [/(?<![\d.])\d{15,20}(?![\d.])/, 'número longo (possível ID de TikTok)'],
  [/docs\.google\.com\/spreadsheets/, 'link de planilha'],
];
if (!allowDemo) rules.push([/demo_00\d\d/, 'dados de demonstração em build de produção']);
for (const name of ['HALL_SPREADSHEET_ID', 'PORTAL_AUX_SPREADSHEET_ID', 'SUPABASE_SECRET_KEY']) {
  const v = process.env[name];
  if (v && v.length > 8) rules.push([new RegExp(v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `valor de ${name}`]);
}

// números longos legítimos em bibliotecas (constantes matemáticas etc.)
const ALLOWED_LONG = new Set(['9007199254740991', '9007199254740992', '18446744073709551615', '4294967295']);
let problems = 0;
for (const f of files) {
  const text = readFileSync(f, 'utf8');
  for (const [re, label] of rules) {
    const g = new RegExp(re.source, 'g');
    for (const m of text.matchAll(g)) {
      if (label.startsWith('número longo') && (ALLOWED_LONG.has(m[0]) || /^0+$/.test(m[0]) || /^1(0)+$/.test(m[0]))) continue;
      problems++;
      console.error(`✗ ${f}: ${label} → "${m[0].slice(0, 12)}…"`);
      break;
    }
  }
}
if (problems) {
  console.error(`\n${problems} problema(s) no bundle público. Publicação bloqueada.`);
  process.exit(1);
}
console.log(`✓ Bundle público verificado (${files.length} arquivos): sem segredos nem dados reais.`);
