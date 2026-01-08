import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as chardet from 'chardet';
import * as iconv from 'iconv-lite';
import { MessageFromWebview, MessageToWebview, EditorConfig, MarkdownMetadata } from '../types';
import { markdownToHtml, detectRTLCharacters } from '../utils/markdownProcessor';
import { htmlToMarkdown, hashContent } from '../utils/htmlProcessor';
import { RTLService } from '../services/RTLService';
import { exportToHTML, ExportOptions } from '../utils/htmlExporter';

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
    // Parse fragment identifier for line navigation (RFC 7763 Section 3)
    const fragment = this.parseFragmentIdentifier(uri.fragment);
    const document = new WebviewDocument(uri, this.context, fragment);
    this.documentMap.set(uri.toString(), document);
    return document;
  }

  /**
   * Parse RFC 7763 fragment identifiers (#line=N syntax)
   */
  private parseFragmentIdentifier(fragment: string): { startLine?: number; endLine?: number } | undefined {
    if (!fragment) return undefined;

    // RFC 7763 Section 3.1: #line=N or #line=N,M
    const lineMatch = fragment.match(/^line=(\d+)(?:,(\d+))?$/);
    if (lineMatch) {
      const startLine = parseInt(lineMatch[1], 10);
      const endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : undefined;
      return { startLine, endLine };
    }

    return undefined;
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
        console.log('[DEBUG] contentChanged received, HTML length:', (message.html || '').length);
        console.log('[DEBUG] HTML sample:', (message.html || '').substring(0, 1000));
        document.updateContent(message.html || '', message.mermaidSources || {});
        console.log('[DEBUG] Calling save()');
        document.save();
        console.log('[DEBUG] Save completed');
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

      case 'saveImageFile':
        if (message.imageData && message.fileName) {
          const savedPath = this.saveImageToAttachments(document.uri, message.imageData, message.fileName);
          
          // Convert to absolute path for webview URI
          const docDir = path.dirname(document.uri.fsPath);
          const absolutePath = path.join(docDir, savedPath);
          const imageUri = vscode.Uri.file(absolutePath);
          const webviewUri = panel.webview.asWebviewUri(imageUri);
          
          // Get image dimensions from base64
          const dimensions = this.getImageDimensions(message.imageData);
          
          panel.webview.postMessage({
            type: 'imageSaved',
            imagePath: savedPath,
            imageUrl: webviewUri.toString(),
            imageWidth: dimensions.width,
            imageHeight: dimensions.height,
          } as MessageToWebview);
        }
        break;

      case 'exportHTML':
        this.handleExportHTML(document, message.options, panel);
        break;
    }
  }

  private sendInitialContent(document: WebviewDocument, panel: vscode.WebviewPanel) {
    const content = document.getContent();
    let { html, mermaidSources } = markdownToHtml(content);
    
    // Use RTLService to create config
    const config = RTLService.createConfig(content, true);
    
    // Add RFC 7763 metadata to config
    const metadata = document.getMetadata();
    config.charset = metadata.charset;
    config.variant = metadata.variant;

    // Convert image paths to webview URIs
    html = this.convertImagePathsToWebviewUris(html, document.uri, panel.webview);

    panel.webview.postMessage({
      type: 'setContent',
      html,
      mermaidSources,
      config,
      fragment: metadata.fragment, // Send fragment for line navigation
    } as MessageToWebview);
  }

  private getImageDimensions(base64Data: string): { width: number | null, height: number | null } {
    // For SVG, try to parse width/height from the SVG content
    if (base64Data.startsWith('data:image/svg')) {
      try {
        const base64Match = base64Data.match(/^data:image\/[^;]+;base64,(.+)$/);
        if (base64Match) {
          const svgContent = Buffer.from(base64Match[1], 'base64').toString('utf8');
          const widthMatch = svgContent.match(/width=["']([\d.]+)["']/);
          const heightMatch = svgContent.match(/height=["']([\d.]+)["']/);
          
          if (widthMatch && heightMatch) {
            return {
              width: Math.round(parseFloat(widthMatch[1])),
              height: Math.round(parseFloat(heightMatch[1]))
            };
          }
        }
      } catch (error) {
        console.error('[Image Dimensions] Error parsing SVG:', error);
      }
    }
    
    // For raster images (PNG, JPG), we can't easily get dimensions without a library
    // Return null to let the browser determine natural size
    return { width: null, height: null };
  }

  private saveImageToAttachments(documentUri: vscode.Uri, base64Data: string, fileName: string): string {
    console.log('[Image Save] Starting saveImageToAttachments');
    console.log('[Image Save] fileName:', fileName);
    console.log('[Image Save] base64Data length:', base64Data.length);
    console.log('[Image Save] base64Data preview:', base64Data.substring(0, 100));
    
    // Get the document filename without extension
    const docBaseName = path.basename(documentUri.fsPath, path.extname(documentUri.fsPath));
    const docDir = path.dirname(documentUri.fsPath);
    
    console.log('[Image Save] docBaseName:', docBaseName);
    console.log('[Image Save] docDir:', docDir);
    
    // Create .attachments/.[mdfilename] folder structure
    const attachmentsDir = path.join(docDir, '.attachments');
    const docAttachmentsDir = path.join(attachmentsDir, `.${docBaseName}`);
    
    console.log('[Image Save] attachmentsDir:', attachmentsDir);
    console.log('[Image Save] docAttachmentsDir:', docAttachmentsDir);
    
    if (!fs.existsSync(attachmentsDir)) {
      fs.mkdirSync(attachmentsDir);
      console.log('[Image Save] Created attachmentsDir');
    }
    if (!fs.existsSync(docAttachmentsDir)) {
      fs.mkdirSync(docAttachmentsDir);
      console.log('[Image Save] Created docAttachmentsDir');
    }
    
    // Generate unique filename if needed
    let finalFileName = fileName;
    let counter = 1;
    let filePath = path.join(docAttachmentsDir, finalFileName);
    while (fs.existsSync(filePath)) {
      const ext = path.extname(fileName);
      const base = path.basename(fileName, ext);
      finalFileName = `${base}_${counter}${ext}`;
      filePath = path.join(docAttachmentsDir, finalFileName);
      counter++;
    }
    
    console.log('[Image Save] Final filePath:', filePath);
    
    // Remove data URL prefix and save
    const base64Match = base64Data.match(/^data:image\/[^;]+;base64,(.+)$/);
    console.log('[Image Save] base64Match:', base64Match ? 'matched' : 'NO MATCH');
    
    if (base64Match) {
      try {
        const buffer = Buffer.from(base64Match[1], 'base64');
        console.log('[Image Save] Buffer size:', buffer.length);
        fs.writeFileSync(filePath, buffer);
        console.log('[Image Save] File written successfully');
        console.log('[Image Save] File exists after write:', fs.existsSync(filePath));
      } catch (error) {
        console.error('[Image Save] Error writing file:', error);
      }
    } else {
      console.error('[Image Save] Failed to match base64 pattern in data');
    }
    
    // Return relative path from markdown file
    const relativePath = `.attachments/.${docBaseName}/${finalFileName}`;
    console.log('[Image Save] Returning relative path:', relativePath);
    return relativePath;
  }

  private async handleExportHTML(
    document: WebviewDocument,
    options: ExportOptions = {},
    panel: vscode.WebviewPanel
  ) {
    try {
      const markdown = document.getContent();
      const docName = path.basename(document.uri.fsPath, path.extname(document.uri.fsPath));

      // Generate HTML
      const html = await exportToHTML(markdown, {
        ...options,
        title: docName,
      });

      // Ask user where to save
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), `${docName}.html`)),
        filters: { 'HTML Files': ['html'] },
      });

      if (uri) {
        // Write the HTML file
        fs.writeFileSync(uri.fsPath, html, 'utf8');
        vscode.window.showInformationMessage(`HTML exported to ${path.basename(uri.fsPath)}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to export HTML: ${error}`);
    }
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
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} data:; connect-src 'self' ${webview.cspSource} data:; child-src 'self'; frame-src https:;" />
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
        <div class="modal-body" style="padding: 20px; min-height: 120px;">
          <div style="margin-bottom: 16px;">
            <label for="link-text" style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px;">Link Text:</label>
            <input type="text" id="link-text" placeholder="Link text (optional)" style="width: calc(100% - 16px); padding: 10px 8px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 0;">
            <label for="link-url" style="display: block; margin-bottom: 6px; font-weight: 600; font-size: 14px;">URL:</label>
            <input type="text" id="link-url" placeholder="https://example.com" style="width: calc(100% - 16px); padding: 10px 8px; border: 1px solid #d0d0d0; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
            <div id="link-url-error" style="display: none; margin-top: 10px; padding: 10px 12px; background-color: #fff4f4; color: #d13438; border: 1px solid #f0adac; border-radius: 4px; font-size: 12px; line-height: 1.4; word-wrap: break-word;"></div>
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
  private _metadata: MarkdownMetadata; // RFC 7763 metadata

  onDidChange: vscode.Event<WebviewDocumentChangeEvent>;

  constructor(uri: vscode.Uri, context: vscode.ExtensionContext, fragment?: { startLine?: number; endLine?: number }) {
    super(() => {
      this._changeEmitter.dispose();
      if (this._watcher) {
        this._watcher.dispose();
      }
    });
    this._uri = uri;
    this._context = context;
    
    // Detect charset using RFC 7763 required parameter (Section 2)
    const buffer = fs.readFileSync(uri.fsPath);
    const detectedCharset = this.detectCharset(buffer);
    
    // Decode with detected charset
    this._documentData = iconv.decode(buffer, detectedCharset);
    this._contentHash = hashContent(this._documentData);
    
    // Initialize RFC 7763 metadata
    this._metadata = {
      charset: detectedCharset,
      variant: this.detectVariant(this._documentData),
      fragment,
      previewType: 'rendered',
    };
    
    this._changeEmitter = new vscode.EventEmitter();
    this.onDidChange = this._changeEmitter.event;

    this.setupFileWatcher();
  }

  /**
   * Detect character encoding per RFC 7763 Section 2 (required charset parameter)
   */
  private detectCharset(buffer: Buffer): string {
    const config = vscode.workspace.getConfiguration('rtf-markdown-editor');
    const autoDetect = config.get<boolean>('detectCharsetAutomatically', true);
    
    if (!autoDetect) {
      return config.get<string>('defaultCharset', 'UTF-8');
    }

    // Use chardet for detection
    const detected = chardet.detect(buffer);
    
    // Map common encodings to RFC 7763 standard names
    if (detected) {
      const charset = detected.toString().toUpperCase();
      // Normalize to standard names
      if (charset.startsWith('UTF-8') || charset === 'UTF8') return 'UTF-8';
      if (charset.startsWith('UTF-16LE')) return 'UTF-16LE';
      if (charset.startsWith('UTF-16BE')) return 'UTF-16BE';
      if (charset.startsWith('ISO-8859-1') || charset === 'ISO88591') return 'ISO-8859-1';
      if (charset.startsWith('WINDOWS-1252') || charset === 'CP1252') return 'Windows-1252';
      return charset;
    }
    
    // Default to UTF-8 if detection fails
    return 'UTF-8';
  }

  /**
   * Detect markdown variant per RFC 7763 Section 2 (optional variant parameter)
   */
  private detectVariant(content: string): string {
    const config = vscode.workspace.getConfiguration('rtf-markdown-editor');
    const defaultVariant = config.get<string>('defaultVariant', 'GFM');
    
    // Detect GFM features
    const hasGFMFeatures = 
      /\|[^\n]+\|/.test(content) ||      // Tables
      /^~~[^~]+~~$/m.test(content) ||   // Strikethrough
      /^- \[[x ]\]/m.test(content);     // Task lists
    
    if (hasGFMFeatures) {
      return 'GFM';
    }
    
    return defaultVariant;
  }

  getMetadata(): MarkdownMetadata {
    return this._metadata;
  }

  get uri(): vscode.Uri {
    return this._uri;
  }

  getContent(): string {
    return this._documentData;
  }

  reload() {
    const buffer = fs.readFileSync(this._uri.fsPath);
    this._documentData = iconv.decode(buffer, this._metadata.charset);
    this._contentHash = hashContent(this._documentData);
  }

  updateContent(html: string, mermaidSources: Record<string, string>) {
    this._mermaidSources = mermaidSources;
    const markdown = htmlToMarkdown(html, mermaidSources, this._uri.fsPath);
    console.log('[DEBUG] updateContent - markdown preview:', markdown.substring(0, 500));
    const newHash = hashContent(markdown);

    if (newHash !== this._contentHash) {
      console.log('[DEBUG] Hash changed, updating content');
      this._documentData = markdown;
      this._contentHash = newHash;
    } else {
      console.log('[DEBUG] Hash unchanged, skipping update');
    }
  }

  updateMermaidBlock(mermaidId: string, source: string) {
    this._mermaidSources[mermaidId] = source;
  }

  save() {
    try {
      // Encode with the document's charset (RFC 7763 Section 2)
      const buffer = iconv.encode(this._documentData, this._metadata.charset);
      fs.writeFileSync(this._uri.fsPath, buffer);
      this._contentHash = hashContent(this._documentData);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save file: ${error}`);
    }
  }

  private setupFileWatcher() {
    this._watcher = vscode.workspace.createFileSystemWatcher(this._uri.fsPath);

    this._watcher.onDidChange(() => {
      const buffer = fs.readFileSync(this._uri.fsPath);
      const newContent = iconv.decode(buffer, this._metadata.charset);
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
