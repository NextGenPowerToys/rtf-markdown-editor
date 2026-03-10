import type { ContentBlock, TextSegment } from './types';

/**
 * Generate a complete RTL Hebrew HTML document from structured content blocks.
 */
export function generateHtml(blocks: ContentBlock[], title = 'PDF Document'): string {
  const bodyHtml = blocks.map(renderBlock).join('\n');

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Hebrew:wght@400;700&display=swap');

    * {
      box-sizing: border-box;
    }

    body {
      font-family: 'Noto Sans Hebrew', 'David', 'Arial Hebrew', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      line-height: 1.8;
      color: #1a1a1a;
      background: #fff;
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 30px;
      font-size: 15px;
    }

    h1 {
      font-size: 1.8em;
      text-align: center;
      margin: 1.2em 0 0.8em;
      color: #003366;
      border-bottom: 2px solid #003366;
      padding-bottom: 0.3em;
    }

    h2 {
      font-size: 1.4em;
      margin: 1.2em 0 0.6em;
      color: #003366;
    }

    h3 {
      font-size: 1.15em;
      margin: 1em 0 0.5em;
      color: #333;
    }

    p {
      margin: 0.4em 0;
      text-align: justify;
    }

    .list-item {
      display: flex;
      gap: 8px;
      margin: 0.4em 0;
      padding-right: 1em;
    }

    .list-item .marker {
      font-weight: bold;
      flex-shrink: 0;
      min-width: 2em;
      text-align: center;
    }

    .list-item .content {
      flex: 1;
      text-align: justify;
    }

    .sub-list-item {
      padding-right: 3em;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1em 0;
      direction: rtl;
      font-size: 0.95em;
    }

    thead {
      background: #003366;
      color: white;
    }

    thead th {
      padding: 10px 12px;
      text-align: right;
      font-weight: 700;
      border: 1px solid #002244;
    }

    tbody td {
      padding: 8px 12px;
      border: 1px solid #ccc;
      text-align: right;
      vertical-align: top;
    }

    tbody tr:nth-child(even) {
      background: #f8f9fa;
    }

    tbody tr:hover {
      background: #e8f0fe;
    }

    .page-break {
      border-top: 1px dashed #ccc;
      margin: 2em 0;
      page-break-before: always;
    }

    strong, b {
      font-weight: 700;
    }

    em, i {
      font-style: italic;
    }

    @media print {
      body {
        max-width: none;
        padding: 20px;
      }
      .page-break {
        border: none;
      }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function renderBlock(block: ContentBlock): string {
  switch (block.type) {
    case 'header':
      return renderHeader(block);
    case 'paragraph':
      return renderParagraph(block);
    case 'table':
      return renderTable(block);
    case 'list-item':
      return renderListItem(block);
    case 'page-break':
      return `<div class="page-break"></div>`;
    case 'image':
      return renderImage(block);
    default:
      return '';
  }
}

function renderImage(block: { data: Buffer }): string {
  const base64 = block.data.toString('base64');
  return `  <p><img src="data:image/png;base64,${base64}" alt=""></p>`;
}

function renderHeader(block: { level: 1 | 2 | 3; text: string }): string {
  const tag = `h${block.level}`;
  return `  <${tag}>${escapeHtml(block.text)}</${tag}>`;
}

function renderParagraph(block: { segments: TextSegment[] }): string {
  const content = renderSegments(block.segments);
  return `  <p>${content}</p>`;
}

function renderListItem(block: { marker: string; segments: TextSegment[] }): string {
  const content = renderSegments(block.segments);
  const isSubItem = /^\([א-תa-z]\)$/.test(block.marker.trim());
  const className = isSubItem ? 'list-item sub-list-item' : 'list-item';

  return `  <div class="${className}">
    <span class="marker">${escapeHtml(block.marker)}</span>
    <span class="content">${content}</span>
  </div>`;
}

function renderTable(block: { headers: string[]; rows: string[][] }): string {
  const numCols = Math.max(
    block.headers.length,
    ...block.rows.map(r => r.length),
  );

  if (numCols === 0) return '';

  let html = '  <table>\n';

  // Header row
  if (block.headers.some(h => h.trim())) {
    html += '    <thead>\n      <tr>\n';
    for (let c = 0; c < numCols; c++) {
      const text = block.headers[c] || '';
      html += `        <th>${escapeHtml(text)}</th>\n`;
    }
    html += '      </tr>\n    </thead>\n';
  }

  // Data rows
  if (block.rows.length > 0) {
    html += '    <tbody>\n';
    for (const row of block.rows) {
      html += '      <tr>\n';
      for (let c = 0; c < numCols; c++) {
        const text = row[c] || '';
        html += `        <td>${escapeHtml(text)}</td>\n`;
      }
      html += '      </tr>\n';
    }
    html += '    </tbody>\n';
  }

  html += '  </table>';
  return html;
}

function renderSegments(segments: TextSegment[]): string {
  return segments.map(seg => {
    let text = escapeHtml(seg.text);
    if (seg.isBold) text = `<strong>${text}</strong>`;
    if (seg.isItalic) text = `<em>${text}</em>`;
    return text;
  }).join('');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
