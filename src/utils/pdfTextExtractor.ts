/**
 * PDF Text Extractor
 *
 * Smart text extraction pipeline for PDFs:
 * 1. Try pdf-parse (fast, works for most PDFs with proper font encoding)
 * 2. Detect garbled text (common with Hebrew PDFs that use embedded fonts without ToUnicode maps)
 * 3. Fall back to OCR via Puppeteer (render) + Tesseract.js (recognize) for broken fonts
 *
 * The OCR fallback also provides position data (bounding boxes) for table detection.
 */

import * as fs from 'fs';
import * as path from 'path';

// Browser-context globals used inside Puppeteer's page.evaluate()
declare var pdfjsLib: any;
declare function atob(data: string): string;
declare var document: {
  createElement(tagName: string): any;
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

export interface TextLine {
  text: string;
  items: TextItem[];
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence?: number;
}

export interface PageData {
  pageNumber: number;
  lines: TextLine[];
  width: number;
  height: number;
}

export interface ExtractionResult {
  pages: PageData[];
  text: string;
  title: string;
  isRTL: boolean;
  method: 'pdf-parse' | 'ocr';
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

/**
 * Extract text from a PDF file.
 * Tries pdf-parse first, falls back to OCR if text is garbled.
 */
export async function extractPdfText(
  pdfPath: string,
  context?: any,
  progress?: (message: string) => void
): Promise<ExtractionResult> {
  const buffer = fs.readFileSync(pdfPath);

  // Step 1: Try pdf-parse
  progress?.('Extracting text from PDF...');
  const pdfParseResult = await tryPdfParse(buffer);

  if (pdfParseResult && !isGarbledText(pdfParseResult.text)) {
    // Text extraction worked — return as flat text (existing pipeline will handle it)
    progress?.('Text extracted successfully');
    return {
      pages: textToPages(pdfParseResult.text),
      text: pdfParseResult.text,
      title: pdfParseResult.title,
      isRTL: hasRTLCharacters(pdfParseResult.text),
      method: 'pdf-parse',
    };
  }

  // Step 2: Text is garbled — use OCR
  progress?.('Font encoding issue detected, switching to OCR...');
  return await extractViaOCR(pdfPath, buffer, progress);
}

// ─── pdf-parse Extraction ───────────────────────────────────────────────────

interface PdfParseResult {
  text: string;
  title: string;
  numPages: number;
}

async function tryPdfParse(buffer: Buffer): Promise<PdfParseResult | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return {
      text: data.text || '',
      title: (data.info?.Title || '').trim(),
      numPages: data.numpages || 1,
    };
  } catch {
    return null;
  }
}

// ─── Garbled Text Detection ─────────────────────────────────────────────────

/**
 * Detects if extracted text is garbled (common with embedded Hebrew fonts
 * that lack ToUnicode CMap entries).
 *
 * Garbled text characteristics:
 * - High ratio of control characters (U+0001-U+001F)
 * - Very few recognizable characters (letters, digits)
 * - Almost no Hebrew/Arabic Unicode characters despite being an RTL document
 */
function isGarbledText(text: string): boolean {
  if (!text || text.length < 50) return false;

  // Sample the first 2000 non-whitespace characters
  const sample = text.replace(/\s/g, '').substring(0, 2000);
  if (sample.length < 20) return true; // Almost empty

  let controlChars = 0;
  let printableChars = 0;
  let hebrewChars = 0;

  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (code >= 0x01 && code <= 0x1f) {
      controlChars++;
    } else if (
      (code >= 0x20 && code <= 0x7e) || // ASCII printable
      (code >= 0x0590 && code <= 0x05ff) || // Hebrew
      (code >= 0x0600 && code <= 0x06ff) || // Arabic
      (code >= 0x00c0 && code <= 0x024f) // Latin Extended
    ) {
      printableChars++;
      if (code >= 0x0590 && code <= 0x05ff) hebrewChars++;
    }
  }

  const total = sample.length;
  const controlRatio = controlChars / total;
  const printableRatio = printableChars / total;

  // If more than 30% control characters, or less than 20% printable, it's garbled
  return controlRatio > 0.3 || printableRatio < 0.2;
}

// ─── OCR Extraction ─────────────────────────────────────────────────────────

/**
 * Extract text via OCR: render PDF pages with Puppeteer, then OCR with Tesseract.js
 */
