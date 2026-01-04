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
  const settings = await chrome.storage.sync.get(['providers']);
  if (!settings.providers) {
    await chrome.storage.sync.set({ providers: DEFAULT_PROVIDERS });
  }
  
  await rebuildContextMenus();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.providers) {
    rebuildContextMenus();
  }
});

async function rebuildContextMenus() {
  await chrome.contextMenus.removeAll();
  
  const { providers } = await chrome.storage.sync.get(['providers']);
  
  if (!providers || providers.length === 0) {
    console.log('[RTF Editor] No providers configured, using defaults');
    await chrome.storage.sync.set({ providers: DEFAULT_PROVIDERS });
    await rebuildContextMenus();
    return;
  }
  
  const enabledProviders = providers.filter((p: ProviderConfig) => p.enabled);
  
  if (enabledProviders.length === 0) {
    console.log('[RTF Editor] No enabled providers');
    return;
  }
  
  // Create context menu without URL restrictions - we'll check in the click handler
  chrome.contextMenus.create({
    id: 'rtf-edit-markdown',
    title: 'Edit with RTF Markdown Editor',
    contexts: ['page'],
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[RTF Editor] Context menu error:', chrome.runtime.lastError);
    } else {
      console.log('[RTF Editor] Context menu created successfully');
    }
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
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
  
  // Store context synchronously
  chrome.storage.local.set({
    [`fileContext_${tab.id}`]: context
  });
  
  // Open side panel immediately
  if (chrome.sidePanel && chrome.sidePanel.open) {
    chrome.sidePanel.open({ tabId: tab.id })
      .then(() => {
        console.log('[RTF Editor] Side panel opened');
      })
      .catch(error => {
        console.error('[RTF Editor] Error opening side panel:', error);
      });
  } else {
    console.error('[RTF Editor] Side panel API not available');
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
    chrome.storage.local.get([`fileContext_${sender.tab?.id}`]).then(result => {
      sendResponse(result[`fileContext_${sender.tab?.id}`]);
    });
    return true;
  }
  
  if (message.type === 'clearFileContext') {
    chrome.storage.local.remove([`fileContext_${sender.tab?.id}`]);
  }
});

export {};
