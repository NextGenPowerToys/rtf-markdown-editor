/**
 * PDF to HTML Converter
 *
 * Converts PDF text to intermediate HTML for better structure preservation
 * before converting to Markdown. This approach preserves:
 * - Bold and italic detection (heuristic-based on text analysis)
 * - List structures (bullets, numbered lists)
 * - Heading hierarchy (size-based detection)
 * - Table-like structures
 * - Code blocks
 * - Spacing and organization
 */

import { hasRTLCharacters } from './bidiHandler';

interface TextBlock {
  text: string;
  size?: number;
  bold?: boolean;
  italic?: boolean;
  x?: number;
  y?: number;
}

/**
 * Converts extracted PDF text to semantic HTML
 * This preserves more structure than plain text conversion
 */
export function pdfTextToHtml(
  pdfText: string,
  title?: string,
  metadata?: Record<string, any>
): string {
  const lines = pdfText.split('\n');
  let html = '';

  // Build HTML document
  html += '<!DOCTYPE html>\n';
  html += '<html>\n';
  html += '<head>\n';
  html += `<meta charset="UTF-8">\n`;
  html += `<title>${escapeHtml(title || 'Document')}</title>\n`;
  html += '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n';
  html += '</head>\n';
  html += '<body>\n';

  if (title) {
    html += `<h1>${escapeHtml(title)}</h1>\n`;
  }

  // Process text into semantic HTML
  html += linesToHtml(lines);

  html += '</body>\n';
  html += '</html>\n';

  return html;
}

/**
 * Convert lines of text to semantic HTML
 */
function linesToHtml(lines: string[]): string {
  let html = '';
  let i = 0;
  const docHasRTL = lines.some((line) => hasRTLCharacters(line));

  // Track paragraph collection to group consecutive non-empty lines
  let paragraphLines: string[] = [];

  while (i < lines.length) {
    const line = lines[i].trimEnd();
    const trimmed = line.trim();

    // Empty line - finalize any pending paragraph, add line break
    if (!trimmed) {
      if (paragraphLines.length > 0) {
        // Process collected paragraph
        const paragraphText = paragraphLines.join(' ').trim();
        html += processParagraph(paragraphText, docHasRTL);
        paragraphLines = [];
      }
      i++;
      continue;
    }

    // Try heading detection
    const headingMatch = detectHeading(trimmed, lines, i);
    if (headingMatch) {
      // Flush any pending paragraph first
      if (paragraphLines.length > 0) {
        const paragraphText = paragraphLines.join(' ').trim();
        html += processParagraph(paragraphText, docHasRTL);
        paragraphLines = [];
      }

      const { level, content } = headingMatch;
      html += `<h${level}>${escapeHtml(content)}</h${level}>\n`;
      i++;
      continue;
    }

    // Try list detection
    const listMatch = detectList(trimmed);
    if (listMatch) {
      // Flush any pending paragraph first
      if (paragraphLines.length > 0) {
        const paragraphText = paragraphLines.join(' ').trim();
        html += processParagraph(paragraphText, docHasRTL);
        paragraphLines = [];
      }

      const { type, content } = listMatch;
      const tag = type === 'ordered' ? 'ol' : 'ul';
      html += `<${tag}>\n`;

      // Collect consecutive list items
      while (i < lines.length) {
        const currentLine = lines[i].trim();
        const currentListMatch = detectList(currentLine);
        if (currentListMatch && currentListMatch.type === type) {
          html += `<li>${escapeHtml(currentListMatch.content)}</li>\n`;
          i++;
        } else {
          break;
        }
      }

      html += `</${tag}>\n`;
      continue;
    }

    // Try code block detection
    if (trimmed.startsWith('```')) {
      // Flush any pending paragraph first
      if (paragraphLines.length > 0) {
        const paragraphText = paragraphLines.join(' ').trim();
        html += processParagraph(paragraphText, docHasRTL);
        paragraphLines = [];
      }

      let codeContent = '';
      i++; // Skip opening backticks
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeContent += lines[i] + '\n';
        i++;
      }
      if (i < lines.length) {
        i++; // Skip closing backticks
      }
      html += `<pre><code>${escapeHtml(codeContent)}</code></pre>\n`;
      continue;
    }

    // Try table detection
    if (trimmed.includes('|') && !trimmed.startsWith('|')) {
      // Flush any pending paragraph first
      if (paragraphLines.length > 0) {
        const paragraphText = paragraphLines.join(' ').trim();
        html += processParagraph(paragraphText, docHasRTL);
        paragraphLines = [];
      }

      const tableResult = detectTable(lines, i);
      if (tableResult) {
        html += tableResult.html;
        i = tableResult.nextIndex;
        continue;
      }
    }

    // Regular text - queue for paragraph collection
    paragraphLines.push(trimmed);
    i++;
  }

  // Flush any remaining paragraph
  if (paragraphLines.length > 0) {
    const paragraphText = paragraphLines.join(' ').trim();
    html += processParagraph(paragraphText, docHasRTL);
  }

  return html;
}

