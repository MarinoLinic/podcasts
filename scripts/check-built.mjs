import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { parseNote } from './content.mjs';

const config = JSON.parse(await fs.readFile('site.config.json','utf8'));
const base = (process.env.BASE_PATH ?? config.basePath).replace(/\/$/, '');
const build = JSON.parse(await fs.readFile('dist/build.json','utf8'));
const files = [];
async function walk(folder) { for (const item of await fs.readdir(folder,{withFileTypes:true})) if (item.isDirectory()) await walk(path.join(folder,item.name)); else files.push(path.join(folder,item.name)); }
await walk('dist');
let links = 0, pages = 0;
for (const file of files.filter(f => f.endsWith('.html') && !['baby-essentials.html','intelligence.html'].includes(path.basename(f)))) {
  const html = await fs.readFile(file,'utf8'); pages++;
  assert.ok(!html.includes('{{') && !html.includes('{%'), `Unbuilt template in ${file}`);
  assert.match(html, /<h1[ >]/, file);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const value = match[1];
    if (!value.startsWith(base + '/')) continue;
    const relative = decodeURIComponent(value.slice(base.length + 1).split(/[?#]/)[0]);
    let target = path.join('dist',relative);
    if (!path.extname(target)) target = path.join(target,'index.html');
    assert.ok((await fs.stat(target).catch(() => null))?.isFile(), `${file}: missing ${value}`); links++;
  }
}
for (const file of (await fs.readdir('notes')).filter(f => f.endsWith('.md'))) {
  const raw = await fs.readFile(path.join('notes',file));
  const note = parseNote(file,raw.toString('utf8'));
  assert.ok(raw.equals(await fs.readFile(path.join('dist/markdown',file))), `Original Markdown changed: ${file}`);
  assert.ok((await fs.readFile(`dist/text/${note.slug}.txt`,'utf8')).startsWith(`${note.author} on ${note.title}`));
}
assert.ok(build.notes > 0); assert.equal(build.basePath,base);
console.log(`Verified ${pages} generated HTML pages, ${links} local links/assets, exact Markdown copies, and copy-text files. ${build.notes} notes / ${build.transcripts} captions.`);
