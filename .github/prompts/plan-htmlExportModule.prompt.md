# Plan: Add HTML Export Shared Module

## Objective
Create a shared module that exports the exact HTML representation of a markdown file as displayed in the editor. Integrate this module into both the VS Code extension and browser extension.

## Overview
- Create a shared HTML export module that packages the rendering pipeline (markdown → HTML + mermaid sources + KaTeX rendering) into reusable functions.
- Integrate into VS Code extension via command and webview export button.
- Integrate into browser extension via export button that writes to file or clipboard.
- Ensure styling consistency by bundling editor CSS and KaTeX styles into exported HTML.
- Handle mermaid/math rendering with pre-rendering options.

## Implementation Steps

### 1. Create Shared HTML Export Module
**File**: `src/utils/htmlExporter.ts`

**Exports**:
- `exportToHTML(markdown: string, options?: ExportOptions): Promise<string>` - Convert markdown to standalone HTML
- `ExportOptions` interface:
  - `includeStyles: boolean` - Include CSS in output (default: true)
  - `includeScripts: boolean` - Include KaTeX/Mermaid JS (default: true)
  - `preRenderMermaid: boolean` - Render mermaid as SVG (default: true)
  - `preRenderMath: boolean` - Render KaTeX as HTML (default: true)
  - `standalone: boolean` - Generate complete HTML document (default: true)
  - `title?: string` - HTML document title
  - `rtl?: boolean` - Enable RTL mode

**Key Logic**:
1. Leverage existing `markdownToHTML()` function from `src/utils/markdownProcessor.ts`
2. Extract mermaid sources during conversion
3. Apply editor CSS from `media/editor.css`
4. Bundle KaTeX CSS for math rendering
5. Optionally embed Mermaid.js and KaTeX.js libraries
6. Return complete HTML string or Document

### 2. Integrate into VS Code Extension

**File**: `src/extension.ts`
- Register new command: `"mdWORD.exportHTML"` - Export current document as HTML file
- Add handler that:
  - Gets active editor document
  - Calls `exportToHTML()` with appropriate options
  - Prompts user for save location
  - Writes to disk

**File**: `src/editors/MarkdownWordEditorProvider.ts`
- Add "Export as HTML" button to toolbar (or menu)
- Send message from webview: `{ type: 'exportHTML', options: {...} }`
- Handle in extension, write file, show success notification

### 3. Integrate into Browser Extension

**File**: `browser-extension/editor/editor.ts`
- Add "Export as HTML" button to toolbar
- Trigger export via shared `htmlExporter.ts` module
- Options for:
  - Download as HTML file
  - Copy HTML to clipboard
  - Open in new tab

**File**: `browser-extension/editor/editor.html`
- Add export button to editor UI

### 4. Ensure Styling Consistency

**Approach**:
- Bundle `media/editor.css` into exported HTML
- Include KaTeX CSS (`media/katex.css`)
- Use CSS custom properties that match VS Code theme variables (provide defaults)
- Ensure RTL styles are included when needed
- Make exported HTML visually identical to editor display

**CSS Handling**:
- Option 1: Inline all CSS in `<style>` tag
- Option 2: Generate `<link>` tags for external stylesheets
- Recommend Option 1 (inline) for standalone HTML portability

### 5. Handle Mermaid & Math Rendering

**Mermaid**:
- Option A: Pre-render to SVG using Mermaid Node.js API (server-side)
- Option B: Include Mermaid.js library in HTML, render client-side
- Option C: Keep as mermaid code blocks for later rendering
- Recommend Option B for simplicity (user can open in browser and it works)

**KaTeX**:
- Option A: Pre-render to HTML/SVG using KaTeX Node.js API
- Option B: Include KaTeX.js library in HTML, render client-side
- Option C: Keep as math expressions
- Recommend Option A for email/document sharing (pre-rendered math looks good everywhere)

### 6. File Paths & Structure

```
src/
├── utils/
│   ├── markdownProcessor.ts (existing)
│   ├── htmlProcessor.ts (existing)
│   ├── htmlExporter.ts (NEW) ← Main export module
│   └── ...
├── editors/
│   └── MarkdownWordEditorProvider.ts (update with export handler)
└── ...

browser-extension/
├── editor/
│   ├── editor.ts (update with export button logic)
│   ├── editor.html (update with export button)
│   └── ...
├── shared/
│   └── htmlExporter.ts (symlink or copy of src/utils/htmlExporter.ts)
└── ...
```

## Export Format Considerations

### Option 1: Standalone HTML File (RECOMMENDED)
- Complete HTML document with embedded CSS and images
- Self-contained, works offline
- Can be emailed, shared, printed
- Larger file size

### Option 2: HTML with External References
- Smaller file size
- Requires CSS/JS files to be present
- Good for web serving
- Less portable

### Option 3: Clipboard Export
- Copy formatted HTML to clipboard
- Paste into Word, Google Docs, Notion, etc.
- No file creation
- Useful for quick sharing

## Implementation Priority

1. **Phase 1**: Create `htmlExporter.ts` with basic HTML export
2. **Phase 2**: Add VS Code extension command + UI button
3. **Phase 3**: Add browser extension export button
4. **Phase 4**: Add advanced options (pre-render math, SVG mermaid, etc.)
5. **Phase 5**: Add clipboard export option

## Success Criteria

- [ ] HTML export matches editor display exactly
- [ ] Exported HTML works offline (all assets embedded)
- [ ] Math and mermaid diagrams render correctly in exported HTML
- [ ] RTL content exports correctly
- [ ] Images are properly embedded or linked
- [ ] VS Code command works and shows file save dialog
- [ ] Browser extension export writes file or copies to clipboard
- [ ] Both extensions show export success/error notifications
- [ ] No external network calls required for export
- [ ] File size is reasonable (< 5MB for typical document)

## Technical Notes

- Leverage existing `markdownToHTML()` for consistency
- Use existing mermaid extraction logic
- Apply CSS from `media/editor.css` unchanged
- Consider charset handling (RFC 7763) if exporting full document
- Handle relative image paths by converting to data URLs or absolute paths
- Ensure CSP compliance if embedding scripts

## Dependencies Required

- Mermaid.js library (already bundled)
- KaTeX library (already bundled)
- markdown-it (already in dependencies)
- If pre-rendering: mermaid Node.js API, KaTeX npm package

## Browser Compatibility

- Modern browsers only (ES2020+)
- Tested on: Chrome, Firefox, Edge (recent versions)
- Print-to-PDF should work from any browser

## Questions for Refinement

1. Should pre-rendering of math/mermaid be automatic or user-selectable?
2. Should exported HTML include a "generated by RTF Markdown Editor" footer/comment?
3. Should we preserve document metadata (author, creation date, etc.)?
4. Should we support batch export of multiple markdown files?
5. Should we add export to other formats (PDF, DOCX) in future?
