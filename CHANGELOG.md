# Changelog

All notable changes to the RTF Markdown Editor extension will be documented in this file.

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
- [ ] Export to PDF
- [ ] Collaborative editing
- [ ] Plugin system
- [ ] Custom themes
- [ ] Find and replace
- [ ] Word count
- [ ] Spelling & grammar checker
- [ ] More table editing options
- [ ] Embedded video/audio support
