# Changelog

All notable changes to the RTF Markdown Editor extension will be documented in this file.

## [3.2.3] - 2026-05-25

> Build refresh tested against **Mermaid NG — Visual Editor 2.5.0**, which brings a per-node green **"+"** button → 4-shape picker (one-click flow building), multi-line labels with `\n` encoding across every object type, and a default + recently-used colour palette in the edit modal. No behaviour changes in the RTF Markdown Editor itself — clicking a Mermaid diagram still hands off to the companion via `mermaidVisualEditor.openFromFile`, and users on v2.5.0+ of the companion automatically see the new editing features.

### Changed

- **Documented companion floor bump.** The "single-click hand-off to Mermaid NG" entry-point still works against any companion `≥ 2.3.0` (the version that introduced the direct-open API), but the README now points readers at **2.5.0+** so they get the new one-click flow building, multi-line labels, and colour palette out of the box. No code change in this extension — the contract with the companion is unchanged.

## [3.2.2] - 2026-05-24

> Bug-fix release. Fixes `@pdfmd convert … to markdown` failing on Windows 11 with `Setting up fake worker failed: "Only URLs with a scheme in: file, data, node, and electron are supported by the default ESM loader. … Received protocol 'c:'"`.

### Fixed

- **`@pdfmd` PDF → Markdown now works on Windows.** `pdfjs-dist`'s "fake worker" dynamically `import()`s the path assigned to `GlobalWorkerOptions.workerSrc`. On macOS/Linux a bare absolute path works; on Windows, Node's ESM loader parses `c:\…\pdf.worker.mjs` as a URL, treats `c:` as a protocol scheme, and rejects it. The resolved worker path is now converted to a proper `file://` URL via `url.pathToFileURL()` before assignment, so the loader accepts it on every platform.

## [3.2.1] - 2026-05-23

> Bug-fix release. Restores the `@pdfmd` PDF → Markdown chat participant, which has been broken since 3.0.0 with `Cannot find package 'pdfjs-dist'`.

### Fixed

