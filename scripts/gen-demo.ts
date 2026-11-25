/**
 * Gera os dados de DEMONSTRAÇÃO do frontend passando a planilha fictícia
 * pelo MESMO pipeline do sincronizador. Uso: npx tsx scripts/gen-demo.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSnapshot } from '../sync/build';
import { sampleWorkbooks } from '../sync/fixtures/sample-workbook';

export function demoSnapshot() {
  const { main, aux } = sampleWorkbooks();
  const r = buildSnapshot(main, aux);
  return {
    _aviso: 'DADOS FICTÍCIOS DE DEMONSTRAÇÃO — gerados por scripts/gen-demo.ts',
    synced_at: '2026-11-25T12:00:00.000Z',
    hash: r.hash,
    payload: r.payload,
    issues: r.issues,
  };
}

if (process.argv[1]?.endsWith('gen-demo.ts')) {
  const out = join(process.cwd(), 'src/data/demo/snapshot.json');
  writeFileSync(out, JSON.stringify(demoSnapshot(), null, 1) + '\n');
  console.log('Gerado', out);
}
