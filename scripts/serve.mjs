import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, root } from './build.mjs';

const port = Number(process.env.PORT || 4175);
const config = JSON.parse(await fs.readFile(path.join(root, 'site.config.json'), 'utf8'));
const base = (process.env.BASE_PATH ?? config.basePath).replace(/\/$/, '');
try {
  const response = await fetch(`http://127.0.0.1:${port}/__podcast_preview`, { signal:AbortSignal.timeout(800) });
  if (response.ok && (await response.json()).root === root) { console.log(`Existing preview: http://127.0.0.1:${port}${base}/`); process.exit(0); }
} catch {}
if (!process.argv.includes('--no-build')) await build();
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.ico':'image/x-icon' };
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__podcast_preview') { response.writeHead(200, {'Content-Type':'application/json'}); response.end(JSON.stringify({ root, pid:process.pid })); return; }
    if (pathname === '/' && base) { response.writeHead(302, { Location:base + '/' }); response.end(); return; }
    if (base && pathname !== base && !pathname.startsWith(base + '/')) { response.writeHead(404); response.end('Not found'); return; }
    const relative = pathname.slice(base.length).replace(/^\//, '');
    let target = path.resolve(root, 'dist', relative || 'index.html');
    if (!target.startsWith(path.join(root, 'dist') + path.sep) && target !== path.join(root, 'dist')) throw new Error('Invalid path');
    let stat = await fs.stat(target);
    if (stat.isDirectory()) {
      if (!pathname.endsWith('/')) { response.writeHead(301, { Location:pathname + '/' }); response.end(); return; }
      target = path.join(target, 'index.html');
    }
    response.writeHead(200, { 'Content-Type':mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    response.end(await fs.readFile(target));
  } catch { response.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }); response.end(await fs.readFile(path.join(root, 'dist/404.html')).catch(() => 'Not found')); }
});
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}${base}/ (PID ${process.pid})`));
let building = false, pending = false, signature = '';
async function sourceSignature() {
  const files = ['site.config.json','sources/youtube/catalog.json'];
  for (const folder of ['notes','site']) for (const name of await fs.readdir(path.join(root, folder))) files.push(`${folder}/${name}`);
  return (await Promise.all(files.map(async name => { const stat = await fs.stat(path.join(root, name)).catch(() => null); return `${name}:${stat?.mtimeMs}`; }))).join('|');
}
signature = await sourceSignature();
const timer = setInterval(async () => {
  const next = await sourceSignature();
  if (next === signature) return;
  signature = next;
  if (building) { pending = true; return; }
  building = true;
  try { do { pending = false; await build(); } while(pending); } catch(error) { console.error('Build failed:', error.message); }
  finally { building = false; }
}, 2000);
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close(); });