/**
 * Process a paragraph text and detect metadata or regular paragraph
 */
function processParagraph(text: string, docHasRTL: boolean): string {
  if (!text) return '';

  // Check for metadata key-value pairs (bold key: value)
  const kvMatch = text.match(/^([^:]+):\s+(.+)$/);
  if (kvMatch && kvMatch[1].length < 50) {
    const key = kvMatch[1];
    const value = kvMatch[2];
    if (detectMetadataLine(key, 0, [])) {
      return `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>\n`;
    }
  }

  // Regular paragraph
  return `<p>${escapeHtml(text)}</p>\n`;
}

interface HeadingDetection {
  level: number;
  content: string;
}

/**
 * Detects if a line is a heading
 */
function detectHeading(line: string, lines: string[], index: number): HeadingDetection | null {
  // Markdown-style heading: # ... or ## ... etc
  const markdownMatch = line.match(/^(#{1,6})\s+(.+)$/);
  if (markdownMatch) {
    return {
      level: markdownMatch[1].length,
      content: markdownMatch[2].trim(),
    };
  }

  // Numbered heading: "1. Title" or "1.2 Title"
  const numberedMatch = line.match(/^(\d{1,2})(?:\.\d{1,2})?\s+(.+)$/);
  if (numberedMatch) {
    const nextLine = (lines[index + 1] || '').trim();
    if (!nextLine) {
      // Isolated numbered line = heading
      const num = parseInt(numberedMatch[1], 10);
      return {
        level: num === 1 ? 2 : 3,
        content: line,
      };
    }
  }

  // ALL-CAPS heading (for LTR content)
  if (
    !hasRTLCharacters(line) &&
    line === line.toUpperCase() &&
    /[A-Z]/.test(line) &&
    line.length < 100 &&
    !line.match(/^\d/) &&
    !line.includes('(')
  ) {
    const nextLine = (lines[index + 1] || '').trim();
    if (!nextLine) {
      return {
        level: 2,
        content: line,
      };
    }
  }

  // RTL heading: isolated line with RTL characters
  if (hasRTLCharacters(line)) {
    const nextLine = (lines[index + 1] || '').trim();
    if (!nextLine && line.length > 10 && line.length < 150) {
      // Check if it looks like a heading (not just random text)
      if (!line.includes('(') || line.match(/^\d+/)) {
        return {
          level: 2,
          content: line,
        };
      }
    }
  }

  return null;
}

interface ListDetection {
  type: 'ordered' | 'unordered';
  content: string;
}

/**
 * Detects if a line is a list item
 */
function detectList(line: string): ListDetection | null {
  // Unordered list: starts with - * + or bullet character
  const unorderedMatch = line.match(/^[-*+•·∙‣⁃◦▪▸►]\s+(.+)$/);
  if (unorderedMatch) {
    return {
      type: 'unordered',
      content: unorderedMatch[1],
    };
  }

  // Ordered list: starts with number or letter
  const orderedMatch = line.match(/^(\d{1,3}|[a-zA-Zא-ת])[.)]\s+(.+)$/);
  if (orderedMatch) {
    return {
      type: 'ordered',
      content: orderedMatch[2],
    };
  }

  return null;
}

interface TableDetection {
  html: string;
  nextIndex: number;
}

/**
 * Detects and converts simple pipe-delimited tables
 */
function detectTable(lines: string[], startIndex: number): TableDetection | null {
  const headerLine = lines[startIndex].trim();

  // Must have at least 2 pipes
  if ((headerLine.match(/\|/g) || []).length < 2) {
    return null;
  }

  // Check if next line is separator (hyphens and pipes)
  const separatorLine = (lines[startIndex + 1] || '').trim();
  const isSeparator = /^\|?[\s|\-:]+\|[\s|\-:]*$/.test(separatorLine);

  if (!isSeparator) {
    // Might still be a table without formal separator
    if (
      startIndex + 1 < lines.length &&
      (lines[startIndex + 1].trim().match(/\|/g) || []).length > 1
    ) {
      // Looks like table rows
    } else {
      return null;
    }
  }

  let html = '<table>\n<thead>\n<tr>\n';

  // Parse header
  const headerCells = headerLine
    .split('|')
    .map((cell) => cell.trim())
    .filter(Boolean);
  for (const cell of headerCells) {
    html += `<th>${escapeHtml(cell)}</th>\n`;
  }

  html += '</tr>\n</thead>\n<tbody>\n';

  // Parse body rows
  let rowIndex = isSeparator ? startIndex + 2 : startIndex + 1;
  while (rowIndex < lines.length) {
    const rowLine = lines[rowIndex].trim();
    if (!rowLine || (rowLine.match(/\|/g) || []).length < 1) {
      break;
    }

    const cells = rowLine
      .split('|')
      .map((cell) => cell.trim())
      .filter(Boolean);
    if (cells.length === 0) {
      break;
    }

    html += '<tr>\n';
    for (const cell of cells) {
      html += `<td>${escapeHtml(cell)}</td>\n`;
    }
    html += '</tr>\n';

    rowIndex++;
  }

  html += '</tbody>\n</table>\n';

  return {
    html,
    nextIndex: rowIndex,
  };
}

/**
 * Heuristic to detect if a key-value line is metadata vs regular text
 */
function detectMetadataLine(key: string, index: number, lines: string[]): boolean {
  // Common metadata keys
  const metadataKeys = [
    'title',
    'author',
    'date',
    'version',
    'status',
    'description',
    'document',
    'גרסת',
    'תאריך',
    'סטטוס',
    'author',
  ];

  const keyLower = key.toLowerCase();
  if (metadataKeys.some((mk) => keyLower.includes(mk))) {
    return true;
  }

  // Appears near document start
  if (index < 10) {
    return true;
  }

  return false;
}

/**
 * Converts structured content (from OCR with tables) to semantic HTML.
 * Used when the extraction pipeline produces position-based data.
 */
export function structuredToHtml(
  content: Array<{ type: 'text' | 'table'; text?: string; table?: { headers: string[]; rows: string[][] } }>,
  title?: string
): string {
  let html = '<!DOCTYPE html>\n<html>\n<head>\n';
  html += `<meta charset="UTF-8">\n`;
  html += `<title>${escapeHtml(title || 'Document')}</title>\n`;
  html += '</head>\n<body>\n';

  if (title) {
    html += `<h1>${escapeHtml(title)}</h1>\n`;
  }

  for (const item of content) {
    if (item.type === 'table' && item.table) {
      html += tableToHtml(item.table);
    } else if (item.type === 'text' && item.text) {
      const text = item.text.trim();
      if (!text) continue;

      // Detect heading (numbered sections like "1." or short bold-looking lines)
      const headingMatch = text.match(/^(\d{1,2})\.\s+(.+)$/);
      if (headingMatch && text.length < 150) {
        const num = parseInt(headingMatch[1], 10);
        const level = num <= 1 ? 2 : 3;
        html += `<h${level}>${escapeHtml(text)}</h${level}>\n`;
        continue;
      }

      // Detect section header (like "פרק א - מבוא")
      const sectionMatch = text.match(/^(פרק\s+[א-ת])\s*[-–]\s*(.+)$/);
      if (sectionMatch) {
        html += `<h2>${escapeHtml(text)}</h2>\n`;
        continue;
      }

      // Detect list items
      const listMatch = text.match(/^[-•·∙]\s+(.+)$/);
      if (listMatch) {
        html += `<ul><li>${escapeHtml(listMatch[1])}</li></ul>\n`;
        continue;
      }

      // Regular paragraph
      html += `<p>${escapeHtml(text)}</p>\n`;
    }
  }

  html += '</body>\n</html>\n';
  return html;
}

function tableToHtml(table: { headers: string[]; rows: string[][] }): string {
  let html = '<table>\n<thead>\n<tr>\n';
  for (const header of table.headers) {
    html += `<th>${escapeHtml(header || '')}</th>\n`;
  }
  html += '</tr>\n</thead>\n<tbody>\n';

  for (const row of table.rows) {
    html += '<tr>\n';
    for (const cell of row) {
      html += `<td>${escapeHtml(cell || '')}</td>\n`;
    }
    html += '</tr>\n';
  }

  html += '</tbody>\n</table>\n';
  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
