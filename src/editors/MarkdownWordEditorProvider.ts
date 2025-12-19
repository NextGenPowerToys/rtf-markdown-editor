import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { MessageFromWebview, MessageToWebview, EditorConfig } from '../types';
import { markdownToHtml, detectRTLCharacters } from '../utils/markdownProcessor';
import { htmlToMarkdown, hashContent } from '../utils/htmlProcessor';

export class MarkdownWordEditorProvider implements vscode.CustomEditorProvider {
  private readonly context: vscode.ExtensionContext;
  private documentMap: Map<string, WebviewDocument> = new Map();
  private _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<WebviewDocument>>();
  
  readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<vscode.CustomDocument> {
    const document = new WebviewDocument(uri, this.context);
    this.documentMap.set(uri.toString(), document);
    return document;
  }

  async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    const webviewDocument = document as WebviewDocument;
    
    // Allow access to media folder and workspace folder
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    const localResourceRoots = [vscode.Uri.joinPath(this.context.extensionUri, 'media')];
    if (workspaceFolder) {
      localResourceRoots.push(workspaceFolder.uri);
    }
    
    webviewPanel.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      enableForms: true,
      localResourceRoots,
    };

    webviewPanel.webview.html = this.getWebviewContent(webviewPanel.webview);

    webviewDocument.onDidChange((e: WebviewDocumentChangeEvent) => {
      webviewPanel.webview.postMessage({
        type: 'externalUpdate',
        content: e.content,
        mermaidSources: e.mermaidSources,
      } as MessageToWebview);
    });

    webviewPanel.webview.onDidReceiveMessage((message: MessageFromWebview) => {
      this.handleWebviewMessage(message, webviewDocument, webviewPanel);
    });
  }

  async saveCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
    const webviewDocument = document as WebviewDocument;
    webviewDocument.save();
  }

  async saveCustomDocumentAs(
    document: vscode.CustomDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    const webviewDocument = document as WebviewDocument;
    fs.writeFileSync(destination.fsPath, webviewDocument.getContent(), 'utf8');
  }

  async revertCustomDocument(document: vscode.CustomDocument, cancellation: vscode.CancellationToken): Promise<void> {
    const webviewDocument = document as WebviewDocument;
    webviewDocument.reload();
  }

  async backupCustomDocument(
    document: vscode.CustomDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    const webviewDocument = document as WebviewDocument;
    fs.copyFileSync(webviewDocument.uri.fsPath, context.destination.fsPath);
    
    return {
      id: context.destination.toString(),
      delete: async () => {
        try {
          fs.unlinkSync(context.destination.fsPath);
        } catch (e) {
          // Ignore errors
        }
      },
    };
  }

  private handleWebviewMessage(
    message: MessageFromWebview,
    document: WebviewDocument,
    panel: vscode.WebviewPanel
  ) {
    switch (message.type) {
      case 'ready':
        this.sendInitialContent(document, panel);
        break;

      case 'contentChanged':
        document.updateContent(message.html || '', message.mermaidSources || {});
        break;

      case 'requestSaveNow':
        document.save();
        break;

      case 'updateMermaid':
        if (message.mermaidId && message.mermaidSource) {
          document.updateMermaidBlock(message.mermaidId, message.mermaidSource);
          document.save();
        }
        break;
    }
  }

  private sendInitialContent(document: WebviewDocument, panel: vscode.WebviewPanel) {
    const content = document.getContent();
    let { html, mermaidSources } = markdownToHtml(content);
    const rtl = detectRTLCharacters(content);

    // Convert image paths to webview URIs
    html = this.convertImagePathsToWebviewUris(html, document.uri, panel.webview);

    panel.webview.postMessage({
      type: 'setContent',
      html,
      mermaidSources,
      config: {
        rtl,
        autoDetectRtl: true,
      },
    } as MessageToWebview);
  }

  private convertImagePathsToWebviewUris(html: string, documentUri: vscode.Uri, webview: vscode.Webview): string {
    // Replace img src attributes with webview URIs
    return html.replace(/<img([^>]*?)src="([^"]+)"([^>]*?)>/g, (match, pre, src, post) => {
      // Skip data URLs
      if (src.startsWith('data:')) {
        return match;
      }

      // Resolve relative paths
      let imagePath: vscode.Uri;
      if (src.startsWith('/')) {
        // Absolute path
        imagePath = vscode.Uri.from({ scheme: 'file', path: src });
      } else {
        // Relative path - resolve from document directory
        const documentDir = path.dirname(documentUri.fsPath);
        imagePath = vscode.Uri.file(path.join(documentDir, src));
      }

      // Convert to webview URI
      const webviewUri = webview.asWebviewUri(imagePath);
      return `<img${pre}src="${webviewUri}"${post}>`;
    });
  }

  private getWebviewContent(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.bundle.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'editor.css')
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; connect-src 'self'; child-src 'self'; frame-src https:;" />
  <link rel="stylesheet" href="${styleUri}">
  <title>RTF Markdown Editor</title>
