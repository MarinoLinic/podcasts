# Podcast Notes continuation

November 14, 2026.

## Architecture

The user requested original Markdown authoring, intuitive files, scalable navigation, readable-text and original-Markdown copying, retained YouTube transcripts, and working GitHub Pages without Jekyll.

`notes/` contains 113 original files, moved without byte changes. No note wording was rewritten. `scripts/content.mjs` reads existing metadata and derives stable slugs using the previous filename rule. `scripts/build.mjs` uses pinned Marked plus sanitize-html for complete static pages. Browser JavaScript only handles library controls, copying and responsive behavior. `site.config.json` owns origin/base path.

`sources/youtube/catalog.json` connects each video ID to notes, caption metadata and hashes. The installed yt CLI retrieved all 64 linked videos successfully: five manual tracks and 59 automatically generated tracks, with zero unavailable/failed requests. Imported Markdown and normalized segment JSON remain unchanged. Display paragraphs group consecutive cues while retaining every cue in order and linking the original start time. No paid transcription, audio/video download, cookies, or account changes were used. Eight older TXT transcripts remain in legacy.

## Preservation

`legacy/2026-11-14/` preserves Notes, Notes_Text, Transcripts, layouts/config, processor, original homepage/assets/docs and unique standalone pages. All 475 initial local files totaling 12,344,104 bytes passed SHA-256/size checks after moving. The preexisting ignored font stays local-only. Git attributes disable line-ending conversion on notes, legacy files and caption originals.

Normal tests freeze only immutable tracked legacy material and caption originals. Source notes remain editable. `verify:preservation --include-notes` compares notes against the initial snapshot deliberately; it is not required after later intended edits.

## Commands

```powershell
npm ci --ignore-scripts
npm run check
npm run verify:preservation
npm run dev
```

The check covers metadata, safe rendering, heading IDs, readable text, legacy hashes and exact caption identities/hashes, then builds 181 HTML pages and validates 2,399 local references/assets and byte-exact Markdown exports. Counts can grow.

Finite isolated Chrome review, using the installed Playwright runtime:

```powershell
py -B -X utf8 scripts/review.py --url http://127.0.0.1:4175/podcasts/ --out C:\Users\marin\agent-files\trash\project-reviews\podcasts\NEW-REVIEW
```

Desktop1440×1000 and phone390×844 passed search, filters, pagination/reload, exact Markdown copy, readable text, clipboard-denial fallback, note/transcript routes and caption identity, with no horizontal overflow or JavaScript errors. Tests intercept clipboard writes inside their isolated page. Actual screenshots are in docs/screenshots; temporary evidence is in agent-files/trash/project-reviews/podcasts/20261114-redesign.

T3 preview opened the page but snapshot timed out twice; isolated Chrome supplied completed checks. Owned browser and server processes were closed after review because disk free space became low during concurrent work.

## Publishing and next steps

Initial Pages was public legacy mode from main/root at https://marinolinic.github.io/podcasts/. The new workflow uploads only dist through GitHub's Pages actions. Keep legacy content untouched. Before publishing, inspect changes, run relevant checks, push only intended source files, and verify the actual workflow and live routes/assets. A push alone is not deployment verification.

Publication was verified on November 14, 2026: Publish Notes run43590602153 built and deployed commit ac31b772d25bfca2c74e2274bad3a776e2f782f4 successfully. The actual public site then passed the complete desktop and phone browser review, including source downloads and both copy formats, caption links, direct note routes, filters and pagination. All 113 earlier note URLs were checked against their preserved Jekyll permalinks. Seven Node tests, 181 generated HTML pages and 2,399 local references/assets passed. Published evidence is under agent-files/trash/project-reviews/podcasts/20261114-redesign/published-review/; the handoff bundle is ../20261114T113539-6dd5d5f0/ within that project's review root. No owned browser or local preview process remains running.

For new captions, use installed youtube-tools, save acquisition under trash with a report, then import with `node scripts/youtube-sources.mjs import REPORT.json`. The importer checks IDs/nonempty segments and refuses to replace different retained bytes. Missing captions and retrieval failures stay distinct; no invented fallback speech.

Boundaries: search covers titles, people, summaries and tags, not every word of notes/captions. Dates/ratings retain the recorded original values. Baby Essentials and Intelligence are retained standalone pages. Captions may contain recognition errors. Filename changes alter note URLs and need a redirect decision. Source edits need no hand-maintained converted Markdown.
