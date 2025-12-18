import { MermaidBlock } from '../types';

/**
 * Convert HTML back to Markdown
 * Preserves inline styles and block formatting including tables
 */
export function htmlToMarkdown(html: string, mermaidSources: Record<string, string>): string {
  let markdown = html;

  // Convert tables to Markdown format FIRST (before other replacements)
  markdown = convertTablesToMarkdown(markdown);

  // Convert common HTML tags to Markdown
  markdown = markdown
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
    .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
    .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a\s+href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '')
    .replace(/<blockquote[^>]*>/gi, '> ')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]*>/g, ''); // Remove any remaining HTML tags

  // Clean up extra whitespace
  markdown = markdown
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return markdown;
}

/**
 * Convert HTML tables to Markdown table format
 */
function convertTablesToMarkdown(html: string): string {
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  
  return html.replace(tableRegex, (match) => {
    const rows: string[][] = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(match)) !== null) {
      const rowContent = rowMatch[1];
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch;
      
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        let cellText = cellMatch[1]
          .replace(/<[^>]*>/g, '') // Remove any HTML tags
          .trim();
        cells.push(cellText);
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (rows.length === 0) return match; // Return original if no rows parsed
    
    // Build Markdown table
    let mdTable = '';
    rows.forEach((row, index) => {
      mdTable += '| ' + row.join(' | ') + ' |\n';
      
      // Add separator after first row (header)
      if (index === 0) {
        mdTable += '|' + row.map(() => ' --- ').join('|') + '|\n';
      }
    });
    
    return mdTable + '\n';
  });
}

/**
 * Calculate hash of content for dirty tracking
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}