</head>
<body>
  <div class="editor-wrapper">
    <div id="toolbar" class="toolbar"></div>
    <div id="editor-container" class="editor-container"></div>
    <div id="mermaid-modal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Edit Mermaid Diagram</h2>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <textarea id="mermaid-source" class="mermaid-textarea"></textarea>
        </div>
        <div class="modal-footer">
          <button id="mermaid-save" class="btn btn-primary">Save</button>
          <button id="mermaid-cancel" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
    <div id="link-modal" class="modal" style="display: none;">
      <div class="modal-content">
        <div class="modal-header">
          <h2>Insert Link</h2>
          <button class="modal-close" id="link-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 12px;">
            <label for="link-text" style="display: block; margin-bottom: 4px; font-weight: 500;">Link Text:</label>
            <input type="text" id="link-text" placeholder="Link text (optional)" style="width: 100%; padding: 8px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px;">
          </div>
          <div>
            <label for="link-url" style="display: block; margin-bottom: 4px; font-weight: 500;">URL:</label>
            <input type="text" id="link-url" placeholder="https://example.com" style="width: 100%; padding: 8px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px;">
          </div>
        </div>
        <div class="modal-footer">
          <button id="link-save" class="btn btn-primary">Insert Link</button>
          <button id="link-cancel" class="btn btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

class WebviewDocument extends vscode.Disposable implements vscode.CustomDocument {
  private _uri: vscode.Uri;
  private _documentData: string;
  private _contentHash: string;
  private _changeEmitter: vscode.EventEmitter<WebviewDocumentChangeEvent>;
  private _context: vscode.ExtensionContext;
  private _mermaidSources: Record<string, string> = {};
  private _watcher: vscode.FileSystemWatcher | null = null;

  onDidChange: vscode.Event<WebviewDocumentChangeEvent>;

  constructor(uri: vscode.Uri, context: vscode.ExtensionContext) {
    super(() => {
      this._changeEmitter.dispose();
      if (this._watcher) {
        this._watcher.dispose();
      }
    });
    this._uri = uri;
    this._context = context;
    this._documentData = fs.readFileSync(uri.fsPath, 'utf8');
    this._contentHash = hashContent(this._documentData);
    this._changeEmitter = new vscode.EventEmitter();
    this.onDidChange = this._changeEmitter.event;

    this.setupFileWatcher();
  }

  get uri(): vscode.Uri {
    return this._uri;
  }

  getContent(): string {
    return this._documentData;
  }

  reload() {
    this._documentData = fs.readFileSync(this._uri.fsPath, 'utf8');
    this._contentHash = hashContent(this._documentData);
  }

  updateContent(html: string, mermaidSources: Record<string, string>) {
    this._mermaidSources = mermaidSources;
    const markdown = htmlToMarkdown(html, mermaidSources, this._uri.fsPath);
    const newHash = hashContent(markdown);

    if (newHash !== this._contentHash) {
      this._documentData = markdown;
      this._contentHash = newHash;
    }
  }

  updateMermaidBlock(mermaidId: string, source: string) {
    this._mermaidSources[mermaidId] = source;
  }

  save() {
    try {
      fs.writeFileSync(this._uri.fsPath, this._documentData, 'utf8');
      this._contentHash = hashContent(this._documentData);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save file: ${error}`);
    }
  }

  private setupFileWatcher() {
    this._watcher = vscode.workspace.createFileSystemWatcher(this._uri.fsPath);

    this._watcher.onDidChange(() => {
      const newContent = fs.readFileSync(this._uri.fsPath, 'utf8');
      const newHash = hashContent(newContent);

      if (newHash !== this._contentHash) {
        this._documentData = newContent;
        this._contentHash = newHash;
        this._changeEmitter.fire({
          content: newContent,
          mermaidSources: this._mermaidSources,
        });
      }
    });
  }
}

interface WebviewDocumentChangeEvent {
  content: string;
  mermaidSources: Record<string, string>;
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
