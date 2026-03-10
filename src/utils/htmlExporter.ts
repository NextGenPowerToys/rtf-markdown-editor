import * as fs from 'fs';
import * as path from 'path';
import { markdownToHtml } from './markdownProcessor';
import { RTLService } from '../services/RTLService';

/**
 * Load bundled Mermaid library from media folder
 */
function getBundledMermaidScript(): string {
  try {
    // Load from media folder - copied from node_modules during build
    // __dirname is dist/ after bundling, so go up one level to reach media/
    const possiblePaths = [
      path.join(__dirname, '..', 'media', 'mermaid.min.js'),
      path.join(process.cwd(), 'media', 'mermaid.min.js'),
    ];
    
    for (const mermaidPath of possiblePaths) {
      if (fs.existsSync(mermaidPath)) {
        const mermaidCode = fs.readFileSync(mermaidPath, 'utf-8');
        return `<script>
${mermaidCode}
</script>
<script>
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({
    startOnLoad: true,
    theme: 'default',
    flowchart: {
      htmlLabels: false,
      useMaxWidth: true,
      padding: 15,
      nodeSpacing: 50,
      rankSpacing: 50
    }
  });
  mermaid.contentLoaded();
}
</script>`;
      }
    }
    console.error('Mermaid library not found in:', possiblePaths);
  } catch (error) {
    console.error('Error loading bundled Mermaid script:', error);
  }
  
  throw new Error('Mermaid library not found - cannot create offline export');
}

/**
 * Options for HTML export
 * NOTE: All exports are fully offline-capable with pre-rendered diagrams and math
 */
export interface ExportOptions {
  /** Include CSS in output (default: true) */
  includeStyles?: boolean;
  /** Render mermaid as SVG during export (default: true - always pre-rendered for offline) */
  preRenderMermaid?: boolean;
  /** Render KaTeX as HTML during export (default: true - always pre-rendered for offline) */
  preRenderMath?: boolean;
  /** Generate complete HTML document (default: true) */
  standalone?: boolean;
  /** HTML document title (default: "Untitled") */
  title?: string;
  /** Enable RTL mode (auto-detect if not specified) */
  rtl?: boolean;
  /** Include markdown source as HTML comment (default: false) */
  includeSourceMarkdown?: boolean;
  /** Embed local images as base64 data URLs for a portable single-file export (default: false) */
  selfContained?: boolean;
  /** Absolute directory path used to resolve relative image src paths when selfContained is true */
  basePath?: string;
  /** Pre-rendered Mermaid diagrams as PNG data URLs (data:image/png;base64,...).
   * When provided, mermaid source injection and the bundled mermaid.js script are skipped. */
  mermaidImages?: Record<string, string>;
}

/**
 * Core editor CSS as a string (imported from media/editor.css)
 */
