# RTF Markdown Editor - Browser Extension

A Chromium browser extension for editing markdown files directly from Git repositories (GitHub, Azure DevOps) with WYSIWYG editing, RTL support, and automatic commit functionality.

## Features

- **Context Menu Integration**: Right-click on any `.md` file in GitHub to open the editor
- **Side Panel Editor**: Full-featured WYSIWYG markdown editor in Chrome side panel
- **Git Integration**: Automatic file checkout and commit with SHA conflict detection
- **RTL Support**: First-class support for Hebrew and Arabic
- **Image Upload**: Paste images directly, auto-uploads to `.attachments/` folder
- **Configurable Providers**: Add custom Git hosting URLs (GitHub Enterprise, on-prem Azure DevOps)
- **Offline-First**: All dependencies bundled locally

## Installation

### From Source

1. Clone the repository
2. Install dependencies:
   ```bash
   cd browser-extension
   npm install
   ```
3. Build the extension:
   ```bash
   npm run build
   ```
4. Load in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `browser-extension/dist` folder

## Configuration

1. Click the extension icon and go to Options
2. Add your GitHub Personal Access Token:
   - Create token at https://github.com/settings/tokens
   - Required scope: `repo`
3. Configure additional Git providers if needed

## Usage

1. Navigate to a markdown file on GitHub (e.g., `https://github.com/owner/repo/blob/main/README.md`)
2. Right-click on the page
3. Select "Edit with RTF Markdown Editor"
4. The side panel opens with the file loaded
5. Edit the file - changes autosave every 750ms
6. Enter a commit message when prompted
7. File is committed back to the repository

## Development

### Watch Mode

```bash
npm run watch
```

### Build for Production

```bash
npm run build -- --production
```

## Project Structure

```
browser-extension/
├── manifest.json           # Chrome extension manifest
├── background/             # Background service worker
├── content/                # Content scripts
├── editor/                 # Side panel editor (TODO)
├── options/                # Options page (TODO)
├── shared/                 # Shared utilities
│   ├── git-providers/     # Git API clients
│   └── utils/             # Markdown processors
└── assets/                # Icons and fonts
```

## Current Status

✅ **Phase 1 - Core Structure** (Complete)
- ✅ Folder structure created
- ✅ Manifest V3 configuration
- ✅ TypeScript setup
- ✅ GitHub API provider
- ✅ Background service worker
- ✅ Content script
- ✅ Build system with esbuild
- ✅ Editor page with TipTap integration
- ✅ Options page with token management
- ✅ Markdown processors (dual mermaid syntax support)
- ✅ KaTeX CSS assets

✅ **Build Status**: Successfully builds to `dist/` folder

🚧 **Next Steps**:
- [ ] Test extension in Chrome
- [ ] Add Azure DevOps provider
- [ ] Enhance conflict resolution UI
- [ ] Add keyboard shortcuts
- [ ] Implement image paste handler

## License

Same as parent project

## Contributing

See main project CONTRIBUTING.md
