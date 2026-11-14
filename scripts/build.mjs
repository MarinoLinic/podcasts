import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { escapeHtml as e, parseNote, readableText, renderMarkdown, captionParagraphs } from './content.mjs';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await fs.readFile(path.join(root, 'site.config.json'), 'utf8'));
const base = (process.env.BASE_PATH ?? config.basePath).replace(/\/$/, '');
if (base && !/^\/[a-zA-Z0-9/_-]+$/.test(base)) throw new Error('BASE_PATH must be an absolute URL path.');
const url = value => `${base}/${value.replace(/^\//, '').split('/').map(encodeURIComponent).join('/')}`;
const dist = path.join(root, 'dist');
const write = async (name, value) => { const target = path.join(dist, name); await fs.mkdir(path.dirname(target), { recursive:true }); await fs.writeFile(target, value); };
const json = value => JSON.stringify(value).replaceAll('<', '\\u003c');
const dateLabel = date => date ? new Intl.DateTimeFormat('en-US', { dateStyle:'medium', timeZone:'UTC' }).format(new Date(date + 'T00:00:00Z')) : 'Date not recorded';

function shell({ title, current = 'notes', description = config.description, body, canonical = '', extra = '' }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · ${e(config.title)}</title><meta name="description" content="${e(description.slice(0, 190))}"><meta name="theme-color" content="#f5f2eb"><link rel="icon" href="${url('favicon.svg')}" type="image/svg+xml"><link rel="stylesheet" href="${url('assets/site.css')}"><link rel="canonical" href="${e(config.origin + url(canonical))}"><meta property="og:title" content="${e(title)}"><meta property="og:type" content="${current === 'note' ? 'article' : 'website'}"><meta property="og:description" content="${e(description.slice(0, 190))}">${extra}</head><body><a class="skip-link" href="#main">Skip to content</a><header class="site-header"><a class="brand" href="${url('')}"><img src="${url('favicon.svg')}" width="28" height="28" alt=""><span>Marino Linic</span></a><nav aria-label="Main"><a href="${url('')}" ${current !== 'transcripts' ? 'aria-current="page"' : ''}>Notes</a><a href="${url('transcripts/')}" ${current === 'transcripts' ? 'aria-current="page"' : ''}>Transcripts</a><a href="https://github.com/MarinoLinic/podcasts">GitHub <span aria-hidden="true">↗</span></a></nav></header>${body}<footer class="site-footer"><span>Curated by Marino · AI-assisted notes</span><a href="${url('about/')}">About the collection</a></footer><div class="toast" id="toast" role="status" aria-live="polite"></div><script type="module" src="${url('assets/site.js')}"></script></body></html>`;
}

function libraryPage(notes, transcripts, isTranscripts = false) {
  const authors = [...new Set(notes.map(n => n.author))].sort();
  const tags = [...new Set(notes.flatMap(n => n.tags))].sort();
  const title = isTranscripts ? 'Transcripts' : 'Notes';
  return shell({ title, current:isTranscripts ? 'transcripts' : 'notes', canonical:isTranscripts ? 'transcripts/' : '', body:`<main id="main" class="library"><div class="library-heading"><div><h1>${title}</h1></div><p class="collection-count">${isTranscripts ? `${transcripts.filter(t => t.status === 'available').length}<span>saved transcripts</span>` : `${notes.length}<span>podcasts, articles & books</span>`}</p></div><section class="library-tools" aria-label="Find notes"><label class="search-box"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="search" type="search" placeholder="Search titles, people, or topics" aria-label="Search titles, people, or topics" autocomplete="off"><kbd>/</kbd></label><div class="filter-row"><div class="type-filters" role="group" aria-label="Source type">${(isTranscripts ? [['all','All videos']] : [['all','All notes'],['video','Podcasts & video'],['article','Articles'],['book','Books']]).map(([value,label]) => `<button type="button" data-type="${value}" aria-pressed="${value === 'all'}">${label}${value === 'all' ? '' : `<span>${notes.filter(n => n.type === value).length}</span>`}</button>`).join('')}</div><button id="reset" type="button" class="text-button" hidden>Reset filters</button></div><div class="select-filters"><label>Person<select id="author"><option value="">Everyone</option>${authors.map(a => `<option>${e(a)}</option>`).join('')}</select></label><label>Topic<select id="tag"><option value="">All topics</option>${tags.map(t => `<option>${e(t)}</option>`).join('')}</select></label>${!isTranscripts ? '<label>Rating<select id="rating"><option value="">Any rating</option><option value="5">5 only</option><option value="4">4 and up</option><option value="3">3 and up</option></select></label>' : '<label>Captions<select id="captions"><option value="">All statuses</option><option value="available">Saved</option><option value="unavailable">Unavailable</option></select></label>'}<label class="sort-select">Sort by<select id="sort"><option value="date">Source date (newest)</option><option value="title">Title A–Z</option><option value="author">Person A–Z</option><option value="rating">Highest rated</option></select></label></div></section><div class="results-meta"><p id="result-count" aria-live="polite"></p><span id="page-range"></span></div><div id="library-results" class="note-list"></div><nav id="pagination" class="pagination" aria-label="Results pages"></nav><noscript><p>JavaScript enables search and filters. All notes remain available below.</p><ul>${notes.map(n => `<li><a href="${url(`notes/${n.slug}/`)}">${e(n.author)}: ${e(n.title)}</a></li>`).join('')}</ul></noscript></main><script type="application/json" id="library-data">${json({ notes, transcripts, base, mode:isTranscripts ? 'transcripts' : 'notes' })}</script>` });
}

export async function build() {
  // Only our known generated tree can be replaced; sources and archives are separate.
  try {
    const marker = await fs.readFile(path.join(dist, '.podcast-notes-build'), 'utf8');
    if (marker.trim() !== 'generated podcast notes') throw new Error('Unrecognized dist folder; preserve and inspect it.');
    if (path.resolve(dist) !== path.join(root, 'dist')) throw new Error('Unsafe output path');
    await fs.rm(dist, { recursive:true });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(dist, { recursive:true });
  await write('.podcast-notes-build', 'generated podcast notes\n');
  await write('.nojekyll', '');
  await fs.cp(path.join(root, 'site'), path.join(dist, 'assets'), { recursive:true });
  await fs.copyFile(path.join(root, 'favicon.svg'), path.join(dist, 'favicon.svg'));
  const filenames = (await fs.readdir(path.join(root, 'notes'))).filter(f => f.endsWith('.md')).sort();
  const notes = await Promise.all(filenames.map(async name => parseNote(name, await fs.readFile(path.join(root, 'notes', name), 'utf8'))));
  if (new Set(notes.map(n => n.slug)).size !== notes.length) throw new Error('Note URL slug collision. Choose unique filenames.');
  let transcripts = [];
  try { transcripts = JSON.parse(await fs.readFile(path.join(root, 'sources/youtube/catalog.json'), 'utf8')).videos; }
  catch(error) { if(error.code !== 'ENOENT') throw error; }
  const catalog = notes.map(({ body, raw, ...note }) => ({ ...note, summary:note.summary.slice(0, 400), words:body.split(/\s+/).length, minutes:Math.max(1, Math.ceil(body.split(/\s+/).length / 230)), transcriptCount:note.videos.filter(id => transcripts.find(t => t.video_id === id)?.status === 'available').length }));
  await write('index.html', libraryPage(catalog, transcripts));
  const captionCatalog = transcripts.map(transcript => {
    const note = catalog.find(n => n.videos.includes(transcript.video_id));
    return note ? { ...note, title:transcript.title || note.title, transcriptId:transcript.video_id,
      captionStatus:transcript.status, videos:[transcript.video_id], transcriptCount:transcript.status === 'available' ? 1 : 0 } : null;
  }).filter(Boolean);
  await write('transcripts/index.html', libraryPage(captionCatalog, transcripts, true));
  for (const note of notes) {
    const rendered = renderMarkdown(note.body);
    const minDepth = Math.min(...rendered.toc.map(h => h.depth));
    const toc = rendered.toc.filter(h => h.depth <= minDepth + (minDepth < 3 ? 1 : 0));
    const related = note.videos.map(id => transcripts.find(t => t.video_id === id) || { video_id:id, status:'not_checked', url:`https://www.youtube.com/watch?v=${id}` });
    const available = related.filter(t => t.status === 'available');
    const sources = note.sources.map((source, i) => `<a href="${e(source)}" rel="noopener noreferrer">${note.sources.length > 1 ? `Source ${i + 1}` : 'Original source'} <span aria-hidden="true">↗</span></a>`).join('');
    const transcriptLinks = related.map(t => t.status === 'available' ? `<a href="${url(`transcripts/${t.video_id}/`)}">${related.length > 1 ? `Transcript ${related.indexOf(t) + 1}` : 'Read transcript'}</a>` : `<span class="caption-gap">Captions ${t.status === 'unavailable' ? 'unavailable' : 'not retrieved'}</span>`).join('');
    const body = `<main id="main" class="reader"><a class="back-link" href="${url('')}" data-library-back>← All notes</a><header class="note-header"><div class="eyebrow">${e(note.type === 'video' ? 'PODCAST / VIDEO' : note.type.toUpperCase())}${note.tags.length ? ` <span>·</span> ${note.tags.map(e).join(' / ')}` : ''}</div><h1>${e(note.title)}</h1><div class="note-byline"><a href="${url('')}?author=${encodeURIComponent(note.author)}">${e(note.author)}</a><span>${e(dateLabel(note.date))}</span><span title="Marino's rating">${note.rating ? `${'★'.repeat(note.rating)}${'☆'.repeat(5 - note.rating)}` : 'Unrated'}</span><span>${Math.max(1, Math.ceil(note.body.split(/\s+/).length / 230))} min read</span></div><div class="reader-actions"><button class="button primary" data-copy="text" data-file="${url(`text/${note.slug}.txt`)}">Copy text</button><button class="button" data-copy="markdown" data-file="${url(`markdown/${note.filename}`)}">Copy Markdown</button><a class="download-link" href="${url(`markdown/${note.filename}`)}" download>Download .md</a></div><div class="source-links">${sources}${transcriptLinks}</div></header><div class="reader-grid"><article class="note-body">${rendered.html}</article>${toc.length > 2 ? `<aside class="contents"><details open><summary>On this page <span>${toc.length}</span></summary><ol>${toc.map(h => `<li class="depth-${h.depth}"><a href="#${h.id}">${e(h.label)}</a></li>`).join('')}</ol></details></aside>` : ''}</div><div class="note-end"><a href="${url('')}" data-library-back>← Back to the library</a>${available.length ? `<a href="${url(`transcripts/${available[0].video_id}/`)}">Read the source transcript →</a>` : ''}</div></main>`;
    await write(`notes/${note.slug}/index.html`, shell({ title:note.title, current:'note', description:note.summary, canonical:`notes/${note.slug}/`, body }));
    await write(`markdown/${note.filename}`, await fs.readFile(path.join(root, 'notes', note.filename)));
    await write(`text/${note.slug}.txt`, readableText(note));
  }
  for (const transcript of transcripts) {
    if (transcript.status !== 'available') continue;
    const folder = path.join(root, 'sources/youtube', transcript.video_id);
    const saved = JSON.parse(await fs.readFile(path.join(folder, 'segments.json'), 'utf8'));
    const rendered = { html:captionParagraphs(saved.segments).map(paragraph => {
      const seconds = Math.floor(paragraph.start), minutes = Math.floor(seconds / 60), remainder = String(seconds % 60).padStart(2, '0');
      return `<p><a class="cue-time" href="${e(transcript.url)}&amp;t=${seconds}">${minutes}:${remainder}</a> ${e(paragraph.text)}</p>`;
    }).join('\n') };
    const related = catalog.filter(n => n.videos.includes(transcript.video_id));
    await fs.cp(folder, path.join(dist, 'sources/youtube', transcript.video_id), { recursive:true });
    const body = `<main id="main" class="reader transcript-reader"><a class="back-link" href="${url('transcripts/')}">← All transcripts</a><header class="note-header"><p class="eyebrow">SOURCE TRANSCRIPT · ${e(transcript.language || 'en')}</p><h1>${e(transcript.title)}</h1><div class="note-byline"><span>${e(transcript.uploader || '')}</span><span>${e(transcript.transcript_source || 'YouTube captions')}</span><span>${e(transcript.duration || '')}</span></div><div class="source-links"><a href="${e(transcript.url)}">Watch on YouTube ↗</a><a href="${url(`sources/youtube/${transcript.video_id}/transcript.md`)}" download>Download transcript</a>${related.map(n => `<a href="${url(`notes/${n.slug}/`)}">Read notes</a>`).join('')}</div><p class="source-notice">${transcript.transcript_source === 'auto-generated' ? 'Automatically generated captions may contain transcription errors.' : 'Captured from YouTube captions.'}</p></header><article class="note-body">${rendered.html}</article></main>`;
    await write(`transcripts/${transcript.video_id}/index.html`, shell({ title:transcript.title, current:'transcripts', canonical:`transcripts/${transcript.video_id}/`, body }));
  }
  for (const name of ['baby-essentials.html','intelligence.html']) await fs.copyFile(path.join(root, 'legacy/2026-11-14', name), path.join(dist, name));
  await write('about/index.html', shell({ title:'About the collection', canonical:'about/', body:`<main id="main" class="about"><h1>About these notes</h1><p>These are Marino's notes on podcasts, articles, and books, curated by Marino and largely written with Gemini. They preserve the original authors' arguments and may contain errors. A note or a saved transcript does not establish that its claims have been independently verified.</p><p>The date on a note is the source date recorded in the original Markdown. Ratings are Marino's. Source links lead to the material discussed.</p><h2>Sources and copies</h2><p>YouTube transcripts retain the exact video ID, channel, caption type, language, and acquisition time. Automatic captions can contain mistakes. Unavailable captions remain labeled.</p><p>Copy Markdown gives the original note, including its metadata. Copy text produces readable plain text for a post or message. It keeps source links and does not submit or publish anything.</p><h2>Other retained pages</h2><ul><li><a href="${url('baby-essentials.html')}">Baby essentials</a></li><li><a href="${url('intelligence.html')}">Intelligence</a></li></ul><p><a href="https://github.com/MarinoLinic/podcasts">Source repository ↗</a></p></main>` }));
  await write('404.html', shell({ title:'Page not found', body:`<main id="main" class="about"><h1>Page not found</h1><p>The note may have moved.</p><a class="button primary" href="${url('')}">Search the library</a></main>` }));
  const digest = createHash('sha256').update(JSON.stringify(config)).update(JSON.stringify(transcripts));
  for (const note of notes) digest.update(note.filename).update(note.raw);
  for (const file of ['scripts/build.mjs','scripts/content.mjs','site/site.css','site/site.js']) digest.update(await fs.readFile(path.join(root,file)));
  const buildId = digest.digest('hex').slice(0, 16);
  await write('build.json', JSON.stringify({ buildId, sourceCommit:process.env.GITHUB_SHA || null, notes:notes.length, videos:transcripts.length, transcripts:transcripts.filter(t => t.status === 'available').length, basePath:base }, null, 2));
  console.log(`Built ${notes.length} notes, ${transcripts.filter(t => t.status === 'available').length} transcripts at ${base || '/'}. Build ${buildId}`);
  return { notes:catalog, transcripts, base, buildId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await build();
