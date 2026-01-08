import * as vscode from 'vscode';
import { MarkdownWordEditorProvider } from './editors/MarkdownWordEditorProvider';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import * as chardet from 'chardet';
import { exportToHTML } from './utils/htmlExporter';

export function activate(context: vscode.ExtensionContext) {
  const provider = new MarkdownWordEditorProvider(context);

  // Register custom editor provider
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'rtf-markdown-editor.editor',
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
          enableFindWidget: true,
        },
      }
    )
  );

  // Register command to open editor
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.openEditor', async (resource: vscode.Uri) => {
      if (resource) {
        await vscode.commands.executeCommand('vscode.openWith', resource, 'rtf-markdown-editor.editor');
      }
    })
  );

  // Register command to export current document as HTML
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.exportHTML', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.md')) {
        vscode.window.showErrorMessage('Please open a markdown file first');
        return;
      }

      try {
        // Read the markdown file
        const buffer = fs.readFileSync(editor.document.uri.fsPath);
        const charset = detectCharset(buffer);
        const markdown = iconv.decode(buffer, charset);

        // Get document name for title
        const docName = path.basename(editor.document.uri.fsPath, path.extname(editor.document.uri.fsPath));

        // Generate HTML
        const html = await exportToHTML(markdown, {
          title: docName,
          includeStyles: true,
          includeScripts: true,
          standalone: true,
        });

        // Ask user where to save
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(path.dirname(editor.document.uri.fsPath), `${docName}.html`)),
          filters: { 'HTML Files': ['html'] },
        });

        if (uri) {
          fs.writeFileSync(uri.fsPath, html, 'utf8');
          vscode.window.showInformationMessage(`HTML exported to ${path.basename(uri.fsPath)}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export HTML: ${error}`);
      }
    })
  );
}

/**
 * Detect character encoding
 */
function detectCharset(buffer: Buffer): string {
  const config = vscode.workspace.getConfiguration('rtf-markdown-editor');
  const autoDetect = config.get<boolean>('detectCharsetAutomatically', true);

  if (!autoDetect) {
    return config.get<string>('defaultCharset', 'UTF-8');
  }

  const detected = chardet.detect(buffer);
  if (detected) {
    const charset = detected.toString().toUpperCase();
    if (charset.startsWith('UTF-8') || charset === 'UTF8') return 'UTF-8';
    if (charset.startsWith('UTF-16LE')) return 'UTF-16LE';
    if (charset.startsWith('UTF-16BE')) return 'UTF-16BE';
    if (charset.startsWith('ISO-8859-1') || charset === 'ISO88591') return 'ISO-8859-1';
    if (charset.startsWith('WINDOWS-1252') || charset === 'CP1252') return 'Windows-1252';
    return charset;
  }

  return 'UTF-8';
}

export function deactivate() {
  // Cleanup
}
