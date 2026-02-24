import { extractPdfText, pageHasText } from './pdfExtractor';
import { OcrEngine } from './ocrEngine';
import { analyzePages } from './structureAnalyzer';
import { generateHtml } from './htmlGenerator';
import type { PageData, ExtractionMode, ContentBlock } from './types';

export { analyzePages } from './structureAnalyzer';
export { generateHtml } from './htmlGenerator';
export { extractPdfText, pageHasText } from './pdfExtractor';
export { OcrEngine } from './ocrEngine';
export type { PageData, TextItem, ContentBlock, ExtractionMode, ConvertOptions } from './types';

export interface ConvertPdfOptions {
  /** Extraction mode: 'text' (fast), 'ocr' (force OCR), 'hybrid' (text first, OCR fallback) */
  mode?: ExtractionMode;
  /** OCR language(s), e.g. 'heb+eng' */
  ocrLanguage?: string;
  /** OCR render scale multiplier (default 3 = 450 DPI) */
  scale?: number;
  /** Progress callback */
  progress?: (message: string) => void;
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
      progress?.(`Running OCR on ${pagesNeedingOcr.length} page(s)...`);
      await runOcr(pdfPath, pages, pagesNeedingOcr, mode, ocrLanguage, scale, progress);
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
  progress?: (message: string) => void,
): Promise<void> {
  let ocrEngine: OcrEngine | null = null;
  try {
    ocrEngine = new OcrEngine(ocrLanguage, progress);
    await ocrEngine.initialize();

    for (const pageIdx of pagesNeedingOcr) {
      const page = pages[pageIdx];
      progress?.(`OCR page ${page.pageNumber} of ${pages.length}...`);

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
    }
  } finally {
    if (ocrEngine) {
      await ocrEngine.terminate();
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
