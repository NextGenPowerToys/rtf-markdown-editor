/// <reference types="node" />

/**
 * Export markdown as a Word DOCX file.
 *
 * Strategy:
 *  - Text content  → altChunk HTML segments (Word imports them on open)
 *  - Mermaid PNGs  → proper OOXML image parts in word/media/ (always visible)
 *
 * When there are no Mermaid diagrams the whole HTML is a single altChunk.
 * When Mermaid images are present the generated HTML is split at the
 * mermaid-rendered div boundaries; each text segment becomes its own
 * afchunk_N.htm and each PNG is stored as word/media/mermaid_N.png,
 * referenced via a standard <w:drawing> element.
 *
 * No external npm packages — only Node.js built-in zlib (via ZipWriter).
 */
import { exportToHTML } from './htmlExporter';
import { ZipWriter } from './zipWriter';
import { RTLService } from '../services/RTLService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HtmlSegment  { type: 'html';    content: string; }
interface MermaidSegment { type: 'mermaid'; pngBase64: string; }
type Segment = HtmlSegment | MermaidSegment;

export interface DocxExportOptions {
  title?: string;
  mermaidImages?: Record<string, string>;
  /** Absolute directory path used to resolve relative image src values */
  basePath?: string;
  /** Enable RTL mode (auto-detect from markdown if not specified) */
  rtl?: boolean;
}

// ---------------------------------------------------------------------------
// PNG dimension parser (no external dependency)
// ---------------------------------------------------------------------------

