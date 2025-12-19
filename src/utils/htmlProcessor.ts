import { MermaidBlock } from '../types';
import * as path from 'path';

/**
 * Convert HTML back to Markdown
 * Preserves inline styles and block formatting including tables, code blocks, and images
 */
export function htmlToMarkdown(html: string, mermaidSources: Record<string, string>, documentPath?: string): string {
  let markdown = html;

  // Convert code blocks FIRST (before other replacements)
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
    // Decode HTML entities in code
    const decoded = decodeHtmlEntities(code);
    return '```\n' + decoded + '\n```\n';
  });

  // Convert inline code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, (match, code) => {
    const decoded = decodeHtmlEntities(code);
    return '`' + decoded + '`';
  });

  // Convert images BEFORE general tag removal
  // Handle any img tag with a src attribute (most general approach)
  const imgRegex = /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
  
  markdown = markdown.replace(imgRegex, (match, preSrc, src, postSrc) => {
    // Extract alt attribute from either side
    const altMatch = match.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    
    let relativeSrc = convertToRelativePath(src, documentPath);
    // Normalize path separators to forward slashes for markdown portability
    relativeSrc = relativeSrc.replace(/\\/g, '/');
    return `![${alt}](${relativeSrc})\n`;
  });

  // Convert tables to Markdown format
  // Convert tables to Markdown format
  markdown = convertTablesToMarkdown(markdown);

  // Convert links EARLY - before other tag replacements that might interfere
  // Handle various link formats: <a href="url">text</a>, <a href='url'>text</a>, etc.
  markdown = markdown.replace(/<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  
  // Also handle links where href might have attributes before it
  markdown = markdown.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi, '[$4]($2)');

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
 * Convert webview URI or absolute path to relative path
 */
function convertToRelativePath(src: string, documentPath?: string): string {
  // Skip data URLs
  if (src.startsWith('data:')) {
    return src;
  }

  // Skip already relative paths
  if (!src.startsWith('/') && !src.startsWith('file://') && !src.includes('://')) {
    return src;
  }

  if (!documentPath) {
    return src;
  }

  // Extract file path from webview URI
  let filePath = src;
  
  // Handle webview URIs like: https://file+.vscode-resource.vscode-cdn.net/c%3A/Users/...
  if (src.includes('vscode-resource')) {
    try {
      // Extract the file path part - look for anything after the domain
      const match = src.match(/vscode-resource\.vscode-cdn\.net([^?#]*)/);
      if (match) {
        // Decode the URI component - it may contain %3A (colon), %2F (slash), etc.
        filePath = match[1];
        
        // First decode to handle %3A, %2F, etc.
        filePath = decodeURIComponent(filePath);
        
        // Remove leading slash for Windows absolute paths
        if (filePath.startsWith('/') && filePath.length > 2 && filePath[2] === ':') {
          filePath = filePath.substring(1); // Remove leading slash: /c: -> c:
        }
      }
    } catch (e) {
      return src;
    }
  } else if (src.startsWith('file://')) {
    filePath = src.slice(7); // Remove file:// prefix
  }

  // Normalize path separators for cross-platform compatibility
  const normalizedPath = filePath.replace(/\//g, path.sep);

  // Make it absolute if it's not already
  if (!path.isAbsolute(normalizedPath)) {
    return src; // Can't make relative without proper path
  }

  // Calculate relative path from document directory
  const documentDir = path.dirname(documentPath);
  try {
    return path.relative(documentDir, normalizedPath);
  } catch (e) {
    return src;
  }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: { [key: string]: string } = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&apos;': "'",
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  return decoded;
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
