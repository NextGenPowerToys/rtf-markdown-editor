import * as fs from 'fs';
import * as vscode from 'vscode';
import { convertPdfToHtml } from './pdfocr';
import { htmlToMarkdown } from './htmlToMarkdown';
import { applyBidiReconstruction, hasRTLCharacters } from './bidiHandler';

/**
 * Import a PDF file and convert it to Markdown.
 *
 * Pipeline (PDFOCR-based):
 * 1. Try MDWE metadata recovery (lossless round-trip for PDFs we exported)
 * 2. Extract text with position data via pdfjs-dist
 * 3. OCR pages that lack text (hybrid mode: text first, OCR fallback)
 * 4. Analyze document structure (headers, tables, lists, paragraphs)
 * 5. Generate semantic HTML → convert to Markdown via Turndown
 *
 * Also supports:
 * - Bidi text reconstruction for RTL content
 */
export async function importFromPDF(
  pdfPath: string,
  context?: vscode.ExtensionContext,
  progress?: (message: string) => void
): Promise<string> {
  const buffer = fs.readFileSync(pdfPath);

  // Step 0: Quick check for MDWE metadata (lossless recovery)
  const metadataResult = await tryMetadataRecovery(buffer);
  if (metadataResult) {
    return metadataResult;
  }

  // Step 1: Use PDFOCR pipeline for conversion
  try {
    progress?.('Starting PDF conversion...');
    const result = await convertPdfToHtml(pdfPath, {
      mode: 'hybrid',
      ocrLanguage: 'heb+eng',
      scale: 3,
      progress,
    });

    // Step 2: Convert HTML to Markdown
    progress?.('Converting to Markdown...');
    const markdown = await htmlToMarkdown(result.html, { rtl: result.isRTL });
    return markdown;
  } catch (error) {
    console.warn('PDFOCR pipeline failed, falling back to heuristics:', error);
    progress?.('Advanced conversion failed, trying basic extraction...');

    // Fallback: basic pdf-parse + heuristics
    return await fallbackConvert(buffer, progress);
  }
}

// ---------------------------------------------------------------------------
// MDWE Metadata Recovery (for PDFs created by this extension)
// ---------------------------------------------------------------------------

async function tryMetadataRecovery(buffer: Buffer): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const text = data.text || '';

    // Try new base64 format first, then legacy HTML comment format
    const b64Match = text.match(/MDWE-METADATA:([A-Za-z0-9+/=]+)/);
    const legacyMatch = !b64Match ? text.match(/<!-- MDWE-METADATA: ({[^}]*}) -->/) : null;
    const metadataJson = b64Match
      ? Buffer.from(b64Match[1], 'base64').toString('utf-8')
      : legacyMatch?.[1] ?? null;
    if (metadataJson) {
      const metadata = JSON.parse(metadataJson);
      if (metadata.structure && metadata.structure.length > 0) {
        return reconstructFromMetadata(text, metadata);
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

interface PdfMetadata {
  version?: string;
  format?: string;
  rtl?: boolean;
  structure?: Array<{
    type: string;
    level?: number;
    content?: string;
  }>;
}

function reconstructFromMetadata(extractedText: string, metadata: PdfMetadata): string {
  const cleanText = extractedText
    .replace(/MDWE-METADATA:[A-Za-z0-9+/=]+\n?/, '')
    .replace(/<!-- MDWE-METADATA: ({[^}]*}) -->\n?/, '');

  if (metadata.structure && metadata.structure.length > 0) {
    const out: string[] = [];

    for (const item of metadata.structure) {
      if (item.type === 'heading') {
        const level = item.level || 1;
        out.push(`${'#'.repeat(level)} ${item.content || ''}`);
      } else if (item.type === 'list') {
        out.push(`- ${item.content || ''}`);
      } else if (item.type === 'ordered-list') {
        out.push(`1. ${item.content || ''}`);
      } else if (item.type === 'paragraph') {
        out.push(item.content || '');
      } else if (item.type === 'blank') {
        out.push('');
      }
    }

    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  return convertToMarkdown(cleanText, {});
}

// ---------------------------------------------------------------------------
// Fallback: basic pdf-parse + heuristics (when PDFOCR pipeline fails)
// ---------------------------------------------------------------------------

async function fallbackConvert(
  buffer: Buffer,
  progress?: (message: string) => void
): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    progress?.('Extracting text with basic parser...');
    const data = await pdfParse(buffer);
    const text = data.text || '';
    const title = (data.info?.Title || '').trim();
    return convertToMarkdown(text, { Title: title });
  } catch (error) {
    throw new Error(`PDF text extraction failed: ${error}`);
  }
}

// ---------------------------------------------------------------------------
// Text → Markdown heuristics (with RTL support)
// ---------------------------------------------------------------------------

function convertToMarkdown(rawText: string, info: Record<string, any>): string {
  const bidiCorrectedText = applyBidiReconstruction(rawText);
  const lines = bidiCorrectedText.split('\n');
  const out: string[] = [];
  const docHasRTL = hasRTLCharacters(bidiCorrectedText);

  const pdfTitle = (info.Title || '').trim();
  if (pdfTitle && !bidiCorrectedText.includes(pdfTitle)) {
    out.push(`# ${pdfTitle}`, '');
  }

  let prevWasBlank = true;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trimEnd();
    const line = raw.trim();

    if (!line) {
      if (!prevWasBlank && out.length > 0) {
        out.push('');
        prevWasBlank = true;
      }
      continue;
    }
    prevWasBlank = false;

    const headingLevel = detectHeadingLevel(line, lines, i, docHasRTL);
    if (headingLevel > 0) {
      if (!prevWasBlank && out.length > 0) {
        out.push('');
      }
      out.push(`${'#'.repeat(headingLevel)} ${line}`);
      out.push('');
      prevWasBlank = true;
      continue;
    }

    const orderedMatch = line.match(/^(\d{1,3}|[א-ת])[.)]\s+(.+)$/);
    if (orderedMatch) {
      out.push(`${orderedMatch[1]}. ${orderedMatch[2]}`);
      continue;
    }

    const bulletMatch = line.match(/^[•·∙‣⁃◦▪▸►]\s+(.+)$/);
    if (bulletMatch) {
      out.push(`- ${bulletMatch[1]}`);
      continue;
    }

    out.push(line);
  }

  const markdown = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return markdown + '\n';
}

function detectHeadingLevel(
  line: string,
  lines: string[],
  currentIndex: number,
  docHasRTL: boolean
): number {
  if (line.length === 0 || line.length > 150) return 0;

  const nextLine = (lines[currentIndex + 1] || '').trim();

  if (
    !docHasRTL &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) &&
    !line.match(/^\d/)
  ) {
    if (!nextLine) return 2;
  }

  if (docHasRTL) {
    const lineHasRTL = hasRTLCharacters(line);
    if (lineHasRTL && !nextLine && line.length < 120) {
      if (
        line.match(/^([\d.]+|[א-ת]+[.)]\s+)/) ||
        (!line.includes('(') && !line.includes('['))
      ) {
        return 2;
      }
    }
  }

  const numberedHeadingMatch = line.match(/^(\d{1,2})(?:\.\d{1,2})?\s+(.+)$/);
  if (numberedHeadingMatch) {
    const headingNumber = numberedHeadingMatch[1];
    const nextIsEmpty = !nextLine;
    if (nextIsEmpty && parseInt(headingNumber, 10) <= 9) {
      return parseInt(headingNumber, 10) === 1 ? 2 : 3;
    }
  }

  return 0;
}