const EDITOR_CSS = `* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  height: auto;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  background-color: #ffffff;
  color: #000000;
}

/* Content wrapper for exported HTML */
.editor-content {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  margin-top: 24px;
  margin-bottom: 12px;
  font-weight: 600;
  page-break-after: avoid;
}

h1 {
  font-size: 2em;
  border-bottom: 1px solid #ddd;
  padding-bottom: 0.3em;
}

h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.3em;
}

h3 {
  font-size: 1.25em;
}

h4 {
  font-size: 1em;
}

h5 {
  font-size: 0.875em;
}

h6 {
  font-size: 0.85em;
  color: #6a737d;
}

/* Paragraphs */
p {
  margin: 0 0 16px 0;
}

/* Links */
a {
  color: #0969da;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Lists */
ul, ol {
  margin: 0 0 16px 0;
  padding-left: 2em;
}

li {
  margin-bottom: 4px;
}

/* Code */
code {
  background-color: #f6f8fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 0.875em;
}

pre {
  background-color: #f6f8fa;
  border: 1px solid #e1e4e8;
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  margin: 0 0 16px 0;
}

pre code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.875em;
}

/* Blockquotes */
blockquote {
  border-left: 4px solid #ddd;
  color: #6a737d;
  padding: 0 15px;
  margin: 0 0 16px 0;
}

blockquote p {
  margin: 0;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 0 0 16px 0;
  page-break-inside: avoid;
}

table thead {
  background-color: #f6f8fa;
}

table th, table td {
  border: 1px solid #d0d7de;
  padding: 12px;
  text-align: left;
}

table th {
  font-weight: 600;
}

table tbody tr:nth-child(even) {
  background-color: #f6f8fa;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 16px 0;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  page-break-inside: avoid;
}

img.align-left {
  float: left;
  margin-right: 16px;
  margin-bottom: 8px;
}

img.align-center {
  margin-left: auto;
  margin-right: auto;
  display: block;
}

img.align-right {
  float: right;
  margin-left: 16px;
  margin-bottom: 8px;
}

/* Horizontal rule */
hr {
  border: none;
  border-top: 2px solid #ddd;
  margin: 24px 0;
}

/* Strong and emphasis */
strong {
  font-weight: 600;
}

em {
  font-style: italic;
}

/* Strikethrough */
del {
  text-decoration: line-through;
  color: #6a737d;
}

/* Math display */
.math-display {
  display: block;
  overflow-x: auto;
  margin: 16px 0;
  padding: 12px;
  background-color: #f6f8fa;
  border-radius: 6px;
}

.math-inline {
  display: inline;
}

/* Mermaid diagram */
[data-mdwe="mermaid"] {
  display: block;
  margin: 16px 0;
  text-align: center;
}

/* RTL Support */
html[dir="rtl"],
html[dir="RTL"] {
  direction: rtl;
  text-align: right;
}

html[dir="rtl"] h1,
html[dir="rtL"] h2,
html[dir="rtl"] h3,
html[dir="rtl"] h4,
html[dir="rtl"] h5,
html[dir="rtl"] h6 {
  text-align: right;
}

html[dir="rtl"] ul,
html[dir="rtl"] ol {
  padding-left: 0;
  padding-right: 2em;
}

html[dir="rtl"] blockquote {
  border-left: none;
  border-right: 4px solid #ddd;
  padding-left: 0;
  padding-right: 15px;
}

html[dir="rtl"] img.align-left {
  float: right;
  margin-right: 0;
  margin-left: 16px;
}

html[dir="rtl"] img.align-right {
  float: left;
  margin-left: 0;
  margin-right: 16px;
}

/* Print styles */
@media print {
  body {
    background-color: #fff;
  }
  
  .editor-content {
    padding: 0;
  }
  
  a {
    color: #0969da;
  }
  
  img {
    max-width: 100%;
    /* Fit tall images within a single printed page (A4 content area minus margins) */
    max-height: 240mm;
    object-fit: contain;
  }
}
`;

/**
 * KaTeX CSS for math rendering
 */
const KATEX_CSS = `/* KaTeX CSS */
.katex { font-size: 1.21em; font-style: italic; }
.katex .katex-mathml { display: none; }
.katex .mord { position: relative; }
.katex .sizing.reset-size1.size1, .katex button.size1 { font-size: 1em; }
.katex .fontsize-ensurer { display: inline; font-size: 1em; }
.katex .mathrm { font-style: normal; }
.katex .mathit { font-style: italic; }
.katex .mathbf { font-weight: bold; }
.katex .boldsymbol { font-weight: bold; font-style: italic; }
`;

/**
 * Mermaid rendering script - loaded dynamically to embed bundled library
 */

/**
 * KaTeX rendering helper - displays math formulas
 */
function getKaTeXScript(): string {
  return `<script>
// Math formula display styling
document.querySelectorAll('.math-display, .math-inline').forEach(function(el) {
  el.style.display = 'inline-block';
  el.style.fontFamily = 'monospace';
  el.style.padding = '2px 4px';
  el.style.backgroundColor = '#f9f9f9';
  el.style.border = '1px solid #e0e0e0';
});
</script>`;
}

