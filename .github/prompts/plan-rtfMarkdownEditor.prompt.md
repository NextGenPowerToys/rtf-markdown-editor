# RTF Markdown Editor — Full Implementation Plan

Build a complete VS Code extension from scratch for word-like WYSIWYG markdown editing with RTL support, offline Mermaid diagrams, and autosave. All dependencies bundled locally, no CDN usage.

---

## Implementation Steps

### 1. Initialize Project Structure & Dependencies

- Create `package.json` with VS Code API, build tools (esbuild), TipTap/ProseMirror, Mermaid (bundled)
- Create `tsconfig.json`, `.gitignore`, `.vscodeignore`
- Generate `.vscode/launch.json` for debugging

### 2. Build Configuration & Tooling

- Set up esbuild config for extension & webview bundling
- Configure TypeScript for proper sourcemaps & bundling
- Add npm scripts for dev/build/package

### 3. Extension Scaffold & Custom Editor

- Implement `src/extension.ts` with extension activation & CustomEditorProvider registration
- Create `src/editors/MarkdownWordEditorProvider.ts` with file open/save/revert logic
- Handle context menu "Edit with RTF Markdown Editor" command

### 4. Markdown ↔ HTML Conversion Pipeline

- Build Markdown parser (extract Mermaid blocks, convert to HTML)
- Build HTML → Markdown serializer (preserve formatting, re-inject Mermaid)
- Ensure round-trip stability (no unwanted rewrites)

### 5. Webview UI & WYSIWYG Editor

- Create `media/editor.html` with strict CSP & offline-safe structure
- Integrate TipTap/ProseMirror for rich editing with inline styles & block formatting
- Implement `media/editor.ts` with message protocol (ready, contentChanged, requestSaveNow, etc.)
- Style with `media/editor.css` (system fonts only, RTL-ready layout)

### 6. Rich Formatting Toolbar

- Font family & size controls
- Text formatting (bold/italic/underline/strikethrough)
- Headings H1–H6 & paragraph styles
- Text color & background highlight
- Alignment controls (right/center/left/justify)
- Lists (bulleted/numbered) & indentation
- Links, images, quotes, code blocks, tables

### 7. RTL (Right-to-Left) Support

- Webview defaults to `dir="rtl"` & `text-align: right`
- Add RTL/LTR toggle in toolbar
- Auto-detect Hebrew/Arabic characters
- Ensure alignment controls work in both modes

### 8. Azure DevOps Mermaid `::::` Blocks

- Parse `:::: mermaid` syntax (extract & store in memory)
- Bundle Mermaid library locally (no CDN)
- Render diagrams in webview as uneditable placeholders
- Implement "Edit Mermaid Source" modal
- Round-trip: save back as `:::: mermaid` blocks

### 9. Autosave & Conflict Handling

- Debounce edits (750ms), hash content to skip unnecessary saves
- Autosave on blur/tab hidden/file close
- Track dirty state, mark clean after save
- Detect external file changes & prompt (Reload/Overwrite/Merge)

### 10. Security & Offline Guarantees

- Strict Content Security Policy (no eval, no external scripts/styles/fonts)
- Use `webview.asWebviewUri()` for all asset URIs
- Verify no CDN calls, no dynamic imports from network
- Test offline (network disabled)

### 11. Documentation & Polish

- Write `README.md` emphasizing 100% offline design
- Add troubleshooting & usage guide
- Create sample `.md` files with RTL & Mermaid examples

---

## Further Considerations

### Editor Library Trade-offs

TipTap offers better structure & extensibility for custom blocks (Mermaid); Quill is simpler but less flexible. **Recommend TipTap** for custom Mermaid nodes.

### Mermaid Bundling Complexity

Mermaid is large (~1.5MB). Options:
- **(A)** Bundle full Mermaid
- **(B)** Use lighter Mermaid fork
- **(C)** Lazy-load Mermaid only when `::::` blocks detected

**Recommend (A) full bundle** for reliability, or **(C) lazy-load** if size is critical.

### External File Change Detection

VS Code's `FileSystemWatcher` vs extension's internal tracking. **Recommend FileSystemWatcher** for reliability across all platforms.

---

## Project Structure (Target)

```
.
├─ package.json
├─ tsconfig.json
├─ esbuild.config.js
├─ .gitignore
├─ .vscodeignore
├─ .vscode/
│  └─ launch.json
├─ src/
│  ├─ extension.ts
│  ├─ editors/
│  │  └─ MarkdownWordEditorProvider.ts
│  ├─ utils/
│  │  ├─ markdownToHtml.ts
│  │  ├─ htmlToMarkdown.ts
│  │  └─ mermaidProcessor.ts
│  └─ types/
│     └─ index.ts
├─ media/
│  ├─ editor.html
│  ├─ editor.ts
│  └─ editor.css
├─ README.md
└─ CHANGELOG.md
```

---

## Key Constraints & Requirements

✅ **MUST:** 100% offline (no CDN, no network calls)
✅ **MUST:** RTL-first design (Hebrew/Arabic priority)
✅ **MUST:** Azure DevOps `:::: mermaid` syntax only
✅ **MUST:** Autosave 750ms debounce
✅ **MUST:** Preserve Markdown round-trip (no unwanted rewrites)
✅ **MUST:** Strict CSP, no eval, all assets bundled locally

❌ **NOT:** Cloud services, AI, backend server
