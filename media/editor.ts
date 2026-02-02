import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import History from '@tiptap/extension-history';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Node } from '@tiptap/core';

import { MessageFromWebview, MessageToWebview, EditorConfig } from '../types';
import { MathBlock, MathInline, renderMathBlocks, convertMarkdownMath } from './mathExtension';
import { WebviewRTLService } from './rtlService';
import mermaid from 'mermaid';
import katex from 'katex';

// Fluent UI System Icons SVG paths
const icons = {
  bold: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 3.5h5.049a3.876 3.876 0 0 1 2.744 1.136A3.876 3.876 0 0 1 14.429 7.38c0 1.03-.419 1.962-1.094 2.637.924.673 1.524 1.76 1.524 2.982a3.876 3.876 0 0 1-1.136 2.744 3.876 3.876 0 0 1-2.744 1.136h-5.43v-1h5.43c.796 0 1.558-.316 2.12-.878a2.996 2.996 0 0 0 .88-2.12c0-.795-.317-1.558-.88-2.12a2.996 2.996 0 0 0-2.12-.879H8.5v-1h2.048c.796 0 1.559-.316 2.121-.878a2.996 2.996 0 0 0 .879-2.121c0-.795-.317-1.559-.879-2.12a2.996 2.996 0 0 0-2.12-.88H5.5v-1z"/></svg>',
  italic: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 3.5h7v1h-2.837L9.337 15.5h2.826v1h-7v-1h2.837l3.326-11H8.5v-1z"/></svg>',
  underline: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 3.5h1v7c0 1.933 1.567 3.5 3.5 3.5s3.5-1.567 3.5-3.5v-7h1v7c0 2.485-2.015 4.5-4.5 4.5s-4.5-2.015-4.5-4.5v-7zm-1 13h11v1h-11v-1z"/></svg>',
  strikethrough: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M14.5 6.5c0-1.93-1.57-3.5-3.5-3.5H7c-1.93 0-3.5 1.57-3.5 3.5v1h1v-1C4.5 5.12 5.62 4 7 4h4c1.38 0 2.5 1.12 2.5 2.5v.5h-10v1h16v-1h-5v-.5zM7 16h4c1.38 0 2.5-1.12 2.5-2.5v-.5h1v.5c0 1.93-1.57 3.5-3.5 3.5H7c-1.93 0-3.5-1.57-3.5-3.5v-.5h1v.5c0 1.38 1.12 2.5 2.5 2.5z"/></svg>',
  code: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M6.354 5.646L2.707 9.293a1 1 0 0 0 0 1.414l3.647 3.647.707-.707L3.414 10l3.647-3.647-.707-.707zm7.292 0l-.707.707L16.586 10l-3.647 3.647.707.707 3.647-3.647a1 1 0 0 0 0-1.414l-3.647-3.647z"/></svg>',
  bulletList: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm0 4.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm0 4.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM6.5 5h11v1h-11V5zm0 4.5h11v1h-11v-1zm0 4.5h11v1h-11v-1z"/></svg>',
  orderedList: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2.5 3.5h1.75v3.75H2.5v-1h1.25v-1.5H2.5v-1zm0 6h2.75v1H2.75v.75h1.5v1H2.5v-1h1.75v-.75H2.5v-1zm0 6h1.75v.75H2.5v1h2.75v-3H2.5v1h1.75v.5H2.5v.75zm4-10h11v1h-11v-1zm0 4.5h11v1h-11v-1zm0 4.5h11v1h-11v-1z"/></svg>',
  quote: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4.5 6c0-1.657 1.343-3 3-3h.5a.5.5 0 0 0 0-1h-.5c-2.21 0-4 1.79-4 4v3.5A1.5 1.5 0 0 0 5 11h1.5a.5.5 0 0 0 .5-.5V7a.5.5 0 0 0-.5-.5H6a.5.5 0 0 0-.5.5v2.5h-.5a.5.5 0 0 1-.5-.5V6zm6 0c0-1.657 1.343-3 3-3h.5a.5.5 0 0 0 0-1h-.5c-2.21 0-4 1.79-4 4v3.5a1.5 1.5 0 0 0 1.5 1.5H13a.5.5 0 0 0 .5-.5V7a.5.5 0 0 0-.5-.5h-.5a.5.5 0 0 0-.5.5v2.5h-.5a.5.5 0 0 1-.5-.5V6z"/></svg>',
  codeBlock: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M11.5 3.5l.4.92-4 14-.92-.4 4-14 .92.4zM6.354 6.146l-3.647 3.647a1 1 0 0 0 0 1.414l3.647 3.647.707-.707L3.414 10.5l3.647-3.647-.707-.707zm7.292 0l-.707.707 3.647 3.647-3.647 3.647.707.707 3.647-3.647a1 1 0 0 0 0-1.414l-3.647-3.647z"/></svg>',
  textColor: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3L5 14h1.5l1.25-2.75h5.5L14.5 14H16L11 3h-1zm0 2.5l2 4.5H8l2-4.5z"/></svg>',
  highlight: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10.5 2.915a.5.5 0 0 1 .277.447l.001 1.038h1.038a.5.5 0 0 1 0 1h-1.038v1.038a.5.5 0 0 1-1 0V5.4H8.74a.5.5 0 0 1 0-1h1.038V3.362a.5.5 0 0 1 .723-.447zm3.328 2.913l-7.071 7.071 2.121 2.122 7.071-7.071-2.121-2.122zM5.636 12.778L2.757 15.657a.5.5 0 0 0 0 .707l.879.879a.5.5 0 0 0 .707 0l2.879-2.879-1.586-1.586z"/></svg>',
  link: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9.5 7.5a2.5 2.5 0 0 0 0 5h1v-1h-1a1.5 1.5 0 0 1 0-3h1v-1h-1zm1 1v3h1v-3h-1zm2 4h1a2.5 2.5 0 0 0 0-5h-1v1h1a1.5 1.5 0 0 1 0 3h-1v1z"/><path d="M7.5 5C5.567 5 4 6.567 4 8.5v3C4 13.433 5.567 15 7.5 15h5c1.933 0 3.5-1.567 3.5-3.5v-3C16 6.567 14.433 5 12.5 5h-5zm0 1h5C13.881 6 15 7.119 15 8.5v3c0 1.381-1.119 2.5-2.5 2.5h-5C6.119 14 5 12.881 5 11.5v-3C5 7.119 6.119 6 7.5 6z"/></svg>',
  image: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 1h14v7.586l-2.293-2.293a1 1 0 0 0-1.414 0L10 13.586l-2.293-2.293a1 1 0 0 0-1.414 0L3 14.586V5zm3.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  table: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 1h14v3h-3V5H9v3H3V5zm0 4h5v3H3V9zm6 0h3v3H9V9zm4 0h4v3h-4V9zM3 13h5v2H3v-2zm6 0h3v2H9v-2zm4 0h4v2h-4v-2z"/></svg>',
  hr: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 9.5h16v1H2v-1z"/></svg>',
  download: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a.5.5 0 0 1 .5.5v10.086l2.793-2.793a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L9.5 12.586V2.5A.5.5 0 0 1 10 2zm-6 14h12v1H4v-1z"/></svg>',
  rtl: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4.5h14v1H3v-1zm0 5h10v1H3v-1zm0 5h14v1H3v-1z"/><path d="M14.5 9.5l2.5 2.5-2.5 2.5v-1.5h-4v-2h4v-1.5z"/></svg>',
  math: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5h1v10H2V5zm3.5 0c-.276 0-.5.224-.5.5v3.414L3.793 7.207a.5.5 0 1 0-.707.707L4.293 10l-1.207 1.207a.5.5 0 1 0 .707.707L5.5 11.086V14.5c0 .276.224.5.5.5s.5-.224.5-.5v-3.414l1.207 1.207a.5.5 0 1 0 .707-.707L6.707 10l1.207-1.207a.5.5 0 0 0-.707-.707L6.5 8.914V5.5c0-.276-.224-.5-.5-.5zm7 0h3.5c1.381 0 2.5 1.119 2.5 2.5v5c0 1.381-1.119 2.5-2.5 2.5h-3.5c-.276 0-.5-.224-.5-.5s.224-.5.5-.5h3.5c.829 0 1.5-.671 1.5-1.5v-5c0-.829-.671-1.5-1.5-1.5h-3.5c-.276 0-.5-.224-.5-.5s.224-.5.5-.5zm9 0h1v10h-1V5z"/></svg>',
};

