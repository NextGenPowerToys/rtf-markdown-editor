/// <reference types="node" />

/**
 * Import a Word DOCX file and convert it to Markdown.
 *
 * Two paths:
 *
 * A) Extension-generated DOCX (detected by presence of afchunk_0.htm):
 *    All text is stored as altChunk HTML (afchunk_N.htm entries in the ZIP).
 *    Mermaid diagrams are stored as word/media/mermaid_N.png.
 *    We reconstruct the ordered HTML directly from the ZIP without mammoth,
 *    because mammoth silently ignores altChunk content.
 *
 * B) Standard Word DOCX (no afchunk_0.htm):
 *    Use mammoth for conversion, extracting images to .attachments/.
 */
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { htmlToMarkdown } from './htmlProcessor';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AdmZip = require('adm-zip');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth') as typeof import('mammoth');

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Convert a .docx file to a Markdown string.
 *
 * Embedded images are saved to .attachments/.<mdBaseName>/ beside the output
 * Markdown file, matching the existing attachment folder convention.
 *
 * @param docxPath           Absolute path to the source .docx file.
 * @param outputMarkdownPath Absolute path where the .md file will be written.
 *                           Used to compute relative image paths; the caller
 *                           is responsible for writing the returned string.
 */
export async function importFromDOCX(
  docxPath: string,
  outputMarkdownPath: string
): Promise<string> {
  const zip = new AdmZip(docxPath);

  // Detect extension-generated DOCX by the presence of the first altChunk file
  const isExtensionDocx = zip.getEntry('afchunk_0.htm') !== null;

  if (isExtensionDocx) {
    return importFromExtensionDocx(zip, outputMarkdownPath);
  } else {
    return importFromStandardDocx(docxPath, outputMarkdownPath);
  }
}

// ---------------------------------------------------------------------------
// Path A: extension-generated DOCX (altChunk HTML + OOXML image parts)
// ---------------------------------------------------------------------------

/**
 * Extract the inner content of <div class="editor-content">…</div>.
 * Mirrors extractBodyContent() in docxExporter.ts.
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
 * Parse word/_rels/document.xml.rels into a relId → target-path map.
 * Targets like "../afchunk_0.htm" have the leading "../" stripped so they
 * can be looked up directly in the ZIP as "afchunk_0.htm".
 */
function parseRels(relsXml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const re = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    map[m[1]] = m[2].replace(/^\.\.\//, '');
  }
  return map;
}

type DocItem = { type: 'chunk'; relId: string } | { type: 'image'; relId: string };

/**
 * Scan word/document.xml linearly for altChunk and image blip references
 * in document order, producing an interleaved sequence.
 */
function parseDocumentSequence(docXml: string): DocItem[] {
  const items: DocItem[] = [];
  // Matches either <w:altChunk ... r:id="..."> or <a:blip ... r:embed="...">
  const re = /<w:altChunk[^>]*r:id="([^"]+)"|<a:blip[^>]*r:embed="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(docXml)) !== null) {
    if (m[1]) { items.push({ type: 'chunk', relId: m[1] }); }
    else if (m[2]) { items.push({ type: 'image', relId: m[2] }); }
  }
  return items;
}

/**
 * Find all data-URI image srcs in an HTML string, save each as a file in
 * attachDir, and replace the src with a file:// URI so that
 * htmlToMarkdown's convertToRelativePath produces a correct relative path.
 *
 * This is needed because the DOCX exporter embeds all local images (JPG, PNG,
 * etc.) as base64 data URIs inside afchunk HTML via exportToHTML selfContained.
 */
function saveDataUriImages(
  html: string,
  attachDir: string,
  imgCounterRef: { value: number },
  attachDirCreatedRef: { value: boolean }
): string {
  return html.replace(
    /src="(data:image\/([^;]+);base64,([^"]+))"/gi,
    (_match, _dataUri, mimeSubtype, base64Data) => {
      const extMap: Record<string, string> = {
        jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif',
        webp: 'webp', bmp: 'bmp', tiff: 'tiff', 'svg+xml': 'svg',
      };
      const rawExt = mimeSubtype.toLowerCase();
      const ext = extMap[rawExt] ?? rawExt.replace('+', '');
      imgCounterRef.value++;
      const fileName = `image_${imgCounterRef.value}.${ext}`;
      if (!attachDirCreatedRef.value) {
        fs.mkdirSync(attachDir, { recursive: true });
        attachDirCreatedRef.value = true;
      }
      const absPath = path.join(attachDir, fileName);
      fs.writeFileSync(absPath, Buffer.from(base64Data, 'base64'));
      return `src="${pathToFileURL(absPath).toString()}"`;
    }
  );
}

