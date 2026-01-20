import he from 'he';

/**
 * Convert HTML back to Markdown
 * Preserves inline styles and block formatting including tables, code blocks, and images
 */
export function htmlToMarkdown(html: string, mermaidSources: Record<string, string>, documentPath?: string): string {
  let markdown = html;

  // Preserve math expressions FIRST (before any other processing)
  // Convert math divs and spans back to raw syntax
  
  // Convert display math divs: <div class="math-display">$$content$$</div>
  markdown = markdown.replace(/<div\s+class=["']math-display["'][^>]*>([\s\S]*?)<\/div>/gi, (match, content) => {
    // Extract the math content (removing the $$ markers if present)
    let mathContent = content;
    if (mathContent.startsWith('$$') && mathContent.endsWith('$$')) {
      mathContent = mathContent.slice(2, -2);
    }
    return '$$' + mathContent + '$$\n';
  });

  // Convert inline math spans: <span class="math-inline">$content$</span>
  markdown = markdown.replace(/<span\s+class=["']math-inline["'][^>]*>([\s\S]*?)<\/span>/gi, (match, content) => {
    // Extract the math content (removing the $ markers if present)
    let mathContent = content;
    if (mathContent.startsWith('$') && mathContent.endsWith('$')) {
      mathContent = mathContent.slice(1, -1);
    }
    return '$' + mathContent + '$';
  });

  const mathReplacements: string[] = [];
  const MATH_PLACEHOLDER = '___MATH_PLACEHOLDER_';
  
  // This is handled by the HTML preservation - math should come through as text with $ signs

  // Convert code blocks FIRST (before other replacements)
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
    // Decode HTML entities in code using he library (RFC 7763 compliant)
    const decoded = he.decode(code);
    return '```\n' + decoded + '\n```\n';
  });

  // Convert inline code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, (match, code) => {
    const decoded = he.decode(code);
    return '`' + decoded + '`';
  });

  // Convert Mermaid blocks BEFORE other replacements
  // Replace mermaid placeholders with actual mermaid fence blocks
  const mermaidReplacements: string[] = [];
  const MERMAID_PLACEHOLDER = '___MERMAID_PLACEHOLDER_';
  
  console.log('[htmlToMarkdown] Mermaid sources received:', Object.keys(mermaidSources));
  
  // Match mermaid divs - more flexible pattern that matches attributes in any order
  // Matches: <div ... data-mdwe="mermaid" ... >...</div> with data-id and data-fence-type somewhere in attributes
  markdown = markdown.replace(/<div\s+[^>]*data-mdwe=["']mermaid["'][^>]*>[\s\S]*?<\/div>/gi, (match) => {
    console.log('[htmlToMarkdown] Found mermaid div:', match.substring(0, 200));
    
    // Extract data-id attribute
    const idMatch = match.match(/data-id=["']([^"']+)["']/);
    if (!idMatch) {
      console.log('[htmlToMarkdown] No data-id found in mermaid div');
      return match;
    }
    
    const mermaidId = idMatch[1];
    const source = mermaidSources[mermaidId];
    if (source) {
      console.log('[htmlToMarkdown] Found source for', mermaidId, 'source length:', source.length);
      
      // Extract fence type from the div attributes
      const fenceTypeMatch = match.match(/data-fence-type=["']([^"']+)["']/);
      const fenceType = fenceTypeMatch ? fenceTypeMatch[1] : 'backtick';
      
      console.log('[htmlToMarkdown] Fence type:', fenceType);
      
      let mermaidBlock: string;
      if (fenceType === 'colon') {
        mermaidBlock = '::: mermaid\n' + source + '\n:::';
      } else {
        mermaidBlock = '```mermaid\n' + source + '\n```';
      }
      
      const index = mermaidReplacements.length;
      mermaidReplacements.push(mermaidBlock);
      return `${MERMAID_PLACEHOLDER}${index}${MERMAID_PLACEHOLDER}`;
    }
    console.log('[htmlToMarkdown] No source found for', mermaidId);
    return match;
  });
  
  console.log('[htmlToMarkdown] Total mermaid replacements:', mermaidReplacements.length);

  // Convert images BEFORE general tag removal
  // Handle any img tag with a src attribute (most general approach)
  const imgRegex = /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
  const imageReplacements: string[] = [];
  const IMAGE_PLACEHOLDER = '___IMAGE_PLACEHOLDER_';
  
  markdown = markdown.replace(imgRegex, (match, preSrc, src, postSrc) => {
    console.log('[htmlToMarkdown] Processing image:', match.substring(0, 200));
    
    // Extract alt attribute from either side
    const altMatch = match.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    
    // Extract width and height attributes
    const widthMatch = match.match(/width=["']?(\d+)["']?/i);
    const heightMatch = match.match(/height=["']?(\d+)["']?/i);
    const width = widthMatch ? widthMatch[1] : null;
    const height = heightMatch ? heightMatch[1] : null;
    
    console.log('[htmlToMarkdown] Extracted - width:', width, 'height:', height, 'src:', src.substring(0, 100));
    
    // Extract style attribute for alignment
    const styleMatch = match.match(/style=["']([^"']*)["']/i);
    let alignment = '';
    if (styleMatch) {
      const style = styleMatch[1];
      if (style.includes('margin-left: 0') || style.includes('margin-right: auto')) {
        alignment = 'left';
      } else if (style.includes('margin-left: auto') && style.includes('margin-right: auto')) {
        alignment = 'center';
      } else if (style.includes('margin-left: auto') || style.includes('margin-right: 0')) {
        alignment = 'right';
      }
    }
    
    // Check class attribute for alignment
    const classMatch = match.match(/class=["']([^"']*)["']/i);
    if (classMatch) {
      const classes = classMatch[1];
      if (classes.includes('image-align-left')) alignment = 'left';
      else if (classes.includes('image-align-center')) alignment = 'center';
      else if (classes.includes('image-align-right')) alignment = 'right';
    }
    
    let relativeSrc = convertToRelativePath(src, documentPath);
    // Normalize path separators to forward slashes for markdown portability
    relativeSrc = relativeSrc.replace(/\\/g, '/');
    
    console.log('[htmlToMarkdown] Relative src:', relativeSrc, 'alignment:', alignment);
    
    let result: string;
    // If image has custom size or alignment, use HTML instead of markdown
    if (width || height || alignment) {
      let styleAttr = '';
      if (alignment === 'left') {
        styleAttr = ' style="display: block; margin-left: 0; margin-right: auto;"';
      } else if (alignment === 'center') {
        styleAttr = ' style="display: block; margin-left: auto; margin-right: auto;"';
      } else if (alignment === 'right') {
        styleAttr = ' style="display: block; margin-left: auto; margin-right: 0;"';
      }
      
      const widthAttr = width ? ` width="${width}"` : '';
      const heightAttr = height ? ` height="${height}"` : '';
      const altAttr = alt ? ` alt="${alt}"` : '';
      
      result = `<img src="${relativeSrc}"${altAttr}${widthAttr}${heightAttr}${styleAttr} class="editor-image">`;
      console.log('[htmlToMarkdown] Returning HTML img tag:', result.substring(0, 150));
    } else {
      // Standard markdown image
      result = `![${alt}](${relativeSrc})`;
      console.log('[htmlToMarkdown] Returning markdown image:', result);
    }
    
    // Store the replacement and return placeholder
    const index = imageReplacements.length;
    imageReplacements.push(result);
    return `${IMAGE_PLACEHOLDER}${index}${IMAGE_PLACEHOLDER}`;
  });

  // Convert tables to Markdown format
  // Convert tables to Markdown format
  markdown = convertTablesToMarkdown(markdown);

  // Convert links EARLY - before other tag replacements that might interfere
  // Handle various link formats: <a href="url">text</a>, <a href='url'>text</a>, etc.
  markdown = markdown.replace(/<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  
  // Also handle links where href might have attributes before it
  markdown = markdown.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi, '[$4]($2)');

  // Convert blockquotes BEFORE other tags to preserve structure
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    // Process the blockquote content to convert inner tags
    let blockContent = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~')
      .replace(/<strike[^>]*>(.*?)<\/strike>/gi, '~~$1~~')
      // Keep <u> tags as-is for underline
      .replace(/<[^>]*>/g, (tag) => {
        // Preserve <u> tags, remove others
        if (tag.match(/<\/?u[^>]*>/i)) {
          return tag;
        }
        return '';
      });
    
    // Split by newlines and prefix each line with >
    const lines = blockContent.split('\n').filter((line: string) => line.trim());
    return '\n' + lines.map((line: string) => '> ' + line).join('\n') + '\n';
  });

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
    .replace(/<[^>]*>/g, (tag) => {
      // Preserve <u> and </u> tags for underline (markdown doesn't support underline natively)
      if (tag.match(/<\/?u[^>]*>/i)) {
        return tag;
      }
      return ''; // Remove all other tags
    });

  // Restore image placeholders
  imageReplacements.forEach((img, index) => {
    markdown = markdown.replace(`${IMAGE_PLACEHOLDER}${index}${IMAGE_PLACEHOLDER}`, '\n' + img + '\n');
  });

  // Restore mermaid placeholders with blank line after to prevent breaking following markdown
  mermaidReplacements.forEach((mermaid, index) => {
    markdown = markdown.replace(`${MERMAID_PLACEHOLDER}${index}${MERMAID_PLACEHOLDER}`, '\n' + mermaid + '\n\n');
  });

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

  // For browser extension, we don't have file system access
  // Just return the src as-is since we can't calculate relative paths
  // This functionality is primarily for VS Code extension
  return src;
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