- **`@pdfmd convert … to markdown` no longer fails with `Cannot find package 'pdfjs-dist'`.** Since 3.0.0 the published `.vsix` shipped without `pdfjs-dist` on disk — esbuild marks the package `--external` (its worker is loaded as a separate file, so it can't be bundled), but `.vscodeignore` was excluding all of `node_modules`. The minimum runtime files (`package.json`, `LICENSE`, `legacy/build/pdf.mjs`, `legacy/build/pdf.worker.mjs`) are now packaged. Adds ~3 MB to the VSIX; no other `node_modules` content is shipped.

## [3.2.0] - 2026-05-23

> Click a Mermaid diagram → it now opens directly in the **Mermaid NG — Visual Editor** companion extension (drag-and-drop WYSIWYG canvas) instead of the built-in source-only modal. The built-in modal is still the silent fallback when the companion isn't installed, so nothing regresses for users who don't want a second extension.

### Added

- **Single-click hand-off to Mermaid NG — Visual Editor.** Click any Mermaid diagram in the editor and the RTF host invokes `mermaidVisualEditor.openFromFile` with the diagram's source + index — the visual editor opens that specific diagram active (no thumbnail picker), with sibling diagrams from the same file available as inactive sheets. Requires the companion extension `NGPowerToys.mermaid-visual-editor` v2.3.0 or later for direct-open; older versions still work but show the thumbnail picker for multi-diagram files.
- **Silent fallback to the built-in modal.** If the companion isn't installed (or its command throws), the host bounces an `openMermaidInModal` message back to the webview and the prior source-edit modal opens immediately. No install prompt, no interrupted click.
- **Always-fresh diagram source.** The document is saved to disk before invoking the companion so the visual editor reads the latest content (it opens the file from disk via `openTextDocument(uri)`, not the in-memory webview HTML).

## [3.1.0] - 2026-05-22

> Smart per-paragraph RTL/LTR — each line now picks its own direction from its content, so a single document can mix Arabic/Hebrew/Urdu prose with English code and technical terms without forcing the whole file in one direction. Adds a manual cursor-direction toggle (button + `Ctrl/Cmd+Shift+X`) so you can choose direction in an empty paragraph *before* you start typing.

### Added

- **Smart per-block direction detection ([#4](https://github.com/NextGenPowerToys/rtf-markdown-editor/issues/4)).** Every paragraph, heading, list item, and blockquote carries its own `dir` attribute, recomputed live from the block's text content. Rule: **any RTL character in the block → `dir="rtl"`, otherwise `dir="ltr"`**. This is intentionally *not* "first strong character" (which is the long-standing Obsidian bug the issue called out): a sentence like `React ایک بہترین لائبریری ہے` now correctly renders RTL even though it starts with a Latin word. Pure-English paragraphs and code blocks stay LTR even inside RTL documents — so you can finally paste a ChatGPT/Gemini response with mixed Urdu explanations + English code snippets and have each line keep its correct direction.
- **Manual cursor-direction toggle.** New "Cursor direction" toolbar button (next to the existing global RTL button) and a keyboard shortcut **`Ctrl+Shift+X`** / **`Cmd+Shift+X`**. Cycles the block under the caret through three states: `auto` → `LTR (manual)` → `RTL (manual)` → `auto`. Manually-pinned blocks get a subtle blue tick at the margin and are skipped by the auto-detector, so the choice survives subsequent edits. Lets you pick a direction in an empty paragraph *before* the first character lands — the long-missing piece for comfortable mixed-language writing.
- **Smart paste preserves per-line direction.** Pasted content from AI chats (ChatGPT, Gemini, Claude) and other mixed-direction sources is re-evaluated paragraph by paragraph immediately after paste — no manual fix-up required.

### Notes

- The `dir` attribute is webview-only. The HTML→Markdown converter strips it on save, so saved Markdown files stay clean (no `<p dir="rtl">` clutter) and direction is re-derived from content on reload.
- The existing global RTL toggle is unchanged and remains available; per-block detection runs alongside it and fine-tunes individual blocks (so English paragraphs no longer get force-aligned right inside a globally-RTL document).

## [3.0.0] - 2026-05-22

> Major release. PDF → Markdown is now AI-driven via GitHub Copilot Chat; a new **Documents** side panel surfaces every `.md` / `.pdf` / `.docx` / `.html` in the workspace with one-click open / convert; HTML → Markdown import is added; the editor title bar gains an "Edit with RTF Markdown Editor" quick action; per-keystroke autosave is replaced with event-driven save to eliminate image flicker; minimum VS Code engine raised to 1.93.0.

### Changed

- **PDF → Markdown is now AI-driven via GitHub Copilot Chat.** The previous in-process heuristic pipeline produced uneven results on RTL documents, tables, and pages with embedded diagrams. The new flow uses a bundled PDF processing **skill** plus GitHub Copilot Chat's language models to produce the final Markdown.
  - The Explorer context menu entry for `.pdf` files is renamed to **"Convert PDF to Markdown (via GitHub Copilot Chat)"** and only shows when GitHub Copilot (Chat) is installed.
  - Clicking it opens a confirmation modal, then opens chat with the new `@pdfmd` chat participant pre-invoked.
  - The chat participant: (1) extracts text + positions from the PDF locally with pdfjs-dist, (2) splits the document into page-aligned chunks (no more 60K-char truncation — every page is sent), (3) passes each chunk to the LM with the bundled skill as authoritative guidance, (4) concatenates the streamed responses, (5) writes the Markdown to `<pdfBaseName>.md` next to the source PDF, (6) opens the result in the RTF Markdown editor.
  - Chat surface is **status-only**: progress messages while converting, a single final "Saved Markdown to …" link. The document body is no longer echoed into chat.
- **Supports Unicode/Hebrew paths.** The menu command wraps the PDF path in backticks before stuffing it into the chat query, and the participant's path extractor accepts backtick-wrapped, double-quoted, and bare paths containing spaces, Hebrew, CJK, and other non-ASCII characters.

### Added

- **`resources/skills/pdf/SKILL.md`** ships with the extension (copied from `.agents/skills/pdf/` at build time via the new `copy:skill` script). The chat participant loads it on every invocation.
- **`@pdfmd` chat participant** — registered via the VS Code Chat Participant API. Can be invoked directly from chat: `@pdfmd convert /path/to/file.pdf to markdown`.
- **`onStartupFinished` activation event** so the `aiChatAvailable` context key is published in time for the Explorer context menu's `when` clause.
- **Diagram / image extraction in the AI-driven flow.** Images embedded in the source PDF (architecture diagrams, sequence diagrams, charts, illustrations…) are now extracted locally, saved as PNGs to `<mdDir>/.attachments/.<pdfBaseName>/image_<N>.png` next to the output Markdown, and referenced in the final document with real `![](.attachments/…)` markdown links. The chat prompt injects `[IMAGE: <relative_path>]` marker lines per page so the model places the image references at the right structural position. Mirrors the existing DOCX-import attachment convention byte-for-byte, so attachments behave identically across DOCX and PDF imports. Pages that have no extractable text *and* no image still emit `*(diagram)*` as a placeholder.
- **Activity Bar side panel: "Documents".** A new RTFMD icon on the VS Code Activity Bar opens a side view that lists every supported document in the open workspace — `.md` / `.markdown` for direct editing, `.pdf` / `.docx` / `.html` / `.htm` for one-click conversion to Markdown. Each entry has a type-specific icon (markdown, file-pdf, file-text, symbol-misc), a `… → MD` description label for non-Markdown formats, and a single-click action: Markdown files open straight in the RTF Markdown editor; PDF / DOCX / HTML files invoke their conversion command and the resulting `.md` is saved alongside the source and opened. A `FileSystemWatcher` keeps the tree in sync with creates / deletes / renames; a `Rescan Workspace` button on the view's title-bar forces a refresh. Layout mirrors the pattern used by Mermaid Live Editor (single workspace folder surfaces its children at the top; multiple folders list each as a collapsible group).
- **HTML → Markdown import.** New `rtf-markdown-editor.importHTML` command (also reachable via right-click on `.html` / `.htm` in the Explorer). Reads the file locally and runs it through the same turndown-based converter the rest of the extension uses (including the GFM-table rule), saves the result alongside the source as a sibling `.md`, and opens it in the RTF Markdown editor.
- **Editor title-bar quick action.** When a `.md` / `.markdown` file is open in any non-RTF editor (default text editor or another custom editor), the RTFMD icon now appears in the top-right of the editor title bar. Clicking it switches the file into the RTF Markdown editor. Hidden when the file is already in the RTF editor.
- **Robust `openEditor` argument handling.** The command now accepts every shape VS Code passes for the target file — raw `Uri`, plain string path, tab-input objects with `uri` / `resource` / `fsPath` fields — and falls back to the active text editor or any active tab in any tab group. Eliminates the "select a Markdown file first" toast when the title-bar button is invoked on a custom-editor host.

### Fixed

- **pdfjs-dist worker resolution in the extension host.** `extractPdfText` now sets `GlobalWorkerOptions.workerSrc` by probing for `pdf.worker.mjs` via `require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')` and several relative paths from `dist/extension.js`. Without this, the host's Node runtime threw `No GlobalWorkerOptions.workerSrc specified` on every conversion.
- **Image flicker while typing in markdown files containing embedded images.** Autosave was running on every keystroke; the resulting disk write echoed back through the `FileSystemWatcher` as an `externalUpdate`, which rebuilt the whole ProseMirror document and re-fetched every `<img>` DOM node. Two-part fix: (1) the watcher now drops events that occur within a short window after our own write so the self-echo can never round-trip back to the webview; (2) per-keystroke autosave is removed entirely — content is persisted only when the editor blurs, the webview tab is hidden, or the panel is closing (`visibilitychange` / `pagehide` / `beforeunload`). Result: images stay rock-steady through editing.
- **Toolbar buttons stealing the editor's caret position.** Clicking the bullet / numbered-list (and other toolbar buttons) used to drop the caret onto the next row — the button was stealing focus on `mousedown`, ProseMirror clamped the now-orphan selection, and `chain().focus()` couldn't restore it. The toolbar now `preventDefault`s `mousedown` on every `.toolbar-btn`, so the editor's selection is preserved across the click and toggle commands land on the line the caret was actually on.

### Removed

- The in-process heuristic PDF → Markdown pipeline is no longer wired into the menu command. Files remain in the tree (`src/utils/pdfImporter.ts`, `src/utils/pdfocr/*`) for now but are unused; they can be deleted in a follow-up.
- The `Extract text from PDF to Markdown` command title is replaced by `Convert PDF to Markdown (via GitHub Copilot Chat)`.

### Engine

- Minimum VS Code engine bumped from **1.85.0** to **1.93.0** to access the finalized Chat Participant API.

## [2.5.4] - 2026-05-22

### Added

- **PDF Import: Image Extraction** — Images embedded in PDF files are now extracted during PDF-to-Markdown conversion, matching the existing DOCX import behavior. Images are saved to `.attachments/.{filename}/` alongside the output Markdown file and referenced with relative paths. Uses pdfjs-dist operator list to detect `paintImageXObject` operations, extracts raw pixel data, and converts to PNG via the canvas package. Supports RGB, RGBA, and grayscale image formats. Small images (< 50px) are filtered out automatically.

### Fixed

- **Horizontal Rules and Blank Lines Corrupted on Save** ([#1](https://github.com/NextGenPowerToys/rtf-markdown-editor/issues/1)) — Fixed a critical data-loss bug in the HTML→Markdown autosave path. The serializer had no rule for `<hr>` tags, so the generic catch-all regex stripped them entirely, destroying `---` horizontal rules in source files. The same path also converted `</p>` to a single `\n` instead of `\n\n`, collapsing adjacent paragraphs into a single block and stripping visual spacing. Now: `<hr>` round-trips correctly as `\n\n---\n\n`, paragraphs are separated by proper blank lines, and empty paragraphs are preserved using a zero-width-space marker so vertical spacing survives autosave.

- **PDF Export: Images Overflowing Page Boundaries** — Large images in exported PDFs now scale down to fit within a single page. Added `max-height: 240mm` and `object-fit: contain` to print CSS, ensuring tall diagrams and screenshots don't span across multiple pages.

## [2.5.3] - 2026-05-21

### Changed

- **Open Editor Command** — `rtf-markdown-editor.openEditor` now falls back to the currently active editor when invoked without a resource argument, and validates that the target is a Markdown file before attempting to open it (previously failed silently).

## [2.5.2] - 2026-03-29

### Fixed

- **Build — Missing esbuild Externals** — Added `--external:puppeteer-core --external:adm-zip --external:turndown --external:mammoth` to the esbuild command, fixing "Could not resolve" build errors.

## [2.5.0] - 2026-03-29

### Fixed

- **RTL Detection Overhaul** — Fixed multiple interacting bugs that caused inconsistent RTL behavior
  - Fixed missing `break` in message handler switch statement (`setContent` fell through into `setConfig`, re-applying config and resetting RTL state)
  - Changed hardcoded `dir="rtl"` in standalone HTML and `dir="ltr"` in webview template to `dir="auto"`, eliminating brief direction flash on load
  - Fixed RTL auto-detection threshold inconsistency: editor used "any RTL character" while backend used 30% density — now both use the same threshold
  - RTL detection now strips fenced code blocks before counting, preventing code-heavy documents from diluting the RTL character ratio below the threshold
  - Lowered RTL detection threshold from 30% to 10% for better sensitivity with mixed-language documents
  - All export paths (HTML, DOCX, PDF) now pass explicit `rtl` flag based on content analysis, instead of relying on fallback auto-detection buried inside exporters

- **PDF Export — Chrome/Edge Detection** — `findChrome()` now detects Microsoft Edge in addition to Chrome/Chromium on Windows, macOS, and Linux, fixing "Chrome not installed" error on machines with only Edge

- **PDF Export — Metadata Not Visible** — PDF metadata marker changed from an HTML comment (which Chrome's PDF engine rendered as visible text) to a hidden `<div>` with base64-encoded content, keeping it invisible in the PDF while preserving lossless round-trip import. Backward-compatible with PDFs exported by older versions.

- **DOCX Import — Relative Image Paths** — Fixed `file://` URL handling in image path conversion: replaced manual `src.slice(7)` with `fileURLToPath()` which correctly handles the leading `/` on Windows paths and decodes percent-encoded characters (e.g., Hebrew filenames)

### Changed

- **PDF Import Renamed** — Command renamed from "Convert PDF to Markdown" to "Extract text from PDF to Markdown" to better reflect that this is a text extraction tool, not a visual format converter
- **PDF Import — Removed Image Extraction** — Removed the non-functional image extraction step from PDF import; the command now focuses on text content extraction (re-introduced in 2.5.4 with a working implementation)

## [2.3.0] - 2026-02-25

### Changed

- **RTL Detection Simplified** — Removed the "first 5 lines must contain 2+ RTL words" precondition from RTL auto-detection. Detection now uses a single rule: if ≥ 30% of non-whitespace characters are RTL (Hebrew, Arabic, Syriac, etc.), the document is treated as RTL. This fixes documents where RTL content doesn't appear in the first few lines being incorrectly displayed as LTR.

- **Import Messaging Clarified** — README and feature descriptions now clearly state that Word (DOCX) and PDF import are **content extraction tools** designed for downstream AI analysis, search indexing, and content migration — not pixel-perfect format converters. The goal is to capture the textual substance and document structure, not reproduce the exact visual layout of the source.

## [2.2.0] - 2026-02-24

### Added

- **Import from PDF (PDF → Markdown)** — Advanced OCR-based PDF conversion with structure detection
  - Right-click any `.pdf` file in Explorer → **"Convert PDF to Markdown"**
  - Command Palette: `RTF Markdown: Convert PDF to Markdown`
  - Integrated PDFOCR engine with full Hebrew/RTL support
  - **pdfjs-dist v4** text extraction with position data, font metadata, and bold/italic detection
  - **Multi-pass OCR** via Tesseract.js: Hebrew+English with Latin misread correction
  - **Inverted text detection**: automatically detects and re-OCRs dark-background text regions
  - **Smart structure analysis**: detects headers (font size, bold, Hebrew patterns), tables (column alignment), lists (numbered, Hebrew letters), and paragraphs
  - **Cross-page table merging**: tables split across page breaks are automatically reassembled
  - **Hybrid mode**: fast text extraction first, OCR fallback only for pages with broken font encodings
  - **Lossless round-trip**: PDFs exported by this extension embed metadata for near-perfect re-import
  - **Graceful fallback**: if the advanced pipeline fails, falls back to basic pdf-parse + heuristics

- **Export to PDF** — One-click Markdown to PDF conversion
  - Right-click context menu or Command Palette
  - Chrome/Chromium headless rendering for high-quality output
  - Mermaid diagrams pre-rendered as PNG images
  - RTL direction preserved in PDF layout
  - Embeds Markdown structure metadata for lossless re-import

### Changed

- **Upgraded pdfjs-dist** from v3 to v4 for better text extraction with coordinate data
- **Added canvas dependency** for OCR image manipulation (inverted text correction, fallback page rendering)
- **PDF import pipeline replaced** — the previous basic pipeline (pdf-parse + Puppeteer OCR) is now replaced by the PDFOCR engine with significantly better structure detection, table handling, and Hebrew support

### Note

- **Import from Word and PDF are limited** — these are best-effort conversions. PDF is a visual format and does not store semantic structure; Word documents may use formatting features that don't map to Markdown. See README for detailed limitations.

## [2.1.0] - 2026-02-19

### Changed

- **Auto-Open After Export/Import** — Converted files now open immediately without requiring a click
  - **Convert to Word (DOCX)** — the exported `.docx` opens automatically in Microsoft Word (or the system default for `.docx`)
  - **Convert to Web Archive (HTML)** — the exported `.html` opens automatically in the default browser
  - **Convert to Markdown** — the resulting `.md` file opens automatically in the RTF Markdown Editor

## [2.0.2] - 2026-02-19

### Added

- **Context Menu for Markdown Files** — Right-click any `.md` file in the Explorer for quick conversions
  - **Edit with RTF Markdown Editor** — open in the WYSIWYG editor
  - **Convert to Word (DOCX)** — export directly from the context menu
  - **Convert to Web Archive (HTML)** — export directly from the context menu

- **Context Menu for Word Files** — Right-click any `.docx` file
  - **Convert to Markdown** — import directly from the context menu

### Changed

- **Unified Export Pipeline** — Context menu export commands now use the exact same pipeline as the editor toolbar buttons
  - Uses live in-memory editor content (not the saved file on disk)
  - Mermaid diagrams rendered via the already-open editor webview
  - If the file is not yet open, the editor opens automatically in the background (`preserveFocus`) and the export triggers once the webview is ready

- **Cleaner Command Names** in Command Palette and context menus:
  - `RTF Markdown: Convert to Word (DOCX)` (was "Export as Word Document (DOCX)")
  - `RTF Markdown: Convert to Web Archive (HTML)` (was "Export Self-Contained HTML (Embed Images)")
  - `RTF Markdown: Convert to Markdown` (was "Import Word Document as Markdown (DOCX → MD)")

## [2.0.1] - 2026-02-19

### Fixed

- **Import from Word — Bullet Lists** — Bullet points now import correctly from standard Word documents
  - Word's "List Paragraph" style causes mammoth to wrap `<li>` content in `<p>` tags with surrounding whitespace, producing a lone `"-"` marker on its own line followed by a blank line and then the text
  - Fixed by a post-processing pass in `htmlToMarkdown()` that merges an isolated bullet marker back onto its content line
  - Affected: all bullet/unordered list items in `.docx` files converted via the mammoth path (standard Word documents)

## [2.0.0] - 2026-02-19

### Added

- **Import from Word (DOCX → MD)** — Full round-trip: export to Word and import back to Markdown
  - Right-click any `.docx` file in Explorer → **"Import Word Document as Markdown (DOCX → MD)"**
  - Command Palette: `RTF Markdown: Import Word Document as Markdown (DOCX → MD)`
  - Opens the resulting `.md` file directly in the RTF Markdown Editor
  - Works with both extension-generated DOCX and standard Word documents

- **Full Content Preservation on Import** — All content extracted, nothing dropped
  - Text, headings, tables, code blocks, blockquotes — full fidelity
  - Mermaid diagrams extracted from `word/media/` and saved as `.png` files
  - Local images (JPG, PNG, GIF, WebP, BMP, TIFF) embedded as data URIs in the DOCX are extracted and saved as real image files in `.attachments/.<name>/`
  - Image references in the resulting `.md` use correct relative paths

- **Dual-Path DOCX Import Engine**
  - **Extension-generated DOCX**: altChunk-aware path — reads `word/document.xml` for document order, extracts HTML from `afchunk_N.htm` ZIP entries, preserves interleaved text + image sequence
  - **Standard Word DOCX**: mammoth-based path — full HTML conversion with image extraction to `.attachments/`
  - Auto-detection: presence of `afchunk_0.htm` in the ZIP distinguishes the two formats

- **Real-Time Editor Refresh** — Editor now correctly reflects external file changes
  - Fixed `externalUpdate` message: content is now converted to HTML before being sent to the webview
  - Image paths resolved to webview URIs for correct display after external edits

### Implementation Details

- **`src/utils/docxImporter.ts`** — New file implementing the full DOCX→MD pipeline
  - `importFromDOCX()` — public entry point, auto-detects DOCX type
  - `importFromExtensionDocx()` — altChunk path using `adm-zip` for ZIP reading
  - `importFromStandardDocx()` — mammoth path for standard Word documents
  - `saveDataUriImages()` — extracts base64-embedded images to `.attachments/`, replaces with `file://` URIs
  - `parseDocumentSequence()` — scans `document.xml` for ordered altChunk + image blip references
  - `parseRels()` — parses `word/_rels/document.xml.rels` into a relId→path map
- **`src/extension.ts`** — Added `importDOCX` command registration
- **`src/editors/MarkdownWordEditorProvider.ts`** — Fixed `externalUpdate` webview message

## [1.2.0] - 2026-02-18

### Added

- **Export to Word (DOCX)** — One-click export of Markdown documents to `.docx` format
  - Toolbar button (W document icon) for quick export from the editor
  - Command Palette: `RTF Markdown: Export as Word Document (DOCX)`
  - Opens natively in Microsoft Word, LibreOffice, and Google Docs
  - No external libraries — built entirely with Node.js built-ins

- **Mermaid Diagrams in DOCX** — Diagrams are exported as real embedded PNG images
  - Stored as proper OOXML image parts (`word/media/mermaid_N.png`)
  - Referenced via `<w:drawing>/<wp:inline>/<pic:pic>` elements — never blank boxes
  - Proportional scaling to fit page width (capped at 16.5 cm / ~6.5 inches)
  - PNG dimensions parsed directly from binary header (no library needed)

- **RTL Support in DOCX** — Full right-to-left document support matching HTML export
  - Auto-detects Hebrew/Arabic content using the same `RTLService` as HTML export
  - Sets `<w:bidi/>` in `<w:sectPr>` for document-level RTL direction in Word
  - Each `altChunk` HTML segment gets `<html dir="rtl">` so CSS RTL rules apply
  - RTL can be overridden explicitly via the `rtl` option in `DocxExportOptions`

### Technical

- **`src/utils/docxExporter.ts`** — New file implementing the full DOCX pipeline:
  - `splitAtMermaidDivs()` — splits generated HTML at `data-mdwe="mermaid-rendered"` boundaries
  - `wrapAsHtml()` — wraps text segments as standalone HTML documents for `altChunk`
  - `drawingXml()` — generates complete OOXML inline-image XML per Mermaid PNG
  - `buildDocumentXml()` — interleaves `<w:altChunk>` (text) and `<w:drawing>` (images)
  - Fast path for documents without Mermaid diagrams (single altChunk)
- **`src/utils/zipWriter.ts`** — Minimal ZIP builder (DEFLATE via `zlib`, manual CRC-32)
- **`media/editor.ts`** — DOCX export toolbar button added to the RTL/export group

## [1.1.5] - 2026-02-02

### Changed

- **Offline Export is Now Default** — HTML export now ALWAYS pre-renders diagrams and math
  - Removed CDN dependency from all export modes
  - All exports are fully offline-capable
  - Pre-rendering now happens by default (not optional)
  - `preRenderMermaid` and `preRenderMath` default to `true`

- **Removed `includeScripts` Option** — No longer needed
  - All exports are offline-first
  - Script tags replaced with offline comments
  - No CDN links in exported HTML

### Fixed

- **Export HTML Always Offline** — Eliminated CDN dependency
  - Diagrams pre-rendered to SVG during export
  - Math formulas pre-rendered to HTML
  - No external library calls needed
  - Exported files work in disconnected environments

### Compliance

✅ **FULLY OFFLINE** — No exceptions, all exports work offline
✅ **Consistent Behavior** — Same offline capability for all export presets
✅ **Zero CDN Dependency** — Extension description promise kept

## [1.1.4] - 2026-02-02

### Added

- **Offline HTML Export** — Pre-rendering support for fully offline HTML exports
  - New `ExportPresets.email()` for pre-rendered diagrams and math
  - SVG pre-rendering during export (no runtime CDN needed)
  - Complete offline capability with pre-rendered exports
  - New documentation: OFFLINE_EXPORT_GUIDE.md
  - Flexible export modes: standard (with CDN) or pre-rendered (offline)

- **Pre-rendering Functions**
  - `preRenderMermaidDiagrams()` converts diagram source to SVG
  - `replaceMermaidWithSVG()` embeds SVG in HTML
  - Fallback to source embedding if pre-rendering fails
  - Async rendering with proper error handling

### Fixed

- **Mermaid Diagram Rendering**
  - Multi-line text now displays correctly (no clipping)
  - Plain-text mode (`htmlLabels: false`) for better reliability
  - `<br/>` tags converted to newlines in diagram source
  - Improved diagram sizing and spacing
  - Better handling of complex flowchart diagrams

- **HTML Export**
  - Better script initialization and error handling
  - Improved CDN fallback messaging
  - Added proper KaTeX rendering scripts
  - Enhanced export flexibility with multiple presets

### Changed

- Updated package.json version: 1.1.3 → 1.1.4
- Updated README.md to document offline export options
- Improved Mermaid configuration with flowchart optimization
- Enhanced documentation for HTML export functionality

### Documentation

- Added OFFLINE_EXPORT_GUIDE.md with comprehensive offline export instructions
- Updated README.md with offline export modes explanation
- Added examples for both standard and pre-rendered exports

## [1.1.3] - 2026-02-02

### Fixed

- **Mermaid Diagram Text Rendering** — Multi-line text in diagrams now displays properly
  - Changed from HTML labels mode to plain-text mode
  - Improved text wrapping and line break handling
  - Fixed component height calculation for multi-line content
  - Enhanced diagram sizing and overflow handling

- **CSS Styling** 
  - Adjusted min-height and min-width constraints for Mermaid containers
  - Fixed overflow handling for proper text visibility
  - Improved SVG rendering in both VSCode and browser extension

## [1.1.1] - 2026-01-08

### Fixed

- **Documentation** — Updated README.md and CHANGELOG.md
  - Added comprehensive Export to HTML feature documentation
  - Enhanced Code Formatting section with detailed explanation
  - Added usage instructions for HTML export
  - Clarified Mermaid diagram export support

## [1.1.0] - 2026-01-08

### Added

- **Export to HTML** — One-click export to standalone HTML files
  - Toolbar button (download icon) for quick export
  - Command Palette: "Export as HTML"
  - Fully styled output with all editor CSS included
  - Mermaid diagrams render correctly with CDN integration
  - KaTeX math formulas included
  - RTL/LTR direction preserved in exported HTML
  - Offline-ready HTML files (work after initial CDN load)
  - Complete standalone documents with embedded styles

### Fixed

- **Mermaid Export** — Fixed Mermaid diagrams not rendering in exported HTML
  - Mermaid source code now properly injected into diagram divs
  - Added `mermaid` class to diagram elements for proper rendering
  - Client-side rendering via Mermaid.js CDN
- **Code Block Alignment** — Enhanced code formatting behavior
  - All code (inline and blocks) now uses `text-align: left` with `direction: ltr`
  - Ensures proper code readability in RTL documents
  - Follows universal programming conventions
  - Prevents code syntax breaking from RTL text direction

## [0.0.1] - 2025-12-17

### Added

- **Initial Release** — Complete WYSIWYG Markdown editor for VS Code
- **RTL-First Design** — Full Hebrew/Arabic support with auto-detection
  - RTL/LTR toggle in toolbar
  - Automatic direction detection
  - Proper alignment controls for both modes
- **Rich Text Toolbar** — Comprehensive formatting options
  - Text formatting: bold, italic, underline, strikethrough, code
  - Headings: H1–H6
  - Paragraph alignment: left, center, right, justify
  - Lists: bulleted, ordered, indentation
  - Block elements: quotes, code blocks, horizontal rules
  - Colors & highlighting
  - Insert controls: links, images, tables
- **WYSIWYG Editor** — TipTap/ProseMirror-based editing
  - Full undo/redo support
  - Inline styles preserved
  - Block formatting
  - Table support
- **Azure DevOps Mermaid** — `::: mermaid` block support
  - Locally bundled Mermaid renderer
  - Click-to-edit diagrams
  - Modal editor for diagram source
  - Round-trip preservation
- **Autosave** — Automatic document saving
  - 750ms debounce on edits
  - Save on blur, tab hidden, file close
  - Content hashing to prevent unnecessary writes
  - External file change detection
- **100% Offline** — No CDN, no network calls
  - All assets bundled locally
  - Strict Content Security Policy
  - Mermaid library bundled
  - System fonts only
  - Works without internet connection
- **Markdown Round-Trip** — Preserve file format
  - HTML → Markdown conversion on save
  - Markdown → HTML conversion on open
  - No unwanted reformatting
  - Mermaid blocks preserved exactly
- **VS Code Integration**
  - Custom Editor Provider
  - Context menu command: "Edit with RTF Markdown Editor"
  - Supports Save, Save As, Revert
  - Dirty state tracking
  - File watcher for external changes

### Technical

- TypeScript source code
- esbuild bundling for extension and webview
- Strict TypeScript compiler options
- Content Security Policy enabled
- No `unsafe-eval` or external scripts

## Future Releases

- [ ] Markdown preview pane
- [x] Export to HTML *(Added in v1.1.0)*
- [x] Export to Word (DOCX) *(Added in v1.2.0)*
- [x] Import from Word (DOCX → MD) *(Added in v2.0.0)*
- [x] Export to PDF *(Added in v2.2.0)*
- [x] Import from PDF (PDF → MD) *(Added in v2.2.0)*
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] Custom themes
- [ ] Find and replace
- [ ] Word count
- [ ] Spelling & grammar checker
- [ ] More table editing options
- [ ] Embedded video/audio support
