import he from 'he';

/**
 * Convert HTML back to Markdown
 */
export function htmlToMarkdown(html: string, mermaidSources: Record<string, string>): string {
  let markdown = html;

  // Preserve math expressions FIRST
  markdown = markdown.replace(/<div\s+class=["']math-display["'][^>]*>([\s\S]*?)<\/div>/gi, (match, content) => {
    let mathContent = content;
    if (mathContent.startsWith('$$') && mathContent.endsWith('$$')) {
      mathContent = mathContent.slice(2, -2);
    }
    return '$$' + mathContent + '$$\n';
  });

  markdown = markdown.replace(/<span\s+class=["']math-inline["'][^>]*>([\s\S]*?)<\/span>/gi, (match, content) => {
    let mathContent = content;
    if (mathContent.startsWith('$') && mathContent.endsWith('$')) {
      mathContent = mathContent.slice(1, -1);
    }
    return '$' + mathContent + '$';
  });

  // Convert code blocks FIRST
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
    const decoded = he.decode(code);
    return '```\n' + decoded + '\n```\n';
  });

  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, (match, code) => {
    const decoded = he.decode(code);
    return '`' + decoded + '`';
  });

  // Convert Mermaid blocks
  const mermaidReplacements: string[] = [];
  const MERMAID_PLACEHOLDER = '___MERMAID_PLACEHOLDER_';
  
  console.log('[htmlToMarkdown] Mermaid sources:', Object.keys(mermaidSources));
  
  markdown = markdown.replace(/<div\s+[^>]*data-mdwe=["']mermaid["'][^>]*>[\s\S]*?<\/div>/gi, (match) => {
    const idMatch = match.match(/data-id=["']([^"']+)["']/);
    if (!idMatch) return match;
    
    const mermaidId = idMatch[1];
    const source = mermaidSources[mermaidId];
    if (source) {
      const fenceTypeMatch = match.match(/data-fence-type=["']([^"']+)["']/);
      const fenceType = fenceTypeMatch ? fenceTypeMatch[1] : 'backtick';
      
      let mermaidBlock: string;
      if (fenceType === 'colon') {
        mermaidBlock = ':::: mermaid\n' + source + '\n::::';
      } else {
        mermaidBlock = '```mermaid\n' + source + '\n```';
      }
      
      const index = mermaidReplacements.length;
      mermaidReplacements.push(mermaidBlock);
      return `${MERMAID_PLACEHOLDER}${index}${MERMAID_PLACEHOLDER}`;
    }
    return match;
  });

  // Convert images
  const imgRegex = /<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi;
  const imageReplacements: string[] = [];
  const IMAGE_PLACEHOLDER = '___IMAGE_PLACEHOLDER_';
  
  markdown = markdown.replace(imgRegex, (match, preSrc, src, postSrc) => {
    const altMatch = match.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    
    const widthMatch = match.match(/width=["']?(\d+)["']?/i);
    const heightMatch = match.match(/height=["']?(\d+)["']?/i);
    const width = widthMatch ? widthMatch[1] : null;
    const height = heightMatch ? heightMatch[1] : null;
    
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
    
    const classMatch = match.match(/class=["']([^"']*)["']/i);
    if (classMatch) {
      const classes = classMatch[1];
      if (classes.includes('image-align-left')) alignment = 'left';
      else if (classes.includes('image-align-center')) alignment = 'center';
      else if (classes.includes('image-align-right')) alignment = 'right';
    }
    
    let result: string;
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
      
      result = `<img src="${src}"${altAttr}${widthAttr}${heightAttr}${styleAttr} class="editor-image">`;
    } else {
      result = `![${alt}](${src})`;
    }
    
    const index = imageReplacements.length;
    imageReplacements.push(result);
    return `${IMAGE_PLACEHOLDER}${index}${IMAGE_PLACEHOLDER}`;
  });

  // Convert tables
  markdown = convertTablesToMarkdown(markdown);

  // Convert links
  markdown = markdown.replace(/<a\s+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  markdown = markdown.replace(/<a\s+([^>]*?)href=["']([^"']+)["']([^>]*?)>([\s\S]*?)<\/a>/gi, '[$4]($2)');

  // Convert blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
    let blockContent = content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<[^>]*>/g, '');
    
    const lines = blockContent.split('\n').filter((line: string) => line.trim());
    return '\n' + lines.map((line: string) => '> ' + line).join('\n') + '\n';
  });

  // Convert common HTML tags
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
    .replace(/<[^>]*>/g, '');

  // Restore placeholders
  imageReplacements.forEach((img, index) => {
    markdown = markdown.replace(`${IMAGE_PLACEHOLDER}${index}${IMAGE_PLACEHOLDER}`, '\n' + img + '\n');
  });

  mermaidReplacements.forEach((mermaid, index) => {
    markdown = markdown.replace(`${MERMAID_PLACEHOLDER}${index}${MERMAID_PLACEHOLDER}`, '\n' + mermaid + '\n\n');
  });

  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n').trim();

  return markdown;
}

/**
 * Convert HTML tables to Markdown
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
        let cellText = cellMatch[1].replace(/<[^>]*>/g, '').trim();
        cells.push(cellText);
      }
      
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
    
    if (rows.length === 0) return match;
    
    let mdTable = '';
    rows.forEach((row, index) => {
      mdTable += '| ' + row.join(' | ') + ' |\n';
      if (index === 0) {
        mdTable += '|' + row.map(() => ' --- ').join('|') + '|\n';
      }
    });
    
    return mdTable + '\n';
  });
}

/**
 * Calculate hash for dirty tracking
 */
export function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}
