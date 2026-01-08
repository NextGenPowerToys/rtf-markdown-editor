# Changelog

All notable changes to the RTF Markdown Editor extension will be documented in this file.

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
- **Azure DevOps Mermaid** — `:::: mermaid` block support
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
- [ ] Export to PDF
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] Custom themes
- [ ] Find and replace
- [ ] Word count
- [ ] Spelling & grammar checker
- [ ] More table editing options
- [ ] Embedded video/audio support
