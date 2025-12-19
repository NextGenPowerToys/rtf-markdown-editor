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
import { Node } from '@tiptap/core';

import { MessageFromWebview, MessageToWebview, EditorConfig } from '../types';
import mermaid from 'mermaid';

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
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-mdwe': 'mermaid', class: 'mermaid-placeholder' }, 0];
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
});

let editor: Editor | null = null;
let mermaidSources: Record<string, string> = {};
let currentMermaidEditId: string | null = null;
let editorConfig: EditorConfig = {
  rtl: true,
  autoDetectRtl: true,
};
let contentHash = '';
let systemIsRTL = false;

// Detect system language direction
function detectSystemDirection(): boolean {
  const userLang = navigator.language || navigator.languages?.[0] || 'en';
  const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'ji', 'iw', 'ps', 'sd'];
  const langCode = userLang.toLowerCase().split('-')[0];
  return rtlLanguages.includes(langCode);
}

systemIsRTL = detectSystemDirection();

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
        inline: false,
        HTMLAttributes: {
          class: 'editor-image',
          draggable: true,
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
    ],
    content: '<p></p>',
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      const newHash = hashContent(html);
      
      if (newHash !== contentHash) {
        contentHash = newHash;
        debounceAutoSave(html);
      }
      
      // Process code blocks for language detection and copy buttons
      processCodeBlocks();
      
      // Render Mermaid diagrams after content updates
      setTimeout(() => renderMermaidDiagrams(), 100);
    },
    onBlur: () => {
      saveContent();
    },
  });

  // Handle mermaid diagram clicks
  setupMermaidHandlers();

  // Setup custom link click handler with https:// auto-prefix
  setupLinkClickHandler();

  // Setup image resize and drag handlers
  setupImageHandlers();

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
          editor!.chain().focus().setImage({ src: base64String }).run();
        }
      };
      reader.readAsDataURL(file);
    });
    
    fileInput.click();
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
    
    // Create alignment toolbar
    const toolbar = document.createElement('div');
    toolbar.className = 'image-align-toolbar';
    toolbar.style.position = 'fixed';
    toolbar.style.left = `${rect.left}px`;
    toolbar.style.top = `${rect.top - 40}px`;
    toolbar.style.zIndex = '10000';
    toolbar.innerHTML = `
      <button class="image-align-btn" data-align="left" title="Align Left">◄</button>
      <button class="image-align-btn" data-align="center" title="Center">◄►</button>
      <button class="image-align-btn" data-align="right" title="Align Right">►</button>
    `;
    document.body.appendChild(toolbar);
    handleElements.push(toolbar);
    
    // Add alignment button listeners
    toolbar.querySelectorAll('.image-align-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const align = (e.target as HTMLElement).dataset.align;
        if (align && selectedImage) {
          applyImageAlignment(selectedImage, align);
        }
      });
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
      if (handle.classList.contains('image-align-toolbar')) {
        // Update toolbar position
        handle.style.left = `${rect.left}px`;
        handle.style.top = `${rect.top - 40}px`;
      } else {
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
      }
    });
  }
  
  function applyImageAlignment(img: HTMLImageElement, align: string) {
    // Remove all alignment classes
    img.classList.remove('image-align-left', 'image-align-center', 'image-align-right');
    img.removeAttribute('style');
    
    // Apply new alignment
    if (align === 'left') {
      img.classList.add('image-align-left');
      img.style.display = 'block';
      img.style.marginLeft = '0';
      img.style.marginRight = 'auto';
    } else if (align === 'center') {
      img.classList.add('image-align-center');
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = 'auto';
    } else if (align === 'right') {
      img.classList.add('image-align-right');
      img.style.display = 'block';
      img.style.marginLeft = 'auto';
      img.style.marginRight = '0';
    }
    
    // Preserve width and height
    if (img.hasAttribute('width')) {
      img.style.width = img.getAttribute('width') + 'px';
    }
    if (img.hasAttribute('height')) {
      img.style.height = img.getAttribute('height') + 'px';
    }
    
    // Update handle positions after alignment
    setTimeout(() => updateHandlePositions(), 10);
    
    // Save changes
    if (editor) {
      saveContent();
    }
    
    console.log('[Image] Applied alignment:', align);
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
    
    // Save content
    if (editor) {
      saveContent();
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
        // Process code blocks after content is set
        setTimeout(() => processCodeBlocks(), 100);
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
      // Delay to ensure DOM is fully rendered by TipTap
      setTimeout(() => renderMermaidDiagrams(), 300);
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
      // Delay to ensure DOM is fully rendered by TipTap
      setTimeout(() => renderMermaidDiagrams(), 300);
      break;

    case 'showError':
      console.error('Editor error:', message.message);
      break;
  }
});

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
      
      mermaid.render(diagramId, source)
        .then(({ svg }) => {
          console.log(`[Mermaid] Got SVG for ${mermaidId}, length: ${svg.length}`);
          // Clear element and insert SVG
          element.innerHTML = '';
          element.innerHTML = svg;
          console.log(`[Mermaid] Injected SVG into ${mermaidId}`);
          
          // Fix SVG display issues by ensuring it has proper dimensions
          const injectedSvg = element.querySelector('svg');
          if (injectedSvg) {
            // Ensure width is set to 100%
            injectedSvg.setAttribute('width', '100%');
            
            // Set height based on viewBox aspect ratio if height not set
            const viewBox = injectedSvg.getAttribute('viewBox');
            if (viewBox && !injectedSvg.getAttribute('height')) {
              const parts = viewBox.split(/\s+|,/);
              if (parts.length >= 4) {
                const vbWidth = parseFloat(parts[2]);
                const vbHeight = parseFloat(parts[3]);
                if (vbWidth > 0 && vbHeight > 0) {
                  const aspectRatio = vbHeight / vbWidth;
                  injectedSvg.setAttribute('height', `${aspectRatio * 100}%`);
                  injectedSvg.style.minHeight = '300px';
                }
              }
            }
            
            console.log(`[Mermaid] SVG element found in DOM for ${mermaidId}`, {
              width: injectedSvg.getAttribute('width'),
              height: injectedSvg.getAttribute('height'),
              viewBox: injectedSvg.getAttribute('viewBox'),
            });
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
