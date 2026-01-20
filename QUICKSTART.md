# Quick Start Guide — RTF Markdown Editor

## 5-Minute Setup

### 1. Install Dependencies (1 min)
```bash
cd rtf-markdown-editor
npm install
```

### 2. Build (30 sec)
```bash
npm run build
```

### 3. Debug (F5)
Press **F5** in VS Code to launch the debug session with the extension running.

### 4. Test
1. In the debug window (new VS Code instance):
2. Create or open a `.md` file
3. Right-click → "Edit with RTF Markdown Editor"
4. Start editing!

---

## Commands Reference

### Development
- `npm run build` — Full build (extension + webview)
- `npm run esbuild` — Build extension only
- `npm run build:webview` — Build webview only
- `npm run watch` — Watch mode (rebuild on changes)
- `npm run compile` — TypeScript check only
- `npm run lint` — ESLint check

### Testing
- `npm run test` — Run tests (configure in package.json)
- **F5 in VS Code** — Launch debug session

### Distribution
- `npm run vscode:prepublish` — Production build (minified)
- `vsce package` — Create .vsix file (install vsce first)
- `vsce publish` — Publish to VS Code Marketplace

---

## File Locations Reference

| What | Where |
|------|-------|
| Extension source | `src/extension.ts` |
| Custom editor | `src/editors/MarkdownWordEditorProvider.ts` |
| Utilities | `src/utils/` |
| Webview HTML | `media/editor.html` |
| Webview CSS | `media/editor.css` |
| Webview logic | `media/editor.ts` |
| Built files | `dist/`, `media/*.bundle.js` |
| Dependencies | `node_modules/` |

---

## Key Features Checklist

Quick reference for what's implemented:

- [x] **WYSIWYG editing** — Word-like interface
- [x] **RTL support** — Hebrew/Arabic with auto-detection
- [x] **Rich toolbar** — All common formatting tools
- [x] **Mermaid diagrams** — `::: mermaid` syntax, click-to-edit
- [x] **Autosave** — 750ms debounce
- [x] **100% offline** — No CDN, fully bundled
- [x] **Security** — Strict CSP, no eval
- [x] **Markdown round-trip** — Preserves format on save

---

## Troubleshooting Quick Links

| Problem | Solution |
|---------|----------|
| Extension doesn't show in debug | Check that build completed: `npm run build` |
| TypeScript errors | Run: `npm run compile` |
| Dependencies missing | Run: `npm install` |
| Webview blank | Check browser console (Ctrl+Shift+I in webview) |
| Changes not showing | Make sure you're in watch mode: `npm run watch` |

---

## Testing Checklist

Before considering the extension "done," verify:

- [ ] Can open `.md` file with context menu
- [ ] Can edit text in WYSIWYG editor
- [ ] Toolbar buttons work (bold, italic, etc.)
- [ ] Can toggle RTL mode
- [ ] Can create Mermaid diagram
- [ ] Can edit Mermaid diagram
- [ ] Document autosaves (check file modified time)
- [ ] Can reload file without losing changes
- [ ] Works offline (disable network)

---

## Next: Package for Marketplace

When ready to publish to VS Code Marketplace:

1. **Install vsce**:
   ```bash
   npm install -g vsce
   ```

2. **Create VSIX**:
   ```bash
   npm run vscode:prepublish
   vsce package
   ```

3. **Get publisher token** from [VS Code Marketplace dashboard](https://marketplace.visualstudio.com/manage)

4. **Publish**:
   ```bash
   vsce publish
   ```

---

## Support

- **Issues**: Check GitHub issues
- **Documentation**: See README.md
- **Examples**: See SAMPLE.md
- **Technical**: See IMPLEMENTATION.md

---

**Happy editing!** 🚀