// Custom extension to preserve Mermaid placeholder divs
const MermaidPlaceholder = Node.create({
  name: 'mermaidPlaceholder',
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      'data-id': {
        default: '',
        parseHTML: element => element.getAttribute('data-id'),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-mdwe="mermaid"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return false;
          return {
            'data-id': element.getAttribute('data-id') || '',
            'data-fence-type': element.getAttribute('data-fence-type') || 'backtick',
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-mdwe': 'mermaid', 'data-fence-type': HTMLAttributes['data-fence-type'] || 'backtick', class: 'mermaid-placeholder' }];
  },

  parseDOM: [
    {
      tag: 'div[data-mdwe="mermaid"]',
    },
  ],
});

// Type definitions for VSCode API
interface VSCodeApi {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

const vscode = acquireVsCodeApi();

// Initialize Mermaid (bundled locally, no CDN)
mermaid.initialize({ 
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  maxTextSize: 50000,
  // Configure flowchart for better text handling
  flowchart: {
    htmlLabels: false,  // Disable HTML labels, use plain text wrapping instead
    useMaxWidth: true,
    padding: 15,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
});

let editor: Editor | null = null;
let mermaidSources: Record<string, string> = {};
let currentMermaidEditId: string | null = null;
let editorConfig: EditorConfig = WebviewRTLService.getDefaultConfig();
let contentHash = '';
let userChangesCount = 0; // Track real user changes
let isLoadingContent = false; // Flag to prevent counting initial load as changes
let editorInitialized = false; // Flag to ensure editor is only initialized once with correct RTL config

// Setup message listener FIRST before anything else
window.addEventListener('message', (event) => {
  const message = event.data as MessageToWebview;

  // Intercept setContent to ensure editor initializes with correct config
  if (message.type === 'setContent' && !editorInitialized && message.config) {
    editorConfig = message.config;
    WebviewRTLService.applyConfig(editorConfig);
    // Now initialize editor with correct RTL settings
    initializeEditor();
    editorInitialized = true;
  }
  handleMessageFromExtension(message);
});

// Initialize UI when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setupUIHandlers();
  notifyReady();
});

function initializeEditor() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  editor = new Editor({
    element: editorContainer,
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        // Keep history enabled
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: WebviewRTLService.getDefaultAlignment(editorConfig.rtl),
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({
        allowBase64: false,
        inline: false,
        HTMLAttributes: {
          class: 'editor-image',
          draggable: true,
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            width: {
              default: null,
              parseHTML: element => element.getAttribute('width'),
              renderHTML: attributes => {
                if (!attributes.width) return {};
                return { width: attributes.width };
              },
            },
            height: {
              default: null,
              parseHTML: element => element.getAttribute('height'),
              renderHTML: attributes => {
                if (!attributes.height) return {};
                return { height: attributes.height };
              },
            },
            style: {
              default: null,
              parseHTML: element => element.getAttribute('style'),
              renderHTML: attributes => {
                if (!attributes.style) return {};
                return { style: attributes.style };
              },
            },
            class: {
              default: 'editor-image',
              parseHTML: element => element.getAttribute('class'),
              renderHTML: attributes => {
                if (!attributes.class) return {};
                return { class: attributes.class };
              },
            },
          };
        },
      }),
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      MermaidPlaceholder,
      MathBlock,
      MathInline,
    ],
    content: '<p></p>',
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const newHash = hashContent(html);
      
      if (newHash !== contentHash) {
        contentHash = newHash;
        debounceAutoSave(html);
        
        // Track user changes (but not during initial content loading)
        if (!isLoadingContent) {
          userChangesCount++;
          console.log('[History] User change tracked. Count:', userChangesCount);
        }
      }
      
      // Process code blocks for language detection and copy buttons
      processCodeBlocks();
      
      // Add IDs to headings for anchor links
      addHeadingIds();
      
      // Render Mermaid diagrams after content updates
      setTimeout(() => renderMermaidDiagrams(), 100);
      
      // Render math blocks and inline math
      setTimeout(() => renderMathBlocks(), 150);
    },
    onBlur: () => {
      saveContent();
    },
  });

  // Attach toolbar event listeners now that editor is initialized
  attachToolbarEventListeners();

  // Handle mermaid diagram clicks
  setupMermaidHandlers();

  // Setup custom link click handler with https:// auto-prefix
  setupLinkClickHandler();

  // Setup image resize and drag handlers
  setupImageHandlers();

  // Setup paste and drop handlers for images
  setupImagePasteDropHandlers();

  // Setup auto-detection of RTL content
  if (editorConfig.autoDetectRtl) {
    detectRTLContent();
  }
}

function setupUIHandlers() {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  // Create toolbar groups
  createToolbar(toolbar);

  // Modal handlers
  document.getElementById('modal-close')?.addEventListener('click', closeMermaidModal);
  document.getElementById('mermaid-cancel')?.addEventListener('click', closeMermaidModal);
  document.getElementById('mermaid-save')?.addEventListener('click', saveMermaidEdit);
}