function parsePngDimensions(buf: Buffer): { width: number; height: number } {
  // PNG IHDR: signature (8) + length (4) + 'IHDR' (4) + width (4) + height (4)
  if (buf.length < 24) { return { width: 800, height: 600 }; }
  return {
    width:  buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

// ---------------------------------------------------------------------------
// HTML post-processing helpers
// ---------------------------------------------------------------------------

/** Extract the CSS block from a full HTML document produced by exportToHTML */
function extractCss(html: string): string {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

/**
 * Extract the inner content of <div class="editor-content">…</div>.
 * Uses a simple div-depth counter so deeply nested content is handled correctly.
 */
function extractBodyContent(html: string): string {
  const startTag = '<div class="editor-content">';
  const startPos = html.indexOf(startTag);
  if (startPos === -1) { return html; }

  const contentStart = startPos + startTag.length;
  let depth = 1;
  let pos = contentStart;

  while (pos < html.length && depth > 0) {
    const nextOpen  = html.indexOf('<div', pos);
    const nextClose = html.indexOf('</div>', pos);
    if (nextClose === -1) { break; }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + 4;
    } else {
      depth--;
      if (depth === 0) { return html.slice(contentStart, nextClose); }
      pos = nextClose + 6;
    }
  }
  return html.slice(contentStart);
}

/**
 * Split body HTML at each <div data-mdwe="mermaid-rendered"> block.
 * Returns alternating html / mermaid segments in document order.
 */
function splitAtMermaidDivs(bodyContent: string): Segment[] {
  const segments: Segment[] = [];

  // Matches the complete mermaid-rendered wrapper div (contains one void <img> → no nested </div>)
  const pattern = /<div[^>]*data-mdwe="mermaid-rendered"[^>]*>[\s\S]*?<\/div>/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(bodyContent)) !== null) {
    // Text preceding this mermaid div
    if (match.index > lastIndex) {
      const text = bodyContent.slice(lastIndex, match.index).trim();
      if (text) { segments.push({ type: 'html', content: text }); }
    }

    // Extract base64 PNG from the embedded <img src="data:image/png;base64,…">
    const imgMatch = match[0].match(/src="data:image\/png;base64,([^"]+)"/);
    if (imgMatch) {
      segments.push({ type: 'mermaid', pngBase64: imgMatch[1] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text after the last mermaid div
  if (lastIndex < bodyContent.length) {
    const text = bodyContent.slice(lastIndex).trim();
    if (text) { segments.push({ type: 'html', content: text }); }
  }

  return segments.length > 0 ? segments : [{ type: 'html', content: bodyContent }];
}

/** Wrap an HTML fragment as a complete standalone HTML document. */
function wrapAsHtml(content: string, title: string, css: string, isRTL: boolean): string {
  const safe = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const dir = isRTL ? ' dir="rtl"' : '';
  return `<!DOCTYPE html>
<html${dir}>
<head>
  <meta charset="UTF-8">
  <title>${safe}</title>
  <style>${css}</style>
</head>
<body>
<div class="editor-content">
${content}
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// OOXML drawing XML for an inline image
// ---------------------------------------------------------------------------

/** 1 pixel at 96 DPI in English Metric Units */
const PX_TO_EMU = 9525;
/** Maximum image width = ~16.5 cm text area (Letter/A4 with 1-inch margins) */
const MAX_IMG_WIDTH_EMU = 5943600;

function drawingXml(relId: string, pngBuf: Buffer, imageIdx: number): string {
  const { width: rawW, height: rawH } = parsePngDimensions(pngBuf);

  let cx = rawW * PX_TO_EMU;
  let cy = rawH * PX_TO_EMU;

  // Scale down proportionally if wider than the text area
  if (cx > MAX_IMG_WIDTH_EMU) {
    cy = Math.round(cy * MAX_IMG_WIDTH_EMU / cx);
    cx = MAX_IMG_WIDTH_EMU;
  }

  const n = imageIdx + 1; // Word requires id ≥ 1

  return `    <w:p>
      <w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="${cx}" cy="${cy}"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="${n}" name="Image${n}"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic>
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic>
                  <pic:nvPicPr>
                    <pic:cNvPr id="${n}" name="mermaid_${imageIdx}.png"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${relId}"/>
                    <a:stretch><a:fillRect/></a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="${cx}" cy="${cy}"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>`;
}

// ---------------------------------------------------------------------------
// Static XML fragments
// ---------------------------------------------------------------------------

function relsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;
}

// ---------------------------------------------------------------------------
// Dynamic XML builders
// ---------------------------------------------------------------------------

function buildContentTypesXml(chunkCount: number, pngCount: number): string {
  const chunkOverrides = Array.from({ length: chunkCount }, (_, i) =>
    `  <Override PartName="/afchunk_${i}.htm" ContentType="text/html"/>`
  ).join('\n');
  const pngLine = pngCount > 0
    ? '\n  <Default Extension="png" ContentType="image/png"/>'
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>${pngLine}
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
${chunkOverrides}
</Types>`;
}

function buildDocumentRelsXml(chunkCount: number, pngCount: number): string {
  const lines: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    lines.push(
      `  <Relationship Id="chunk${i}"\n` +
      `    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk"\n` +
      `    Target="../afchunk_${i}.htm"/>`
    );
  }
  for (let i = 0; i < pngCount; i++) {
    lines.push(
      `  <Relationship Id="imgRid${i}"\n` +
      `    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"\n` +
      `    Target="media/mermaid_${i}.png"/>`
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${lines.join('\n')}
</Relationships>`;
}

function buildDocumentXml(segments: Segment[], pngBuffers: Buffer[], isRTL: boolean): string {
  let chunkIdx = 0;
  let imgIdx   = 0;
  const bodyParts: string[] = [];

  for (const seg of segments) {
    if (seg.type === 'html') {
      bodyParts.push(`    <w:altChunk r:id="chunk${chunkIdx++}"/>`);
    } else {
      bodyParts.push(drawingXml(`imgRid${imgIdx}`, pngBuffers[imgIdx], imgIdx));
      imgIdx++;
    }
  }

  // Minimal section properties (US Letter page, 1-inch margins)
  const bidi = isRTL ? '\n      <w:bidi/>' : '';
  const sectPr = `    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720" w:gutter="0"/>${bidi}
    </w:sectPr>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
${bodyParts.join('\n')}
${sectPr}
  </w:body>
</w:document>`;
}

// ---------------------------------------------------------------------------
// Simple single-altChunk path (no Mermaid diagrams)
// ---------------------------------------------------------------------------

function buildSimpleDocx(html: string, isRTL: boolean): Buffer {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/afchunk_0.htm" ContentType="text/html"/>
</Types>`;

  const bidi = isRTL ? '\n      <w:bidi/>' : '';
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:altChunk r:id="chunk0"/>
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"
               w:header="720" w:footer="720" w:gutter="0"/>${bidi}
    </w:sectPr>
  </w:body>
</w:document>`;

  const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="chunk0"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk"
    Target="../afchunk_0.htm"/>
</Relationships>`;

  const zip = new ZipWriter();
  zip.addFile('[Content_Types].xml',          Buffer.from(contentTypes,  'utf8'));
  zip.addFile('_rels/.rels',                  Buffer.from(relsXml(),     'utf8'));
  zip.addFile('word/document.xml',            Buffer.from(documentXml,   'utf8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(documentRels,  'utf8'));
  zip.addFile('afchunk_0.htm',                Buffer.from(html,          'utf8'));
  return zip.toBuffer();
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Convert markdown to a DOCX Buffer.
 *
 * Mermaid diagrams (pre-rendered as PNG data URLs) are stored as proper OOXML
 * image parts so they display correctly in all Word versions without relying on
 * Word's limited data-URI support in altChunk HTML.
 *
 * @param markdown  Source markdown text
 * @param options   Title, pre-rendered Mermaid PNGs, base path for local images
 * @returns         Buffer containing the complete .docx file
 */
export async function exportToDOCX(
  markdown: string,
  options: DocxExportOptions = {}
): Promise<Buffer> {
  const { title = 'Untitled', mermaidImages, basePath, rtl } = options;

  // Mirror htmlExporter.ts: auto-detect RTL when not explicitly specified
  const isRTL = rtl !== undefined ? rtl : RTLService.detectRTLCharacters(markdown);

  // Generate fully self-contained HTML (local images base64-embedded,
  // Mermaid PNGs injected as data URIs via replaceMermaidWithImages).
  const html = await exportToHTML(markdown, {
    title,
    includeStyles: true,
    standalone: true,
    selfContained: true,
    basePath,
    mermaidImages,
    rtl: isRTL,
  });

  // Fast path: no Mermaid diagrams → single altChunk for the whole document
  if (!html.includes('data-mdwe="mermaid-rendered"')) {
    return buildSimpleDocx(html, isRTL);
  }

  // --- Mermaid path: split HTML at mermaid-rendered boundaries ---

  const css         = extractCss(html);
  const bodyContent = extractBodyContent(html);
  const segments    = splitAtMermaidDivs(bodyContent);

  // Decode each mermaid segment's base64 → binary PNG
  const pngBuffers: Buffer[] = [];
  for (const seg of segments) {
    if (seg.type === 'mermaid') {
      pngBuffers.push(Buffer.from(seg.pngBase64, 'base64'));
    }
  }

  const chunkCount = segments.filter(s => s.type === 'html').length;
  const pngCount   = pngBuffers.length;

  const zip = new ZipWriter();

  // Package-level manifests
  zip.addFile('[Content_Types].xml',          Buffer.from(buildContentTypesXml(chunkCount, pngCount), 'utf8'));
  zip.addFile('_rels/.rels',                  Buffer.from(relsXml(),                                  'utf8'));
  zip.addFile('word/document.xml',            Buffer.from(buildDocumentXml(segments, pngBuffers, isRTL), 'utf8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(buildDocumentRelsXml(chunkCount, pngCount),  'utf8'));

  // HTML chunks for text segments
  let chunkIdx = 0;
  for (const seg of segments) {
    if (seg.type === 'html') {
      const wrapped = wrapAsHtml(seg.content, title, css, isRTL);
      zip.addFile(`afchunk_${chunkIdx}.htm`, Buffer.from(wrapped, 'utf8'));
      chunkIdx++;
    }
  }

  // PNG image parts
  let imgIdx = 0;
  for (const buf of pngBuffers) {
    zip.addFile(`word/media/mermaid_${imgIdx}.png`, buf);
    imgIdx++;
  }

  return zip.toBuffer();
}
