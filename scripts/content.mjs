import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
export const slugify = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const videoIds = value => [...new Set([...value.matchAll(/(?:youtube\.com\/watch\?[^\s<>)]*?v=|youtu\.be\/)([\w-]{11})/g)].map(m => m[1]))];

// Same order as the original Liquid sidebar: author ascending; five-star notes
// first, then the others; each subset sorted by date and reversed.
export function navigationOrder(a, b) {
  if (a.author !== b.author) return a.author < b.author ? -1 : 1;
  const favorite = Number((b.navigationRating ?? b.rating) === 5) - Number((a.navigationRating ?? a.rating) === 5);
  if (favorite) return favorite;
  const date = (b.navigationDate || b.date || '1970-01-01').localeCompare(a.navigationDate || a.date || '1970-01-01');
  if (date) return date;
  return a.filename === b.filename ? 0 : a.filename < b.filename ? 1 : -1;
}

export function parseNote(filename, raw) {
  const stem = filename.replace(/\.md$/i, '');
  const separator = stem.indexOf(' - ');
  const author = separator < 0 ? 'Other notes' : stem.slice(0, separator);
  const title = separator < 0 ? stem : stem.slice(separator + 3);
  const normalized = raw.replace(/^\uFEFF/, '');
  const boundary = normalized.search(/^(?:---+[ \t]*|#{1,6}[ \t]+.*)\r?$/m);
  const header = boundary < 0 ? normalized : normalized.slice(0,boundary);
  const metadata = {};
  for (const match of header.matchAll(/^(Rating|Date|Type|Tags|Source|Video URL):[ \t]*(.*)$/gmi)) {
    const key = match[1].toLowerCase();
    if (!(key in metadata)) metadata[key] = match[2].trim();
  }
  const dateInput = (metadata.date || '').replaceAll('`', '');
  const dateMatch = dateInput.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const month = dateMatch ? months.indexOf(dateMatch[2].slice(0, 3).toLowerCase()) : -1;
  let date = dateMatch && month >= 0 ? `${dateMatch[3]}-${String(month + 1).padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : null;
  if (date) { const parsed = new Date(date + 'T00:00:00Z'); if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) date = null; }
  const rating = /^[1-5]$/.test(metadata.rating) ? Number(metadata.rating) : null;
  const type = ['video','article','book'].includes(metadata.type?.toLowerCase()) ? metadata.type.toLowerCase() : 'other';
  const tags = [...new Set((metadata.tags || '').split(',').map(x => x.trim()).filter(Boolean))];
  const body = (header.replace(/^(Rating|Date|Type|Tags|Source|Video URL):[^\r\n]*(?:\r?\n|$)/gmi, '')+(boundary < 0 ? '' : normalized.slice(boundary))).replace(/^\s*Summary:[ \t]*(?:\r?\n)?/i, '').trim();
  const summary = body.split(/\r?\n\s*\r?\n/)[0].replace(/[*_#`]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const urls = [...new Set([...raw.matchAll(/https?:\/\/[^\s<>)\]]+/g)].map(m => m[0].replace(/[.,;]+$/, '')))];
  const sources = (metadata.source || metadata['video url']) ? urls.filter(url => (metadata.source || metadata['video url']).includes(url)) : urls.filter(url => /youtube\.com|youtu\.be/.test(url));
  return { slug: slugify(stem), filename, title, author, date, dateLabel: dateInput, rating, type, tags, summary, body, sources, videos: videoIds(raw), raw };
}

export function renderMarkdown(markdown, { headings = true } = {}) {
  const renderer = new marked.Renderer();
  const toc = [], used = new Map();
  renderer.heading = function(token) {
    const label = token.text.replace(/<[^>]*>/g, '').replace(/[*_`]/g, '');
    const base = slugify(label) || 'section';
    const number = (used.get(base) || 0) + 1;
    used.set(base, number);
    const id = base + (number > 1 ? `-${number}` : '');
    const level = Math.min(6, token.depth + 1);
    if (headings) toc.push({ label, id, depth: token.depth });
    return `<h${level} id="${id}">${this.parser.parseInline(token.tokens)}</h${level}>\n`;
  };
  const html = sanitizeHtml(marked.parse(markdown, { renderer, gfm: true }), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'details', 'summary', 'mark'],
    allowedAttributes: { a: ['href', 'title'], '*': ['id'], code: ['class'], th: ['align'], td: ['align'] },
    allowedSchemes: ['http', 'https', 'mailto'], allowProtocolRelative: false,
    transformTags: { a: (tag, attrs) => ({ tagName: tag, attribs: { ...attrs, ...(/^https?:/.test(attrs.href || '') ? { rel:'noopener noreferrer' } : {}) } }) }
  });
  return { html, toc };
}

function inlineText(tokens = []) {
  return tokens.map(t => {
    if (t.type === 'link') return `${inlineText(t.tokens)}${t.href === t.text ? '' : ` (${t.href})`}`;
    if (t.type === 'image') return `${t.text || 'Image'} (${t.href})`;
    if (t.tokens) return inlineText(t.tokens);
    if (t.type === 'br') return '\n';
    return t.text ?? t.raw ?? '';
  }).join('');
}

function tokensText(tokens, depth = 0) {
  return tokens.map(t => {
    if (t.type === 'space') return '';
    if (t.type === 'hr') return '---';
    if (t.type === 'list') return t.items.map((item, i) => `${'  '.repeat(depth)}${t.ordered ? `${Number(t.start || 1) + i}.` : '-'} ${tokensText(item.tokens, depth + 1).trim()}`).join('\n');
    if (t.type === 'blockquote') return tokensText(t.tokens, depth);
    if (t.type === 'table') return [t.header, ...t.rows].map(row => row.map(c => inlineText(c.tokens)).join(' | ')).join('\n');
    if (t.type === 'html') return sanitizeHtml(t.text, { allowedTags: [], allowedAttributes: {} });
    if (t.tokens) return inlineText(t.tokens);
    return t.text || '';
  }).filter(Boolean).join('\n\n');
}

export function readableText(note) {
  const text = tokensText(marked.lexer(note.body)).replace(/\n{3,}/g, '\n\n').trim();
  const source = note.sources.length ? '\n\n' + note.sources.map(url => `Source: ${url}`).join('\n') : '';
  return `${note.author} on ${note.title}\n\n${text}${source}\n`;
}

export function captionParagraphs(segments) {
  const paragraphs = [];
  let current = null;
  for (const segment of segments) {
    const text = String(segment.text || '').trim();
    if (!text) continue;
    if (!current) current = { start:Number(segment.start) || 0, texts:[] };
    current.texts.push(text);
    const elapsed = Number(segment.start) - current.start;
    if (elapsed >= 45 || (elapsed >= 20 && /[.!?]["')]*$/.test(text))) {
      paragraphs.push({ start:current.start, text:current.texts.join(' ') }); current = null;
    }
  }
  if (current) paragraphs.push({ start:current.start, text:current.texts.join(' ') });
  return paragraphs;
}
