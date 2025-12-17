import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
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

import { MessageFromWebview, MessageToWebview, EditorConfig } from '../types';
import mermaid from 'mermaid';

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
});

let editor: Editor | null = null;
let mermaidSources: Record<string, string> = {};
let currentMermaidEditId: string | null = null;
let editorConfig: EditorConfig = {
  rtl: true,
  autoDetectRtl: true,
};
let contentHash = '';

// Initialize editor when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeEditor();
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
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: editorConfig.rtl ? 'right' : 'left',
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
      Image.configure({
        allowBase64: true,
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
    ],
    content: '<p></p>',
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const newHash = hashContent(html);
      
      if (newHash !== contentHash) {
        contentHash = newHash;
        debounceAutoSave(html);
      }
    },
    onBlur: () => {
      saveContent();
    },
  });

  // Handle mermaid diagram clicks
  setupMermaidHandlers();

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
    <button class="toolbar-btn" id="bold-btn" title="Bold (Ctrl+B)">
      <strong>B</strong>
    </button>
    <button class="toolbar-btn" id="italic-btn" title="Italic (Ctrl+I)">
      <em>I</em>
    </button>
    <button class="toolbar-btn" id="underline-btn" title="Underline (Ctrl+U)">
      <u>U</u>
    </button>
    <button class="toolbar-btn" id="strike-btn" title="Strikethrough">
      <s>S</s>
    </button>
    <button class="toolbar-btn" id="code-btn" title="Inline code">
      code
    </button>
  `;
  container.appendChild(formatGroup);

  // Heading group
  const headingGroup = document.createElement('div');
  headingGroup.className = 'toolbar-group';
  headingGroup.innerHTML = `
    <select class="toolbar-select" id="heading-select" title="Paragraph style">
      <option value="paragraph">Paragraph</option>
      <option value="h1">Heading 1</option>
      <option value="h2">Heading 2</option>
      <option value="h3">Heading 3</option>
      <option value="h4">Heading 4</option>
      <option value="h5">Heading 5</option>
      <option value="h6">Heading 6</option>
    </select>
  `;
  container.appendChild(headingGroup);

  // Alignment group
  const alignGroup = document.createElement('div');
  alignGroup.className = 'toolbar-group';
  alignGroup.innerHTML = `
    <button class="toolbar-btn" id="align-left-btn" title="Align left">
      ◄
    </button>
    <button class="toolbar-btn" id="align-center-btn" title="Align center">
      ◄►
    </button>
    <button class="toolbar-btn" id="align-right-btn" title="Align right">
      ►
    </button>
    <button class="toolbar-btn" id="align-justify-btn" title="Justify">
      ◄ ►
    </button>
  `;
  container.appendChild(alignGroup);

  // List group
  const listGroup = document.createElement('div');
  listGroup.className = 'toolbar-group';
  listGroup.innerHTML = `
    <button class="toolbar-btn" id="bullet-list-btn" title="Bullet list">
      • List
    </button>
    <button class="toolbar-btn" id="ordered-list-btn" title="Ordered list">
      1. List
    </button>
  `;
  container.appendChild(listGroup);

  // Block group
  const blockGroup = document.createElement('div');
  blockGroup.className = 'toolbar-group';
  blockGroup.innerHTML = `
    <button class="toolbar-btn" id="blockquote-btn" title="Block quote">
      ❝
    </button>
    <button class="toolbar-btn" id="code-block-btn" title="Code block">
      { }
    </button>
  `;
  container.appendChild(blockGroup);

  // Color group
  const colorGroup = document.createElement('div');
  colorGroup.className = 'toolbar-group';
  colorGroup.innerHTML = `
    <input type="color" id="text-color-btn" title="Text color" class="toolbar-select" style="width: 40px; height: 32px; padding: 2px;">
    <input type="color" id="highlight-btn" title="Highlight color" class="toolbar-select" style="width: 40px; height: 32px; padding: 2px;">
  `;
  container.appendChild(colorGroup);

  // Insert group
  const insertGroup = document.createElement('div');
  insertGroup.className = 'toolbar-group';
  insertGroup.innerHTML = `
    <button class="toolbar-btn" id="link-btn" title="Insert link">
      🔗
    </button>
    <button class="toolbar-btn" id="image-btn" title="Insert image">
      🖼️
    </button>
    <button class="toolbar-btn" id="table-btn" title="Insert table">
      ⊞
    </button>
    <button class="toolbar-btn" id="hr-btn" title="Horizontal rule">
      ─
    </button>
  `;
  container.appendChild(insertGroup);

  // RTL/LTR toggle
  const rtlGroup = document.createElement('div');
  rtlGroup.className = 'toolbar-group';
  rtlGroup.innerHTML = `
    <button class="toolbar-btn ${editorConfig.rtl ? 'active' : ''}" id="rtl-btn" title="Toggle RTL/LTR">
      RTL
    </button>
  `;
  container.appendChild(rtlGroup);

  attachToolbarEventListeners();
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

  // Alignment
  document.getElementById('align-left-btn')?.addEventListener('click', () => editor!.chain().focus().setTextAlign('left').run());
  document.getElementById('align-center-btn')?.addEventListener('click', () => editor!.chain().focus().setTextAlign('center').run());
  document.getElementById('align-right-btn')?.addEventListener('click', () => editor!.chain().focus().setTextAlign('right').run());
  document.getElementById('align-justify-btn')?.addEventListener('click', () => editor!.chain().focus().setTextAlign('justify').run());

  // Lists
  document.getElementById('bullet-list-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBulletList().run());
  document.getElementById('ordered-list-btn')?.addEventListener('click', () => editor!.chain().focus().toggleOrderedList().run());

  // Blocks
  document.getElementById('blockquote-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBlockquote().run());
  document.getElementById('code-block-btn')?.addEventListener('click', () => editor!.chain().focus().toggleCodeBlock().run());

  // Colors
  document.getElementById('text-color-btn')?.addEventListener('change', (e) => {
    const color = (e.target as HTMLInputElement).value;
    editor!.chain().focus().setColor(color).run();
  });

  document.getElementById('highlight-btn')?.addEventListener('change', (e) => {
    const color = (e.target as HTMLInputElement).value;
    editor!.chain().focus().setHighlight({ color }).run();
  });

  // Insert
  document.getElementById('link-btn')?.addEventListener('click', () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor!.chain().focus().setLink({ href: url }).run();
    }
  });

  document.getElementById('image-btn')?.addEventListener('click', () => {
    const src = prompt('Enter image URL or relative path:');
    if (src) {
      editor!.chain().focus().setImage({ src }).run();
    }
  });

  document.getElementById('table-btn')?.addEventListener('click', () => {
    editor!.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  });

  document.getElementById('hr-btn')?.addEventListener('click', () => {
    editor!.chain().focus().setHorizontalRule().run();
  });

  // RTL toggle
  document.getElementById('rtl-btn')?.addEventListener('click', () => {
    editorConfig.rtl = !editorConfig.rtl;
    document.documentElement.dir = editorConfig.rtl ? 'rtl' : 'ltr';
    document.getElementById('rtl-btn')?.classList.toggle('active');
    
    const alignment = editorConfig.rtl ? 'right' : 'left';
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

function openMermaidModal(mermaidId: string) {
  currentMermaidEditId = mermaidId;
  const textarea = document.getElementById('mermaid-source') as HTMLTextAreaElement;
  if (textarea) {
    textarea.value = mermaidSources[mermaidId] || '';
    textarea.focus();
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
  currentMermaidEditId = null;
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
  const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F]/;
  
  // Simple check on visible text
  const hasRTL = JSON.stringify(text).match(rtlPattern) !== null;
  
  if (hasRTL && !editorConfig.rtl) {
    editorConfig.rtl = true;
    document.documentElement.dir = 'rtl';
    document.getElementById('rtl-btn')?.classList.add('active');
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
window.addEventListener('message', (event) => {
  const message = event.data as MessageToWebview;

  switch (message.type) {
    case 'setContent':
      if (editor && message.html) {
        editor.commands.setContent(message.html);
        contentHash = hashContent(message.html);
      }
      if (message.mermaidSources) {
        mermaidSources = message.mermaidSources;
      }
      if (message.config) {
        editorConfig = message.config;
        document.documentElement.dir = editorConfig.rtl ? 'rtl' : 'ltr';
        const rtlBtn = document.getElementById('rtl-btn');
        if (rtlBtn) {
          rtlBtn.classList.toggle('active', editorConfig.rtl);
        }
      }
      setupMermaidHandlers();
      renderMermaidDiagrams();
      break;

    case 'setConfig':
      if (message.config) {
        editorConfig = message.config;
        document.documentElement.dir = editorConfig.rtl ? 'rtl' : 'ltr';
      }
      break;

    case 'externalUpdate':
      if (editor && message.html) {
        editor.commands.setContent(message.html);
      }
      if (message.mermaidSources) {
        mermaidSources = message.mermaidSources;
      }
      setupMermaidHandlers();
      renderMermaidDiagrams();
      break;

    case 'showError':
      console.error('Editor error:', message.message);
      break;
  }
});

function renderMermaidDiagrams() {
  document.querySelectorAll('[data-mdwe="mermaid"]').forEach((element) => {
    const mermaidId = element.getAttribute('data-id');
    if (mermaidId && mermaidSources[mermaidId]) {
      try {
        mermaid.contentLoaded();
      } catch (e) {
        console.error('Mermaid render error:', e);
      }
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
