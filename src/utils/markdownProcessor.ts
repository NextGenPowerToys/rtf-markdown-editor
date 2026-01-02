import MarkdownIt from 'markdown-it';
import { MermaidBlock } from '../types';
import { RTLService } from '../services/RTLService';

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
});

// Configure markdown-it to not escape HTML
md.renderer.rules.html_block = (tokens, idx) => tokens[idx].content;
md.renderer.rules.html_inline = (tokens, idx) => tokens[idx].content;

// Add a custom rule for math expressions to preserve them with special markup
// This allows them to be styled and potentially rendered by KaTeX later
md.inline.ruler.before('text', 'math', (state, silent) => {
  let pos = state.pos;
  const maximum = state.posMax;

  // Check for display math $$...$$
  if (pos + 1 < maximum && state.src[pos] === '$' && state.src[pos + 1] === '$') {
    let searchPos = pos + 2;
    while (searchPos < maximum) {
      if (state.src[searchPos] === '$' && state.src[searchPos + 1] === '$' && 
          (searchPos === pos + 2 || state.src[searchPos - 1] !== '\\')) {
        // Found closing $$
        const content = state.src.slice(pos + 2, searchPos);
        if (content && !silent) {
          const token = state.push('math_block', 'div', 0);
          token.content = content;
          token.markup = '$$';
          token.meta = { display: true };
        }
        state.pos = searchPos + 2;
        return true;
      }
      searchPos++;
    }
  }

  // Check for inline math $...$
  if (state.src[pos] === '$' && (pos === 0 || state.src[pos - 1] !== '\\')) {
    let searchPos = pos + 1;
    while (searchPos < maximum) {
      if (state.src[searchPos] === '$' && state.src[searchPos - 1] !== '\\') {
        // Found closing $
        const content = state.src.slice(pos + 1, searchPos);
        if (content && !silent) {
          const token = state.push('math_inline', 'span', 0);
          token.content = content;
          token.markup = '$';
          token.meta = { display: false };
        }
        state.pos = searchPos + 1;
        return true;
      }
      searchPos++;
    }
  }

  return false;
});

// Custom renderers for math
md.renderer.rules.math_block = (tokens, idx) => {
  const token = tokens[idx];
  const content = token.content;
  return `<div class="math-display">$$${content}$$</div>\n`;
};

md.renderer.rules.math_inline = (tokens, idx) => {
  const token = tokens[idx];
  const content = token.content;
  return `<span class="math-inline">$${content}$</span>`;
};

// Mermaid fence patterns - Support both standard backtick and Azure DevOps colon syntax
const MERMAID_BACKTICK_FENCE_PATTERN = /^```\s*mermaid\s*$/i;
const MERMAID_BACKTICK_CLOSE_PATTERN = /^```\s*$/;
const MERMAID_COLON_FENCE_PATTERN = /^:::+\s*mermaid\s*$/i;
const MERMAID_COLON_CLOSE_PATTERN = /^:::+\s*$/;

/**
 * Detects Hebrew/Arabic RTL characters in text
 * @deprecated Use RTLService.detectRTLCharacters() instead
 */
export function detectRTLCharacters(text: string): boolean {
  return RTLService.detectRTLCharacters(text);
}

/**
 * Extract Mermaid blocks from markdown
 * Replaces them with placeholders and stores mapping
 */
export function extractMermaidBlocks(markdown: string): {
  markdown: string;
  mermaidBlocks: MermaidBlock[];
  mermaidSources: Record<string, string>;
} {
  const lines = markdown.split('\n');
  const mermaidBlocks: MermaidBlock[] = [];
  const mermaidSources: Record<string, string> = {};
  const result: string[] = [];

  let i = 0;
  let mermaidCounter = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // Check for backtick fence
    if (MERMAID_BACKTICK_FENCE_PATTERN.test(trimmedLine)) {
      const startLine = i;
      const mermaidId = `MERMAID_${mermaidCounter++}`;
      const mermaidContent: string[] = [];

      i++;
      // Collect content until closing fence
      while (i < lines.length && !MERMAID_BACKTICK_CLOSE_PATTERN.test(lines[i].trim())) {
        mermaidContent.push(lines[i]);
        i++;
      }

      // Consume closing fence
      if (i < lines.length && MERMAID_BACKTICK_CLOSE_PATTERN.test(lines[i].trim())) {
        i++;
      }

      const source = mermaidContent.join('\n').trim();
      if (source) {
        mermaidBlocks.push({ id: mermaidId, source, startLine, endLine: i - 1, fenceType: 'backtick' });
        mermaidSources[mermaidId] = source;
        result.push(`<div data-mdwe="mermaid" data-id="${mermaidId}" data-fence-type="backtick"></div>`);
      }
    }
    // Check for colon fence (Azure DevOps syntax)
    else if (MERMAID_COLON_FENCE_PATTERN.test(trimmedLine)) {
      const startLine = i;
      const mermaidId = `MERMAID_${mermaidCounter++}`;
      const mermaidContent: string[] = [];

      i++;
      // Collect content until closing fence
      while (i < lines.length && !MERMAID_COLON_CLOSE_PATTERN.test(lines[i].trim())) {
        mermaidContent.push(lines[i]);
        i++;
      }

      // Consume closing fence
      if (i < lines.length && MERMAID_COLON_CLOSE_PATTERN.test(lines[i].trim())) {
        i++;
      }

      const source = mermaidContent.join('\n').trim();
      if (source) {
        mermaidBlocks.push({ id: mermaidId, source, startLine, endLine: i - 1, fenceType: 'colon' });
        mermaidSources[mermaidId] = source;
        result.push(`<div data-mdwe="mermaid" data-id="${mermaidId}" data-fence-type="colon"></div>`);
      }
    } else {
      result.push(line);
      i++;
    }
  }

  return {
    markdown: result.join('\n'),
    mermaidBlocks,
    mermaidSources,
  };
}

/**
 * Convert Markdown to HTML
 */
export function markdownToHtml(markdown: string): {
  html: string;
  mermaidSources: Record<string, string>;
} {
  const { markdown: cleanMarkdown, mermaidSources } = extractMermaidBlocks(markdown);
  const html = md.render(cleanMarkdown);
  return { html, mermaidSources };
}

/**
 * Re-inject Mermaid blocks back into markdown
 */
export function rejectMermaidBlocks(markdown: string, mermaidSources: Record<string, string>): string {
  let result = markdown;

  for (const [mermaidId, source] of Object.entries(mermaidSources)) {
    const placeholder = `<p><div data-mdwe="mermaid" data-id="${mermaidId}"></div></p>`;
    const mermaidBlock = `\`\`\`mermaid\n${source}\n\`\`\``;

    result = result.replace(placeholder, mermaidBlock);
  }

  return result;
}
