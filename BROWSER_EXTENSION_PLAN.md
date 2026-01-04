# RTF Markdown Editor - Browser Extension Implementation Plan

## Overview

Port the RTF Markdown Editor to a Chromium browser extension that integrates with Git providers (GitHub, Azure DevOps) via context menu, opening files in a side panel with automatic Git checkout/commit instead of local file operations.

## Architecture

```
browser-extension/
 manifest.json                     # Chrome Extension Manifest V3
 background/
    service-worker.ts            # Context menu, URL routing, message hub
 content/
    github-integration.ts        # Page detection, visual hints
 editor/
    editor.html                  # Side panel editor page
    editor.ts                    # Main editor logic + Git integration
    editor.css                   # Copy from media/editor.css
 options/
    options.html                 # Settings page
    options.ts                   # Provider & token management
 shared/
    git-providers/
       github.ts                # GitHub API client
       azure-devops.ts          # Azure DevOps API (Phase 2)
       base-provider.ts         # Abstract provider interface
    utils/
        markdownProcessor.ts     # Copy from src/utils (adapted)
        htmlProcessor.ts         # Copy from src/utils (adapted)
 assets/
    fonts/                       # Copy from media/fonts/
    icons/                       # Extension icons
    images/                      # UI assets
 esbuild.config.js                # Build configuration
 package.json                     # Dependencies
 tsconfig.json                    # TypeScript config
```

## Phase 1: Core GitHub Integration

### 1. Manifest Configuration (manifest.json)

**Key Points:**
- Manifest V3 for modern Chrome
- Broad host permissions for custom Git domains
- Side panel API for editor UI
- Content script on all URLs (filters internally)

### 2. Provider Configuration System

#### Storage Schema

Configurable providers allow adding any Git hosting service (GitHub.com, GitHub Enterprise, on-prem Azure DevOps, etc.)

#### Default Providers (First Install)

- GitHub.com (enabled)
- Azure DevOps Cloud (Phase 2)
- Azure DevOps Legacy (Phase 2)

### 3. Background Service Worker

#### Context Menu Management

- Dynamic context menu creation based on enabled providers
- URL parsing for GitHub and Azure DevOps
- Side panel integration
- File context storage

#### URL Parsers

- GitHub: Extract owner/repo/branch/path from URL
- Azure DevOps: Extract org/project/repo/path/branch
- Support for custom provider URLs

### 4. GitHub API Provider

Features:
- Get file content with base64 decoding
- Commit file with SHA conflict detection
- Upload images to .attachments/ folder
- Test authentication

### 5. Editor Page (Side Panel)

Key features:
- Load file from Git via provider API
- Initialize TipTap editor with content
- Debounced autosave (750ms)
- Commit message prompt modal
- SHA conflict detection and resolution UI
- Image paste handler with Git upload
- Status indicators (loading, saving, error)

### 6. Options Page

Features:
- GitHub PAT input with save/test
- Provider list with add/edit/delete
- Enable/disable toggles per provider
- Custom provider configuration modal
- Connection testing per provider

## Phase 2: Azure DevOps Support

### Azure DevOps API Provider

Implementation similar to GitHub using Azure DevOps REST API v7.0

## Required File Adaptations

### markdownProcessor.ts
- No changes needed - already browser-compatible

### htmlProcessor.ts
- Remove Node.js path module - use URL manipulation
- Remove iconv-lite - use TextEncoder/TextDecoder
- Keep he library for HTML entities

## Build System

### Four Bundles
1. Background service worker (ESM)
2. Content script (IIFE)
3. Editor page (IIFE)
4. Options page (IIFE)

### Dependencies
- TipTap editor with all extensions
- markdown-it, KaTeX, Mermaid
- he for HTML entities
- @types/chrome for TypeScript

## Testing Strategy

### Manual Testing Checklist

**Context Menu:**
- Right-click on GitHub .md file shows menu
- Menu click opens side panel
- Multiple providers work correctly

**File Operations:**
- File loads with correct content
- All markdown features render
- RTL text displays properly
- Mermaid diagrams render
- Math formulas display

**Editing & Saving:**
- Changes trigger autosave
- Commit message prompt appears
- Commit succeeds on GitHub
- SHA conflict detection works
- Conflict resolution UI functions

**Images:**
- Paste image works
- Upload to .attachments/ succeeds
- Relative path correct
- Image displays in editor

**Configuration:**
- Add/edit/delete custom providers
- Enable/disable toggle works
- Token save/test works

## Security Considerations

1. Token Storage: chrome.storage.sync
2. CSP: Strict Content Security Policy
3. Token Permissions: Minimal scopes (repo only)
4. HTTPS Only: Reject HTTP providers
5. Input Validation: Sanitize all inputs
6. XSS Prevention: Proper HTML escaping

## Performance Optimizations

1. Lazy Loading: TipTap extensions on demand
2. Caching: File content in IndexedDB
3. Debouncing: 750ms autosave delay
4. Bundle Splitting: Separate vendor chunks
5. Tree Shaking: Remove unused code

## Distribution

- Chrome Web Store (primary)
- Edge Add-ons (compatible)
- Self-Hosting (enterprise ZIP)
- Auto-Updates via store

## Future Enhancements

- GitLab support
- Bitbucket support
- Offline editing with sync
- Multi-file editing
- Branch switching
- Pull request creation
- Diff view for conflicts
- Collaborative editing
- Export to PDF
- Custom CSS themes
