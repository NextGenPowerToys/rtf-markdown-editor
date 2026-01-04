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

async function initializeEditor() {
  console.log('[Editor] Initializing...');
  
  // Get current tab ID
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const currentTabId = tabs[0]?.id;
  
  if (!currentTabId) {
    showError('Could not determine current tab');
    return;
  }
  
  console.log('[Editor] Current tab ID:', currentTabId);
  
  // Wait for file context (poll with timeout)
  let attempts = 0;
  const maxAttempts = 50; // 5 seconds max
  
  while (attempts < maxAttempts) {
    const result = await chrome.storage.local.get([`fileContext_${currentTabId}`]);
    const context = result[`fileContext_${currentTabId}`];
    
    if (context) {
      console.log('[Editor] Got file context:', context);
      currentFileContext = context;
      break;
    }
    
    console.log('[Editor] Waiting for file context... attempt', attempts + 1);
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  if (!currentFileContext) {
    showError('No file context available. Please try again.');
    return;
  }
  
  updateFileInfo();
  
  // Initialize TipTap editor FIRST
  console.log('[Editor] Creating TipTap editor...');
  editor = new Editor({
    element: document.getElementById('editor')!,
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
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
    onUpdate: () => {
      isDirty = true;
      updateStatus('modified');
      scheduleAutosave();
    },
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
    const { html, mermaidSources: sources } = markdownToHtml(fileData.content);
    mermaidSources = sources;
    
    console.log('[Editor] Markdown converted to HTML, mermaid blocks:', Object.keys(sources).length);
    
    if (editor) {
      editor.commands.setContent(html);
      isDirty = false;
      updateStatus('saved');
      console.log('[Editor] Content set in editor');
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
