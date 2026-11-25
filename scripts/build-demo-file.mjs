/**
 * Gera UM arquivo HTML autocontido com a demonstração (dados fictícios),
 * que abre com dois cliques, sem servidor: demo-hall-da-fama.html
 * Uso: npm run build:demo-file
 */
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const out = join(process.cwd(), '.demo-file-build');
process.env.VITE_DATA_MODE = 'demo';
await build({
  logLevel: 'warn',
  base: './',
  build: {
    outDir: out,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    modulePreload: false,
    rolldownOptions: { output: { codeSplitting: false } },
  },
});

let html = readFileSync(join(out, 'index.html'), 'utf8');
const assets = join(out, 'assets');
for (const f of readdirSync(assets)) {
  const content = readFileSync(join(assets, f), 'utf8');
  if (f.endsWith('.js')) {
    html = html.replace(new RegExp(`<script[^>]*src="\\./assets/${f}"[^>]*></script>`), () => '');
    // script no fim do body (o DOM já existe quando roda)
    html = html.replace('</body>', () => `<script type="module">${content.replace(/<\/script/g, '<\\/script')}</script>\n</body>`);
  } else if (f.endsWith('.css')) {
    html = html.replace(new RegExp(`<link[^>]*href="\\./assets/${f}"[^>]*>`), () => `<style>${content}</style>`);
  }
}
// ícones/manifesto externos não existem fora do servidor
html = html.replace(/<link rel="(manifest|apple-touch-icon|icon)"[^>]*>\n?/g, '');
const target = join(process.cwd(), 'demo-hall-da-fama.html');
writeFileSync(target, html);
rmSync(out, { recursive: true, force: true });
console.log('Gerado', target, `(${Math.round(html.length / 1024)} KB)`);