function importFromExtensionDocx(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zip: any,
  outputMarkdownPath: string
): string {
  const mdDir      = path.dirname(outputMarkdownPath);
  const mdBaseName = path.basename(outputMarkdownPath, path.extname(outputMarkdownPath));
  const attachDir  = path.join(mdDir, '.attachments', `.${mdBaseName}`);

  // Build relId → file-path map from document relationships
  const relsEntry = zip.getEntry('word/_rels/document.xml.rels');
  const rels: Record<string, string> = relsEntry
    ? parseRels(relsEntry.getData().toString('utf8'))
    : {};

  // Get ordered sequence of altChunk and image references from document.xml
  const docEntry = zip.getEntry('word/document.xml');
  const docXml   = docEntry ? docEntry.getData().toString('utf8') : '';
  const sequence = parseDocumentSequence(docXml);

  const htmlParts: string[] = [];
  // Shared counter/flag across both OOXML images and data-URI images
  const imgCounterRef      = { value: 0 };
  const attachDirCreatedRef = { value: false };

  for (const item of sequence) {
    const target = rels[item.relId];
    if (!target) { continue; }

    if (item.type === 'chunk') {
      // target is like "afchunk_0.htm" — look it up directly in the ZIP root
      const entry = zip.getEntry(target);
      if (entry) {
        let chunkHtml = entry.getData().toString('utf8');
        // Extract any data-URI images embedded by the selfContained exporter
        // (JPGs, PNGs, etc.) and save them to .attachments/ as real files
        chunkHtml = saveDataUriImages(chunkHtml, attachDir, imgCounterRef, attachDirCreatedRef);
        htmlParts.push(extractBodyContent(chunkHtml));
      }
    } else {
      // target is like "media/mermaid_0.png" — lives under word/ in the ZIP
      const entry = zip.getEntry('word/' + target);
      if (entry) {
        if (!attachDirCreatedRef.value) {
          fs.mkdirSync(attachDir, { recursive: true });
          attachDirCreatedRef.value = true;
        }
        imgCounterRef.value++;
        const ext      = path.extname(target) || '.png';
        const fileName = `image_${imgCounterRef.value}${ext}`;
        const absPath  = path.join(attachDir, fileName);
        fs.writeFileSync(absPath, entry.getData());
        // Use file:// URI so htmlToMarkdown's convertToRelativePath resolves
        // the correct relative path on both macOS/Linux and Windows
        htmlParts.push(`<img src="${pathToFileURL(absPath).toString()}">`);
      }
    }
  }

  const assembledHtml = htmlParts.join('\n');
  return htmlToMarkdown(assembledHtml, {}, outputMarkdownPath);
}

// ---------------------------------------------------------------------------
// Path B: standard Word DOCX (mammoth)
// ---------------------------------------------------------------------------

async function importFromStandardDocx(
  docxPath: string,
  outputMarkdownPath: string
): Promise<string> {
  const mdDir      = path.dirname(outputMarkdownPath);
  const mdBaseName = path.basename(outputMarkdownPath, path.extname(outputMarkdownPath));
  const attachDir  = path.join(mdDir, '.attachments', `.${mdBaseName}`);
  let imgCounter = 0;
  let attachDirCreated = false;

  const contentTypeMap: Record<string, string> = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/bmp': 'bmp',
    'image/tiff': 'tiff', 'image/svg+xml': 'svg',
  };

  const mammothOptions = {
    convertImage: mammoth.images.imgElement(async (image: {
      read(): Promise<Buffer>;
      contentType: string;
    }) => {
      imgCounter++;
      const ext      = contentTypeMap[image.contentType.toLowerCase()] ?? 'png';
      const fileName = `image_${imgCounter}.${ext}`;
      if (!attachDirCreated) {
        fs.mkdirSync(attachDir, { recursive: true });
        attachDirCreated = true;
      }
      const absPath = path.join(attachDir, fileName);
      fs.writeFileSync(absPath, await image.read());
      return { src: pathToFileURL(absPath).toString() };
    }),
  };

  const result = await mammoth.convertToHtml({ path: docxPath }, mammothOptions);

  if (result.messages && result.messages.length > 0) {
    const warnings = result.messages
      .filter((m: { type: string }) => m.type === 'warning')
      .map((m: { message: string }) => m.message);
    if (warnings.length > 0) {
      console.warn('[importFromDOCX] mammoth warnings:', warnings.join('; '));
    }
  }

  return htmlToMarkdown(result.value, {}, outputMarkdownPath);
}