function createToolbar(container: HTMLElement) {
  container.innerHTML = '';

  // Text formatting group
  const formatGroup = document.createElement('div');
  formatGroup.className = 'toolbar-group';
  formatGroup.innerHTML = `
    <button class="toolbar-btn" id="bold-btn" title="Bold (Ctrl+B)">${icons.bold}</button>
    <button class="toolbar-btn" id="italic-btn" title="Italic (Ctrl+I)">${icons.italic}</button>
    <button class="toolbar-btn" id="underline-btn" title="Underline (Ctrl+U)">${icons.underline}</button>
    <button class="toolbar-btn" id="strike-btn" title="Strikethrough">${icons.strikethrough}</button>
    <button class="toolbar-btn" id="code-btn" title="Inline code">${icons.code}</button>
  `;
  container.appendChild(formatGroup);

  // Heading group
  const headingGroup = document.createElement('div');
  headingGroup.className = 'toolbar-group';
  headingGroup.innerHTML = `
    <select class="toolbar-select" id="heading-select" title="Paragraph style">
      <option value="paragraph">Normal</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
    </select>
  `;
  container.appendChild(headingGroup);

  // List group
  const listGroup = document.createElement('div');
  listGroup.className = 'toolbar-group';
  listGroup.innerHTML = `
    <button class="toolbar-btn" id="bullet-list-btn" title="Bullets">${icons.bulletList}</button>
    <button class="toolbar-btn" id="ordered-list-btn" title="Numbering">${icons.orderedList}</button>
  `;
  container.appendChild(listGroup);

  // Block group
  const blockGroup = document.createElement('div');
  blockGroup.className = 'toolbar-group';
  blockGroup.innerHTML = `
    <button class="toolbar-btn" id="blockquote-btn" title="Quote">${icons.quote}</button>
    <button class="toolbar-btn" id="code-block-btn" title="Code Block">${icons.codeBlock}</button>
  `;
  container.appendChild(blockGroup);

  // Color group
  const colorGroup = document.createElement('div');
  colorGroup.className = 'toolbar-group';
  colorGroup.innerHTML = `
    <label class="toolbar-btn" title="Text color" style="position: relative; cursor: pointer; display: flex; align-items: center; justify-content: center;">
      <span id="text-color-indicator" style="color: #000000;">${icons.textColor}</span>
      <input type="color" id="text-color-btn" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; top: 0; left: 0;">
    </label>
    <label class="toolbar-btn" title="Highlight color" style="position: relative; cursor: pointer; display: flex; align-items: center; justify-content: center;">
      <span id="highlight-color-indicator" style="color: #ffff00;">${icons.highlight}</span>
      <input type="color" id="highlight-btn" value="#ffff00" style="position: absolute; opacity: 0; width: 100%; height: 100%; cursor: pointer; top: 0; left: 0;">
    </label>
  `;
  container.appendChild(colorGroup);

  // Insert group
  const insertGroup = document.createElement('div');
  insertGroup.className = 'toolbar-group';
  insertGroup.innerHTML = `
    <button class="toolbar-btn" id="link-btn" title="Insert link">${icons.link}</button>
    <button class="toolbar-btn" id="image-btn" title="Insert picture">${icons.image}</button>
    <button class="toolbar-btn" id="table-btn" title="Insert table">${icons.table}</button>
    <button class="toolbar-btn" id="math-btn" title="Insert math formula">${icons.math}</button>
    <button class="toolbar-btn" id="hr-btn" title="Horizontal line">${icons.hr}</button>
  `;
  container.appendChild(insertGroup);

  // RTL/LTR toggle and Export group
  const rtlGroup = document.createElement('div');
  rtlGroup.className = 'toolbar-group';
  rtlGroup.innerHTML = `
    <button class="toolbar-btn" id="export-btn" title="Export as HTML">${icons.download}</button>
    <button class="toolbar-btn ${editorConfig.rtl ? 'active' : ''}" id="rtl-btn" title="Toggle RTL/LTR">${icons.rtl}</button>
  `;
  container.appendChild(rtlGroup);
}

