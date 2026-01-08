/**
 * GitHub API Provider
 * Handles file operations via GitHub REST API
 */

export interface FileContent {
  content: string;
  sha: string;
  encoding: 'utf-8';
}

export interface CommitResult {
  sha: string;
  conflict: boolean;
  conflictData?: {
    remoteSha: string;
    remoteContent: string;
  };
}

export class GitHubProvider {
  private token: string;
  private apiUrl: string;
  
  constructor(token: string, apiUrl: string = 'https://api.github.com') {
    this.token = token;
    this.apiUrl = apiUrl;
  }
  
  async getFile(owner: string, repo: string, path: string, branch: string): Promise<FileContent> {
    // Add timestamp to prevent caching
    const timestamp = Date.now();
    const url = `${this.apiUrl}/repos/${owner}/${repo}/contents/${path}?ref=${branch}&t=${timestamp}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub API error: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    // Properly decode Base64 to UTF-8 to handle multi-byte characters (emojis, etc.)
    const base64Content = data.content.replace(/\n/g, '');
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const decodedContent = new TextDecoder('utf-8').decode(bytes);
    
    return {
      content: decodedContent,
      sha: data.sha,
      encoding: 'utf-8'
    };
  }
  
  async commitFile(
    owner: string,
    repo: string,
    path: string,
    branch: string,
    content: string,
    message: string,
    sha: string
  ): Promise<CommitResult> {
    try {
      const currentFile = await this.getFile(owner, repo, path, branch);
      
      if (currentFile.sha !== sha) {
        console.warn('[GitHub] SHA mismatch - conflict detected');
        return {
          sha: currentFile.sha,
          conflict: true,
          conflictData: {
            remoteSha: currentFile.sha,
            remoteContent: currentFile.content
          }
        };
      }
    } catch (error) {
      console.error('[GitHub] Failed to check SHA:', error);
    }
    
    // Properly encode UTF-8 to Base64 to handle multi-byte characters (emojis, etc.)
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(content);
    let binaryString = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binaryString += String.fromCharCode(utf8Bytes[i]);
    }
    const encodedContent = btoa(binaryString);
    const url = `${this.apiUrl}/repos/${owner}/${repo}/contents/${path}`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message,
        content: encodedContent,
        sha,
        branch
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`GitHub commit error: ${error.message || response.statusText}`);
    }
    
    const data = await response.json();
    
    return {
      sha: data.content.sha,
      conflict: false
    };
  }
  
  async uploadImage(
    owner: string,
    repo: string,
    branch: string,
    fileName: string,
    base64Data: string,
    markdownFilePath: string
  ): Promise<string> {
    const markdownDir = markdownFilePath.substring(0, markdownFilePath.lastIndexOf('/'));
    const attachmentPath = markdownDir ? `${markdownDir}/.attachments/${fileName}` : `.attachments/${fileName}`;
    
    const url = `${this.apiUrl}/repos/${owner}/${repo}/contents/${attachmentPath}`;
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, '');
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Add image ${fileName}`,
        content: base64Content,
        branch
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Image upload error: ${error.message || response.statusText}`);
    }
    
    return `.attachments/${fileName}`;
  }
  
  async testAuthentication(): Promise<{ valid: boolean; user?: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/user`, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return { valid: true, user: data.login };
      }
      
      return { valid: false };
    } catch (error) {
      return { valid: false };
    }
  }
}
