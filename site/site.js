const $ = id => document.getElementById(id);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const safeLink = (text, href, className) => { const node = element('a', text, className); node.href = href; return node; };
const dateText = date => date ? new Intl.DateTimeFormat('en-US', { month:'short', day:'numeric', year:'numeric', timeZone:'UTC' }).format(new Date(`${date}T00:00:00Z`)) : 'Undated';
let toastTimer;
function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3000); }

const navigation = $('notes-navigation'), navigationToggle = document.querySelector('.navigation-toggle');
if (navigation && navigationToggle) {
  const backdrop = document.querySelector('.navigation-backdrop'), close = navigation.querySelector('.close-navigation');
  const mobile = matchMedia('(max-width: 900px)');
  function state(open, focus = true) {
    navigation.hidden = !open; backdrop.hidden = !open;
    document.body.classList.toggle('navigation-open',open);
    navigationToggle.setAttribute('aria-expanded',String(open));
    navigationToggle.setAttribute('aria-label',open ? 'Close note navigation' : 'Open note navigation');
    $('main').inert = open && mobile.matches;
    if(open && mobile.matches) { navigation.setAttribute('role','dialog'); navigation.setAttribute('aria-modal','true'); }
    else { navigation.removeAttribute('role'); navigation.removeAttribute('aria-modal'); }
    try { sessionStorage.setItem('podcasts-navigation-open',String(open)); } catch {}
    if(focus) (open ? close : navigationToggle).focus();
  }
  navigationToggle.addEventListener('click',()=>state(navigation.hidden));
  close.addEventListener('click',()=>state(false)); backdrop.addEventListener('click',()=>state(false));
  document.addEventListener('keydown',event=>{
    if(navigation.hidden) return;
    if(event.key==='Escape') { state(false); return; }
    if(event.key==='Tab' && mobile.matches) {
      const nodes=[...navigation.querySelectorAll('button,input,a[href],summary')].filter(node=>node.offsetParent!==null);
      const first=nodes[0],last=nodes.at(-1);
      if(event.shiftKey&&document.activeElement===first) { event.preventDefault();last.focus(); }
      else if(!event.shiftKey&&document.activeElement===last) { event.preventDefault();first.focus(); }
    }
  });
  mobile.addEventListener('change',()=>{if(!navigation.hidden) state(true,false);});
  for(const link of navigation.querySelectorAll('a')) link.addEventListener('click',()=>{if(mobile.matches) state(false,false);});
  for(const link of navigation.querySelectorAll('.drawer-note')) if(new URL(link.href).pathname===location.pathname) link.setAttribute('aria-current','page');
  $('navigation-search').addEventListener('input',()=>{
    const query=$('navigation-search').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    for(const group of navigation.querySelectorAll('.navigation-author')) {
      let count=0;
      for(const item of group.querySelectorAll('li[data-search]')) { item.hidden=!query.every(term=>item.dataset.search.includes(term)); if(!item.hidden) count++; }
      group.hidden=!count; if(query.length&&count) group.open=true;
    }
  });
  try { if(sessionStorage.getItem('podcasts-navigation-open')==='true') state(true,false); } catch {}
}

if(document.querySelector('[data-word-count]')) {
  const words=document.querySelector('.note-body').innerText.trim().split(/\s+/).filter(Boolean).length;
  document.querySelector('[data-word-count]').textContent=`${words.toLocaleString('en-US')} words`;
}

