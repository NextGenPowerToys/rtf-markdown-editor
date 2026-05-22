/**
 * HTML to Markdown Converter
 *
 * Uses turndown to convert HTML to Markdown with custom rules for
 * better formatting preservation and RTL content handling.
 */

import { hasRTLCharacters } from './bidiHandler';

// Dynamic import to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
let TurndownService: any = null;

async function getTurndownService() {
  if (!TurndownService) {
    const module = await import('turndown');
    TurndownService = module.default;
  }
  return TurndownService;
}

/**
 * Convert HTML to Markdown with custom rules for semantic preservation
 */
export async function htmlToMarkdown(html: string, options: { rtl?: boolean } = {}): Promise<string> {
  // Strip <style>, <script>, and <head> contents up-front. Turndown will
  // otherwise dump their text contents (CSS rules, script source) into the
  // markdown output.
  const cleanedHtml = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '');

  const Turndown = await getTurndownService();
  const turndownService = new Turndown({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    preserveNewlines: false,
    hr: '---',
  });

  // Drop any residual style/script tags that the regex pass missed.
  turndownService.remove(['style', 'script', 'head']);

  // Render <table> as a GFM-style markdown table. Without this, turndown's
  // default rules emit `| --- | --- |` after every row and double the row count.
  turndownService.addRule('gfmTable', {
    filter: (node: any) => (node.nodeName ?? '').toUpperCase() === 'TABLE',
    replacement: (_content: string, node: any) => {
      const rows: string[][] = [];
      let numCols = 0;
      const collectCells = (tr: any): string[] => {
        const cells: string[] = [];
        for (const child of tr.childNodes ?? []) {
          const name = (child.nodeName ?? '').toLowerCase();
          if (name === 'th' || name === 'td') {
            const text = (child.textContent ?? '')
              .replace(/\s+/g, ' ')
              .replace(/\|/g, '\\|')
              .trim();
            cells.push(text);
          }
        }
        return cells;
      };
      const walk = (n: any) => {
        for (const child of n.childNodes ?? []) {
          const name = (child.nodeName ?? '').toLowerCase();
          if (name === 'tr') {
            const cells = collectCells(child);
            if (cells.length > 0) {
              rows.push(cells);
              if (cells.length > numCols) numCols = cells.length;
            }
          } else if (name === 'thead' || name === 'tbody' || name === 'tfoot') {
            walk(child);
          }
        }
      };
      walk(node);
      if (rows.length === 0 || numCols === 0) return '';
      for (const r of rows) while (r.length < numCols) r.push('');
      const header = rows[0];
      const body = rows.slice(1);
      const sep = Array(numCols).fill('---');
      const lines = [
        '| ' + header.join(' | ') + ' |',
        '| ' + sep.join(' | ') + ' |',
        ...body.map(r => '| ' + r.join(' | ') + ' |'),
      ];
      return '\n\n' + lines.join('\n') + '\n\n';
    },
  });

  // Add custom rules for better preservation

  // Preserve emphasis (bold/italic) with context awareness
  turndownService.addRule('emphasis', {
    filter: ['em', 'i'],
    replacement: (content: string) => {
      // Don't wrap if already contains emphasis markers
      if (content.includes('**') || content.includes('*')) {
        return content;
      }
      return `*${content}*`;
    },
  });

  turndownService.addRule('strong', {
    filter: ['strong', 'b'],
    replacement: (content: string) => {
      if (content.includes('**')) {
        return content;
      }
      return `**${content}**`;
    },
  });

  // Custom rule for code blocks to preserve multi-line formatting
  turndownService.addRule('codecustom', {
    filter: (node: any) => {
      return node.nodeName === 'PRE' && node.querySelector('CODE');
    },
    replacement: (content: string) => {
      const codeBlock = content.trim();
      // Detect language if possible
      const lang = 'javascript'; // Default, could be enhanced
      return `\`\`\`${lang}\n${codeBlock}\n\`\`\`\n`;
    },
  });

  // Table handling is done holistically by the `gfmTable` rule above. The
  // children (thead/tbody/tr/th/td) are deliberately neutralized so they
  // don't emit per-row separators or other intermediate markdown.
  for (const tag of ['thead', 'tbody', 'tfoot', 'tr', 'th', 'td']) {
    turndownService.addRule(`neutralize-${tag}`, {
      filter: tag,
      replacement: () => '',
    });
  }

  // Custom rule for line breaks - preserve them better
  turndownService.addRule('linebreak', {
    filter: 'br',
    replacement: () => {
      return ' ';
    },
  });

  // Convert the HTML
  let markdown = turndownService.turndown(cleanedHtml);

  // Post-processing: clean up excessive whitespace
  markdown = markdown
    .split('\n')
    .map((line: string) => line.trimEnd())
    .join('\n');

  // Remove excessive blank lines
  markdown = markdown.replace(/\n{4,}/g, '\n\n');

  // Normalize heading spacing
  markdown = markdown.replace(/\n(#{1,6})\s+/g, '\n\n$1 ');

  // Normalize list spacing
  markdown = markdown.replace(/\n([-*+])\s+/g, '\n\n$1 ');

  // Add newline at end
  if (!markdown.endsWith('\n')) {
    markdown += '\n';
  }

  return markdown.trim() + '\n';
}

/**
 * Simple HTML to text converter for fallback (when turndown fails)
 */
export function htmlToText(html: string): string {
  // Remove script and style elements
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');

  // Convert common HTML tags to text equivalents
  text = text.replace(/<h[1-6][^>]*>/g, '\n');
  text = text.replace(/<\/h[1-6]>/g, '\n');
  text = text.replace(/<p[^>]*>/g, '\n');
  text = text.replace(/<\/p>/g, '\n');
  text = text.replace(/<br[^>]*>/g, '\n');
  text = text.replace(/<li[^>]*>/g, '\n- ');
  text = text.replace(/<\/li>/g, '\n');
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");

  // Clean up whitespace
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  return text;
}
