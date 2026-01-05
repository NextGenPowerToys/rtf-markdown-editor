import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Node } from '@tiptap/core';
import mermaid from 'mermaid';
// import katex from 'katex'; // Not used directly, math rendering happens in processor

import { markdownToHtml } from '../shared/utils/markdownProcessor';
import { htmlToMarkdown } from '../shared/utils/htmlProcessor';
import { GitHubProvider, FileContent, CommitResult } from '../shared/git-providers/github';
import { RTLService, RTLConfig } from '../shared/utils/rtlService';

// Mermaid placeholder extension
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
      'data-fence-type': {
        default: 'backtick',
        parseHTML: element => element.getAttribute('data-fence-type') || 'backtick',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mdwe="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { ...HTMLAttributes, 'data-mdwe': 'mermaid', class: 'mermaid-placeholder' }];
  },
});

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
  link: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M9.5 7.5a2.5 2.5 0 0 0 0 5h1v-1h-1a1.5 1.5 0 0 1 0-3h1v-1h-1zm1 1v3h1v-3h-1zm2 4h1a2.5 2.5 0 0 0 0-5h-1v1h1a1.5 1.5 0 0 1 0 3h-1v1z"/><path d="M7.5 5C5.567 5 4 6.567 4 8.5v3C4 13.433 5.567 15 7.5 15h5c1.933 0 3.5-1.567 3.5-3.5v-3C16 6.567 14.433 5 12.5 5h-5zm0 1h5C13.881 6 15 7.119 15 8.5v3c0 1.381-1.119 2.5-2.5 2.5h-5C6.119 14 5 12.881 5 11.5v-3C5 7.119 6.119 6 7.5 6z"/></svg>',
  image: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 1h14v7.586l-2.293-2.293a1 1 0 0 0-1.414 0L10 13.586l-2.293-2.293a1 1 0 0 0-1.414 0L3 14.586V5zm3.5 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  table: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H3zm0 1h14v3h-3V5H9v3H3V5zm0 4h5v3H3V9zm6 0h3v3H9V9zm4 0h4v3h-4V9zM3 13h5v2H3v-2zm6 0h3v2H9v-2zm4 0h4v2h-4v-2z"/></svg>',
  hr: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M2 9.5h16v1H2v-1z"/></svg>',
  rtl: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4.5h14v1H3v-1zm0 5h10v1H3v-1zm0 5h14v1H3v-1z"/><path d="M14.5 9.5l2.5 2.5-2.5 2.5v-1.5h-4v-2h4v-1.5z"/></svg>',
};

// Initialize Mermaid
mermaid.initialize({ 
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

interface FileContext {
  providerId: string;
  provider: 'github' | 'azure-devops';
  owner: string;
  repo: string;
  branch: string;
  path: string;
  url: string;
}

let editor: Editor | null = null;
let mermaidSources: Record<string, string> = {};
let currentFileContext: FileContext | null = null;
let currentFileSha: string = '';
let isDirty = false;
let saveTimeout: number | null = null;
let editorConfig: RTLConfig = RTLService.getDefaultConfig();

async function initializeEditor() {
  console.log('[Editor] Initializing...');
  
  // Get context key from URL
  const urlParams = new URLSearchParams(window.location.search);
  const contextKey = urlParams.get('context');
  
  if (!contextKey) {
    showError('No context key provided');
    return;
  }
  
  console.log('[Editor] Context key:', contextKey);
  
  // Get file context from storage
  const result = await chrome.storage.local.get([contextKey]);
  const context = result[contextKey];
  
  if (!context) {
    showError('File context not found. Please try again.');
    return;
  }
  
  console.log('[Editor] Got file context:', context);
  currentFileContext = context;
  
  // Clean up the context from storage
  chrome.storage.local.remove([contextKey]);
  
  updateFileInfo();
  
  // Initialize TipTap editor FIRST (without onUpdate to avoid false dirty flag during load)
  console.log('[Editor] Creating TipTap editor...');
  
  // Apply RTL config before creating editor
  RTLService.applyConfig(editorConfig);
  
  editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: RTLService.getDefaultAlignment(editorConfig.rtl),
      }),
      Underline,
      Link,
      Image,
      Table,
      TableRow,
      TableHeader,
      TableCell,
      MermaidPlaceholder,
    ],
    // onUpdate will be attached after content is fully loaded
  });
  
  console.log('[Editor] TipTap editor created');
  
  // Create and populate toolbar
  createToolbar();
  
  // Now load file content
  await loadFile();
  
  // Render mermaid diagrams after content is loaded
  setTimeout(() => renderMermaidDiagrams(), 100);
}

