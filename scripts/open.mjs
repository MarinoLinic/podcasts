import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await fs.readFile(path.join(root,'site.config.json'),'utf8'));
const port = Number(process.env.PORT || 4175), url = `http://127.0.0.1:${port}${config.basePath}/`;
async function healthy() {
  try { const result = await fetch(`http://127.0.0.1:${port}/__podcast_preview`, {signal:AbortSignal.timeout(1000)}); if(result.ok) return (await result.json()).root === root; } catch {}
  return false;
}
if (!await healthy()) {
  const child = spawn(process.execPath,[path.join(root,'scripts/serve.mjs')], {cwd:root,detached:true,stdio:'ignore',windowsHide:true,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=192'}});
  child.unref();
  for(let i=0;i<80 && !await healthy();i++) await setTimeout(500);
}
if (!await healthy()) throw new Error(`Preview could not start on port ${port}. Run npm ci, then npm run dev to inspect the error.`);
console.log(url);
spawn('cmd.exe',['/d','/c','start','',url],{windowsHide:true,stdio:'ignore'}).unref();
