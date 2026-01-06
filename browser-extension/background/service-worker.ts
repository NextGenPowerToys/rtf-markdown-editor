/**
 * Background Service Worker
 * Handles context menu and file context management
 */

interface ProviderConfig {
  id: string;
  type: 'github' | 'azure-devops';
  name: string;
  baseUrl: string;
  apiUrl: string;
  urlPattern: string;
  enabled: boolean;
}

interface FileContext {
  providerId: string;
  provider: 'github' | 'azure-devops';
  owner: string;
  repo: string;
  branch: string;
  path: string;
  url: string;
}

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'github-com',
    type: 'github',
    name: 'GitHub.com',
    baseUrl: 'https://github.com',
    apiUrl: 'https://api.github.com',
    urlPattern: '*/blob/*/*.md',
    enabled: true
  },
  {
    id: 'azure-devops-cloud',
    type: 'azure-devops',
    name: 'Azure DevOps (Cloud)',
    baseUrl: 'https://dev.azure.com',
    apiUrl: 'https://dev.azure.com',
    urlPattern: '*/_git/*?path=*.md*',
    enabled: false
  }
];

chrome.runtime.onInstalled.addListener(async () => {
  try {
    console.log('[RTF Editor] Extension installed/updated');
    const settings = await chrome.storage.sync.get(['providers']);
    if (!settings.providers) {
      await chrome.storage.sync.set({ providers: DEFAULT_PROVIDERS });
    }
    
    await rebuildContextMenus();
  } catch (error) {
    console.error('[RTF Editor] Error on install:', error);
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.providers) {
    console.log('[RTF Editor] Providers changed, rebuilding context menus');
    rebuildContextMenus();
  }
});

// Also rebuild on startup (in case context menu was cleared)
rebuildContextMenus().catch(error => {
  console.error('[RTF Editor] Error rebuilding context menus on startup:', error);
});

async function rebuildContextMenus() {
  try {
    await chrome.contextMenus.removeAll();
    console.log('[RTF Editor] Cleared existing context menus');
    
    // Create context menu only for GitHub markdown files
    try {
      await chrome.contextMenus.create({
        id: 'rtf-edit-markdown',
        title: 'Edit with RTF Markdown Editor',
        contexts: ['page'],
        documentUrlPatterns: [
          'https://github.com/*/blob/*/*.md',
          'https://dev.azure.com/*/*/_git/*path=*.md*',
          'https://*.visualstudio.com/*/*/_git/*path=*.md*'
        ]
      });
      console.log('[RTF Editor] Context menu created with URL patterns');
    } catch (error) {
      console.error('[RTF Editor] Error creating context menu:', error);
      // Fallback: create without patterns for broader support
      try {
        await chrome.contextMenus.create({
          id: 'rtf-edit-markdown',
          title: 'Edit with RTF Markdown Editor',
          contexts: ['page']
        });
        console.log('[RTF Editor] Context menu created (fallback, no patterns)');
      } catch (fallbackError) {
        console.error('[RTF Editor] Fallback context menu also failed:', fallbackError);
      }
    }
  } catch (error) {
    console.error('[RTF Editor] Error in rebuildContextMenus:', error);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  try {
    console.log('[RTF Editor] Context menu clicked', { info, tab });
    
    if (info.menuItemId !== 'rtf-edit-markdown') {
      console.log('[RTF Editor] Wrong menu item ID:', info.menuItemId);
      return;
    }
    
    if (!tab?.id) {
      console.error('[RTF Editor] No tab ID available');
      return;
    }
    
    const url = info.pageUrl || info.linkUrl;
    if (!url) {
      console.error('[RTF Editor] No URL available');
      return;
    }
    
    console.log('[RTF Editor] Processing URL:', url);
    
    // Parse GitHub URL synchronously
    const context = parseGitHubUrlSync(url);
    if (!context) {
      console.error('[RTF Editor] URL does not match markdown file pattern:', url);
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => alert('This extension only works with markdown (.md) files on GitHub.')
      }).catch(e => console.error('[RTF Editor] Could not show alert:', e));
      return;
    }
    
    console.log('[RTF Editor] Parsed context:', context);
    
    // Store context with a unique key
    const contextKey = `fileContext_${Date.now()}`;
    chrome.storage.local.set({
      [contextKey]: context
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('[RTF Editor] Error storing context:', chrome.runtime.lastError);
        return;
      }
      console.log('[RTF Editor] Context stored with key:', contextKey);
      
      // Open editor in a new tab
      chrome.tabs.create({
        url: `editor/editor.html?context=${contextKey}`
      }).then(newTab => {
        console.log('[RTF Editor] Editor tab opened:', newTab.id);
      }).catch(error => {
        console.error('[RTF Editor] Error opening editor tab:', error);
      });
    });
  } catch (error) {
    console.error('[RTF Editor] Error in context menu click handler:', error);
  }
});

function parseGitHubUrlSync(url: string): FileContext | null {
  // GitHub pattern: https://github.com/{owner}/{repo}/blob/{branch}/{path}
  const pattern = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+\.md)$/;
  const match = url.match(pattern);
  
  if (!match) {
    return null;
  }
  
  return {
    providerId: 'github-com',
    provider: 'github',
    owner: match[1],
    repo: match[2],
    branch: match[3],
    path: decodeURIComponent(match[4]),
    url
  };
}

async function parseUrl(url: string): Promise<FileContext | null> {
  const { providers } = await chrome.storage.sync.get(['providers']);
  
  for (const provider of providers.filter((p: ProviderConfig) => p.enabled)) {
    if (url.startsWith(provider.baseUrl)) {
      if (provider.type === 'github') {
        return parseGitHubUrl(url, provider);
      }
    }
  }
  
  return null;
}

function parseGitHubUrl(url: string, provider: ProviderConfig): FileContext | null {
  const pattern = new RegExp(
    `${escapeRegex(provider.baseUrl)}/([^/]+)/([^/]+)/blob/([^/]+)/(.+\\.md)`
  );
  
  const match = url.match(pattern);
  if (!match) return null;
  
  return {
    providerId: provider.id,
    provider: 'github',
    owner: match[1],
    repo: match[2],
    branch: match[3],
    path: decodeURIComponent(match[4]),
    url
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'getFileContext') {
    const contextKey = message.contextKey;
    if (!contextKey) {
      console.error('[RTF Editor] No context key provided');
      sendResponse(null);
      return false;
    }
    
    chrome.storage.local.get([contextKey]).then(result => {
      const context = result[contextKey];
      console.log('[RTF Editor] Retrieved context:', context);
      sendResponse(context || null);
    }).catch(error => {
      console.error('[RTF Editor] Error retrieving context:', error);
      sendResponse(null);
    });
    return true;
  }
  
  if (message.type === 'clearFileContext') {
    const contextKey = message.contextKey;
    if (contextKey) {
      chrome.storage.local.remove([contextKey]);
    }
  }
});

export {};