async function loadFile() {
  if (!currentFileContext) return;
  
  updateStatus('loading');
  
  try {
    const token = await getGitHubToken();
    if (!token) {
      showError('GitHub token not configured. Please go to Options.');
      return;
    }
    
    console.log('[Editor] Loading file:', currentFileContext.path);
    
    const provider = new GitHubProvider(token);
    const fileData = await provider.getFile(
      currentFileContext.owner,
      currentFileContext.repo,
      currentFileContext.path,
      currentFileContext.branch
    );
    
    console.log('[Editor] File loaded, SHA:', fileData.sha);
    
    currentFileSha = fileData.sha;
    
    // Detect RTL from markdown content BEFORE converting
    if (editorConfig.autoDetectRtl) {
      const hasRTL = RTLService.hasRTLContent(fileData.content);
      if (hasRTL) {
        console.log('[Editor] RTL content detected, applying RTL layout');
        editorConfig.rtl = true;
        RTLService.applyToDocument(true);
        RTLService.updateButtonUI(true);
      }
    }
    
    const { html, mermaidSources: sources } = markdownToHtml(fileData.content);
    mermaidSources = sources;
    
    console.log('[Editor] Markdown converted to HTML, mermaid blocks:', Object.keys(sources).length);
    
    if (editor) {
      editor.commands.setContent(html);
      isDirty = false;
      updateStatus('saved');
      console.log('[Editor] Content set in editor');
      
      // If RTL, apply text alignment to all content
      if (editorConfig.rtl) {
        const alignment = RTLService.getDefaultAlignment(editorConfig.rtl);
        editor.commands.selectAll();
        editor.commands.setTextAlign(alignment);
        editor.commands.setTextSelection(0); // Clear selection
      }
      
      // Now that content is fully loaded and formatted, attach the change handler
      setTimeout(() => {
        editor?.on('update', () => {
          isDirty = true;
          updateStatus('modified');
          scheduleAutosave();
        });
        console.log('[Editor] Change tracking enabled');
      }, 200);
    } else {
      console.error('[Editor] Editor not initialized!');
    }
  } catch (error) {
    console.error('[Editor] Load error:', error);
    showError(`Failed to load file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function saveFile(commitMessage: string) {
  if (!currentFileContext || !editor) return;
  
  try {
    const token = await getGitHubToken();
    if (!token) {
      showError('GitHub token not configured');
      return;
    }
    
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html, mermaidSources);
    
    const provider = new GitHubProvider(token);
    const result = await provider.commitFile(
      currentFileContext.owner,
      currentFileContext.repo,
      currentFileContext.path,
      currentFileContext.branch,
      markdown,
      commitMessage,
      currentFileSha
    );
    
    if (result.conflict) {
      showConflictModal(result);
    } else {
      currentFileSha = result.sha;
      isDirty = false;
      updateStatus('saved');
      hideModal('commit-modal');
    }
  } catch (error) {
    console.error('[Editor] Save error:', error);
    showError(`Failed to save file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function scheduleAutosave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  
  saveTimeout = setTimeout(() => {
    if (isDirty) {
      showModal('commit-modal');
    }
  }, 2000);
}

async function getGitHubToken(): Promise<string | null> {
  const result = await chrome.storage.sync.get(['githubToken']);
  return result.githubToken || null;
}

function updateFileInfo() {
  if (!currentFileContext) return;
  
  const pathEl = document.getElementById('file-path');
  if (pathEl) {
    pathEl.textContent = `${currentFileContext.owner}/${currentFileContext.repo}/${currentFileContext.path}`;
  }
}

function updateStatus(status: 'modified' | 'saved' | 'loading') {
  const statusEl = document.getElementById('file-status');
  if (!statusEl) return;
  
  statusEl.className = 'file-status ' + status;
  statusEl.textContent = status === 'modified' ? 'Modified' : 
                        status === 'saved' ? 'Saved' : 'Loading...';
  
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  if (saveBtn) {
    saveBtn.disabled = status !== 'modified';
  }
}

function showModal(id: string) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function hideModal(id: string) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('hidden');
  }
}

