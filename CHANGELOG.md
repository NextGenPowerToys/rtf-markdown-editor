# Changelog

All notable changes to the RTF Markdown Editor extension will be documented in this file.

## [2.5.4] - 2026-05-22

### Added

- **PDF Import: Image Extraction** — Images embedded in PDF files are now extracted during PDF-to-Markdown conversion, matching the existing DOCX import behavior. Images are saved to `.attachments/.{filename}/` alongside the output Markdown file and referenced with relative paths. Uses pdfjs-dist operator list to detect `paintImageXObject` operations, extracts raw pixel data, and converts to PNG via the canvas package. Supports RGB, RGBA, and grayscale image formats. Small images (< 50px) are filtered out automatically.

### Fixed

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
