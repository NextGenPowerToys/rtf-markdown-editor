import * as fs from 'fs';
import type { TextItem, PageData } from './types';

// pdfjs-dist types
interface PdfTextItem {
  str: string;
  dir: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL: boolean;
}

interface PdfTextContent {
  items: (PdfTextItem | { type: string })[];
  styles: Record<string, { fontFamily: string; ascent: number; descent: number; vertical: boolean }>;
}

/**
 * Extract text with positioning data from a PDF using pdfjs-dist.
 * Returns structured page data with text items containing coordinates,
 * font info, and bold/italic detection.
 */
export async function extractPdfText(pdfPath: string): Promise<PageData[]> {
  // Dynamic import for pdfjs-dist (handles ESM/CJS in Node.js)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const pages: PageData[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent: PdfTextContent = await page.getTextContent();

    const items: TextItem[] = [];

    for (const item of textContent.items) {
      // Skip marked content items (they don't have text)
      if (!('str' in item) || !(item as PdfTextItem).str) continue;

      const textItem = item as PdfTextItem;
      if (textItem.str.trim() === '') continue;

      const transform = textItem.transform;
      // PDF transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
      const fontSize = Math.abs(transform[3]) || Math.abs(transform[0]);
      const x = transform[4];
      // Convert PDF coordinates (bottom-up) to top-down
      const y = viewport.height - transform[5];

      const fontName = textItem.fontName || '';
      const isBold = detectBold(fontName, textContent.styles);
      const isItalic = detectItalic(fontName, textContent.styles);

      items.push({
        text: textItem.str,
        x,
        y,
        width: textItem.width,
        height: textItem.height || fontSize,
        fontSize,
        fontName,
        isBold,
        isItalic,
      });
    }

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      items,
    });

    page.cleanup();
  }

  await doc.cleanup();
  await doc.destroy();

  return pages;
}

/**
 * Check if a page has meaningful text content.
 * Used to decide whether OCR is needed.
 */
export function pageHasText(page: PageData, minItems = 5): boolean {
  return page.items.length >= minItems;
}

function detectBold(fontName: string, styles: PdfTextContent['styles']): boolean {
  const lowerName = fontName.toLowerCase();
  if (lowerName.includes('bold') || lowerName.includes('-bd')) return true;
  if (lowerName.includes('heavy') || lowerName.includes('black')) return true;

  // Check style info
  const style = styles[fontName];
  if (style) {
    const familyLower = style.fontFamily.toLowerCase();
    if (familyLower.includes('bold') || familyLower.includes('heavy')) return true;
  }

  return false;
}

function detectItalic(fontName: string, styles: PdfTextContent['styles']): boolean {
  const lowerName = fontName.toLowerCase();
  if (lowerName.includes('italic') || lowerName.includes('oblique')) return true;

  const style = styles[fontName];
  if (style) {
    const familyLower = style.fontFamily.toLowerCase();
    if (familyLower.includes('italic') || familyLower.includes('oblique')) return true;
  }

  return false;
}
