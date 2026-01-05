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
  
  // RTL toggle button
  const rtlBtn = document.getElementById('rtl-btn');
  rtlBtn?.addEventListener('click', () => {
    if (!editor) return;
    
    editorConfig.rtl = !editorConfig.rtl;
    RTLService.applyToDocument(editorConfig.rtl);
    RTLService.updateButtonUI(editorConfig.rtl);
    
    // Update editor alignment
    const alignment = RTLService.getDefaultAlignment(editorConfig.rtl);
    editor.commands.setTextAlign(alignment);
  });
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', () => {
  setupUIHandlers();
  initializeEditor();
});
