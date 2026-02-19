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

// Microsoft Word–style toolbar icons
const icons = {
  // Bold — thick serif B with two bumps
  bold: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M6 3.5h5.5a3 3 0 0 1 2.1 5.1A3.25 3.25 0 0 1 11.5 16H6V3.5zm2 2V9H11a1 1 0 0 0 0-2H8zm0 5v4h3.5a1.5 1.5 0 0 0 0-3H8z"/></svg>',
  // Italic — capital I, slanted, with serifs at top and bottom
  italic: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4h5v1.5h-1.8L9.4 14.5H11V16H6v-1.5h1.8L10.6 5.5H9V4z"/></svg>',
  // Underline — U shape + thick underline bar
  underline: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4h1.5v6a3.5 3.5 0 0 0 7 0V4H15v6a5 5 0 0 1-10 0V4zm-1 12.5h12V18H4v-1.5z"/></svg>',
  // Strikethrough — S with horizontal line through middle
  strikethrough: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3.5 10.5h13v1h-13v-1zM10 5C8 5 6.5 6 6.5 7.5H5C5 5.2 7.2 3.5 10 3.5c2.5 0 4.5 1.5 4.5 3H13c0-1-1.2-1.5-3-1.5zm0 9.5c-2 0-3-1-3-2h-1.5c0 2 2 3.5 4.5 3.5S14.5 14 14.5 12H13c0 1.3-1.2 2.5-3 2.5z"/></svg>',
  // Inline code — < /> angle brackets + slash
  code: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M7 6.5L3.5 10 7 13.5l1-.9L5 10l3-2.6-1-.9zm6 0l-1 .9L15 10l-3 2.6 1 .9L16.5 10 13 6.5zm-3.5 7.5.96-.26-2-7.5-.97.26 2 7.5z"/></svg>',
  // Bullet list — 3 filled circles + 3 text lines
  bulletList: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><circle cx="3" cy="5" r="1.5"/><circle cx="3" cy="10" r="1.5"/><circle cx="3" cy="15" r="1.5"/><path d="M7 4.25h11v1.5H7v-1.5zm0 5h11v1.5H7v-1.5zm0 5h11v1.5H7v-1.5z"/></svg>',
  // Ordered list — 1/2/3 numerals + 3 text lines
  orderedList: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3.75h1.5V8H2V5H1V3.75h1zm-1 7.25h3v1H3v.5h1.5v1H3v.5H4v1H1v-1h1.5V13H1v-1h.5v-.5H1v-.5zm0 6h3v-1H2v-.5h2v-1H2V15h1.5v-.5H1v-1h3v1h-1.5v.5H4V16.25H1v-1.25zM7 4.25h11v1.5H7v-1.5zm0 5h11v1.5H7v-1.5zm0 5h11v1.5H7v-1.5z"/></svg>',
  // Blockquote — thick left bar + 3 indented lines
  quote: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4h2v12H3V4zm4 2h10v1.5H7V6zm0 4h10v1.5H7V10zm0 4h10v1.5H7V14z"/></svg>',
  // Code block — { } braces inside a rounded rectangle
  codeBlock: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 5.5A2.5 2.5 0 0 1 4.5 3h11A2.5 2.5 0 0 1 18 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 2 14.5v-9zm2.5-1A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16h11a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 15.5 4.5h-11zM7 8.5l-1.5 1.5L7 11.5l-.75.75L4 10l2.25-2.25L7 8.5zm6 0 .75-.75L16 10l-2.25 2.25L13 11.5l1.5-1.5L13 8.5zm-4.5 3.5.97-.25 1.5-5-.97-.25-1.5 5z"/></svg>',
  // Text color — bold A glyph with thick bar at bottom
  textColor: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3 5.5 15h1.75L8.5 11.5h3l1.25 3.5h1.75L10 3zm0 3 1.1 4H8.9L10 6zM3.5 16.5h13V18h-13v-1.5z"/></svg>',
  // Highlight — diagonal marker/pen stroke
  highlight: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M14.5 2 18 5.5 8.5 15H5v-3.5L14.5 2zm0 2.1L6.5 12.1V13.5H7.9l8-8L14.5 4.1zM2 18h16v-1.5H2V18z"/></svg>',
  // Link — two interlocked oval chain rings
  link: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 13.5a4.5 4.5 0 0 1 0-7l1.5-1.5a4.5 4.5 0 0 1 6 6.7l-.7.7A4.5 4.5 0 0 1 8.5 13.5zm1-1 1.5-1.5.7.7-1.5 1.5a2.5 2.5 0 0 0 3.6-3.5l-.7-.7-1.5 1.5-.7-.7 1.5-1.5a3 3 0 1 0-4.2 4.2l.7.7 1.5-1.5.7.7-1.5 1.5-.7-.7-.7.7zM4.7 14.7a4.5 4.5 0 0 1 0-6.4l.7.7a3 3 0 0 0 0 4.2L6.8 14l.7.7a3 3 0 0 0 4.2 0l-.7-.7 1-1 .7.7a4.5 4.5 0 0 1-6.4 0l-.6-.7z"/></svg>',
  // Image — landscape with mountains, sky, sun
  image: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 1h14v6.5l-3.3-2.8a1 1 0 0 0-1.3.1L9.2 12l-1.9-1.4a1 1 0 0 0-1.3.2L3 14.3V5zm2.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  // Table — 3×3 grid with header row
  table: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 1h4v3H3V5zm0 4h4v3H3V9zm0 4h4v2H3v-2zm5-8h4v3H8V5zm0 4h4v3H8V9zm0 4h4v2H8v-2zm5-8h4v3h-4V5zm0 4h4v3h-4V9zm0 4h4v2h-4v-2z"/></svg>',
  // Horizontal rule — thick center line with short end ticks
  hr: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 9.25h14v1.5H3v-1.5zm0-2.5h1.5v6.5H3V6.75zm13.5 0H18v6.5h-1.5V6.75z"/></svg>',
  // Download (kept for backward compat)
  download: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a.5.5 0 0 1 .5.5v10.086l2.793-2.793a.5.5 0 1 1 .707.707l-4 4a.5.5 0 0 1-.707 0l-4-4a.5.5 0 1 1 .707-.707L9.5 12.586V2.5A.5.5 0 0 1 10 2zm-6 14h12v1H4v-1z"/></svg>',
  // HTML export — </> tag icon
  archive: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M7 6.5L3.5 10 7 13.5l1-.9L4.9 10 8 7.4 7 6.5zm6 0-1 .9L15.1 10 12 12.6l1 .9L16.5 10 13 6.5zm-2.5 8 .97-.26-2-7.5-.97.26 2 7.5z"/></svg>',
  // PDF export — document with text lines icon
  pdf: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3h8.5L16 6.5V17H4V3zm1.5 1.5v11h9V7.5H12V4.5H5.5zm8 .5 1.5 1.5H13.5V5zM7 10h6v1.5H7V10zm0 2.5h4.5V14H7v-1.5z"/></svg>',
  // RTL toggle — lines with right-pointing arrow
  rtl: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5h13v1.5H3V5zm0 4.5h8v1.5H3V9.5zm0 4.5h13v1.5H3V14zm10-5 2.5 2.5L13 14v-1.5H9.5v-2H13V7.5z"/></svg>',
  // Math — Greek capital Sigma Σ (summation)
  math: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3.5h12v1.75L11 10l5 4.75V16.5H4V14.75h9.4L9 10.5v-1l4.4-4.25H4V3.5z"/></svg>',
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
    htmlLabels: false,
    useMaxWidth: true,
    padding: 15,
    nodeSpacing: 50,
    rankSpacing: 50,
  },
  sequence: {
    useMaxWidth: true,
    showSequenceNumbers: false,
    boxMargin: 10,
    noteMargin: 10,
    messageMargin: 35,
    mirrorActors: true,
    bottomMarginAdj: 1,
    rightAngles: false,
  }
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

