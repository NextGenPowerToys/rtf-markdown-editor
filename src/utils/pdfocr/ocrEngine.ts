import * as fs from 'fs';
import { resolveOfflineTesseractPaths, type OfflineTesseractPaths } from './offlineConfig';
import type { TextItem } from './types';

/**
 * OCR engine using Tesseract.js for scanned/image-based PDF pages.
 * Renders PDF pages to images via pdfjs-dist + canvas — no shell-outs to
 * external binaries, no CDN access. Traineddata + WASM core are loaded from
 * the bundled resources directory.
 */
export class OcrEngine {
  private worker: any = null;
  private language: string;
  private progress?: (message: string) => void;
  private offlinePaths: OfflineTesseractPaths;

  constructor(
    language = 'heb+eng',
    extensionRoot: string,
    progress?: (message: string) => void,
  ) {
    this.language = language;
    this.progress = progress;
    this.offlinePaths = resolveOfflineTesseractPaths(extensionRoot);
  }

  async initialize(): Promise<void> {
    const Tesseract = await import('tesseract.js');
    this.progress?.('Initializing OCR engine (offline)...');
    this.worker = await Tesseract.createWorker(this.language, undefined, {
      corePath: this.offlinePaths.corePath,
      langPath: this.offlinePaths.langPath,
      gzip: this.offlinePaths.gzip,
      cacheMethod: this.offlinePaths.cacheMethod,
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          this.progress?.(`OCR progress: ${(m.progress * 100).toFixed(0)}%`);
        }
      },
    });
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  /**
   * Render a PDF page to an image buffer using pdfjs-dist + canvas.
   * No external binaries; everything runs inside the Node.js extension host.
   */
  async renderPageToImage(pdfPath: string, pageNum: number, scale = 3.0): Promise<Buffer> {
    return renderWithPdfjs(pdfPath, pageNum, scale);
  }

  /**
   * Run OCR on an image buffer and return structured text items.
   * When using multi-language (e.g. 'heb+eng'), performs a second pass with
   * the primary language only to fix misreads (e.g. Hebrew read as Latin).
   */
  async recognizeImage(imageBuffer: Buffer, pageWidth: number, pageHeight: number, pdfTextItems?: TextItem[]): Promise<TextItem[]> {
    if (!this.worker) {
      throw new Error('OCR engine not initialized. Call initialize() first.');
    }

    const result = await this.worker.recognize(imageBuffer);
    this.progress?.('OCR recognition complete');

    const { scaleX, scaleY } = getImageScale(imageBuffer, result, pageWidth, pageHeight);
    const items = extractWordItems(result, scaleX, scaleY);

    // If using multi-language, detect and fix Latin misreads in Hebrew context
    if (this.language.includes('+')) {
      await this.fixMisreadWords(imageBuffer, items, scaleX, scaleY);
    }

    // Detect low-confidence regions (e.g. inverted text on dark backgrounds)
    // and retry with color-inverted image
    await this.fixInvertedText(imageBuffer, items, scaleX, scaleY, pdfTextItems);

    // Deduplicate items at the same position with same text
    for (let i = items.length - 1; i >= 1; i--) {
      for (let j = i - 1; j >= 0; j--) {
        if (items[i].text.trim() === items[j].text.trim()
            && Math.abs(items[i].x - items[j].x) < 2
            && Math.abs(items[i].y - items[j].y) < 2) {
          if ((items[i].confidence ?? 0) > (items[j].confidence ?? 0)) {
            items.splice(j, 1);
          } else {
            items.splice(i, 1);
          }
          break;
        }
      }
    }

    return items;
  }

  /**
   * Detect Latin-only words in a predominantly Hebrew page and replace them
   * with results from a primary-language-only OCR pass.
   */
  private async fixMisreadWords(
    imageBuffer: Buffer,
    items: TextItem[],
    scaleX: number,
    scaleY: number,
  ): Promise<void> {
    let hebrewCount = 0;
    let latinOnlyCount = 0;
    for (const item of items) {
      if (hasHebrew(item.text)) hebrewCount++;
      else if (isLatinOnly(item.text)) latinOnlyCount++;
    }

    if (hebrewCount < 3 || latinOnlyCount === 0) return;
    if (latinOnlyCount / (hebrewCount + latinOnlyCount) > 0.4) return;

    const primaryLang = this.language.split('+')[0];
    this.progress?.(`Re-checking ${latinOnlyCount} word(s) with ${primaryLang}-only OCR...`);

    try {
      await this.worker.reinitialize(primaryLang);
      const result2 = await this.worker.recognize(imageBuffer);
      await this.worker.reinitialize(this.language);

      const items2 = extractWordItems(result2, scaleX, scaleY);

      for (const item of items) {
        if (!isLatinOnly(item.text)) continue;

        const match = findBestOverlap(item, items2);
        if (match && hasHebrew(match.text)) {
          item.text = match.text;
          item.confidence = match.confidence;
        }
      }
    } catch (err) {
      this.progress?.(`Misread fix failed: ${(err as Error).message}`);
      try { await this.worker.reinitialize(this.language); } catch { /* ignore */ }
    }
  }

  /**
   * Detect low-confidence regions (likely inverted text on dark backgrounds)
   * and re-OCR them with color-inverted image for better recognition.
   */
  private async fixInvertedText(
    imageBuffer: Buffer,
    items: TextItem[],
    scaleX: number,
    scaleY: number,
    pdfTextItems?: TextItem[],
  ): Promise<void> {
    const lowConf = items.filter(i => (i.confidence ?? 100) < 40 && i.text.trim().length > 0);
    if (lowConf.length === 0) return;

    // Check if canvas is available for image manipulation
    if (!canvasAvailable) return;

    // Group low-confidence items into tight Y bands (same line only)
    const bands: TextItem[][] = [];
    const sorted = [...lowConf].sort((a, b) => a.y - b.y);
    let band: TextItem[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const avgH = band.reduce((s, it) => s + it.height, 0) / band.length;
      if (sorted[i].y - sorted[i - 1].y < avgH * 0.7) {
        band.push(sorted[i]);
      } else {
        bands.push(band);
        band = [sorted[i]];
      }
    }
    bands.push(band);

    const badBands = bands.filter(b => {
      const avg = b.reduce((s, i) => s + (i.confidence ?? 0), 0) / b.length;
      return avg < 35;
    });
    if (badBands.length === 0) return;

    // Get full image height from PNG header
    let imgHeight = 1;
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) {
      imgHeight = imageBuffer.readUInt32BE(20);
    }

    for (const band of badBands) {
      const yMinPage = Math.min(...band.map(i => i.y));
      const yMaxPage = Math.max(...band.map(i => i.y + i.height));
      const bandHeight = yMaxPage - yMinPage;
      const pad = Math.max(bandHeight * 0.5, 5);
      const cropYmin = Math.max(0, Math.floor((yMinPage - pad) / scaleY));
      const cropYmax = Math.min(imgHeight, Math.ceil((yMaxPage + pad) / scaleY));
      if (cropYmax - cropYmin < 10) continue;

      try {
        const { inverted: invertedCrop } = await invertRegion(
          imageBuffer, cropYmin, cropYmax,
        );

        const result = await this.worker.recognize(invertedCrop);
        const newItems = extractWordItems(result, scaleX, scaleY);

        const yOffset = cropYmin * scaleY;
        for (const ni of newItems) {
          ni.y += yOffset;
        }

        const goodNewItems = newItems.filter(ni => (ni.confidence ?? 0) > 50);
        if (goodNewItems.length === 0) continue;

        const newAvgConf = goodNewItems.reduce((s, i) => s + (i.confidence ?? 0), 0) / goodNewItems.length;
        const oldAvgConf = band.reduce((s, i) => s + (i.confidence ?? 0), 0) / band.length;

        if (newAvgConf > oldAvgConf + 20) {
          this.progress?.(`Fixed inverted text region (conf ${oldAvgConf.toFixed(0)}→${newAvgConf.toFixed(0)})`);

          const bandItemSet = new Set(band);
          const removedItems: TextItem[] = [];
          for (let i = items.length - 1; i >= 0; i--) {
            if (bandItemSet.has(items[i])) {
              removedItems.push(items[i]);
              items.splice(i, 1);
            }
          }

          for (const ni of goodNewItems) {
            const overlap = findBestOverlap(ni, items);
            if (!overlap || (overlap.confidence ?? 0) < 50) {
              items.push(ni);
            }
          }

          // Check for removed items that have no replacement from the inverted OCR
          const orphans = removedItems.filter(r => !findBestOverlap(r, goodNewItems));
          if (orphans.length > 0 && pdfTextItems && pdfTextItems.length > 0) {
            for (const orphan of orphans) {
              const pdfMatch = findBestOverlap(orphan, pdfTextItems);
              if (pdfMatch && hasHebrew(pdfMatch.text)) {
                const existingOverlap = findBestOverlap(pdfMatch, items);
                if (!existingOverlap) {
                  const isDup = items.some(it =>
                    it.text.trim() === pdfMatch.text.trim()
                    && Math.abs(it.y - pdfMatch.y) < 15);
                  if (!isDup) {
                    items.push({ ...pdfMatch, confidence: 80 });
                  }
                } else {
                  const existingText = existingOverlap.text.trim();
                  const pdfText = pdfMatch.text.trim();
                  let remainder = '';
                  if (pdfText.startsWith(existingText)) {
                    remainder = pdfText.slice(existingText.length).trim();
                  } else if (pdfText.endsWith(existingText)) {
                    remainder = pdfText.slice(0, pdfText.length - existingText.length).trim();
                  }
                  if (remainder && hasHebrew(remainder)) {
                    const isRemDup = items.some(it =>
                      it.text.trim() === remainder
                      && Math.abs(it.y - orphan.y) < 15);
                    if (!isRemDup) {
                      items.push({
                        ...orphan,
                        text: remainder,
                        confidence: 80,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      } catch { /* non-fatal */ }
    }
  }

  /**
   * Full OCR pipeline for a single page: render → recognize → return items.
   */
  async ocrPage(
    pdfPath: string,
    pageNum: number,
    pageWidth: number,
    pageHeight: number,
    scale = 3.0,
    pdfTextItems?: TextItem[],
  ): Promise<TextItem[]> {
    const imageBuffer = await this.renderPageToImage(pdfPath, pageNum, scale);
    return this.recognizeImage(imageBuffer, pageWidth, pageHeight, pdfTextItems);
  }
}

// ── Canvas availability check ──

let canvasAvailable = false;
let _canvasChecked = false;

async function checkCanvas(): Promise<boolean> {
  if (_canvasChecked) return canvasAvailable;
  _canvasChecked = true;
  try {
    await import('canvas');
    canvasAvailable = true;
  } catch {
    canvasAvailable = false;
  }
  return canvasAvailable;
}

// Run check immediately on module load
checkCanvas();

// ── OCR result helpers ──

function getImageScale(
  imageBuffer: Buffer,
  result: any,
  pageWidth: number,
  pageHeight: number,
): { scaleX: number; scaleY: number } {
  let imgWidth = 1;
  let imgHeight = 1;
  if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50) { // PNG magic
    imgWidth = imageBuffer.readUInt32BE(16);
    imgHeight = imageBuffer.readUInt32BE(20);
  }
  if (imgWidth <= 1 && result.data.width) imgWidth = result.data.width;
  if (imgHeight <= 1 && result.data.height) imgHeight = result.data.height;
  return { scaleX: pageWidth / imgWidth, scaleY: pageHeight / imgHeight };
}

function extractWordItems(result: any, scaleX: number, scaleY: number): TextItem[] {
  const items: TextItem[] = [];
  for (const block of result.data.blocks || []) {
    for (const paragraph of block.paragraphs || []) {
      for (const line of paragraph.lines || []) {
        for (const word of line.words || []) {
          if (!word.text.trim()) continue;
          const bbox = word.bbox;
          items.push({
            text: word.text,
            x: bbox.x0 * scaleX,
            y: bbox.y0 * scaleY,
            width: (bbox.x1 - bbox.x0) * scaleX,
            height: (bbox.y1 - bbox.y0) * scaleY,
            fontSize: (bbox.y1 - bbox.y0) * scaleY * 0.75,
            fontName: 'ocr-detected',
            isBold: false,
            isItalic: false,
            confidence: word.confidence,
          });
        }
      }
    }
  }
  return items;
}

/** True if text contains any Hebrew character */
function hasHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/** True if text contains Latin letters but NO Hebrew characters */
function isLatinOnly(text: string): boolean {
  return /[A-Za-z]/.test(text) && !hasHebrew(text);
}

/** Find the pass-2 word with the best bounding-box overlap */
function findBestOverlap(target: TextItem, candidates: TextItem[]): TextItem | null {
  let best: TextItem | null = null;
  let bestArea = 0;

  for (const c of candidates) {
    const yOverlap = Math.min(target.y + target.height, c.y + c.height) - Math.max(target.y, c.y);
    if (yOverlap <= 0) continue;
    const xOverlap = Math.min(target.x + target.width, c.x + c.width) - Math.max(target.x, c.x);
    if (xOverlap <= 0) continue;

    const area = xOverlap * yOverlap;
    if (area > bestArea) {
      bestArea = area;
      best = c;
    }
  }

  return best;
}

/**
 * Crop a horizontal band from a PNG image and invert its colors.
 * Requires the 'canvas' package.
 */
async function invertRegion(
  pngBuffer: Buffer, yMin: number, yMax: number,
): Promise<{ inverted: Buffer }> {
  const { createCanvas, loadImage } = await import('canvas');
  const img = await loadImage(pngBuffer);
  const h = yMax - yMin;
  const canvas = createCanvas(img.width, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img as any, 0, yMin, img.width, h, 0, 0, img.width, h);
  const imageData = ctx.getImageData(0, 0, img.width, h);

  for (let i = 0; i < imageData.data.length; i += 4) {
    imageData.data[i] = 255 - imageData.data[i];
    imageData.data[i + 1] = 255 - imageData.data[i + 1];
    imageData.data[i + 2] = 255 - imageData.data[i + 2];
  }
  ctx.putImageData(imageData, 0, 0);
  return { inverted: canvas.toBuffer('image/png') };
}

// ── pdfjs-dist + canvas rendering (fallback) ──

async function renderWithPdfjs(pdfPath: string, pageNum: number, scale: number): Promise<Buffer> {
  if (!canvasAvailable) {
    throw new Error(
      'PDF page rendering requires either pdftoppm (poppler-utils) or the canvas package. ' +
      'Install poppler: brew install poppler (macOS) / apt install poppler-utils (Linux)'
    );
  }

  const canvasModule = await import('canvas');
  const { createCanvas, Image } = canvasModule;

  // Patch globals for pdfjs-dist image rendering compatibility
  if (typeof globalThis.Image === 'undefined') {
    (globalThis as any).Image = Image;
  }

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const ctx = canvas.getContext('2d');

  // Fill white background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  const canvasFactory = {
    create(width: number, height: number) {
      const c = createCanvas(width, height);
      return { canvas: c, context: c.getContext('2d') };
    },
    reset(canvasAndContext: any, width: number, height: number) {
      canvasAndContext.canvas.width = width;
      canvasAndContext.canvas.height = height;
    },
    destroy(canvasAndContext: any) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    },
  };

  try {
    await page.render({
      canvasContext: ctx,
      viewport,
      canvasFactory,
    } as any).promise;
  } catch (renderErr) {
    console.warn(`Warning: Partial render for page ${pageNum}: ${(renderErr as Error).message}`);
  }

  const buffer = canvas.toBuffer('image/png');

  page.cleanup();
  await doc.destroy();

  return buffer;
}
