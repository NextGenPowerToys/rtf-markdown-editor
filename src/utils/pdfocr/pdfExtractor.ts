import * as fs from 'fs';
import type { TextItem, ImageItem, PageData } from './types';

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

// Minimum image dimensions to extract (skip tiny icons/masks)
const MIN_IMAGE_SIZE = 50;

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

    // Extract images from this page
    const images = await extractPageImages(page, viewport, pdfjsLib);

    pages.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      items,
      images,
    });

    page.cleanup();
  }

  await doc.cleanup();
  await doc.destroy();

  return pages;
}

/**
 * Extract images from a PDF page using the operator list.
 * Converts raw pixel data to PNG via the canvas package.
 */
async function extractPageImages(
  page: any,
  viewport: { width: number; height: number },
  pdfjsLib: any,
): Promise<ImageItem[]> {
  const images: ImageItem[] = [];

  let createCanvas: any;
  try {
    const canvasModule = require('canvas');
    createCanvas = canvasModule.createCanvas;
  } catch {
    // canvas not available — skip image extraction
    return images;
  }

  try {
    const operatorList = await page.getOperatorList();
    const OPS = pdfjsLib.OPS;

    // Track current transformation matrix (CTM) to determine image position/size
    const ctmStack: number[][] = [];
    let ctm = [1, 0, 0, 1, 0, 0]; // identity

    for (let i = 0; i < operatorList.fnArray.length; i++) {
      const fn = operatorList.fnArray[i];
      const args = operatorList.argsArray[i];

      if (fn === OPS.save) {
        ctmStack.push([...ctm]);
      } else if (fn === OPS.restore) {
        ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
      } else if (fn === OPS.transform) {
        ctm = multiplyMatrix(ctm, args as number[]);
      } else if (fn === OPS.paintImageXObject) {
        const objId = args[0];
        try {
          const imgData = await new Promise<any>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
            page.objs.get(objId, (data: any) => {
              clearTimeout(timeout);
              resolve(data);
            });
          });

          if (!imgData || !imgData.width || !imgData.height) continue;
          if (imgData.width < MIN_IMAGE_SIZE || imgData.height < MIN_IMAGE_SIZE) continue;

          // Compute position and displayed size from CTM
          const displayWidth = Math.abs(ctm[0]) || imgData.width;
          const displayHeight = Math.abs(ctm[3]) || imgData.height;
          const x = ctm[4];
          const y = viewport.height - ctm[5] - displayHeight;

          // Convert raw pixel data to PNG
          const pngBuffer = rawImageToPng(imgData, createCanvas);
          if (pngBuffer) {
            images.push({
              data: pngBuffer,
              x,
              y,
              width: displayWidth,
              height: displayHeight,
            });
          }
        } catch {
          // Skip images that can't be extracted
        }
      }
    }
  } catch {
    // Operator list extraction failed — skip images for this page
  }

  return images;
}

/**
 * Multiply two 2D transformation matrices [a,b,c,d,e,f].
 */
function multiplyMatrix(m1: number[], m2: number[]): number[] {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/**
 * Convert pdfjs-dist raw image data to a PNG buffer using the canvas package.
 * Handles GRAYSCALE (kind=1), RGB (kind=2), and RGBA (kind=3) formats.
 */
function rawImageToPng(imgData: any, createCanvas: any): Buffer | null {
  try {
    const { width, height, data, kind } = imgData;
    if (!data || !width || !height) return null;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);
    const rgba = imageData.data;

    if (kind === 3 || (!kind && data.length >= width * height * 4)) {
      // RGBA — copy directly
      rgba.set(data.subarray(0, width * height * 4));
    } else if (kind === 2 || (!kind && data.length >= width * height * 3)) {
      // RGB — expand to RGBA
      let src = 0;
      let dst = 0;
      const pixelCount = width * height;
      for (let p = 0; p < pixelCount; p++) {
        rgba[dst++] = data[src++];
        rgba[dst++] = data[src++];
        rgba[dst++] = data[src++];
        rgba[dst++] = 255;
      }
    } else if (kind === 1) {
      // Grayscale — expand to RGBA
      let dst = 0;
      const pixelCount = width * height;
      for (let p = 0; p < pixelCount; p++) {
        const v = data[p];
        rgba[dst++] = v;
        rgba[dst++] = v;
        rgba[dst++] = v;
        rgba[dst++] = 255;
      }
    } else {
      return null;
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas.toBuffer('image/png');
  } catch {
    return null;
  }
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
