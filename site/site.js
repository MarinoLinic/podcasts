const $ = id => document.getElementById(id);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const safeLink = (text, href, className) => { const node = element('a', text, className); node.href = href; return node; };
const dateText = date => date ? new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`)) : 'Undated';
let toastTimer;
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }

const libraryNode = $('library-data');
if (libraryNode) {
  const data = JSON.parse(libraryNode.textContent), pageSize = 24;
  const source = data.notes.map(note => ({ ...note, search:[note.title,note.author,note.summary,...note.tags].join(' ').normalize('NFKD').toLowerCase() }));
  const controls = ['search','author','tag','rating','sort','captions'].filter(id => $(id));
  let selectedType = 'all', currentPage = 1;
  const parameter = id => id === 'search' ? 'q' : id;
  function readLocation() {
    const params = new URLSearchParams(location.search);
    for (const id of controls) {
      const value = params.get(parameter(id)) || (id === 'sort' ? 'date' : '');
      $(id).value = value;
      if ($(id).tagName === 'SELECT' && $(id).selectedIndex < 0) $(id).value = id === 'sort' ? 'date' : '';
    }
    selectedType = ['video','article','book'].includes(params.get('type')) ? params.get('type') : 'all';
    currentPage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
  }
  function updateLocation(push = false) {
    const params = new URLSearchParams();
    for (const id of controls) if ($(id).value && !(id === 'sort' && $(id).value === 'date')) params.set(parameter(id), $(id).value);
    if (selectedType !== 'all') params.set('type', selectedType);
    if (currentPage > 1) params.set('page', String(currentPage));
    const value = location.pathname + (params.size ? `?${params}` : '');
    history[push ? 'pushState' : 'replaceState'](null, '', value);
    try { sessionStorage.setItem(`podcasts-library-${data.mode}`, value); } catch {}
  }
  function render(push = false) {
    const query = $('search').value.normalize('NFKD').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const author = $('author').value, tag = $('tag').value, rating = Number($('rating')?.value || 0), caption = $('captions')?.value;
    const notes = source.filter(n => (selectedType === 'all' || n.type === selectedType) && (!author || n.author === author) && (!tag || n.tags.includes(tag)) && (!rating || n.rating >= rating) && query.every(term => n.search.includes(term)) && (!caption || (caption === 'available' ? n.transcriptCount > 0 : n.transcriptCount < n.videos.length)));
    const sort = $('sort').value;
    notes.sort((a,b) => (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'author' ? a.author.localeCompare(b.author) || a.title.localeCompare(b.title) : sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : (b.date || '').localeCompare(a.date || '')) || a.title.localeCompare(b.title));
    const pages = Math.max(1, Math.ceil(notes.length / pageSize));
    currentPage = Math.min(pages, currentPage);
    const start = (currentPage - 1) * pageSize;
    for (const button of document.querySelectorAll('[data-type]')) button.setAttribute('aria-pressed', String(button.dataset.type === selectedType));
    $('result-count').textContent = `${notes.length} ${data.mode === 'transcripts' ? 'video source' : 'note'}${notes.length === 1 ? '' : 's'}`;
    $('page-range').textContent = notes.length ? `${start + 1}–${Math.min(start + pageSize, notes.length)} of ${notes.length}` : '';
    $('reset').hidden = !query.length && !author && !tag && !rating && !caption && selectedType === 'all' && sort === 'date';
    const rows = document.createDocumentFragment();
    for (const note of notes.slice(start, start + pageSize)) {
      const row = element('article', null, 'note-row');
      const person = element('div', null, 'row-author');
      person.append(element('span', note.author), element('span', note.type === 'video' ? 'Podcast / video' : note.type, 'source-type'));
      const content = element('div', null, 'row-content'), heading = element('h2');
      heading.append(safeLink(note.title, data.mode === 'transcripts' && note.captionStatus === 'available' ? `${data.base}/transcripts/${note.transcriptId}/` : `${data.base}/notes/${note.slug}/`));
      const tags = element('div', null, 'row-tags');
      for (const value of note.tags) {
        const link = safeLink(value, `?tag=${encodeURIComponent(value)}`);
        link.addEventListener('click', event => { if (event.ctrlKey || event.metaKey) return; event.preventDefault(); $('tag').value = value; currentPage = 1; render(true); });
        tags.append(link);
      }
      if (data.mode === 'transcripts') {
        tags.append(safeLink('Read notes ↗', `${data.base}/notes/${note.slug}/`, 'transcript-badge'));
        if (!note.transcriptCount) tags.append(element('span', note.captionStatus === 'unavailable' ? 'Captions unavailable' : 'Retrieval not completed', 'caption-gap'));
      } else if (note.transcriptCount) tags.append(safeLink(`${note.transcriptCount > 1 ? `${note.transcriptCount} transcripts` : 'Transcript'} ↗`, `${data.base}/transcripts/${note.videos.find(id => data.transcripts.find(t => t.video_id === id)?.status === 'available')}/`, 'transcript-badge'));
      content.append(heading, element('p', note.summary, 'row-excerpt'), tags);
      const info = element('div', null, 'row-date');
      const time = element('time', dateText(note.date));
      if (note.date) time.dateTime = note.date;
      info.append(time);
      const stars = element('span', note.rating ? '★'.repeat(note.rating) + '☆'.repeat(5 - note.rating) : 'Unrated', 'row-rating');
      stars.setAttribute('aria-label', note.rating ? `Rated ${note.rating} out of 5` : 'Unrated');
      info.append(stars, element('span', `${note.minutes} min read`, 'row-minutes'));
      row.append(person, content, info); rows.append(row);
    }
    if (!notes.length) { const empty = element('div', null, 'empty-state'); empty.append(element('h2', 'No matching notes'), element('p', 'Try another search or reset the filters.')); rows.append(empty); }
    $('library-results').replaceChildren(rows);
    const previous = element('button', '← Previous'), next = element('button', 'Next →');
    previous.disabled = currentPage <= 1; next.disabled = currentPage >= pages;
    for (const [button, step] of [[previous,-1],[next,1]]) button.addEventListener('click', () => { currentPage += step; render(true); $('main').scrollIntoView({ block:'start', behavior:'instant' }); });
    $('pagination').replaceChildren(previous, element('span', `Page ${currentPage} of ${pages}`), next);
    $('pagination').hidden = notes.length <= pageSize;
    updateLocation(push);
  }
  for (const id of controls) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => { currentPage = 1; render(id !== 'search'); });
  for (const button of document.querySelectorAll('[data-type]')) button.addEventListener('click', () => { selectedType = button.dataset.type; currentPage = 1; render(true); });
  $('reset').addEventListener('click', () => { for (const id of controls) $(id).value = id === 'sort' ? 'date' : ''; selectedType = 'all'; currentPage = 1; render(true); $('search').focus(); });
  addEventListener('popstate', () => { readLocation(); render(); });
  addEventListener('keydown', event => { if (event.key === '/' && !['INPUT','SELECT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('search').focus(); } });
  readLocation(); render();
}

for (const link of document.querySelectorAll('[data-library-back]')) {
  try { const saved = sessionStorage.getItem('podcasts-library-notes'); if (saved?.startsWith(new URL(link.href).pathname)) link.href = saved; } catch {}
}
for (const button of document.querySelectorAll('[data-copy]')) button.addEventListener('click', async () => {
  button.disabled = true;
  try {
    const response = await fetch(button.dataset.file);
    if (!response.ok) throw new Error('The source file could not be loaded.');
    const text = await response.text();
    try { await navigator.clipboard.writeText(text); toast(button.dataset.copy === 'markdown' ? 'Original Markdown copied' : 'Text copied'); }
    catch {
      const dialog = element('dialog', null, 'copy-dialog');
      const title = element('h2', button.dataset.copy === 'markdown' ? 'Original Markdown' : 'Readable text');
      const help = element('p', 'Clipboard access is unavailable. Select the text below and copy it.');
      const area = element('textarea'); area.value = text; area.readOnly = true; area.setAttribute('aria-label', 'Text to copy');
      const close = element('button', 'Close', 'button'); close.addEventListener('click', () => dialog.close());
      dialog.append(title, help, area, close); document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove()); dialog.showModal(); area.focus(); area.select();
    }
  } catch(error) { toast(error.message || 'Copy failed. Use Download .md instead.'); }
  finally { button.disabled = false; }
});

if (matchMedia('(max-width: 1000px)').matches) for (const details of document.querySelectorAll('.contents details')) details.open = false;