function attachToolbarEventListeners() {
  if (!editor) return;

  // Text formatting
  document.getElementById('bold-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBold().run());
  document.getElementById('italic-btn')?.addEventListener('click', () => editor!.chain().focus().toggleItalic().run());
  document.getElementById('underline-btn')?.addEventListener('click', () => editor!.chain().focus().toggleUnderline().run());
  document.getElementById('strike-btn')?.addEventListener('click', () => editor!.chain().focus().toggleStrike().run());
  document.getElementById('code-btn')?.addEventListener('click', () => editor!.chain().focus().toggleCode().run());

  // Headings
  document.getElementById('heading-select')?.addEventListener('change', (e) => {
    const value = (e.target as HTMLSelectElement).value;
    if (value === 'paragraph') {
      editor!.chain().focus().setParagraph().run();
    } else {
      const level = parseInt(value.replace('h', ''));
      editor!.chain().focus().toggleHeading({ level: level as any }).run();
    }
  });

  // Lists
  document.getElementById('bullet-list-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBulletList().run());
  document.getElementById('ordered-list-btn')?.addEventListener('click', () => editor!.chain().focus().toggleOrderedList().run());

  // Blocks
  document.getElementById('blockquote-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBlockquote().run());
  document.getElementById('code-block-btn')?.addEventListener('click', () => editor!.chain().focus().toggleCodeBlock().run());

  // Colors
  document.getElementById('text-color-btn')?.addEventListener('change', (e) => {
    const color = (e.target as HTMLInputElement).value;
    const indicator = document.getElementById('text-color-indicator');
    if (indicator) {
      indicator.style.color = color;
    }
    editor!.chain().focus().setColor(color).run();
  });

  document.getElementById('highlight-btn')?.addEventListener('change', (e) => {
    const color = (e.target as HTMLInputElement).value;
    const indicator = document.getElementById('highlight-color-indicator');
    if (indicator) {
      indicator.style.color = color;
    }
    editor!.chain().focus().setHighlight({ color }).run();
  });

  // Insert Link
  document.getElementById('link-btn')?.addEventListener('click', () => {
    console.log('[Link] Link button clicked');
    const modal = document.getElementById('link-modal') as HTMLDivElement;
    if (!modal) {
      console.error('[Link] Modal not found');
      return;
    }
    
    const textInput = document.getElementById('link-text') as HTMLInputElement;
    const urlInput = document.getElementById('link-url') as HTMLInputElement;
    const modalContent = modal.querySelector('.modal-content') as HTMLElement;
    
    // Set modal direction based on system language, not document direction
    if (modalContent) {
      modalContent.dir = systemIsRTL ? 'rtl' : 'ltr';
    }
    
    // Clear previous values
    textInput.value = '';
    urlInput.value = '';
    
    // If text is selected, pre-fill the text field
    const { from, to } = editor!.state.selection;
    if (from !== to) {
      const selectedText = editor!.state.doc.textBetween(from, to);
      textInput.value = selectedText;
      console.log('[Link] Pre-filled text from selection:', selectedText);
    }
    
    // Show modal
    modal.style.display = 'flex';
    urlInput.focus();
  });
  
  // Link modal handlers
  document.getElementById('link-modal-close')?.addEventListener('click', () => {
    const modal = document.getElementById('link-modal') as HTMLDivElement;
    const errorDiv = document.getElementById('link-url-error') as HTMLDivElement;
    const saveBtn = document.getElementById('link-save') as HTMLButtonElement;
    modal.style.display = 'none';
    // Reset error state and button
    if (errorDiv) errorDiv.style.display = 'none';
    if (saveBtn) saveBtn.disabled = false;
  });
  
  document.getElementById('link-cancel')?.addEventListener('click', () => {
    const modal = document.getElementById('link-modal') as HTMLDivElement;
    const errorDiv = document.getElementById('link-url-error') as HTMLDivElement;
    const saveBtn = document.getElementById('link-save') as HTMLButtonElement;
    modal.style.display = 'none';
    // Reset error state and button
    if (errorDiv) errorDiv.style.display = 'none';
    if (saveBtn) saveBtn.disabled = false;
  });
  
  document.getElementById('link-save')?.addEventListener('click', () => {
    console.log('[Link] Save button clicked');
    const textInput = document.getElementById('link-text') as HTMLInputElement;
    const urlInput = document.getElementById('link-url') as HTMLInputElement;
    const modal = document.getElementById('link-modal') as HTMLDivElement;
    
    const linkText = textInput.value.trim();
    const url = urlInput.value.trim();
    
    if (!url) {
      alert('Please enter a URL');
      return;
    }
    
    // Validate URL format
    if (!isValidUrl(url)) {
      alert('URL must start with a protocol (http://, https://, ftp://, etc.)');
      return;
    }
    
    try {
      const { from, to } = editor!.state.selection;
      const hasSelection = from !== to;
      
      if (hasSelection) {
        // If text is selected, apply link to the selection
        console.log('[Link] Applying link to selected text');
        editor!.chain().focus().setLink({ href: url }).run();
      } else {
        // If no text selected, insert text and apply link
        const displayText = linkText || url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || url;
        console.log('[Link] Inserting new link with text:', displayText);
        
        // Insert text first, then apply link mark to it
        editor!.chain()
          .focus()
          .insertContent(displayText)
          .extendMarkRange('link')
          .setLink({ href: url })
          .run();
      }
      
      console.log('[Link] Link created successfully');
      modal.style.display = 'none';
    } catch (err) {
      console.error('[Link] Error creating link:', err);
    }
  });
  
  // Allow Enter key to submit
  document.getElementById('link-url')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('link-save')?.click();
    }
  });

  // Real-time validation for URL input
  document.getElementById('link-url')?.addEventListener('input', (e) => {
    const urlInput = e.target as HTMLInputElement;
    updateLinkUrlError(urlInput.value);
  });

  document.getElementById('image-btn')?.addEventListener('click', () => {
    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png,image/jpeg,image/jpg,image/svg+xml,.png,.jpg,.jpeg,.svg';
    
    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      // Validate file type
      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
      if (!validTypes.includes(file.type)) {
        alert('Please select a valid image file (PNG, JPG, or SVG)');
        return;
      }
      
      // Read file as base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        if (base64String) {
          // Send to extension to save the file
          vscode.postMessage({
            type: 'saveImageFile',
            imageData: base64String,
            fileName: file.name,
          });
        }
      };
      reader.readAsDataURL(file);
    });
    
    fileInput.click();
  });

  document.getElementById('table-btn')?.addEventListener('click', () => {
    editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    
    // Apply RTL alignment to all table cells if in RTL mode
    if (editorConfig.rtl) {
      setTimeout(() => {
        const alignment = 'right'; // RTL alignment
        // Select the first cell and then traverse all cells in the table
        editor!.chain()
          .focus()
          .goToNextCell() // Move to first cell
          .setTextAlign(alignment)
          .goToPreviousCell()
          .selectTable() // Select entire table
          .setTextAlign(alignment)
          .run();
      }, 100);
    }
  });

  document.getElementById('math-btn')?.addEventListener('click', () => {
    openMathModal();
  });

  document.getElementById('hr-btn')?.addEventListener('click', () => {
    editor!.chain().focus().setHorizontalRule().run();
  });

  // Export HTML
  document.getElementById('export-btn')?.addEventListener('click', () => {
    if (!editor) return;
    
    const html = editor.getHTML();
    vscode.postMessage({
      type: 'exportHTML',
      options: {
        title: 'Document',
        includeStyles: true,
        includeScripts: true,
        standalone: true,
      },
    });
  });

  // RTL toggle
  document.getElementById('rtl-btn')?.addEventListener('click', () => {
    editorConfig.rtl = !editorConfig.rtl;
    WebviewRTLService.applyToDocument(editorConfig.rtl);
    WebviewRTLService.updateButtonUI(editorConfig.rtl);
    
    const alignment = WebviewRTLService.getDefaultAlignment(editorConfig.rtl);
    editor!.chain().focus().setTextAlign(alignment).run();
  });
}

function setupMermaidHandlers() {
  setTimeout(() => {
    document.querySelectorAll('[data-mdwe="mermaid"]').forEach((element) => {
      element.addEventListener('click', (e) => {
        const mermaidId = (e.currentTarget as HTMLElement).getAttribute('data-id');
        if (mermaidId) {
          openMermaidModal(mermaidId);
        }
      });
    });
  }, 100);
}

function setupLinkClickHandler() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  // Delegate click handler for all links in the editor
  editorContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const link = target.closest('a');
    
    if (link) {
      e.preventDefault();
      let url = link.getAttribute('href') || '';
      
      // Handle anchor links (internal page navigation)
      if (url.startsWith('#')) {
        const anchorId = decodeURIComponent(url.substring(1));
        // Try to find the element by ID
        const targetElement = document.getElementById(anchorId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          // If not found by ID, try to find heading with matching text
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          for (const heading of headings) {
            const headingText = heading.textContent?.trim() || '';
            // Try exact match first
            if (headingText === anchorId || 
                headingText.toLowerCase().replace(/\s+/g, '-') === anchorId.toLowerCase()) {
              heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
              break;
            }
          }
        }
        return;
      }
      
      // Prepend https:// if URL doesn't start with http(s):// or other protocol
      if (url && !url.match(/^[a-z]+:\/\//i)) {
        url = 'https://' + url;
      }
      
      if (url) {
        window.open(url, '_blank');
      }
    }
  });
}

function isValidUrl(url: string): boolean {
  // Check if URL starts with a valid protocol (http://, https://, ftp://, etc.)
  // or matches common domain patterns
  const urlPattern = /^[a-z]+:\/\//i;
  return url.match(urlPattern) !== null;
}