// ---------------------------------------------------------------------------
// PDF export overlay — shown while Chrome is generating the PDF
// ---------------------------------------------------------------------------

function createPdfOverlay() {
  const overlay = document.createElement('div');
  overlay.id = 'pdf-export-overlay';
  overlay.style.cssText = [
    'display:none',
    'position:fixed',
    'top:0', 'left:0', 'right:0', 'bottom:0',
    'background:rgba(0,0,0,0.45)',
    'z-index:9999',
    'align-items:center',
    'justify-content:center',
    'flex-direction:column',
    'gap:14px',
  ].join(';');
  overlay.innerHTML = `
    <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
      <circle cx="26" cy="26" r="22" stroke="white" stroke-width="4" opacity="0.2"/>
      <path d="M26 4a22 22 0 0 1 22 22" stroke="white" stroke-width="4" stroke-linecap="round">
        <animateTransform attributeName="transform" type="rotate"
          from="0 26 26" to="360 26 26" dur="0.75s" repeatCount="indefinite"/>
      </path>
    </svg>
    <span style="color:white;font-size:13px;font-family:var(--vscode-font-family,sans-serif);opacity:0.9">Converting to PDF\u2026</span>
  `;
  document.body.appendChild(overlay);
}

function showPdfOverlay() {
  const el = document.getElementById('pdf-export-overlay');
  if (el) { el.style.display = 'flex'; }
}

function hidePdfOverlay() {
  const el = document.getElementById('pdf-export-overlay');
  if (el) { el.style.display = 'none'; }
}

// ---------------------------------------------------------------------------

