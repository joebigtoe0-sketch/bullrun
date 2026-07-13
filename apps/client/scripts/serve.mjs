// Minimal zero-dependency static server for the built client.
// Serves apps/client/dist with SPA fallback, binds 0.0.0.0:$PORT.
// Replaces `vite preview` in production (no config loading, no host checks,
// no devDependencies needed at runtime — so it can't 502 on those).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = normalize(process.argv[2] || fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 4173;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

async function sendFile(res, file, code = 200) {
  const buf = await readFile(file);
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const cache = file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600';
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': cache });
  res.end(buf);
}

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let path = normalize(join(DIST, url));
    // block path traversal outside dist
    if (!path.startsWith(DIST)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    let info = await stat(path).catch(() => null);
    if (info && info.isDirectory()) {
      path = join(path, 'index.html');
      info = await stat(path).catch(() => null);
    }
    if (info && info.isFile()) {
      await sendFile(res, path);
      return;
    }
    // SPA fallback — any unknown route serves index.html
    await sendFile(res, join(DIST, 'index.html'));
  } catch {
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Bull Race client serving ${DIST} on 0.0.0.0:${PORT}`);
});