function showConflictModal(result: CommitResult) {
  const modal = document.getElementById('conflict-modal');
  if (!modal) return;
  
  modal.classList.remove('hidden');
  
  const overwriteBtn = document.getElementById('conflict-overwrite-btn');
  const reloadBtn = document.getElementById('conflict-reload-btn');
  const cancelBtn = document.getElementById('conflict-cancel-btn');
  
  overwriteBtn?.addEventListener('click', async () => {
    if (result.conflictData) {
      currentFileSha = result.conflictData.remoteSha;
      const commitMsg = (document.getElementById('commit-message') as HTMLTextAreaElement).value;
      await saveFile(commitMsg);
    }
    hideModal('conflict-modal');
  }, { once: true });
  
  reloadBtn?.addEventListener('click', async () => {
    await loadFile();
    hideModal('conflict-modal');
  }, { once: true });
  
  cancelBtn?.addEventListener('click', () => {
    hideModal('conflict-modal');
  }, { once: true });
}

function showError(message: string) {
  alert(message);
}

function renderMermaidDiagrams() {
  document.querySelectorAll('.mermaid-placeholder').forEach((el) => {
    const id = el.getAttribute('data-id');
    if (id && mermaidSources[id]) {
      const source = mermaidSources[id];
      try {
        mermaid.render(`mermaid-${id}`, source).then(({ svg }) => {
          el.innerHTML = svg;
        });
      } catch (error) {
        console.error('[Mermaid] Render error:', error);
        el.textContent = 'Mermaid diagram (render error)';
      }
    }
  });
}

