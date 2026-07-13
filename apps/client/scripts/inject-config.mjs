import { readFileSync, writeFileSync } from 'node:fs';

const [indexPath, apiUrl, wsUrl, solanaRpc] = process.argv.slice(2);
if (!indexPath || !apiUrl) {
  console.error('Usage: inject-config.mjs <index.html> <apiUrl> [wsUrl] [solanaRpc]');
  process.exit(1);
}

const ws = wsUrl || apiUrl;
const solana = solanaRpc || 'https://api.mainnet-beta.solana.com';
const payload = JSON.stringify({ apiUrl, wsUrl: ws, solanaRpc: solana });
const tag = `<script>window.__BULLRACE_CONFIG__=${payload}</script>`;

let html = readFileSync(indexPath, 'utf8');
html = html.replace(/<script>window\.__BULLRACE_CONFIG__=.*?<\/script>/, '');
html = html.replace('</head>', `${tag}</head>`);
writeFileSync(indexPath, html);
