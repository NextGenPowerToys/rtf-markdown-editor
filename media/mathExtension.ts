import { Node } from '@tiptap/core';
import katex from 'katex';

/**
 * Math Block Extension for TipTap
 * Renders LaTeX/KaTeX math formulas in block mode ($$formula$$)
 */
export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: element => element.getAttribute('data-formula') || '',
        renderHTML: attributes => {
          return {
            'data-formula': attributes.formula,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mdwe="math-block"]',
        getAttrs: element => {
          if (typeof element === 'string') return false;
          const formula = element.getAttribute('data-formula') || '';
          console.log(`[Math] MathBlock parseHTML: found formula="${formula}"`);
          return { formula };
        },
      },
    ];
  },

  renderHTML({ node }) {
    console.log(`[Math] MathBlock renderHTML: node.attrs.formula="${node.attrs.formula}"`);
    return [
      'div',
      {
        'data-mdwe': 'math-block',
        'data-formula': node.attrs.formula || '',
        class: 'math-block-placeholder',
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Enter Enter': ({ editor }) => {
        return editor.commands.insertContent({
          type: this.name,
          attrs: {
            'data-formula': '',
          },
        });
      },
    };
  },
});

/**
 * Inline Math Extension for TipTap
 * Renders LaTeX/KaTeX math formulas inline ($formula$)
 */
export const MathInline = Node.create({
  name: 'mathInline',
  group: 'inline',
  atom: true,
  inline: true,

  addAttributes() {
    return {
      formula: {
        default: '',
        parseHTML: element => element.getAttribute('data-formula') || '',
        renderHTML: attributes => {
          return {
            'data-formula': attributes.formula,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mdwe="math-inline"]',
        getAttrs: element => {
          if (typeof element === 'string') return false;
          const formula = element.getAttribute('data-formula') || '';
          console.log(`[Math] MathInline parseHTML: found formula="${formula}"`);
          return { formula };
        },
      },
    ];
  },

  renderHTML({ node }) {
    console.log(`[Math] MathInline renderHTML: node.attrs.formula="${node.attrs.formula}"`);
    return [
      'span',
      {
        'data-mdwe': 'math-inline',
        'data-formula': node.attrs.formula || '',
        class: 'math-inline-placeholder',
      },
    ];
  },
});

/**
 * Render all math blocks in the document using KaTeX
 */
export function renderMathBlocks() {
  try {
    console.log('[Math] Starting render math blocks');
    
    // Render block math
    const mathBlocks = document.querySelectorAll('[data-mdwe="math-block"]');
    console.log(`[Math] Found ${mathBlocks.length} math blocks`);
    
    mathBlocks.forEach((element, idx) => {
      console.log(`[Math] Block ${idx}: Element HTML=`, element.outerHTML.substring(0, 200));
      console.log(`[Math] Block ${idx}: Element attributes:`, Array.from((element as HTMLElement).attributes).map(a => `${a.name}="${a.value}"`));
      
      const formula = (element as HTMLElement).getAttribute('data-formula');
      console.log(`[Math] Block ${idx}: formula="${formula}"`);
      
      if (!formula) {
        console.log(`[Math] Block ${idx}: Empty formula, skipping`);
        return;
      }

      // Check if already rendered
      const existingMath = element.querySelector('.math-rendered');
      if (existingMath) {
        console.log(`[Math] Block ${idx}: Already rendered, skipping`);
        return;
      }

      try {
        const html = katex.renderToString(formula, {
          displayMode: true,
          throwOnError: false,
          trust: true,
        });

        console.log(`[Math] Block ${idx}: Rendered successfully, HTML length: ${html.length}`);

        const container = document.createElement('div');
        container.className = 'math-rendered';
        container.innerHTML = html;
        
        // Clear and insert
        element.innerHTML = '';
        element.appendChild(container);
        console.log(`[Math] Block ${idx}: Inserted into DOM`);
      } catch (error) {
        console.error('[Math] Error rendering block math:', error, formula);
        const error_container = document.createElement('div');
        error_container.className = 'math-error';
        error_container.textContent = `Error: ${error instanceof Error ? error.message : 'Invalid formula'}`;
        element.innerHTML = '';
        element.appendChild(error_container);
      }
    });

    // Render inline math
    const mathInlines = document.querySelectorAll('[data-mdwe="math-inline"]');
    console.log(`[Math] Found ${mathInlines.length} inline math elements`);
    
    mathInlines.forEach((element, idx) => {
      const formula = (element as HTMLElement).getAttribute('data-formula');
      console.log(`[Math] Inline ${idx}: formula="${formula}"`);
      
      if (!formula) {
        console.log(`[Math] Inline ${idx}: Empty formula, skipping`);
        return;
      }

      // Check if already rendered
      if (element.querySelector('.math-rendered')) {
        console.log(`[Math] Inline ${idx}: Already rendered, skipping`);
        return;
      }

      try {
        const html = katex.renderToString(formula, {
          displayMode: false,
          throwOnError: false,
          trust: true,
        });

        console.log(`[Math] Inline ${idx}: Rendered successfully, HTML length: ${html.length}`);

        const container = document.createElement('span');
        container.className = 'math-rendered';
        container.innerHTML = html;
        
        // Clear and insert
        element.innerHTML = '';
        element.appendChild(container);
        console.log(`[Math] Inline ${idx}: Inserted into DOM`);
      } catch (error) {
        console.error('[Math] Error rendering inline math:', error, formula);
        const error_container = document.createElement('span');
        error_container.className = 'math-error';
        error_container.textContent = `Error: ${error instanceof Error ? error.message : 'Invalid formula'}`;
        element.innerHTML = '';
        element.appendChild(error_container);
      }
    });
    
    console.log('[Math] Finished rendering all math');
  } catch (error) {
    console.error('[Math] Error in renderMathBlocks:', error);
  }
}

/**
 * Convert markdown-style math to our custom nodes
 * Converts $$formula$$ to block math nodes and $formula$ to inline math nodes
 */
export function convertMarkdownMath(html: string): string {
  console.log('[Math] Starting convertMarkdownMath');
  
  // First, handle block math ($$...$$)
  // Allow content that doesn't start or end with $ (to avoid matching $$$$)
  let converted = html.replace(
    /\$\$([^]*?)\$\$/g,
    (match, formula) => {
      // Skip empty formulas
      if (!formula || !formula.trim()) {
        console.log('[Math] Skipping empty block math');
        return match;
      }
      const trimmedFormula = formula.trim();
      console.log(`[Math] Converting block math: "${trimmedFormula.substring(0, 50)}${trimmedFormula.length > 50 ? '...' : ''}"`);
      return `<div data-mdwe="math-block" data-formula="${escapeHtml(trimmedFormula)}" class="math-block-placeholder"></div>`;
    }
  );

  // Then handle inline math ($...$) but not $$...$$
  // Use negative lookbehind/lookahead to avoid matching block math
  converted = converted.replace(
    /(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)/g,
    (match, formula) => {
      // Skip empty formulas
      if (!formula || !formula.trim()) {
        console.log('[Math] Skipping empty inline math');
        return match;
      }
      const trimmedFormula = formula.trim();
      console.log(`[Math] Converting inline math: "${trimmedFormula}"`);
      return `<span data-mdwe="math-inline" data-formula="${escapeHtml(trimmedFormula)}" class="math-inline-placeholder"></span>`;
    }
  );

  console.log('[Math] Finished convertMarkdownMath');
  return converted;
}

/**
 * Escape HTML special characters in formula
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