function updateLinkUrlError(url: string): void {
  const errorDiv = document.getElementById('link-url-error') as HTMLDivElement;
  const saveBtn = document.getElementById('link-save') as HTMLButtonElement;
  
  if (!errorDiv || !saveBtn) return;
  
  const trimmedUrl = url.trim();
  
  if (!trimmedUrl) {
    errorDiv.style.display = 'none';
    saveBtn.disabled = false;
    return;
  }
  
  if (!isValidUrl(trimmedUrl)) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = '⚠ URL must start with a protocol (http://, https://, ftp://, etc.)';
    errorDiv.dir = systemIsRTL ? 'rtl' : 'ltr';
    errorDiv.style.textAlign = systemIsRTL ? 'right' : 'left';
    saveBtn.disabled = true;
  } else {
    errorDiv.style.display = 'none';
    saveBtn.disabled = false;
  }
}

function setupImageHandlers() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  let selectedImage: HTMLImageElement | null = null;
  let isResizing = false;
  let resizeHandle: 'se' | 'sw' | 'ne' | 'nw' | null = null;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  // Add click handler to select images
  editorContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    // Ignore clicks on resize handles
    if (target.classList.contains('image-resize-handle')) {
      return;
    }
    
    if (target.tagName === 'IMG' && target.classList.contains('editor-image')) {
      e.preventDefault();
      selectImage(target as HTMLImageElement);
    } else if (!target.closest('.image-wrapper')) {
      deselectImage();
    }
  });

  function selectImage(img: HTMLImageElement) {
    deselectImage();
    selectedImage = img;
    img.classList.add('image-selected');
    
    // Create 4 corner resize handles positioned absolutely relative to viewport
    const rect = img.getBoundingClientRect();
    const handles = ['nw', 'ne', 'sw', 'se'];
    const handleElements: HTMLElement[] = [];
    
    handles.forEach(handle => {
      const handleDiv = document.createElement('div');
      handleDiv.className = `image-resize-handle image-resize-handle-${handle}`;
      handleDiv.dataset.handle = handle;
      handleDiv.style.position = 'fixed';
      handleDiv.style.zIndex = '10000';
      
      // Position based on image bounds
      const handleSize = 16;
      if (handle === 'nw') {
        handleDiv.style.left = `${rect.left - handleSize / 2}px`;
        handleDiv.style.top = `${rect.top - handleSize / 2}px`;
      } else if (handle === 'ne') {
        handleDiv.style.left = `${rect.right - handleSize / 2}px`;
        handleDiv.style.top = `${rect.top - handleSize / 2}px`;
      } else if (handle === 'sw') {
        handleDiv.style.left = `${rect.left - handleSize / 2}px`;
        handleDiv.style.top = `${rect.bottom - handleSize / 2}px`;
      } else if (handle === 'se') {
        handleDiv.style.left = `${rect.right - handleSize / 2}px`;
        handleDiv.style.top = `${rect.bottom - handleSize / 2}px`;
      }
      
      document.body.appendChild(handleDiv);
      handleElements.push(handleDiv);
      
      // Attach event listener
      handleDiv.addEventListener('mousedown', startResize);
    });
    
    // Store handle elements for cleanup
    (img as any).__resizeHandles = handleElements;
    
    console.log('[Image] Image selected, resize handles and alignment toolbar added');
  }

  function deselectImage() {
    if (!selectedImage) return;
    
    selectedImage.classList.remove('image-selected');
    
    // Remove handles from body
    const handles = (selectedImage as any).__resizeHandles as HTMLElement[];
    if (handles) {
      handles.forEach(handle => handle.remove());
      delete (selectedImage as any).__resizeHandles;
    }
    
    selectedImage = null;
  }
  
  function updateHandlePositions() {
    if (!selectedImage) return;
    
    const rect = selectedImage.getBoundingClientRect();
    const handles = (selectedImage as any).__resizeHandles as HTMLElement[];
    if (!handles) return;
    
    const handleSize = 16;
    handles.forEach(handle => {
      const type = handle.dataset.handle;
        if (type === 'nw') {
          handle.style.left = `${rect.left - handleSize / 2}px`;
          handle.style.top = `${rect.top - handleSize / 2}px`;
        } else if (type === 'ne') {
          handle.style.left = `${rect.right - handleSize / 2}px`;
          handle.style.top = `${rect.top - handleSize / 2}px`;
        } else if (type === 'sw') {
          handle.style.left = `${rect.left - handleSize / 2}px`;
          handle.style.top = `${rect.bottom - handleSize / 2}px`;
      } else if (type === 'se') {
        handle.style.left = `${rect.right - handleSize / 2}px`;
        handle.style.top = `${rect.bottom - handleSize / 2}px`;
      }
    });
  }

  function startResize(e: Event) {
    const mouseEvent = e as MouseEvent;
    mouseEvent.preventDefault();
    mouseEvent.stopPropagation();
    
    if (!selectedImage) return;
    
    const target = mouseEvent.target as HTMLElement;
    const handle = target.dataset.handle;
    
    if (!handle) return;
    
    console.log('[Image] Starting resize with handle:', handle);
    
    isResizing = true;
    resizeHandle = handle as 'se' | 'sw' | 'ne' | 'nw';
    startX = mouseEvent.clientX;
    startY = mouseEvent.clientY;
    startWidth = selectedImage.offsetWidth;
    startHeight = selectedImage.offsetHeight;
    
    document.addEventListener('mousemove', doResize);
    document.addEventListener('mouseup', stopResize);
  }

  function doResize(e: MouseEvent) {
    if (!isResizing || !selectedImage || !resizeHandle) return;
    
    e.preventDefault();
    
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    
    // Calculate new dimensions based on handle
    if (resizeHandle.includes('e')) {
      newWidth = startWidth + deltaX;
    } else if (resizeHandle.includes('w')) {
      newWidth = startWidth - deltaX;
    }
    
    // Maintain aspect ratio
    const aspectRatio = startWidth / startHeight;
    newHeight = newWidth / aspectRatio;
    
    // Apply minimum size constraints
    if (newWidth < 50) newWidth = 50;
    if (newHeight < 50) newHeight = 50;
    
    selectedImage.style.width = newWidth + 'px';
    selectedImage.style.height = newHeight + 'px';
    selectedImage.setAttribute('width', Math.round(newWidth).toString());
    selectedImage.setAttribute('height', Math.round(newHeight).toString());
    
    // Update handle positions during resize
    updateHandlePositions();
  }

  function stopResize() {
    if (!isResizing) return;
    
    console.log('[Image] Stopping resize');
    
    isResizing = false;
    resizeHandle = null;
    document.removeEventListener('mousemove', doResize);
    document.removeEventListener('mouseup', stopResize);
    
    // Update ProseMirror node with new dimensions
    if (editor && selectedImage) {
      const width = selectedImage.getAttribute('width');
      const height = selectedImage.getAttribute('height');
      
      console.log('[Image] Updating node with width:', width, 'height:', height);
      
      // Normalize URLs for comparison (decode both to handle %2B vs + differences)
      const normalizeUrl = (url: string) => {
        try {
          return decodeURIComponent(url);
        } catch {
          return url;
        }
      };
      
      const selectedSrc = normalizeUrl(selectedImage.src);
      console.log('[Image] Selected image src (normalized):', selectedSrc);
      
      // Find and update the image node in ProseMirror
      const { state } = editor;
      const { doc } = state;
      let nodePos: number | null = null;
      let foundNode: any = null;
      
      doc.descendants((node, pos) => {
        if (node.type.name === 'image') {
          const nodeSrc = normalizeUrl(node.attrs.src);
          if (nodeSrc === selectedSrc) {
            nodePos = pos;
            foundNode = node;
            console.log('[Image] MATCH! Found at position:', pos);
            return false;
          }
        }
      });
      
      if (nodePos !== null && foundNode) {
        const newAttrs = { ...foundNode.attrs, width, height };
        console.log('[Image] Updating attributes to:', newAttrs);
        const result = editor.commands.updateAttributes('image', newAttrs);
        console.log('[Image] Update result:', result);
        setTimeout(() => {
          console.log('[Image] Calling saveContent after resize');
          saveContent();
        }, 100);
      } else {
        console.log('[Image] ERROR: Node not found!');
      }
    }
  }

  // Close image selection when clicking outside
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.image-wrapper') && !target.classList.contains('editor-image')) {
      deselectImage();
    }
  });
}

