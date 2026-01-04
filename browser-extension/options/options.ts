import { GitHubProvider } from '../shared/git-providers/github';

interface ProviderConfig {
  id: string;
  type: 'github' | 'azure-devops';
  name: string;
  baseUrl: string;
  apiUrl: string;
  urlPattern: string;
  enabled: boolean;
}

let providers: ProviderConfig[] = [];
let editingProviderId: string | null = null;

async function loadSettings() {
  const result = await chrome.storage.sync.get(['githubToken', 'providers']);
  
  const tokenInput = document.getElementById('github-token') as HTMLInputElement;
  if (tokenInput && result.githubToken) {
    tokenInput.value = result.githubToken;
  }
  
  if (result.providers) {
    providers = result.providers;
    renderProviders();
  }
}

async function saveToken() {
  const tokenInput = document.getElementById('github-token') as HTMLInputElement;
  const token = tokenInput.value.trim();
  
  if (!token) {
    showStatus('Please enter a token', 'error');
    return;
  }
  
  await chrome.storage.sync.set({ githubToken: token });
  showStatus('Token saved successfully', 'success');
}

async function testConnection() {
  const tokenInput = document.getElementById('github-token') as HTMLInputElement;
  const token = tokenInput.value.trim();
  
  if (!token) {
    showStatus('Please enter a token first', 'error');
    return;
  }
  
  try {
    const provider = new GitHubProvider(token);
    const result = await provider.testAuthentication();
    
    if (result.valid) {
      showStatus(`✓ Connected as ${result.user}`, 'success');
    } else {
      showStatus('✗ Invalid token', 'error');
    }
  } catch (error) {
    showStatus(`✗ Connection failed: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
}

function renderProviders() {
  const list = document.getElementById('providers-list');
  if (!list) return;
  
  list.innerHTML = '';
  
  providers.forEach(provider => {
    const item = document.createElement('div');
    item.className = 'provider-item';
    
    item.innerHTML = `
      <div class="provider-info">
        <div class="provider-name">${provider.name}</div>
        <div class="provider-url">${provider.baseUrl}</div>
      </div>
      <div class="provider-actions">
        <div class="provider-toggle">
          <label class="toggle-switch">
            <input type="checkbox" ${provider.enabled ? 'checked' : ''} data-id="${provider.id}">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <button class="btn btn-secondary btn-edit" data-id="${provider.id}">Edit</button>
        <button class="btn btn-danger btn-delete" data-id="${provider.id}">Delete</button>
      </div>
    `;
    
    // Toggle handler
    const toggle = item.querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggle.addEventListener('change', () => {
      toggleProvider(provider.id, toggle.checked);
    });
    
    // Edit handler
    const editBtn = item.querySelector('.btn-edit') as HTMLButtonElement;
    editBtn.addEventListener('click', () => {
      editProvider(provider.id);
    });
    
    // Delete handler
    const deleteBtn = item.querySelector('.btn-delete') as HTMLButtonElement;
    deleteBtn.addEventListener('click', () => {
      deleteProvider(provider.id);
    });
    
    list.appendChild(item);
  });
}

function toggleProvider(id: string, enabled: boolean) {
  const provider = providers.find(p => p.id === id);
  if (provider) {
    provider.enabled = enabled;
    saveProviders();
  }
}

function addProvider() {
  editingProviderId = null;
  clearProviderForm();
  showModal('provider-modal');
  
  const title = document.getElementById('modal-title');
  if (title) title.textContent = 'Add Git Provider';
}

function editProvider(id: string) {
  const provider = providers.find(p => p.id === id);
  if (!provider) return;
  
  editingProviderId = id;
  
  (document.getElementById('provider-name') as HTMLInputElement).value = provider.name;
  (document.getElementById('provider-type') as HTMLSelectElement).value = provider.type;
  (document.getElementById('provider-base-url') as HTMLInputElement).value = provider.baseUrl;
  (document.getElementById('provider-api-url') as HTMLInputElement).value = provider.apiUrl;
  (document.getElementById('provider-url-pattern') as HTMLInputElement).value = provider.urlPattern;
  
  const title = document.getElementById('modal-title');
  if (title) title.textContent = 'Edit Git Provider';
  
  showModal('provider-modal');
}

function deleteProvider(id: string) {
  if (!confirm('Are you sure you want to delete this provider?')) return;
  
  providers = providers.filter(p => p.id !== id);
  saveProviders();
  renderProviders();
}

function saveProvider() {
  const name = (document.getElementById('provider-name') as HTMLInputElement).value.trim();
  const type = (document.getElementById('provider-type') as HTMLSelectElement).value as 'github' | 'azure-devops';
  const baseUrl = (document.getElementById('provider-base-url') as HTMLInputElement).value.trim();
  const apiUrl = (document.getElementById('provider-api-url') as HTMLInputElement).value.trim();
  const urlPattern = (document.getElementById('provider-url-pattern') as HTMLInputElement).value.trim();
  
  if (!name || !baseUrl || !apiUrl || !urlPattern) {
    alert('Please fill in all fields');
    return;
  }
  
  if (editingProviderId) {
    const provider = providers.find(p => p.id === editingProviderId);
    if (provider) {
      provider.name = name;
      provider.type = type;
      provider.baseUrl = baseUrl;
      provider.apiUrl = apiUrl;
      provider.urlPattern = urlPattern;
    }
  } else {
    const newProvider: ProviderConfig = {
      id: `provider-${Date.now()}`,
      type,
      name,
      baseUrl,
      apiUrl,
      urlPattern,
      enabled: true,
    };
    providers.push(newProvider);
  }
  
  saveProviders();
  renderProviders();
  hideModal('provider-modal');
}

function clearProviderForm() {
  (document.getElementById('provider-name') as HTMLInputElement).value = '';
  (document.getElementById('provider-type') as HTMLSelectElement).value = 'github';
  (document.getElementById('provider-base-url') as HTMLInputElement).value = '';
  (document.getElementById('provider-api-url') as HTMLInputElement).value = '';
  (document.getElementById('provider-url-pattern') as HTMLInputElement).value = '';
}

async function saveProviders() {
  await chrome.storage.sync.set({ providers });
}

function showStatus(message: string, type: 'success' | 'error') {
  const status = document.getElementById('connection-status');
  if (!status) return;
  
  status.textContent = message;
  status.className = `status-message ${type}`;
  
  setTimeout(() => {
    status.className = 'status-message';
  }, 5000);
}

function showModal(id: string) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('hidden');
}

function hideModal(id: string) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('hidden');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  document.getElementById('save-token-btn')?.addEventListener('click', saveToken);
  document.getElementById('test-connection-btn')?.addEventListener('click', testConnection);
  document.getElementById('add-provider-btn')?.addEventListener('click', addProvider);
  document.getElementById('provider-save-btn')?.addEventListener('click', saveProvider);
  document.getElementById('provider-cancel-btn')?.addEventListener('click', () => {
    hideModal('provider-modal');
  });
});
