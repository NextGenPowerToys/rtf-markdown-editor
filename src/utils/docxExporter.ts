/**
 * Export markdown as a Word DOCX file.
 *
 * Strategy: use Word's `w:altChunk` feature to embed the fully self-contained
 * HTML produced by the existing `exportToHTML` pipeline.  When Word opens the
 * file it converts the HTML chunk to native Word XML — the same conversion that
 * happens when a user manually opens an HTML file in Word and saves it as DOCX.
 *
 * No external npm packages are used.  The DOCX container (ZIP) is built with
 * the built-in `src/utils/zipWriter.ts` helper.
 */
import { exportToHTML } from './htmlExporter';
import { ZipWriter } from './zipWriter';

export interface DocxExportOptions {
  title?: string;
  mermaidImages?: Record<string, string>;
  /** Absolute directory path used to resolve relative image src values */
  basePath?: string;
}

// ---------------------------------------------------------------------------
// OOXML XML fragments
// ---------------------------------------------------------------------------

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/afchunk.htm"
    ContentType="text/html"/>
</Types>`;
}

function relsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`;
}

function documentXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 wp14">
  <w:body>
    <w:altChunk r:id="htmlChunk"/>
  </w:body>
</w:document>`;
}

function documentRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk"
    Target="../afchunk.htm"/>
</Relationships>`;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Convert markdown to a DOCX Buffer.
 *
 * @param markdown  Source markdown text
 * @param options   Title, pre-rendered Mermaid PNGs, and base path for images
 * @returns         Buffer containing the complete .docx file
 */
export async function exportToDOCX(
  markdown: string,
  options: DocxExportOptions = {}
): Promise<Buffer> {
  const { title = 'Untitled', mermaidImages, basePath } = options;

  // Generate fully self-contained HTML (images base64-embedded so DOCX is portable)
  const html = await exportToHTML(markdown, {
    title,
    includeStyles: true,
    standalone: true,
    selfContained: true,
    basePath,
    mermaidImages,
  });

  const zip = new ZipWriter();
  zip.addFile('[Content_Types].xml',          Buffer.from(contentTypesXml(),    'utf8'));
  zip.addFile('_rels/.rels',                  Buffer.from(relsXml(),            'utf8'));
  zip.addFile('word/document.xml',            Buffer.from(documentXml(),        'utf8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(documentRelsXml(),    'utf8'));
  zip.addFile('afchunk.htm',                  Buffer.from(html,                 'utf8'));

  return zip.toBuffer();
}