/**
 * Replace mermaid placeholder divs with <img> tags containing pre-rendered PNG data URLs.
 * Diagrams absent from mermaidImages are left as placeholder divs for fallback handling.
 */
function replaceMermaidWithImages(
  html: string,
  mermaidImages: Record<string, string>,
  mermaidSources: Record<string, string>
): string {
  for (const [mermaidId, dataUrl] of Object.entries(mermaidImages)) {
    const divPattern = new RegExp(
      `<div\\s+data-mdwe="mermaid"\\s+data-id="${mermaidId}"[^>]*>\\s*</div>`,
      'g'
    );
    const firstLine = (mermaidSources[mermaidId] || '').split('\n')[0].trim();
    const altText = escapeHtmlAttribute(`Mermaid diagram: ${firstLine}`);
    html = html.replace(divPattern,
      `<div class="mermaid-png" data-mdwe="mermaid-rendered" data-id="${mermaidId}" ` +
      `style="text-align:center;margin:16px 0;">` +
      `<img src="${dataUrl}" alt="${altText}" ` +
      `style="max-width:100%;height:auto;display:inline-block;border:none;border-radius:0;">` +
      `</div>`
    );
  }
  return html;
}

/**
 * Export markdown as HTML
 * @param markdown Markdown content
 * @param options Export options
 * @returns Promise<string> HTML content
 */
export async function exportToHTML(
  markdown: string,
  options: ExportOptions = {}
): Promise<string> {
  const {
    includeStyles = true,
    standalone = true,
    title = 'Untitled',
    rtl: explicitRTL,
    includeSourceMarkdown = false,
    selfContained = false,
    mermaidImages,
  } = options;

  // Convert markdown to HTML
  let { html, mermaidSources } = markdownToHtml(markdown);

  const hasMermaidImages = mermaidImages && Object.keys(mermaidImages).length > 0;

  if (hasMermaidImages) {
    // Pre-rendered path: replace placeholder divs with <img> tags
    html = replaceMermaidWithImages(html, mermaidImages!, mermaidSources);

    // Diagrams that failed to render: show source as a styled code block fallback
    for (const [mermaidId, source] of Object.entries(mermaidSources)) {
      if (!mermaidImages![mermaidId]) {
        const pattern = new RegExp(
          `<div\\s+data-mdwe="mermaid"\\s+data-id="${mermaidId}"[^>]*>\\s*</div>`,
          'g'
        );
        html = html.replace(pattern,
          `<div class="mermaid-fallback" data-mdwe="mermaid-fallback" data-id="${mermaidId}" ` +
          `style="margin:16px 0;padding:12px;background:#f6f8fa;border:1px solid #e1e4e8;` +
          `border-radius:6px;font-family:monospace;font-size:0.875em;white-space:pre-wrap;">` +
          escapeHtml(source) +
          `</div>`
        );
      }
    }
  } else {
    // Client-side rendering path: inject mermaid source into placeholder divs
    for (const [mermaidId, source] of Object.entries(mermaidSources)) {
      const placeholder = `<div data-mdwe="mermaid" data-id="${mermaidId}"`;
      const replacement = `<div class="mermaid" data-mdwe="mermaid" data-id="${mermaidId}"`;
      html = html.replace(placeholder, replacement);

      const emptyDivPattern = new RegExp(`<div class="mermaid" data-mdwe="mermaid" data-id="${mermaidId}"[^>]*></div>`, 'g');
      html = html.replace(emptyDivPattern, `<div class="mermaid" data-mdwe="mermaid" data-id="${mermaidId}">${escapeHtml(source)}</div>`);
    }
  }

  // Detect RTL if not explicitly specified
  const isRTL = explicitRTL !== undefined ? explicitRTL : RTLService.detectRTLCharacters(markdown);

  // Build the content HTML
  let contentHTML = `<div class="editor-content">${html}</div>`;

  // If standalone, wrap in complete HTML document
  let output: string;
  if (standalone) {
    const dir = isRTL ? ' dir="rtl"' : '';
    const css = includeStyles ? `<style>\n${EDITOR_CSS}\n${KATEX_CSS}\n</style>` : '';
    // Only include bundled mermaid.js when diagrams are NOT pre-rendered as images
    const mermaidScript = hasMermaidImages ? '' : getBundledMermaidScript();
    const kaTeXScript = getKaTeXScript();
    const scripts = mermaidScript ? `${mermaidScript}\n${kaTeXScript}` : kaTeXScript;
    const sourceComment = includeSourceMarkdown ? `\n<!-- Source Markdown:\n${escapeHtmlComment(markdown)}\n-->` : '';

    output = `<!DOCTYPE html>
<html${dir}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtmlAttribute(title)}</title>
  ${css}
</head>
<body>
  ${contentHTML}
  ${scripts}${sourceComment}
</body>
</html>`;
  } else {
    output = contentHTML;
  }

  if (selfContained && options.basePath) {
    output = await embedImages(output, options.basePath);
  }

  return output;
}

