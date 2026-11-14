import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await fs.readFile(path.join(root, 'docs/preservation-manifest.json'), 'utf8'));
const includeNotes = process.argv.includes('--include-notes');
let count = 0, bytes = 0;
for (const file of manifest.files) {
  if (!includeNotes && !file.preserved_path.startsWith('legacy/')) continue;
  const data = await fs.readFile(path.join(root, file.preserved_path)).catch(error => {
    if(error.code === 'ENOENT' && !file.git_tracked_before) return null;
    throw error;
  });
  if (!data) continue;
  if (data.length !== file.bytes || createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`Preserved file changed: ${file.preserved_path}`);
  count++; bytes += data.length;
}
console.log(`Verified ${count} preserved files (${bytes.toLocaleString()} bytes)${includeNotes ? ', including the initial source-note snapshot' : ''}.`);
