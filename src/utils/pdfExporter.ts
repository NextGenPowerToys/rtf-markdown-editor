import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exportToHTML, ExportOptions } from './htmlExporter';
import { hasRTLCharacters, detectParagraphDirection } from './bidiHandler';

export interface PdfExportOptions {
  title?: string;
  mermaidImages?: Record<string, string>;
  basePath?: string;
  rtl?: boolean;
}

interface PdfMetadataItem {
  type: 'heading' | 'paragraph' | 'list' | 'ordered-list' | 'blank';
  level?: number;
  content?: string;
}

interface PdfMetadata {
  version: string;
  format: string;
  rtl: boolean;
  title?: string;
  structure: PdfMetadataItem[];
}

function getChromePaths(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    ];
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    return [
      path.join(programFiles, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(programFiles, 'Chromium\\Application\\chrome.exe'),
      path.join(programFilesX86, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(programFiles, 'Microsoft\\Edge\\Application\\msedge.exe'),
      path.join(local, 'Microsoft\\Edge\\Application\\msedge.exe'),
    ].filter(Boolean);
  }
  // Linux / other POSIX
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
  ];
}

function findChrome(): string {
  for (const p of getChromePaths()) {
    if (fs.existsSync(p)) { return p; }
  }
  throw new Error(
    'PDF export requires Google Chrome, Chromium, or Microsoft Edge to be installed.\n' +
    'Please install one from https://www.google.com/chrome and try again.'
  );
}

// ---------------------------------------------------------------------------
// Metadata extraction from markdown
// ---------------------------------------------------------------------------

/**
 * Parses markdown to extract structure (headings, lists, paragraphs).
 * This metadata is embedded in the PDF to enable lossless round-trip imports.
 */
function extractMarkdownStructure(markdown: string): PdfMetadataItem[] {
  const lines = markdown.split('\n');
  const structure: PdfMetadataItem[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Blank line
    if (!trimmed) {
      structure.push({ type: 'blank' });
      continue;
    }

    // Heading: # ... or ## ... etc
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2].trim();
      structure.push({ type: 'heading', level, content });
      continue;
    }

    // Ordered list: "1. ..." or "- ..." etc
    const orderedMatch = trimmed.match(/^(\d+|[a-zA-Z])[.)]\s+(.+)$/);
    if (orderedMatch) {
      const content = orderedMatch[2].trim();
      structure.push({ type: 'ordered-list', content });
      continue;
    }

    // Unordered list: "- ..."
    if (trimmed.match(/^[-*+]\s+/)) {
      const content = trimmed.replace(/^[-*+]\s+/, '');
      structure.push({ type: 'list', content });
      continue;
    }

    // Regular paragraph
    structure.push({ type: 'paragraph', content: trimmed });
  }

  return structure;
}

/**
 * Creates metadata object from markdown content
 */
function createPdfMetadata(markdown: string, title?: string): PdfMetadata {
  return {
    version: '1.0',
    format: 'markdown',
    rtl: hasRTLCharacters(markdown),
    title,
    structure: extractMarkdownStructure(markdown),
  };
}

/**
 * Injects metadata as a hidden element in the document.
 * Uses a hidden <div> in <body> so that pdf-parse can still extract
 * the marker text for lossless round-trip imports.
 * The hidden div is not rendered visually in the PDF.
 */
function injectMetadataIntoHTML(html: string, metadata: PdfMetadata): string {
  const json = JSON.stringify(metadata);
  const encoded = Buffer.from(json).toString('base64');
  const hiddenDiv = `<div id="mdwe-metadata" style="display:none;position:absolute;overflow:hidden;width:0;height:0" data-mdwe-metadata="${encoded}">MDWE-METADATA:${encoded}</div>\n`;

  // Insert hidden div after opening body tag
  const bodyMatch = html.match(/<body[^>]*>/i);
  if (bodyMatch) {
    const insertPos = html.indexOf(bodyMatch[0]) + bodyMatch[0].length;
    return html.slice(0, insertPos) + hiddenDiv + html.slice(insertPos);
  }
  return hiddenDiv + html;
}

export async function exportToPDF(
  markdown: string,
  options: PdfExportOptions = {}
): Promise<Buffer> {
  const { title = 'Untitled', mermaidImages, basePath, rtl } = options;

  // Reuse the existing HTML pipeline — fully self-contained (base64 images + Mermaid PNGs)
  let html = await exportToHTML(markdown, {
    title,
    includeStyles: true,
    standalone: true,
    selfContained: true,
    basePath,
    mermaidImages,
    rtl,
  } as ExportOptions);

  // Inject metadata for lossless round-trip imports
  const metadata = createPdfMetadata(markdown, title);
  html = injectMetadataIntoHTML(html, metadata);

  const executablePath = findChrome();

  // Dynamic import so a missing module fails at export time, not at extension activation
  const puppeteer = await import('puppeteer-core');

  const browser = await (puppeteer as any).launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    // setContent avoids writing a temp file; networkidle0 ensures fonts/resources settle
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
