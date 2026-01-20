# Browser Extension - Installation & Testing Guide

## Quick Start

### 1. Build the Extension

```bash
cd browser-extension
npm install
npm run build
```

This creates a `dist/` folder with all necessary files.

### 2. Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `browser-extension/dist` folder
5. The extension icon should appear in your toolbar

### 3. Configure GitHub Token

1. Click the extension icon or go to `chrome://extensions/` and click "Options"
2. Create a Personal Access Token:
   - Go to https://github.com/settings/tokens/new
   - Give it a name like "RTF Markdown Editor"
   - Select scope: `repo` (Full control of private repositories)
   - Click "Generate token"
   - Copy the token (starts with `ghp_`)
3. Paste the token in the Options page
4. Click "Test Connection" to verify
5. Click "Save Token"

### 4. Test the Extension

1. Navigate to any GitHub repository in your browser
2. Open a markdown file (e.g., `README.md`)
3. Right-click anywhere on the page
4. Select **"Edit with RTF Markdown Editor"**
5. The side panel opens with the file loaded in the editor
6. Make your edits
7. Click the **Save** button
8. Enter a commit message
9. Click **Commit**

## Features to Test

### ✅ Basic Editing
- [ ] Bold, italic, underline formatting
- [ ] Headings (H1-H6)
- [ ] Lists (bullets and numbered)
- [ ] Links
- [ ] Blockquotes
- [ ] Code blocks
- [ ] Tables

### ✅ Mermaid Diagrams
- [ ] Standard backtick syntax: \`\`\`mermaid
- [ ] Azure DevOps colon syntax: ::: mermaid
- [ ] Fence type preservation on save

### ✅ Math Expressions
- [ ] Inline math: `$x = y$`
- [ ] Display math: `$$E = mc^2$$`

### ✅ Images
- [ ] Markdown images: `![alt](path)`
- [ ] HTML images with sizing
- [ ] Image alignment (left/center/right)

### ✅ Git Operations
- [ ] File loading from GitHub
- [ ] Commit with message
- [ ] SHA conflict detection
- [ ] Overwrite remote option
- [ ] Reload file option

## Troubleshooting

### Extension doesn't load
- Check the `dist/` folder exists
- Verify `manifest.json` is present in `dist/`
- Check Chrome's extension error messages

### Context menu doesn't appear
- Verify you're on a markdown file URL (ends with `.md`)
- Check the GitHub token is saved in Options
- Reload the GitHub page after loading the extension

### Can't save files
- Verify GitHub token has `repo` scope
- Check the repository is accessible with your token
- Look for errors in Chrome DevTools Console (F12)

### Mermaid diagrams don't render
- Mermaid is bundled locally (no internet required)
- Check the diagram syntax is valid
- Open DevTools Console to see render errors

## Development Workflow

### Watch Mode

For development with auto-rebuild:

```bash
npm run watch
```

Then reload the extension in Chrome after changes:
1. Go to `chrome://extensions/`
2. Click the refresh icon on the extension card

### Building for Production

```bash
npm run build -- --production
```

This creates minified bundles without source maps.

## File Structure

```
dist/
├── manifest.json          # Extension configuration
├── background.js          # Service worker
├── content.js             # Content script
├── editor/
│   ├── editor.html       # Side panel UI
│   ├── editor.css        # Editor styles
│   └── editor.js         # Editor logic + TipTap
├── options/
│   ├── options.html      # Options page UI
│   ├── options.css       # Options styles
│   └── options.js        # Token/provider management
└── assets/
    └── katex.css         # Math rendering styles
```

## Known Limitations

- Only GitHub is supported currently (Azure DevOps coming in Phase 2)
- Images must be committed separately (no direct paste from clipboard yet)
- No offline mode (requires network connection to GitHub)
- Side panel API requires Chrome 114+ (not supported in Edge/Brave yet)

## Next Steps

1. Test with various markdown files
2. Try conflict scenarios (edit same file in two places)
3. Test with different GitHub repositories (public/private)
4. Report bugs or issues
5. Add custom Git providers in Options (for GitHub Enterprise)
