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

The check covers metadata, safe rendering, heading IDs, readable text, legacy hashes, exact caption identities/hashes, exact legacy navigation order and preview idle/reuse behavior. The corrected build produces 181 HTML pages and validates 31,842 local references/assets and byte-exact Markdown/text exports. Counts can grow.

Finite isolated Chrome review, using the installed Playwright runtime:

```powershell
py -B -X utf8 scripts/review.py --url http://127.0.0.1:4175/podcasts/ --out C:\Users\marin\agent-files\trash\project-reviews\podcasts\NEW-REVIEW
```

Desktop 1440 by 1000 and phone 390 by 844 passed search, filters/reload, all 113 items in exact legacy order, all nine source tags including TFR, drawer opening/closing and author links, source icon/word count, matching action controls, real Markdown/text downloads, both copy formats, clipboard-denial fallback, note/transcript routes and caption identity. There was no horizontal overflow or JavaScript error. Tests intercept clipboard writes inside their isolated page. Current screenshots are in docs/screenshots; current temporary evidence is in agent-files/trash/project-reviews/podcasts/20261114-appearance/complete-actions-navigation.

T3 preview opened the page but snapshot timed out twice; isolated Chrome supplied completed checks. Owned browser contexts close after each finite review. The current local preview remains available with the idle policy below.

## Publishing and next steps

Initial Pages was public legacy mode from main/root at https://marinolinic.github.io/podcasts/. The new workflow uploads only dist through GitHub's Pages actions. Keep legacy content untouched. Before publishing, inspect changes, run relevant checks, push only intended source files, and verify the actual workflow and live routes/assets. A push alone is not deployment verification.

The initial Markdown/Actions migration was published successfully on November 14, 2026 (run 43590602153, commit ac31b772d25bfca2c74e2274bad3a776e2f782f4). Its interim appearance was subsequently rejected and replaced by the legacy-style correction below. All 113 earlier note URLs were checked against their preserved Jekyll permalinks. Historical migration evidence remains in agent-files/trash/project-reviews/podcasts/20261114-redesign/published-review/. See the current publication receipt below for the corrected site.

For new captions, use installed youtube-tools, save acquisition under trash with a report, then import with `node scripts/youtube-sources.mjs import REPORT.json`. The importer checks IDs/nonempty segments and refuses to replace different retained bytes. Missing captions and retrieval failures stay distinct; no invented fallback speech.

Boundaries: search covers titles, people, summaries and tags, not every word of notes/captions. Dates/ratings retain the recorded original values. Baby Essentials and Intelligence are retained standalone pages. Captions may contain recognition errors. Filename changes alter note URLs and need a redirect decision. Source edits need no hand-maintained converted Markdown.

## Appearance and ordering correction

The user explicitly rejected the interim ivory/serif redesign. The active CSS now reuses the original white #ffffff, light gray #fbfbfb, blue #0969da, original Inter/JetBrains Mono typography, author strips, tags and copy-button treatments. The two fonts are self-hosted with their OFL licenses; no runtime font CDN is required. The original site title is restored exactly: Marino's Podcast Notes.

The homepage contains all 113 articles under authors in the exact old sidebar sequence, with source icons and stars. No pagination breaks the author groups. The original Liquid rule is author ascending, five-star items first, then other items; each subset is date descending with the original reversed tie order. `site/library-order.json` records the original 113 navigation metadata records. Existing items retain that familiar order; new filenames not in the snapshot use their own leading metadata under the same author/rating/date rule. This file controls navigation only, not editable note text or displayed metadata.

Menu opens an optional left drawer containing the full author/article sequence, a search field and every tag. It is collapsed by default; desktop preference survives page navigation. Phone navigation uses an accessible modal overlay. Each note shows its supplied source-type icon, author, date, rating and rendered-body word count. Four matching controls copy/download readable text or original Markdown; Read transcript is the last, blue control where captions exist. The source URL remains in metadata. Supplied types, including Dan Carlin's book values, remain unchanged.

An apparent rating mismatch was traced to a parser issue, not stale source evidence: Samo Burja's Mass Immigration note has duplicate leading-header keys, Rating:3 followed by Rating:5 before the Date/Source fields and separator. The earlier parser chose the last occurrence; the legacy processor chose the first. Metadata now uses first-occurrence semantics within the leading block. Metadata-like text in the actual body remains visible. Original files are unchanged. A regression independently compares the homepage sequence against preserved legacy metadata.

The local preview is http://127.0.0.1:4175/podcasts/. It reuses only a matching project owner and has a 120-minute idle timeout. Real page/asset/source requests, trusted browser interactions (event driven, at most once per minute), and actual source changes extend it. Health polling and unchanged watcher polls do not. `http://127.0.0.1:4175/__podcast_preview` reports PID and expiry without extending the lifetime. Stop with `node scripts/serve.mjs --stop`; PREVIEW_IDLE_MINUTES overrides the default for tests. The idle/reuse regression verifies activity, ignored health polling, owner reuse and automatic exit. The final review preview is intentionally left running.

At the corrected local handoff, the tracked preview owner is Node PID 17040. That PID is a receipt, not a hardcoded launcher target; use the owner-checked stop command. Reopen with Open Notes.cmd or npm run dev after idle exit.

## Corrected publication receipt

The corrected appearance/navigation was pushed as 783794a36d5224c455b6a083f7591673a91b3333. Publish Notes run 43594887127 completed successfully; the public build.json confirmed that source commit. The actual public https://marinolinic.github.io/podcasts/ then passed the complete desktop and phone review, including exact full drawer ordering, displayed word count equal to rendered-body words, byte-for-byte original Markdown downloads, readable-text downloads and both copy actions. All eleven Node tests and the generated-page/link checks passed in Actions. All 475 preserved originals, including source notes, were rechecked locally against their initial hashes.

Current public-site screenshots and checks are in agent-files/trash/project-reviews/podcasts/20261114-appearance/published-complete/. The inspected handoff bundle is agent-files/trash/project-reviews/podcasts/20261114T122847-a30c59f7/. README embeds the matching local captures of the same corrected source. This final documentation/QA-assertion follow-up changes no rendered site code. No owned capture or test-browser context remains open; only the idle-bounded review preview remains running.
