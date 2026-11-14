import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseNote, readableText, renderMarkdown, videoIds, captionParagraphs, navigationOrder } from '../scripts/content.mjs';

test('original metadata, Unicode titles, source IDs, and historical slugs remain separate from the rendered body', () => {
  const raw = 'Summary:\nA short summary.\n\nRating: 4\nType: video\nTags: history, politics\nDate: 2 February 2025\nSource: https://youtu.be/abcdefghijk\n\n## Topic\nA **claim**.';
  const note = parseNote('A Person - Europe’s Future.md', raw);
  assert.equal(note.slug, 'a-person-europe-s-future');
  assert.equal(note.date, '2025-02-02'); assert.equal(note.rating, 4);
  assert.deepEqual(note.videos, ['abcdefghijk']); assert.deepEqual(note.tags, ['history','politics']);
  assert.equal(note.raw, raw); assert.ok(note.body.includes('A **claim**.')); assert.ok(!note.body.includes('Rating:'));
  assert.match(readableText(note), /^A Person on Europe’s Future\n/);
  assert.match(readableText(note), /A claim\./); assert.match(readableText(note), /Source: https:\/\/youtu.be\/abcdefghijk/);
});

test('unknown dates and ratings stay unknown; multi-part videos remain distinct', () => {
  const note = parseNote('Unattributed.md', 'Type: article\nDate: unknown\nRating: 8\n\nText.');
  assert.equal(note.date, null); assert.equal(note.rating, null);
  assert.deepEqual(videoIds('https://youtube.com/watch?v=abcdefghijk&x=1 https://youtu.be/123456789_0 https://youtu.be/abcdefghijk'), ['abcdefghijk','123456789_0']);
});

test('body fields do not replace leading note metadata or disappear from the rendered note', () => {
  const raw = 'Summary:\nA summary.\n\nRating: 3\nType: video\nDate: 21 Aug 2024\n\n---\n\n## Discussion\nRating: 5\nSource: a cited passage';
  const note = parseNote('Author - Title.md',raw);
  assert.equal(note.rating,3);
  assert.ok(note.body.includes('Rating: 5'));
  assert.ok(note.body.includes('Source: a cited passage'));
  assert.equal(note.raw,raw);
});

test('duplicate leading header keys use the first value, matching the old processor', () => {
  const note=parseNote('Author - Title.md','Summary:\nA summary.\n\nRating: 3\nRating: 5\nType: book\nDate: 21 Aug 2024\n\n---\n\nContent.');
  assert.equal(note.rating,3); assert.equal(note.type,'book');
});

test('rendered imported Markdown cannot execute scripts or unsafe URLs; heading IDs are unique', () => {
  const { html, toc } = renderMarkdown('## Same\n\n<script>alert(1)</script>\n\n<a href="javascript:alert(1)" onclick="bad()">unsafe</a>\n\n## Same\n\n[Safe](https://example.com)');
  assert.ok(!html.includes('<script')); assert.ok(!html.includes('javascript:')); assert.ok(!html.includes('onclick'));
  assert.deepEqual(toc.map(h => h.id), ['same','same-2']); assert.ok(html.includes('https://example.com'));
});

test('copy text preserves nested lists, links, tables and quoted meaning without Markdown decorations', () => {
  const note = parseNote('Writer - Title.md', '## Heading\n\n- **First**\n  - Child\n\n[Reference](https://example.com)\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> A quotation.');
  const text = readableText(note);
  for (const value of ['Heading','First','Child','Reference (https://example.com)','A | B','1 | 2','A quotation.']) assert.ok(text.includes(value), value);
  assert.ok(!text.includes('**')); assert.ok(!text.includes('## Heading'));
});

test('immutable legacy material stays byte-identical while the original notes remain editable', async () => {
  const manifest = JSON.parse(await fs.readFile('docs/preservation-manifest.json','utf8'));
  for (const file of manifest.files) {
    if (!file.preserved_path.startsWith('legacy/') || !file.git_tracked_before) continue;
    const data = await fs.readFile(file.preserved_path);
    assert.equal(data.length, file.bytes, file.preserved_path);
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256, file.preserved_path);
  }
  assert.equal(manifest.files.filter(f => f.preserved_path.startsWith('notes/')).length, 113);
});

test('retained captions match exact video identities and original-byte hashes', async () => {
  const catalog = JSON.parse(await fs.readFile('sources/youtube/catalog.json','utf8'));
  assert.equal(new Set(catalog.videos.map(v => v.video_id)).size,catalog.videos.length);
  for (const video of catalog.videos) assert.match(video.video_id,/^[a-zA-Z0-9_-]{11}$/);
  for (const video of catalog.videos.filter(v => v.status === 'available')) {
    const segments = JSON.parse(await fs.readFile(`sources/youtube/${video.video_id}/segments.json`,'utf8'));
    assert.equal(segments.video_id, video.video_id); assert.ok(segments.segments.length > 0);
    for (const file of video.files) assert.equal(createHash('sha256').update(await fs.readFile(`sources/youtube/${file.path}`)).digest('hex'), file.sha256);
  }
});

test('transcript paragraphs retain every cue in order and original starting times', () => {
  const cues = [{start:0,text:'First cue'},{start:15,text:'continues'},{start:25,text:'to a sentence.'},{start:30,text:'Next paragraph'},{start:76,text:'continues without punctuation'}];
  const paragraphs = captionParagraphs(cues);
  assert.deepEqual(paragraphs.map(p => p.start),[0,30]);
  assert.equal(paragraphs.map(p => p.text).join(' '),cues.map(c => c.text).join(' '));
});

test('homepage order exactly matches the preserved old Liquid author/sidebar ordering', async () => {
  const old = [];
  for (const filename of (await fs.readdir('legacy/2026-11-14/Notes')).filter(n=>n.endsWith('.md')).sort()) {
    const text = await fs.readFile(path.join('legacy/2026-11-14/Notes',filename),'utf8');
    const frontmatter = text.split('---')[1];
    const value = field => frontmatter.match(new RegExp(`^${field}:\\s*(.*)$`,'m'))?.[1].trim().replace(/^"|"$/g,'');
    old.push({filename,author:value('author'),date:value('date'),rating:Number(value('rating'))});
  }
  const expected = [...new Set(old.map(n=>n.author))].sort().flatMap(author => {
    const items = old.filter(n=>n.author===author);
    const byDate = group => group.sort((a,b)=>a.date.localeCompare(b.date)).reverse();
    return [...byDate(items.filter(n=>n.rating===5)),...byDate(items.filter(n=>n.rating!==5))];
  });
  const current = await Promise.all(old.map(async n=>parseNote(n.filename,await fs.readFile(path.join('notes',n.filename),'utf8'))));
  const snapshot = JSON.parse(await fs.readFile('site/library-order.json','utf8'));
  for (const note of current) {
    const historical = snapshot.entries.find(entry=>entry.filename===note.filename);
    Object.assign(note,{navigationRating:historical.rating,navigationDate:historical.date});
  }
  assert.deepEqual(current.sort(navigationOrder).map(n=>n.filename),expected.map(n=>n.filename));
});
