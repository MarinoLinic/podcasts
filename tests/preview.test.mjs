import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('preview reuses its owner, ignores health polling, and expires after real inactivity', {timeout:15000}, async () => {
  const reservation = net.createServer();
  reservation.listen(0,'127.0.0.1'); await once(reservation,'listening');
  const port = reservation.address().port; await new Promise(resolve=>reservation.close(resolve));
  const env = {...process.env,PORT:String(port),PREVIEW_IDLE_MINUTES:'0.08'};
  const child = spawn(process.execPath,['scripts/serve.mjs','--no-build'],{env,stdio:['ignore','pipe','pipe']});
  const health = `http://127.0.0.1:${port}/__podcast_preview`;
  try {
    let first;
    for(let i=0;i<70&&!first;i++) { try { first=await (await fetch(health)).json(); } catch {await delay(40);} }
    assert.ok(first); assert.equal(first.pid,child.pid);
    const reuse = spawn(process.execPath,['scripts/serve.mjs','--no-build'],{env,stdio:'ignore'});
    const [reuseCode] = await once(reuse,'exit'); assert.equal(reuseCode,0);
    assert.equal((await (await fetch(health)).json()).lastActivity,first.lastActivity,'Health/reuse is not activity');
    await delay(100);
    const active = await fetch(`http://127.0.0.1:${port}/__podcast_activity`,{method:'POST',headers:{Origin:`http://127.0.0.1:${port}`},body:'activity'});
    assert.equal(active.status,204);
    const after = await (await fetch(health)).json(); assert.ok(after.lastActivity>first.lastActivity);
    const exit = once(child,'exit');
    const polling = setInterval(()=>fetch(health).catch(()=>{}),100);
    try { const [code] = await exit; assert.equal(code,0); } finally { clearInterval(polling); }
  } finally { if(child.exitCode===null) child.kill(); }
});