function createToolbar() {
  const toolbar = document.getElementById('toolbar');
  if (!toolbar || !editor) return;

  toolbar.innerHTML = '';

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
  toolbar.appendChild(formatGroup);

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
  toolbar.appendChild(headingGroup);

  // List group
  const listGroup = document.createElement('div');
  listGroup.className = 'toolbar-group';
  listGroup.innerHTML = `
    <button class="toolbar-btn" id="bullet-list-btn" title="Bullets">${icons.bulletList}</button>
    <button class="toolbar-btn" id="ordered-list-btn" title="Numbering">${icons.orderedList}</button>
  `;
  toolbar.appendChild(listGroup);

  // Block group
  const blockGroup = document.createElement('div');
  blockGroup.className = 'toolbar-group';
  blockGroup.innerHTML = `
    <button class="toolbar-btn" id="blockquote-btn" title="Quote">${icons.quote}</button>
    <button class="toolbar-btn" id="code-block-btn" title="Code Block">${icons.codeBlock}</button>
  `;
  toolbar.appendChild(blockGroup);

  // Insert group
  const insertGroup = document.createElement('div');
  insertGroup.className = 'toolbar-group';
  insertGroup.innerHTML = `
    <button class="toolbar-btn" id="link-btn" title="Insert link">${icons.link}</button>
    <button class="toolbar-btn" id="image-btn" title="Insert picture">${icons.image}</button>
    <button class="toolbar-btn" id="table-btn" title="Insert table">${icons.table}</button>
    <button class="toolbar-btn" id="hr-btn" title="Horizontal line">${icons.hr}</button>
  `;
  toolbar.appendChild(insertGroup);

  // RTL/LTR toggle
  const rtlGroup = document.createElement('div');
  rtlGroup.className = 'toolbar-group';
  rtlGroup.innerHTML = `
    <button class="toolbar-btn ${editorConfig.rtl ? 'active' : ''}" id="rtl-btn" title="Toggle RTL/LTR">${icons.rtl}</button>
  `;
  toolbar.appendChild(rtlGroup);

  // Attach event listeners
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
      const level = parseInt(value.replace('h', '')) as 1 | 2 | 3 | 4 | 5 | 6;
      editor!.chain().focus().toggleHeading({ level }).run();
    }
  });

  // Lists
  document.getElementById('bullet-list-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBulletList().run());
  document.getElementById('ordered-list-btn')?.addEventListener('click', () => editor!.chain().focus().toggleOrderedList().run());

  // Blocks
  document.getElementById('blockquote-btn')?.addEventListener('click', () => editor!.chain().focus().toggleBlockquote().run());
  document.getElementById('code-block-btn')?.addEventListener('click', () => editor!.chain().focus().toggleCodeBlock().run());

  // Insert
  document.getElementById('link-btn')?.addEventListener('click', () => {
    const url = prompt('Enter URL:');
    if (url) {
      editor!.chain().focus().setLink({ href: url }).run();
    }
  });

  document.getElementById('image-btn')?.addEventListener('click', () => {
    const url = prompt('Enter image URL:');
    if (url) {
      editor!.chain().focus().setImage({ src: url }).run();
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
    if (!editor) return;
    
    editorConfig.rtl = !editorConfig.rtl;
    RTLService.applyToDocument(editorConfig.rtl);
    RTLService.updateButtonUI(editorConfig.rtl);
    
    // Update button active state
    const rtlBtn = document.getElementById('rtl-btn');
    if (rtlBtn) {
      if (editorConfig.rtl) {
        rtlBtn.classList.add('active');
      } else {
        rtlBtn.classList.remove('active');
      }
    }
    
    // Update editor alignment
    const alignment = RTLService.getDefaultAlignment(editorConfig.rtl);
    editor.commands.setTextAlign(alignment);
  });
}

function detectRTLContent() {
  if (!editor) return;

  const text = editor.getJSON();
  const hasRTL = RTLService.hasRTLContent(text);
  
  if (hasRTL && !editorConfig.rtl) {
    editorConfig.rtl = true;
    RTLService.applyToDocument(true);
    RTLService.updateButtonUI(true);
    
    // Update editor alignment
    const alignment = RTLService.getDefaultAlignment(editorConfig.rtl);
    editor.commands.setTextAlign(alignment);
  }
}

// UI event handlers
function setupUIHandlers() {
  const saveBtn = document.getElementById('save-btn');
  saveBtn?.addEventListener('click', () => {
    showModal('commit-modal');
  });
  
  const closeBtn = document.getElementById('close-btn');
  closeBtn?.addEventListener('click', () => {
    window.close();
  });
  
  const commitConfirmBtn = document.getElementById('commit-confirm-btn');
  commitConfirmBtn?.addEventListener('click', async () => {
    const messageEl = document.getElementById('commit-message') as HTMLTextAreaElement;
    const message = messageEl.value.trim();
    
    if (!message) {
      alert('Please enter a commit message');
      return;
    }
    
    await saveFile(message);
    messageEl.value = '';
  });
  
  const commitCancelBtn = document.getElementById('commit-cancel-btn');
  commitCancelBtn?.addEventListener('click', () => {
    hideModal('commit-modal');
  });
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  setupUIHandlers();
  initializeEditor();
});