async function extractViaOCR(
  pdfPath: string,
  pdfBuffer: Buffer,
  progress?: (message: string) => void
): Promise<ExtractionResult> {
  // Render all pages to images
  progress?.('Rendering PDF pages...');
  const pageImages = await renderPdfPages(pdfPath, pdfBuffer, progress);

  // OCR each page
  const pages: PageData[] = [];
  const allText: string[] = [];
  let isRTL = false;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Tesseract = require('tesseract.js');
  const worker = await Tesseract.createWorker('heb+eng', undefined, {
    logger: () => {}, // suppress logs
  });

  try {
    for (let i = 0; i < pageImages.length; i++) {
      progress?.(`OCR processing page ${i + 1} of ${pageImages.length}...`);

      const result = await worker.recognize(pageImages[i].data);
      const pageData = ocrResultToPageData(result.data, i + 1, pageImages[i].width, pageImages[i].height);
      pages.push(pageData);

      const pageText = pageData.lines.map((l) => l.text).join('\n');
      allText.push(pageText);

      if (!isRTL && hasRTLCharacters(pageText)) {
        isRTL = true;
      }

      // Clean up temp image
      if (pageImages[i].tempPath) {
        try { fs.unlinkSync(pageImages[i].tempPath!); } catch { /* ignore */ }
      }
    }
  } finally {
    await worker.terminate();
  }

  const text = allText.join('\n\n');
  const title = extractTitleFromText(text);

  return {
    pages,
    text,
    title,
    isRTL,
    method: 'ocr',
  };
}

// ─── PDF Page Rendering ─────────────────────────────────────────────────────

interface RenderedPage {
  data: Buffer;
  width: number;
  height: number;
  tempPath?: string;
}

/**
 * Render PDF pages to PNG images using Puppeteer + pdfjs
 */
async function renderPdfPages(
  pdfPath: string,
  pdfBuffer: Buffer,
  progress?: (message: string) => void
): Promise<RenderedPage[]> {
  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error(
      'PDF OCR requires Google Chrome or Chromium. ' +
      'Please install Chrome to convert PDFs with embedded fonts.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = require('puppeteer-core');
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.goto('about:blank');

    // Inject pdf.js into the browser page
    // Use the CDN version since it runs in the browser context
    await page.addScriptTag({
      url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    });

    const pdfBase64 = pdfBuffer.toString('base64');

    // Render all pages and collect as base64 PNGs
    // The callback runs in the Puppeteer browser context where pdfjsLib and document are globals.
    const renderedPages: RenderedPage[] = await page.evaluate(async (b64: string) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const binary = atob(b64);
      const data = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);

      const doc = await pdfjsLib.getDocument({ data }).promise;
      const pages: Array<{ dataUrl: string; width: number; height: number }> = [];

      const scale = 2.0; // High res for OCR quality

      for (let i = 1; i <= doc.numPages; i++) {
        const pg = await doc.getPage(i);
        const viewport = pg.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await pg.render({ canvasContext: ctx, viewport }).promise;
        pages.push({
          dataUrl: canvas.toDataURL('image/png'),
          width: viewport.width,
          height: viewport.height,
        });
      }

      doc.destroy();
      return pages;
    }, pdfBase64);

    // Convert data URLs to buffers
    return renderedPages.map((p: any) => ({
      data: Buffer.from(p.dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'),
      width: p.width,
      height: p.height,
    }));
  } finally {
    await browser.close();
  }
}

// ─── OCR Result Processing ──────────────────────────────────────────────────

function ocrResultToPageData(
  ocrData: any,
  pageNumber: number,
  pageWidth: number,
  pageHeight: number
): PageData {
  const lines: TextLine[] = [];

  for (const ocrLine of ocrData.lines || []) {
    const lineText = (ocrLine.text || '').replace(/\n/g, '').trim();
    if (!lineText) continue;

    const items: TextItem[] = [];
    for (const word of ocrLine.words || []) {
      if (!word.text?.trim()) continue;
      items.push({
        str: word.text.trim(),
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
        confidence: word.confidence,
      });
    }

    if (items.length > 0) {
      lines.push({
        text: lineText,
        items,
        bbox: ocrLine.bbox,
        confidence: ocrLine.confidence,
      });
    }
  }

  return { pageNumber, lines, width: pageWidth, height: pageHeight };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function hasRTLCharacters(text: string): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (
      (code >= 0x0590 && code <= 0x05ff) || // Hebrew
      (code >= 0x0600 && code <= 0x06ff) // Arabic
    ) {
      return true;
    }
  }
  return false;
}

function textToPages(text: string): PageData[] {
  // For pdf-parse results, return a single "page" with all text as lines
  const lines: TextLine[] = text.split('\n').map((line, i) => ({
    text: line,
    items: [{
      str: line,
      x: 0,
      y: i * 20,
      width: line.length * 10,
      height: 20,
    }],
    bbox: { x0: 0, y0: i * 20, x1: line.length * 10, y1: i * 20 + 20 },
  }));

  return [{ pageNumber: 1, lines, width: 595, height: 842 }];
}

function extractTitleFromText(text: string): string {
  // Try to find a title in the first few lines
  const lines = text.split('\n').filter((l) => l.trim());
  for (const line of lines.slice(0, 10)) {
    const trimmed = line.trim();
    // Skip very short lines or lines that look like headers/metadata
    if (trimmed.length > 5 && trimmed.length < 100 && !trimmed.includes(':')) {
      return trimmed;
    }
  }
  return '';
}

/**
 * Find Chrome/Chromium executable path
 */
function findChromePath(): string | null {
  const candidates: string[] = [];

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || '';
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    candidates.push(
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
    );
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}