function setupImagePasteDropHandlers() {
  const editorContainer = document.getElementById('editor-container');
  if (!editorContainer) return;

  // Handle paste events
  editorContainer.addEventListener('paste', (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          handleImageFile(file);
        }
        break;
      }
    }
  });

  // Handle drop events
  editorContainer.addEventListener('drop', (e: DragEvent) => {
    const files = e.dataTransfer?.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        e.preventDefault();
        e.stopPropagation();
        handleImageFile(file);
        break;
      }
    }
  });

  // Prevent default drag behaviors
  editorContainer.addEventListener('dragover', (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  });

  editorContainer.addEventListener('dragenter', (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

function handleImageFile(file: File) {
  // Validate file type
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    alert('Please paste or drop a valid image file (PNG, JPG, or SVG)');
    return;
  }

  // Read file as base64 and send to extension
  const reader = new FileReader();
  reader.onload = (event) => {
    const base64String = event.target?.result as string;
    if (base64String) {
      console.log('[Image] Pasted/dropped image, sending to extension');
      vscode.postMessage({
        type: 'saveImageFile',
        imageData: base64String,
        fileName: file.name || 'pasted-image.' + file.type.split('/')[1],
      });
    }
  };
  reader.readAsDataURL(file);
}

function openMermaidModal(mermaidId: string) {
  currentMermaidEditId = mermaidId;
  const textarea = document.getElementById('mermaid-source') as HTMLTextAreaElement;
  if (textarea) {
    textarea.value = mermaidSources[mermaidId] || '';
    textarea.focus();
    
    // Set up live preview on input
    textarea.addEventListener('input', updateMermaidPreview);
    
    // Initial preview render
    setTimeout(() => updateMermaidPreview(), 50);
  }

  const modal = document.getElementById('mermaid-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeMermaidModal() {
  const modal = document.getElementById('mermaid-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  
  // Clean up event listener
  const textarea = document.getElementById('mermaid-source') as HTMLTextAreaElement;
  if (textarea) {
    textarea.removeEventListener('input', updateMermaidPreview);
  }
  
  currentMermaidEditId = null;
}

function updateMermaidPreview() {
  const textarea = document.getElementById('mermaid-source') as HTMLTextAreaElement;
  const preview = document.getElementById('mermaid-preview');
  const errorDiv = document.getElementById('mermaid-error');
  
  if (!textarea || !preview || !errorDiv) return;
  
  const source = textarea.value.trim();
  
  if (!source) {
    preview.innerHTML = '<div style="color: #999;">Diagram preview will appear here</div>';
    errorDiv.style.display = 'none';
    return;
  }
  
  try {
    // Clear error
    errorDiv.style.display = 'none';
    errorDiv.innerHTML = '';
    
    // Clear preview
    preview.innerHTML = '<div style="color: #999;">Rendering...</div>';
    
    // Render Mermaid diagram
    const uniqueId = 'mermaid-preview-' + Date.now();
    preview.innerHTML = `<div id="${uniqueId}">${source}</div>`;
    
    // Initialize Mermaid rendering
    if (typeof mermaid !== 'undefined' && mermaid.contentLoaded) {
      mermaid.contentLoaded();
    } else if (typeof mermaid !== 'undefined' && mermaid.run) {
      mermaid.run();
    }
  } catch (error) {
    preview.innerHTML = '<div style="color: #999;">Error rendering preview</div>';
    errorDiv.style.display = 'block';
    errorDiv.innerHTML = `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

function saveMermaidEdit() {
  if (!currentMermaidEditId) return;

  const textarea = document.getElementById('mermaid-source') as HTMLTextAreaElement;
  const newSource = textarea.value;

  mermaidSources[currentMermaidEditId] = newSource;

  // Notify extension of update
  vscode.postMessage({
    type: 'updateMermaid',
    mermaidId: currentMermaidEditId,
    mermaidSource: newSource,
  } as MessageFromWebview);

  closeMermaidModal();
  saveContent();
}

function detectRTLContent() {
  if (!editor) return;

  const text = editor.getJSON();
  const hasRTL = WebviewRTLService.hasRTLContent(text);
  
  if (hasRTL && !editorConfig.rtl) {
    editorConfig.rtl = true;
    WebviewRTLService.applyToDocument(true);
    WebviewRTLService.updateButtonUI(true);
  }
}

/**
 * Open math formula modal
 */
function openMathModal() {
  const modal = document.getElementById('math-modal');
  const textarea = document.getElementById('math-formula') as HTMLTextAreaElement;
  const typeSelect = document.getElementById('math-type') as HTMLSelectElement;
  
  if (modal && textarea) {
    textarea.value = '';
    textarea.focus();
    typeSelect.value = 'block';
    
    // Clear previous error
    const errorDiv = document.getElementById('math-error') as HTMLDivElement;
    if (errorDiv) {
      errorDiv.style.display = 'none';
      errorDiv.textContent = '';
    }
    
    // Set up live preview on input
    textarea.addEventListener('input', updateMathPreview);
    typeSelect.addEventListener('change', updateMathPreview);
    
    // Initial preview render
    setTimeout(() => updateMathPreview(), 50);
    
    modal.style.display = 'flex';
  }

  // Setup event listeners
  document.getElementById('math-modal-close')?.addEventListener('click', closeMathModal);
  document.getElementById('math-cancel')?.addEventListener('click', closeMathModal);
  document.getElementById('math-save')?.addEventListener('click', saveMathFormula);
}

/**
 * Close math formula modal
 */
function closeMathModal() {
  const modal = document.getElementById('math-modal');
  if (modal) {
    modal.style.display = 'none';
  }

  // Clean up event listeners
  const textarea = document.getElementById('math-formula') as HTMLTextAreaElement;
  const typeSelect = document.getElementById('math-type') as HTMLSelectElement;
  
  if (textarea) {
    textarea.removeEventListener('input', updateMathPreview);
  }
  
  if (typeSelect) {
    typeSelect.removeEventListener('change', updateMathPreview);
  }
}

/**
 * Update math formula preview
 */
function updateMathPreview() {
  const textarea = document.getElementById('math-formula') as HTMLTextAreaElement;
  const preview = document.getElementById('math-preview');
  const errorDiv = document.getElementById('math-error') as HTMLDivElement;
  const typeSelect = document.getElementById('math-type') as HTMLSelectElement;
  
  if (!textarea || !preview || !errorDiv) return;

  const formula = textarea.value.trim();
  const displayMode = typeSelect.value === 'block';

  if (!formula) {
    preview.innerHTML = '<span style="color: #999;">Preview will appear here...</span>';
    errorDiv.style.display = 'none';
    return;
  }

  try {
    const katex = (window as any).katex;
    if (!katex) {
      errorDiv.style.display = 'block';
      errorDiv.textContent = 'KaTeX library not loaded';
      return;
    }

    const html = katex.renderToString(formula, {
      displayMode: displayMode,
      throwOnError: false,
      trust: true,
    });

    preview.innerHTML = `<div style="text-align: center;">${html}</div>`;
    errorDiv.style.display = 'none';
  } catch (error) {
    errorDiv.style.display = 'block';
    errorDiv.textContent = `Error: ${error instanceof Error ? error.message : 'Invalid formula'}`;
    preview.innerHTML = '';
  }
}

/**
 * Save and insert math formula
 */
function saveMathFormula() {
  const textarea = document.getElementById('math-formula') as HTMLTextAreaElement;
  const typeSelect = document.getElementById('math-type') as HTMLSelectElement;
  
  if (!textarea || !editor) return;

  const formula = textarea.value.trim();
  if (!formula) {
    alert('Please enter a formula');
    return;
  }

  const displayMode = typeSelect.value === 'block';

  try {
    if (displayMode) {
      // Insert block math
      editor.chain().focus().insertContent({
        type: 'mathBlock',
        attrs: {
          formula: formula,
        },
      }).run();
    } else {
      // Insert inline math
      editor.chain().focus().insertContent({
        type: 'mathInline',
        attrs: {
          formula: formula,
        },
      }).run();
    }

    closeMathModal();
    saveContent();
    
    // Render the newly inserted math after a delay
    setTimeout(() => {
      console.log('[Math] Calling renderMathBlocks after insert');
      renderMathBlocks();
    }, 200);
  } catch (error) {
    console.error('[Math] Error inserting formula:', error);
    alert('Error inserting formula. Check the console for details.');
  }
}

let autoSaveTimeout: NodeJS.Timeout;

function debounceAutoSave(html: string) {
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    saveContent();
  }, 750);
}

function saveContent() {
  if (!editor) return;

  const html = editor.getHTML();
  
  // LOG THE FULL HTML FOR DEBUGGING
  console.log('[SaveContent] Full HTML being sent to extension:', html);
  
  // Check if content is empty - if so, try to redo to restore content
  const textContent = editor.state.doc.textContent.trim();
  if (!textContent || html === '<p></p>' || html === '<p style="text-align: right;"></p>') {
    console.log('[SaveContent] Content is empty, attempting redo to restore');
    editor.commands.redo();
    return; // Don't save empty content
  }
  
  // Log image tags in the HTML
  const imgMatches = html.match(/<img[^>]*>/gi);
  if (imgMatches) {
    console.log('[SaveContent] Found', imgMatches.length, 'image tags in HTML:');
    imgMatches.forEach((img, i) => console.log(`[SaveContent] Image ${i + 1}:`, img));
  } else {
    console.log('[SaveContent] No image tags found in HTML');
  }

  vscode.postMessage({
    type: 'contentChanged',
    html,
    mermaidSources,
  } as MessageFromWebview);
}

function notifyReady() {
  vscode.postMessage({
    type: 'ready',
  } as MessageFromWebview);
}

// Handle messages from extension
function handleMessageFromExtension(message: MessageToWebview) {
  switch (message.type) {
    case 'setContent':
      if (editor && message.html) {
        // Set loading flag to prevent counting as user changes
        isLoadingContent = true;
        userChangesCount = 0; // Reset counter
        
        // Convert markdown math syntax to custom nodes BEFORE setting content
        const convertedHtml = convertMarkdownMath(message.html);
        
        // Set content normally
        editor.commands.setContent(convertedHtml, false);
        contentHash = hashContent(convertedHtml);
        
        // Re-enable tracking after a short delay
        setTimeout(() => {
          isLoadingContent = false;
          console.log('[History] Content loaded, tracking enabled');
        }, 50);
        
        // Process code blocks after content is set
        setTimeout(() => processCodeBlocks(), 100);
      }
      if (message.mermaidSources) {
        mermaidSources = message.mermaidSources;
      }
      if (message.config) {
        editorConfig = message.config;
        WebviewRTLService.applyConfig(editorConfig);
      }
      setupMermaidHandlers();
      // Delay to ensure DOM is fully rendered by TipTap
      setTimeout(() => renderMermaidDiagrams(), 300);
      setTimeout(() => renderMathBlocks(), 300);

    case 'setConfig':
      if (message.config) {
        editorConfig = message.config;
        WebviewRTLService.applyConfig(editorConfig);
      }
      break;

    case 'externalUpdate':
      if (editor && message.html) {
        // Set loading flag to prevent counting as user changes
        isLoadingContent = true;
        userChangesCount = 0; // Reset counter on external update
        
        // Convert markdown math syntax to custom nodes BEFORE setting content
        const convertedHtml = convertMarkdownMath(message.html);
        editor.commands.setContent(convertedHtml, false);
        setTimeout(() => {
          isLoadingContent = false;
        }, 100);
      }
      if (message.mermaidSources) {
        mermaidSources = message.mermaidSources;
      }
      setupMermaidHandlers();
      // Delay to ensure DOM is fully rendered by TipTap
      setTimeout(() => renderMermaidDiagrams(), 300);
      setTimeout(() => renderMathBlocks(), 300);
      break;

    case 'showError':
      console.error('Editor error:', message.message);
      break;

    case 'imageSaved':
      if (editor && message.imagePath) {
        // Use imageUrl for display (webview URI), but store imagePath (relative path) in src attribute
        // Set width/height if available to force HTML format storage
        const attrs: any = { src: message.imagePath };
        
        if (message.imageWidth && message.imageHeight) {
          attrs.width = message.imageWidth;
          attrs.height = message.imageHeight;
        }
        
        editor.chain().focus().setImage(attrs).run();
        
        // After insertion, update the img element to use webview URI for display
        // The resize system will handle saving the relative path
        if (message.imageUrl) {
          setTimeout(() => {
            const images = document.querySelectorAll('img.editor-image');
            images.forEach((img: Element) => {
              const htmlImg = img as HTMLImageElement;
              if (htmlImg.src === message.imagePath || htmlImg.getAttribute('src') === message.imagePath) {
                htmlImg.src = message.imageUrl!;
              }
            });
          }, 100);
        }
      }
      break;
  }
}

function renderMermaidDiagrams() {
  if (typeof mermaid === 'undefined') {
    console.error('[Mermaid] Mermaid library not available');
    return;
  }

  const elements = document.querySelectorAll('[data-mdwe="mermaid"]');
  console.log(`[Mermaid] Found ${elements.length} placeholder elements`);

  if (elements.length === 0) {
    return;
  }

  elements.forEach((element) => {
    const mermaidId = element.getAttribute('data-id');

    if (!mermaidId || !mermaidSources[mermaidId]) {
      return;
    }

    // Check if already has SVG
    const existingSvg = element.querySelector('svg');
    if (existingSvg) {
      console.log(`[Mermaid] SVG already exists for ${mermaidId}`);
      return;
    }

    const source = mermaidSources[mermaidId];
    console.log(`[Mermaid] Rendering ${mermaidId}`);

    try {
      const diagramId = `mermaid-${mermaidId}`;
      
      // Preprocess source: convert <br/> tags to escaped newlines for plain text mode
      // Since htmlLabels is disabled, <br/> won't render as HTML, but newlines will wrap text
      const processedSource = source.replace(/<br\s*\/?>/gi, '\n');
      
      mermaid.render(diagramId, processedSource)
        .then(({ svg }) => {
          console.log(`[Mermaid] Got SVG for ${mermaidId}, length: ${svg.length}`);
          // Clear element and insert SVG
          element.innerHTML = '';
          element.innerHTML = svg;
          console.log(`[Mermaid] Injected SVG into ${mermaidId}`);
          
          // Fix SVG display issues by ensuring it has proper dimensions
          // This is critical for diagrams with HTML tags like <br/> in component labels
          const injectedSvg = element.querySelector('svg');
          if (injectedSvg) {
            // Wait for text content to fully render before applying styles
            setTimeout(() => {
              try {
                // Remove inline width/height to let viewBox and CSS handle sizing
                injectedSvg.removeAttribute('width');
                injectedSvg.removeAttribute('height');
                
                // Apply CSS for responsive sizing
                // Trust Mermaid's viewBox calculation
                injectedSvg.style.width = '100%';
                injectedSvg.style.height = 'auto';
                injectedSvg.style.display = 'block';
                injectedSvg.style.overflow = 'visible';
                
                // Ensure container allows natural sizing
                element.style.overflow = 'visible';
                element.style.width = 'auto';
                element.style.height = 'auto';
                
                console.log(`[Mermaid] Finalized ${mermaidId}:`, {
                  viewBox: injectedSvg.getAttribute('viewBox'),
                  style: {
                    width: injectedSvg.style.width,
                    height: injectedSvg.style.height,
                    overflow: injectedSvg.style.overflow,
                  }
                });
              } catch (err) {
                console.error(`[Mermaid] Error finalizing SVG for ${mermaidId}:`, err);
              }
            }, 100);
          } else {
            console.warn(`[Mermaid] SVG element NOT found in DOM after injection for ${mermaidId}`);
          }
        })
        .catch((err) => {
          console.error(`[Mermaid] Error rendering ${mermaidId}:`, err);
          element.innerHTML = `<div style="color: #d13438; padding: 12px; background: #fff4f4; border: 1px solid #f0adac; border-radius: 4px; font-size: 12px; word-break: break-all;">Error: ${err.message || String(err)}</div>`;
        });
    } catch (error) {
      console.error(`[Mermaid] Error processing diagram ${mermaidId}:`, error);
      element.innerHTML = `<div style="color: #d13438; padding: 12px; background: #fff4f4; border: 1px solid #f0adac; border-radius: 4px; font-size: 12px;">Error: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
  });
}

/**
 * Generate a slug from heading text for use as an ID
 */
function generateHeadingSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0590-\u05FF\u0600-\u06FF\-]/g, '') // Keep Hebrew, Arabic, and basic chars
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Add IDs to headings for anchor link navigation
 */
