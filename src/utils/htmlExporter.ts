import { markdownToHtml } from './markdownProcessor';
import { RTLService } from '../services/RTLService';

/**
 * Options for HTML export
 */
export interface ExportOptions {
  /** Include CSS in output (default: true) */
  includeStyles?: boolean;
  /** Include KaTeX and Mermaid libraries (default: true) */
  includeScripts?: boolean;
  /** Render mermaid as embedded content (default: false - rendered client-side) */
  preRenderMermaid?: boolean;
  /** Render KaTeX as HTML (default: false - rendered client-side) */
  preRenderMath?: boolean;
  /** Generate complete HTML document (default: true) */
  standalone?: boolean;
  /** HTML document title (default: "Untitled") */
  title?: string;
  /** Enable RTL mode (auto-detect if not specified) */
  rtl?: boolean;
  /** Include markdown source as HTML comment (default: false) */
  includeSourceMarkdown?: boolean;
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
 * Mermaid.js CDN script tag for client-side rendering
 */
const MERMAID_SCRIPT = `<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>
<script>
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    mermaid.contentLoaded();
  }
<\/script>`;

/**
 * KaTeX.js script for client-side math rendering
 */
const KATEX_SCRIPT = `<script src="https://cdn.jsdelivr.net/npm/katex@0.16/dist/katex.min.js"><\/script>
<script>
  if (typeof katex !== 'undefined') {
    document.querySelectorAll('.math-display, .math-inline').forEach(function(el) {
      const isDisplay = el.classList.contains('math-display');
      const content = el.textContent;
      try {
        katex.render(content, el, { displayMode: isDisplay, throwOnError: false });
      } catch (e) {
        console.warn('KaTeX rendering error:', e);
      }
    });
  }
<\/script>`;

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
    includeScripts = true,
    preRenderMermaid = false,
    preRenderMath = false,
    standalone = true,
    title = 'Untitled',
    rtl: explicitRTL,
    includeSourceMarkdown = false,
  } = options;

  // Convert markdown to HTML
  const { html, mermaidSources } = markdownToHtml(markdown);

  // Detect RTL if not explicitly specified
  const isRTL = explicitRTL !== undefined ? explicitRTL : RTLService.detectRTLCharacters(markdown);

  // Build the content HTML
  let contentHTML = `<div class="editor-content">${html}</div>`;

  // If standalone, wrap in complete HTML document
  if (standalone) {
    const dir = isRTL ? ' dir="rtl"' : '';
    const css = includeStyles ? `<style>\n${EDITOR_CSS}\n${KATEX_CSS}\n</style>` : '';
    const scripts = includeScripts ? `${MERMAID_SCRIPT}\n${KATEX_SCRIPT}` : '';
    const sourceComment = includeSourceMarkdown ? `\n<!-- Source Markdown:\n${escapeHtmlComment(markdown)}\n-->` : '';

    return `<!DOCTYPE html>
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
  }

  return contentHTML;
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
 * Get export options preset for different use cases
 */
export const ExportPresets = {
  /** Standalone HTML file with all assets included */
  standalone: (): ExportOptions => ({
    includeStyles: true,
    includeScripts: true,
    preRenderMermaid: false,
    preRenderMath: false,
    standalone: true,
  }),

  /** Minimal HTML for embedding in other documents */
  minimal: (): ExportOptions => ({
    includeStyles: false,
    includeScripts: false,
    preRenderMermaid: false,
    preRenderMath: false,
    standalone: false,
  }),

  /** HTML with pre-rendered diagrams and math (good for email/sharing) */
  email: (): ExportOptions => ({
    includeStyles: true,
    includeScripts: false,
    preRenderMermaid: true,
    preRenderMath: true,
    standalone: true,
  }),

  /** Fragment with styles for pasting into editors like Notion, Word */
  clipboard: (): ExportOptions => ({
    includeStyles: true,
    includeScripts: false,
    preRenderMermaid: false,
    preRenderMath: false,
    standalone: false,
  }),
};
