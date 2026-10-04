// Test-only local server: built static assets and the real contact handler.
// No mock credentials or sender can be enabled in the production route.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { handleContact } from '../../src/server/contact.ts';
const root = resolve(process.env.STATIC_ROOT || '.vercel/output/static');
createServer(async (req, res) => {
  try {
    if (req.url === '/api/contact' && req.method === 'POST') {
      const request = new Request('http://127.0.0.1:4321/api/contact', { method: 'POST', headers: req.headers, body: req, duplex: 'half' });
      const response = await handleContact(request, null, '127.0.0.1');
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(await response.text()); return;
    }
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch { if (!res.headersSent) res.writeHead(404); res.end(); }
}).listen(4321, '127.0.0.1');