const libraryNode = $('library-data');
if (libraryNode) {
  const data = JSON.parse(libraryNode.textContent);
  // The build supplies the exact familiar author/article ordering. Filtering
  // never re-sorts it and every matching item stays with its author.
  const source = data.notes.map(note => ({ ...note, search:[note.title,note.author,note.summary,...note.tags].join(' ').normalize('NFKD').toLowerCase() }));
  const controls = ['search','author','tag','rating','captions'].filter(id => $(id));
  let selectedType = 'all';
  const parameter = id => id === 'search' ? 'q' : id;
  function readLocation() {
    const params = new URLSearchParams(location.search);
    for (const id of controls) {
      $(id).value = params.get(parameter(id)) || '';
      if ($(id).tagName === 'SELECT' && $(id).selectedIndex < 0) $(id).value = '';
    }
    selectedType = ['video','article','book'].includes(params.get('type')) ? params.get('type') : 'all';
  }
  function updateLocation(push = false) {
    const params = new URLSearchParams();
    for (const id of controls) if ($(id).value) params.set(parameter(id), $(id).value);
    if (selectedType !== 'all') params.set('type', selectedType);
    const value = location.pathname + (params.size ? `?${params}` : '');
    history[push ? 'pushState' : 'replaceState'](null, '', value);
    try { sessionStorage.setItem(`podcasts-library-${data.mode}`, value); } catch {}
  }
  function render(push = false) {
    const query = $('search').value.normalize('NFKD').toLowerCase().trim().split(/\s+/).filter(Boolean);
    const author = $('author').value, tag = $('tag').value, rating = Number($('rating')?.value || 0), caption = $('captions')?.value;
    const notes = source.filter(n => (selectedType === 'all' || n.type === selectedType) && (!author || n.author === author) && (!tag || n.tags.includes(tag)) && (!rating || n.rating >= rating) && query.every(term => n.search.includes(term)) && (!caption || (caption === 'available' ? n.transcriptCount > 0 : n.transcriptCount < n.videos.length)));
    for (const button of document.querySelectorAll('[data-type]')) button.setAttribute('aria-pressed', String(button.dataset.type === selectedType));
    $('result-count').textContent = `${notes.length} ${data.mode === 'transcripts' ? 'video source' : 'note'}${notes.length === 1 ? '' : 's'}`;
    $('page-range').textContent = '';
    $('reset').hidden = !query.length && !author && !tag && !rating && !caption && selectedType === 'all';
    const groups = new Map();
    for (const note of notes) {
      if (!groups.has(note.author)) groups.set(note.author, []);
      groups.get(note.author).push(note);
    }
    const output = document.createDocumentFragment();
    for (const [author, entries] of groups) {
      const section = element('section', null, 'author-group');
      const heading = element('h2', author, 'author-heading');
      section.append(heading);
      const list = element('ul', null, 'author-notes');
      for (const note of entries) {
        const row = element('li', null, 'note-row');
        const icon = element('span', {video:'\u{1F3AC}',book:'\u{1F4D6}',article:'\u{1F4C4}'}[note.type] || '\u{1F516}', 'source-icon');
        icon.setAttribute('aria-label', note.type); icon.title = note.type;
        const content = element('div', null, 'row-content');
        const link = safeLink(note.title, data.mode === 'transcripts' && note.captionStatus === 'available' ? `${data.base}/transcripts/${note.transcriptId}/` : `${data.base}/notes/${note.slug}/`, 'note-title');
        content.append(link);
        if (data.mode === 'transcripts') content.append(safeLink('Notes', `${data.base}/notes/${note.slug}/`, 'row-source-link'));
        const stars = element('span', note.rating ? '\u2605'.repeat(note.rating) + '\u2606'.repeat(5 - note.rating) : 'Unrated', 'row-rating');
        stars.setAttribute('aria-label', note.rating ? `Rated ${note.rating} out of 5` : 'Unrated');
        row.append(icon, content, stars); list.append(row);
      }
      section.append(list); output.append(section);
    }
    if (!notes.length) { const empty = element('div', null, 'empty-state'); empty.append(element('h2', 'No matching notes'), element('p', 'Try another search or reset the filters.')); output.append(empty); }
    $('library-results').replaceChildren(output);
    updateLocation(push);
  }
  for (const id of controls) $(id).addEventListener(id === 'search' ? 'input' : 'change', () => render(id !== 'search'));
  for (const button of document.querySelectorAll('[data-type]')) button.addEventListener('click', () => { selectedType = button.dataset.type; render(true); });
  $('reset').addEventListener('click', () => { for (const id of controls) $(id).value = ''; selectedType = 'all'; render(true); $('search').focus(); });
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
