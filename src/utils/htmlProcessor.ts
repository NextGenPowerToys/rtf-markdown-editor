import { MermaidBlock } from '../types';

/**
 * Convert HTML back to Markdown
 * Preserves inline styles and block formatting
 */
export function htmlToMarkdown(html: string, mermaidSources: Record<string, string>): string {
  // Simple HTML to Markdown conversion
  // For production, consider using a library like turndown.js
  // but we must ensure it's bundled locally

  let markdown = html;

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