function addHeadingIds() {
  if (!editor) return;
  
  const editorElement = document.querySelector('.ProseMirror');
  if (!editorElement) return;
  
  const headings = editorElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
  const usedIds = new Set<string>();
  
  headings.forEach((heading) => {
    const text = heading.textContent?.trim() || '';
    if (!text) return;
    
    let id = generateHeadingSlug(text);
    
    // Handle duplicate IDs by appending a number
    if (usedIds.has(id)) {
      let counter = 1;
      while (usedIds.has(`${id}-${counter}`)) {
        counter++;
      }
      id = `${id}-${counter}`;
    }
    
    usedIds.add(id);
    heading.id = id;
  });
}

/**
 * Process code blocks to add language detection and styling
 */
function processCodeBlocks() {
  if (!editor) return;
  
  const editorElement = document.querySelector('.ProseMirror');
  if (!editorElement) return;
  
  const codeBlocks = editorElement.querySelectorAll('pre');
  
  codeBlocks.forEach((pre) => {
    const codeElement = pre.querySelector('code');
    if (!codeElement) return;
    
    // Extract language from class or data attribute
    const classes = codeElement.className || '';
    const languageMatch = classes.match(/language-(\w+)/);
    const language = languageMatch ? languageMatch[1].toUpperCase() : 'CODE';
    
    // Set data-language attribute for CSS ::before
    pre.setAttribute('data-language', language);
    
    // Add copy button functionality
    if (!pre.querySelector('.code-copy-button')) {
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-copy-button';
      copyBtn.title = 'Copy to clipboard';
      copyBtn.textContent = '📋 Copy';
      copyBtn.style.position = 'absolute';
      copyBtn.style.top = '8px';
      copyBtn.style.right = `${60 + language.length}px`;
      
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const text = codeElement.textContent || '';
        navigator.clipboard.writeText(text).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✓ Copied!';
          copyBtn.style.background = 'rgba(16, 124, 16, 0.8)';
          
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = 'rgba(255, 255, 255, 0.1)';
          }, 2000);
        }).catch((err) => {
          console.error('Copy failed:', err);
          copyBtn.textContent = '✗ Failed';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy';
          }, 2000);
        });
      });
      
      pre.style.position = 'relative';
      pre.appendChild(copyBtn);
    }
  });
}

function hashContent(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

// Handle editor blur for autosave
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveContent();
  }
});

window.addEventListener('beforeunload', () => {
  saveContent();
});
