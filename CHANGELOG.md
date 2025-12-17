# Changelog

All notable changes to the RTF Markdown Editor extension will be documented in this file.

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
- [ ] Export to PDF/HTML
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] Custom themes
- [ ] Find and replace
- [ ] Word count
- [ ] Spelling & grammar checker
- [ ] More table editing options
- [ ] Embedded video/audio support
