import { readFileSync, writeFileSync } from 'node:fs';

const [indexPath, apiUrl, wsUrl] = process.argv.slice(2);
if (!indexPath || !apiUrl) {
  console.error('Usage: inject-config.mjs <index.html> <apiUrl> [wsUrl]');
  process.exit(1);
}

const ws = wsUrl || apiUrl;
const payload = JSON.stringify({ apiUrl, wsUrl: ws });
const tag = `<script>window.__BULLRUN_CONFIG__=${payload}</script>`;

let html = readFileSync(indexPath, 'utf8');
html = html.replace(/<script>window\.__BULLRUN_CONFIG__=.*?<\/script>/, '');
html = html.replace('</head>', `${tag}</head>`);
writeFileSync(indexPath, html);
