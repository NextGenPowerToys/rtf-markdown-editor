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
  const Turndown = await getTurndownService();
  const turndownService = new Turndown({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    preserveNewlines: false,
    hr: '---',
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

  // Custom rule for tables with proper markdown format
  turndownService.addRule('table', {
    filter: 'table',
    replacement: (content: string) => {
      return `\n${content}\n`;
    },
  });

  turndownService.addRule('tableheader', {
    filter: 'thead',
    replacement: (content: string) => {
      if (!content.trim()) return '';
      return content;
    },
  });

  turndownService.addRule('tablebody', {
    filter: 'tbody',
    replacement: (content: string) => {
      if (!content.trim()) return '';
      return content;
    },
  });

  turndownService.addRule('tablerow', {
    filter: 'tr',
    replacement: (content: string, node: any) => {
      const cells = Array.from(node.querySelectorAll('th, td'));
      if (cells.length === 0) {
        return content;
      }

      const row = cells
        .map((cell: any) => {
          let text = cell.textContent?.trim() || '';
          // Escape pipe characters in cell content
          text = text.replace(/\|/g, '\\|');
          return text;
        })
        .join(' | ');

      // Add separator after header row
      const isHeader = node.querySelector('th') !== null;
      let result = `| ${row} |\n`;
      if (isHeader) {
        const separator = cells.map(() => '---').join(' | ');
        result += `| ${separator} |\n`;
      }

      return result;
    },
  });

  turndownService.addRule('tablecell', {
    filter: ['th', 'td'],
    replacement: (content: string) => {
      // Process cell content
      return content.trim();
    },
  });

  // Custom rule for line breaks - preserve them better
  turndownService.addRule('linebreak', {
    filter: 'br',
    replacement: () => {
      return ' ';
    },
  });

  // Convert the HTML
  let markdown = turndownService.turndown(html);

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
