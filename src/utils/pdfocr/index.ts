import { extractPdfText, pageHasText } from './pdfExtractor';
import { OcrEngine } from './ocrEngine';
import { analyzePages } from './structureAnalyzer';
import { generateHtml } from './htmlGenerator';
import type { PageData, ExtractionMode, ContentBlock } from './types';

export { analyzePages } from './structureAnalyzer';
export { generateHtml } from './htmlGenerator';
export { extractPdfText, pageHasText } from './pdfExtractor';
export { OcrEngine } from './ocrEngine';
export type { PageData, TextItem, ImageItem, ContentBlock, ExtractionMode, ConvertOptions } from './types';

export interface ConvertPdfOptions {
  /** Extraction mode: 'text' (fast), 'ocr' (force OCR), 'hybrid' (text first, OCR fallback) */
  mode?: ExtractionMode;
  /** OCR language(s), e.g. 'heb+eng' */
  ocrLanguage?: string;
  /** OCR render scale multiplier (default 3 = 450 DPI) */
  scale?: number;
  /** Progress callback */
  progress?: (message: string) => void;
  /**
   * Absolute path to the extension's installation directory. Required for OCR
   * — used to locate the bundled tesseract-core WASM and traineddata files so
   * the engine never reaches out to a CDN.
   */
  extensionRoot?: string;
}

export interface ConvertPdfResult {
  /** Generated HTML string */
  html: string;
  /** Document title (from first header) */
  title: string;
  /** Whether document contains RTL text */
  isRTL: boolean;
  /** Detected content blocks (for further processing) */
  blocks: ContentBlock[];
}

/**
 * Convert a PDF file to structured HTML.
 *
 * Pipeline:
 * 1. Extract text with position data via pdfjs-dist
 * 2. Optionally OCR pages that lack text content
 * 3. Analyze document structure (headers, tables, lists, paragraphs)
 * 4. Generate semantic HTML with RTL support
 */
export async function convertPdfToHtml(
  pdfPath: string,
  options: ConvertPdfOptions = {},
): Promise<ConvertPdfResult> {
  const {
    mode = 'hybrid',
    ocrLanguage = 'heb+eng',
    scale = 3,
    progress,
    extensionRoot,
  } = options;

  // Step 1: Extract text with position data
  progress?.('Extracting text from PDF...');
  const pages = await extractPdfText(pdfPath);
  progress?.(`Extracted ${pages.length} pages`);

  // Step 2: OCR if needed
  if (mode !== 'text') {
    const pagesNeedingOcr = mode === 'ocr'
      ? pages.map((_, i) => i)
      : pages.map((p, i) => pageHasText(p) ? -1 : i).filter(i => i >= 0);

    if (pagesNeedingOcr.length > 0) {
      if (!extensionRoot) {
        throw new Error(
          'OCR requested but extensionRoot was not provided. Offline OCR needs ' +
          'the extension installation path to locate bundled tesseract assets.',
        );
      }
      progress?.(`Running OCR on ${pagesNeedingOcr.length} page(s)...`);
      await runOcr(pdfPath, pages, pagesNeedingOcr, mode, ocrLanguage, scale, extensionRoot, progress);
    } else if (mode === 'hybrid') {
      progress?.('All pages have text content, skipping OCR');
    }
  }

  // Step 3: Analyze document structure
  progress?.('Analyzing document structure...');
  const blocks = analyzePages(pages);

  // Step 4: Detect RTL
  const isRTL = detectRTL(pages);

  // Step 5: Extract title
  const title = extractTitle(blocks);

  // Step 6: Generate HTML
  progress?.('Generating HTML...');
  const html = generateHtml(blocks, title);

  return { html, title, isRTL, blocks };
}

async function runOcr(
  pdfPath: string,
  pages: PageData[],
  pagesNeedingOcr: number[],
  mode: ExtractionMode,
  ocrLanguage: string,
  scale: number,
  extensionRoot: string,
  progress?: (message: string) => void,
): Promise<void> {
  // OCR failures must NEVER abort the conversion. Pages that can't be OCR'd
  // (e.g. mermaid-diagram pages on hosts where `canvas` isn't available)
  // should just yield zero OCR items; the rest of the document still
  // converts correctly via the pdfjs-dist text extraction path. Catching
  // here prevents the whole pipeline from falling back to plain pdf-parse.
  let ocrEngine: OcrEngine | null = null;
  try {
    ocrEngine = new OcrEngine(ocrLanguage, extensionRoot, progress);
    await ocrEngine.initialize();
  } catch (err) {
    progress?.(`OCR engine init failed (${(err as Error).message}); continuing with text-only extraction`);
    return;
  }

  try {
    for (const pageIdx of pagesNeedingOcr) {
      const page = pages[pageIdx];
      progress?.(`OCR page ${page.pageNumber} of ${pages.length}...`);

      try {
        const ocrItems = await ocrEngine.ocrPage(
          pdfPath,
          page.pageNumber,
          page.width,
          page.height,
          scale,
          page.items, // pass PDF text items for gap-filling in inverted regions
        );

        if (mode === 'ocr') {
          page.items = ocrItems;
        } else {
          // Hybrid: merge OCR items with existing text items
          page.items = [...page.items, ...ocrItems];
        }

        progress?.(`OCR found ${ocrItems.length} text items on page ${page.pageNumber}`);
      } catch (err) {
        progress?.(`OCR failed on page ${page.pageNumber} (${(err as Error).message}); skipping`);
      }
    }
  } finally {
    if (ocrEngine) {
      try { await ocrEngine.terminate(); } catch { /* ignore */ }
    }
  }
}

function extractTitle(blocks: ContentBlock[]): string {
  for (const block of blocks) {
    if (block.type === 'header' && block.text) {
      return block.text;
    }
  }
  return 'PDF Document';
}

function detectRTL(pages: PageData[]): boolean {
  for (const page of pages) {
    for (const item of page.items) {
      if (/[\u0590-\u05FF\u0600-\u06FF]/.test(item.text)) {
        return true;
      }
    }
  }
  return false;
}
