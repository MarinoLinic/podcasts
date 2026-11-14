import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, root } from './build.mjs';

const port = Number(process.env.PORT || 4175);
const config = JSON.parse(await fs.readFile(path.join(root, 'site.config.json'), 'utf8'));
const base = (process.env.BASE_PATH ?? config.basePath).replace(/\/$/, '');
const idleMinutes = Number(process.env.PREVIEW_IDLE_MINUTES || 120);
if (!Number.isFinite(idleMinutes) || idleMinutes <= 0 || idleMinutes > 1440) throw new Error('PREVIEW_IDLE_MINUTES must be between 0 and 1440.');
let lastActivity = Date.now();
const touch = () => { lastActivity = Date.now(); };
try {
  const response = await fetch(`http://127.0.0.1:${port}/__podcast_preview`, { signal:AbortSignal.timeout(800) });
  if (response.ok) {
    const existing = await response.json();
    if (existing.root === root) {
      if (process.argv.includes('--stop')) { process.kill(existing.pid); console.log(`Stopped owned preview PID ${existing.pid}.`); }
      else console.log(`Existing preview: http://127.0.0.1:${port}${base}/ (PID ${existing.pid})`);
      process.exit(0);
    }
  }
} catch {}
if (process.argv.includes('--stop')) { console.log('No matching preview is running.'); process.exit(0); }
if (!process.argv.includes('--no-build')) await build();
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2' };
const activityScript = `<script>(()=>{let sent=0;for(const type of ['pointerdown','keydown','input','scroll'])addEventListener(type,event=>{if(event.isTrusted&&Date.now()-sent>60000){sent=Date.now();navigator.sendBeacon('/__podcast_activity','activity')}},{passive:true})})()</script>`;
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/__podcast_preview') { response.writeHead(200, {'Content-Type':'application/json'}); response.end(JSON.stringify({ root, pid:process.pid, idleMinutes, lastActivity:new Date(lastActivity).toISOString(), expiresAt:new Date(lastActivity + idleMinutes*60000).toISOString() })); return; }
    if (pathname === '/__podcast_activity') {
      if (request.method !== 'POST' || request.headers.origin !== `http://127.0.0.1:${port}`) { response.writeHead(403); response.end(); return; }
      request.resume(); touch(); response.writeHead(204); response.end(); return;
    }
    if (pathname === '/' && base) { touch(); response.writeHead(302, { Location:base + '/' }); response.end(); return; }
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
    touch();
    const data = await fs.readFile(target);
    response.end(path.extname(target) === '.html' ? data.toString('utf8').replace('</body>', activityScript + '</body>') : data);
  } catch { response.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }); response.end(await fs.readFile(path.join(root, 'dist/404.html')).catch(() => 'Not found')); }
});
server.listen(port, '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${port}${base}/ (PID ${process.pid}; ${idleMinutes}-minute idle timeout)`));
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
  touch();
  if (building) { pending = true; return; }
  building = true;
  try { do { pending = false; await build(); } while(pending); } catch(error) { console.error('Build failed:', error.message); }
  finally { building = false; }
}, 2000);
function stop() { clearInterval(timer); clearInterval(idleTimer); server.close(); server.closeAllConnections(); }
const idleTimer = setInterval(() => { if (Date.now()-lastActivity >= idleMinutes*60000) { console.log('Preview stopped after inactivity.'); stop(); } }, Math.min(30000,idleMinutes*60000/4));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, stop);