function setupUIHandlers() {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar) return;

  // Create toolbar groups
  createToolbar(toolbar);

  // PDF export overlay
  createPdfOverlay();

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
    <button class="toolbar-btn" id="export-self-contained-btn" title="Export Self-Contained HTML (images embedded)">${icons.archive}</button>
    <button class="toolbar-btn" id="export-docx-btn" title="Export as Word Document (DOCX)"><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M4 3h8.5L16 6.5V17H4V3zm1.5 1.5v11h9V7.5H12V4.5H5.5zm8 .5 1.5 1.5H13.5V5z" opacity="0.9"/><path d="M7 9h1.2l.8 3.5.9-2.3.9 2.3.8-3.5H12.8l-1.7 6H9.7l-.7-2-.7 2H6.7L5 9h2z"/></svg></button>
    <button class="toolbar-btn" id="export-pdf-btn" title="Export as PDF">${icons.pdf}</button>
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

  // Export Self-Contained HTML (images embedded as base64)
  document.getElementById('export-self-contained-btn')?.addEventListener('click', () => {
    if (!editor) return;
    vscode.postMessage({ type: 'exportHTMLSelfContained' });
  });

  // Export as Word Document (DOCX) — uses the already-loaded Mermaid instance
  document.getElementById('export-docx-btn')?.addEventListener('click', () => {
    if (!editor) return;
    vscode.postMessage({ type: 'exportDOCX' });
  });

  // Export as PDF — show blocking overlay immediately, extension will echo exportPDFStart
  document.getElementById('export-pdf-btn')?.addEventListener('click', () => {
    if (!editor) return;
    const btn = document.getElementById('export-pdf-btn') as HTMLButtonElement | null;
    if (btn && !btn.disabled) {
      btn.disabled = true;
      showPdfOverlay();
    }
    vscode.postMessage({ type: 'exportPDF' });
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

    case 'renderMermaidForExport':
      // Render mermaid sources to PNG data URLs for HTML export using the existing mermaid instance.
      (async () => {
        const sources = message.mermaidSources || {};
        const exportImages: Record<string, string> = {};
        for (const [diagramId, source] of Object.entries(sources) as [string, string][]) {
          try {
            // Same preprocessing as renderMermaidDiagrams()
            let processed = source.replace(
              /^[\t ]*participant\s+([a-zA-Z0-9_\-]+)\s+as\s+([^"\n]+?)(?:\s*)$/gm,
              (match: string, participantId: string, alias: string) => {
                const trimmed = alias.trim();
                if (trimmed.startsWith('"') && trimmed.endsWith('"')) { return match; }
                return `\tparticipant ${participantId} as "${trimmed}"`;
              }
            );
            processed = processed.replace(/<br\s*\/?>/gi, '\\n');
            const { svg } = await mermaid.render('mermaid-export-' + diagramId, processed);
            exportImages[diagramId] = await mermaidSvgToPng(svg);
          } catch (err) {
            console.error(`[Mermaid Export] Failed to render ${diagramId}:`, err);
          }
        }
        vscode.postMessage({ type: 'mermaidExportReady', mermaidImages: exportImages } as MessageFromWebview);
      })();
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

    case 'exportPDFStart':
      // Show blocking overlay — covers both toolbar button and context menu paths
      showPdfOverlay();
      break;

    case 'exportPDFDone': {
      hidePdfOverlay();
      const btn = document.getElementById('export-pdf-btn') as HTMLButtonElement | null;
      if (btn) { btn.disabled = false; }
      break;
    }
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

      // Preprocess source:
      // 1. Sanitize participant aliases by quoting them if they contain special characters (like parentheses)
      //    This fixes parsing errors where Mermaid misinterprets unquoted aliases.
      let processedSource = source.replace(
        /^[\t ]*participant\s+([a-zA-Z0-9_\-]+)\s+as\s+([^"\n]+?)(?:\s*)$/gm,
        (match, id, alias) => {
          const trimmedAlias = alias.trim();
          // If already quoted, leave it alone
          if (trimmedAlias.startsWith('"') && trimmedAlias.endsWith('"')) {
            return match;
          }
          return `\tparticipant ${id} as "${trimmedAlias}"`;
        }
      );

      // 2. Convert <br/> tags to escaped newlines for plain text mode (when htmlLabels: false)
      processedSource = processedSource.replace(/<br\s*\/?>/gi, '\\n');

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
 * Convert an SVG string to a PNG data URL via an off-screen canvas.
 * Parses viewBox for correct dimensions and fills with a white background.
 */
function mermaidSvgToPng(svgString: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgEl = svgDoc.querySelector('svg');
    let width = 1200, height = 800;
    if (svgEl) {
      const vb = svgEl.getAttribute('viewBox');
      if (vb) {
        const parts = vb.trim().split(/[\s,]+/);
        if (parts.length >= 4) {
          width = parseFloat(parts[2]) || width;
          height = parseFloat(parts[3]) || height;
        }
      } else {
        width = parseFloat(svgEl.getAttribute('width') || '') || width;
        height = parseFloat(svgEl.getAttribute('height') || '') || height;
      }
    }
    // Use a data: URL instead of blob: — the webview CSP allows img-src data: but not blob:
    const svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
    const dataUrl = 'data:image/svg+xml;base64,' + svgBase64;
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      reject(new Error('SVG to PNG conversion failed'));
    };
    img.src = dataUrl;
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
