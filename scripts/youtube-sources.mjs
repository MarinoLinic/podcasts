import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { videoIds } from './content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const map = new Map();
for (const file of (await fs.readdir(path.join(root, 'notes'))).filter(f => f.endsWith('.md')).sort()) {
  for (const id of videoIds(await fs.readFile(path.join(root, 'notes', file), 'utf8'))) map.set(id, [...(map.get(id) || []), file]);
}
if (process.argv[2] === 'list') {
  console.log([...map.keys()].map(id => `https://www.youtube.com/watch?v=${id}`).join('\n'));
} else if (process.argv[2] === 'import') {
  const reportPath = process.argv[3];
  if (!reportPath) throw new Error('Usage: node scripts/youtube-sources.mjs import PATH-TO-YT-REPORT.json');
  const report = JSON.parse(await fs.readFile(reportPath, 'utf8'));
  const output = path.join(root, 'sources/youtube');
  await fs.mkdir(output, { recursive:true });
  let previous = [];
  try { previous = JSON.parse(await fs.readFile(path.join(output, 'catalog.json'), 'utf8')).videos; } catch(error) { if(error.code !== 'ENOENT') throw error; }
  const videos = [];
  for (const [id, notes] of map) {
    const result = report.results.find(r => videoIds(r.url).includes(id));
    const old = previous.find(v => v.video_id === id);
    if (!result) { videos.push(old ? {...old, notes} : { video_id:id, url:`https://www.youtube.com/watch?v=${id}`, notes, status:'not_checked', error:'Not present in this acquisition report.' }); continue; }
    const record = { video_id:id, url:`https://www.youtube.com/watch?v=${id}`, notes, title:result.title || old?.title || '', acquisition_status:result.status, status:'failed', error:result.error || '', acquired_at:new Date().toISOString() };
    const jsonPath = result.files?.find(file => file.endsWith('.transcript.json'));
    const markdownPath = result.files?.find(file => file.endsWith('.md') && !file.endsWith('.info.md'));
    const folder = path.join(output, id);
    if (jsonPath && markdownPath) {
      const rawJson = await fs.readFile(jsonPath), rawMarkdown = await fs.readFile(markdownPath);
      const metadata = JSON.parse(rawJson.toString('utf8'));
      if (metadata.video_id !== id || !metadata.segments?.length) throw new Error(`Identity/empty-caption check failed for ${id}`);
      await fs.mkdir(folder, { recursive:true });
      for (const [filename, bytes] of [['transcript.md',rawMarkdown],['segments.json',rawJson]]) {
        const target = path.join(folder, filename);
        try {
          const existing = await fs.readFile(target);
          if (!existing.equals(bytes)) throw new Error(`Preserved caption differs: ${id}/${filename}. Use a new dated version; no overwrite permitted.`);
        } catch(error) { if(error.code === 'ENOENT') await fs.writeFile(target, bytes); else throw error; }
      }
      Object.assign(record, Object.fromEntries(['title','uploader','channel_url','upload_date','duration','duration_seconds','language','transcript_source','downloaded_at'].map(key => [key, metadata[key] ?? null])), { status:'available', error:'', segment_count:metadata.segments.length,
        files:[{path:`${id}/transcript.md`,bytes:rawMarkdown.length,sha256:createHash('sha256').update(rawMarkdown).digest('hex')},{path:`${id}/segments.json`,bytes:rawJson.length,sha256:createHash('sha256').update(rawJson).digest('hex')}] });
      await fs.writeFile(path.join(folder, 'source.json'), JSON.stringify(record, null, 2) + '\n');
    } else if (result.status === 'info') {
      record.status = 'unavailable';
      record.error ||= 'No usable caption track was returned; video metadata only.';
      await fs.mkdir(folder, { recursive:true });
      for (const file of result.files || []) if (file.endsWith('.info.md') || file.endsWith('.info.json')) await fs.copyFile(file, path.join(folder, path.basename(file).endsWith('.json') ? 'video-info.json' : 'video-info.md'));
    } else if (old?.status === 'available') {
      videos.push({...old, notes, latest_attempt:{status:result.status,error:result.error || '',at:new Date().toISOString()}}); continue;
    }
    videos.push(record);
  }
  const catalog = { schema:1, checked_at:new Date().toISOString(), method:'Installed youtube-tools yt transcript; caption retrieval only, no media or paid transcription.', requested:map.size, saved:videos.filter(v => v.status === 'available').length, unavailable:videos.filter(v => v.status === 'unavailable').length, failed:videos.filter(v => v.status === 'failed').length, videos };
  await fs.writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
  console.log(JSON.stringify({requested:catalog.requested,saved:catalog.saved,unavailable:catalog.unavailable,failed:catalog.failed},null,2));
} else throw new Error('Choose list or import.');
