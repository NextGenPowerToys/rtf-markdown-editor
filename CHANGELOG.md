# Changelog

All notable changes to the RTF Markdown Editor extension will be documented in this file.

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
- [ ] Export to PDF
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] Custom themes
- [ ] Find and replace
- [ ] Word count
- [ ] Spelling & grammar checker
- [ ] More table editing options
- [ ] Embedded video/audio support