/**
 * Export markdown as HTML fragment (without document wrapper)
 * @param markdown Markdown content
 * @param options Export options
 * @returns Promise<string> HTML fragment
 */
export async function exportToHTMLFragment(
  markdown: string,
  options: ExportOptions = {}
): Promise<string> {
  return exportToHTML(markdown, { ...options, standalone: false });
}

/**
 * Escape text for use in HTML content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escape text for use in HTML attributes
 */
function escapeHtmlAttribute(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape text for use in HTML comments
 */
function escapeHtmlComment(text: string): string {
  // HTML comments cannot contain -- or end with -
  return text
    .replace(/--/g, '- -')
    .replace(/-$/gm, '- ');
}

/**
 * Embed local images as base64 data URLs for self-contained HTML export.
 * Remote URLs and existing data: URLs are left unchanged.
 * Missing files are silently skipped (graceful degradation).
 */
async function embedImages(html: string, basePath: string): Promise<string> {
  const imgPattern = /<img([^>]*?)src="([^"]+)"([^>]*?)>/gi;
  const matches = [...html.matchAll(imgPattern)];

  for (const match of matches) {
    const [full, pre, src, post] = match;
    if (src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
      continue;
    }
    try {
      const absPath = path.isAbsolute(src) ? src : path.join(basePath, src);
      const buffer = fs.readFileSync(absPath);
      const ext = path.extname(absPath).slice(1).toLowerCase();
      const mime =
        ext === 'svg' ? 'image/svg+xml' :
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
        ext === 'webp' ? 'image/webp' :
        ext === 'gif' ? 'image/gif' :
        `image/${ext}`;
      const dataUrl = `data:${mime};base64,${buffer.toString('base64')}`;
      html = html.replace(full, `<img${pre}src="${dataUrl}"${post}>`);
    } catch {
      // Image file not found — leave src unchanged
    }
  }
  return html;
}

/**
 * Get export options preset for different use cases
 * NOTE: All presets use pre-rendering for full offline capability
 */
export const ExportPresets = {
  /** Standalone HTML file - fully offline capable */
  standalone: (): ExportOptions => ({
    includeStyles: true,
    preRenderMermaid: true,
    preRenderMath: true,
    standalone: true,
  }),

  /** Minimal HTML for embedding - offline capable */
  minimal: (): ExportOptions => ({
    includeStyles: false,
    preRenderMermaid: true,
    preRenderMath: true,
    standalone: false,
  }),

  /** HTML with pre-rendered diagrams and math - offline capable */
  email: (): ExportOptions => ({
    includeStyles: true,
    preRenderMermaid: true,
    preRenderMath: true,
    standalone: true,
  }),

  /** Fragment with styles - offline capable */
  clipboard: (): ExportOptions => ({
    includeStyles: true,
    preRenderMermaid: true,
    preRenderMath: true,
    standalone: false,
  }),

  /** Fully portable single-file HTML with images embedded as base64 */
  selfContained: (): ExportOptions => ({
    includeStyles: true,
    standalone: true,
    selfContained: true,
  }),
};
