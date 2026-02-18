# HTML Export & Offline Capability Guide

## Overview

The RTF Markdown Editor supports two approaches for HTML export:

1. **Client-side Rendering** (Default) - Diagrams rendered when HTML is viewed
2. **Pre-rendering** (Optional) - Diagrams pre-rendered to SVG during export

## Key Changes in v1.1.3+

### Fixed Issues
- ✅ Multi-line Mermaid diagrams now display properly (text no longer clipped)
- ✅ HTML export supports offline viewing with pre-rendering option
- ✅ Mermaid configuration uses plain-text mode (`htmlLabels: false`)
- ✅ Line breaks in diagrams properly converted from `<br/>` tags to newlines

### Technical Updates

#### Editor (WORKS OFFLINE)
- **Bundled Libraries**: Mermaid @10 is bundled locally in the extension
- **No CDN Dependency**: Diagrams render in VS Code without internet
- **Configuration**: Flowchart optimization with proper spacing and sizing

#### HTML Export (CONFIGURABLE)
Two options available via export presets:

**Option 1: Standalone (Default)**
```typescript
ExportPresets.standalone()  
// Includes CDN script tags for Mermaid @10 and KaTeX @0.16
// ✅ Works with internet connection
// ❌ Requires CDN access for diagram/math rendering
```

**Option 2: Email/Pre-rendered**
```typescript
ExportPresets.email()
// Pre-renders diagrams to SVG during export
// ✅ Fully offline - no CDN required
// ✅ Static output - smaller file size
// ❌ Rendering happens at export time (slower for large docs)
```

## Using Pre-rendered HTML Export (FULLY OFFLINE)

### Why Use Pre-rendering?

Pre-rendering converts Mermaid diagrams to static SVG during export, making the HTML completely self-contained and viewable without:
- Internet connection
- Web server
- Browser's script execution abilities
- Any external dependencies

### How to Use

**Via API:**
```typescript
import { exportToHTML, ExportPresets } from './utils/htmlExporter';

// Full offline-ready export
const html = await exportToHTML(markdown, ExportPresets.email());
```

**Via Command Palette (when implemented in UI):**
- Export > Save as HTML (Pre-rendered) → Fully offline
- Export > Save as HTML (Standard) → Requires internet for rendering

### Implementation Notes

- Pre-rendering uses Mermaid's async `render()` API
- `<br/>` tags in diagram source are converted to newlines
- Failed pre-renders gracefully fall back to source embedding
- KaTeX math expressions can be pre-rendered if `preRenderMath: true`

## Viewing Exported HTML

### With Internet Connection
- Any modern browser (Chrome, Firefox, Safari, Edge)
- VS Code Live Server extension
- Any HTTP server
- File-based viewing may work with some browsers

### Without Internet Connection
- **Pre-rendered exports**: Any browser or file viewer (HTML file format)
- **Standard exports**: 
  - VS Code with Live Server extension (local fallback)
  - Python: `python -m http.server 8000`
  - Node.js: `npx http-server`

## Example: Creating Offline-Safe Export

```typescript
// Export function for offline use
async function exportForOffline(markdownContent: string, filename: string) {
  const html = await exportToHTML(markdownContent, {
    includeStyles: true,
    includeScripts: false,  // No CDN scripts
    preRenderMermaid: true,  // Convert to SVG
    preRenderMath: true,     // Render math formulas
    standalone: true,        // Complete HTML document
    title: 'Offline Document'
  });
  
  fs.writeFileSync(filename, html);
  console.log('Offline-ready HTML saved:', filename);
}
```

## Troubleshooting

### Diagrams Don't Render in Exported HTML

**Cause**: Standard export without internet connection

**Solution**: 
- Use pre-rendering preset: `ExportPresets.email()`
- OR open file with HTTP server
- OR open with VS Code Live Server extension

### Math Expressions Show Source Code

**Cause**: Pre-rendering not enabled

**Solution**: Enable `preRenderMath: true` in export options

### File Size Too Large

**Cause**: Pre-rendered SVG includes all diagram metadata

**Solution**: Use standard export (smaller) or optimize SVG post-export

## Architecture

### Render Flow (Client-side)
1. HTML loads with embedded Mermaid source
2. CDN script loads (requires internet)
3. Mermaid renders diagram from source
4. Math expressions rendered by KaTeX

### Pre-render Flow (During Export)
1. Export initiated with `preRenderMermaid: true`
2. Each diagram source processed: `<br/>` → `\n`
3. Mermaid's Node.js API renders to SVG
4. SVG embeds directly in HTML
5. No external scripts needed

## Compliance

- ✅ FULLY OFFLINE: Pre-rendered exports work without CDN
- ✅ Editor: Bundled libraries, zero CDN dependency  
- ✅ HTML Export: Flexible approach (online or offline)
- ✅ RFC 7763 Compliant: Markdown to HTML conversion
- ✅ RTL Support: Preserved in both online and offline exports

## Version History

- **v1.1.3**: Added offline pre-rendering support
- **v1.1.2**: Fixed Mermaid multi-line text display
- **v1.1.1**: Initial release
