import * as vscode from 'vscode';
import { MarkdownWordEditorProvider } from './editors/MarkdownWordEditorProvider';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import * as chardet from 'chardet';
import { exportToHTML } from './utils/htmlExporter';
import { exportToDOCX } from './utils/docxExporter';
import { importFromDOCX } from './utils/docxImporter';
import { extractMermaidBlocks } from './utils/markdownProcessor';
import { renderMermaidToPng } from './utils/mermaidRenderer';

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

        // Pre-render Mermaid diagrams to PNG using a hidden webview
        const { mermaidSources } = extractMermaidBlocks(markdown);
        let mermaidImages: Record<string, string> = {};
        if (Object.keys(mermaidSources).length > 0) {
          await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Exporting HTML: rendering Mermaid diagrams...', cancellable: false },
            async () => { mermaidImages = await renderMermaidToPng(mermaidSources, context); }
          );
        }

        // Generate HTML
        const html = await exportToHTML(markdown, {
          title: docName,
          includeStyles: true,
          standalone: true,
          mermaidImages,
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

  // Register command to export as self-contained HTML (images embedded as base64)
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.exportHTMLSelfContained', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.md')) {
        vscode.window.showErrorMessage('Please open a markdown file first');
        return;
      }

      try {
        const buffer = fs.readFileSync(editor.document.uri.fsPath);
        const charset = detectCharset(buffer);
        const markdown = iconv.decode(buffer, charset);

        const docName = path.basename(editor.document.uri.fsPath, path.extname(editor.document.uri.fsPath));

        // Pre-render Mermaid diagrams to PNG using a hidden webview
        const { mermaidSources } = extractMermaidBlocks(markdown);
        let mermaidImages: Record<string, string> = {};
        if (Object.keys(mermaidSources).length > 0) {
          await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Exporting HTML: rendering Mermaid diagrams...', cancellable: false },
            async () => { mermaidImages = await renderMermaidToPng(mermaidSources, context); }
          );
        }

        const html = await exportToHTML(markdown, {
          title: docName,
          includeStyles: true,
          standalone: true,
          selfContained: true,
          basePath: path.dirname(editor.document.uri.fsPath),
          mermaidImages,
        });

        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(path.dirname(editor.document.uri.fsPath), `${docName}.html`)),
          filters: { 'HTML Files': ['html'] },
        });

        if (uri) {
          fs.writeFileSync(uri.fsPath, html, 'utf8');
          vscode.window.showInformationMessage(`Self-contained HTML exported to ${path.basename(uri.fsPath)}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export self-contained HTML: ${error}`);
      }
    })
  );

  // Register command to export current document as Word DOCX
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.exportDOCX', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || !editor.document.fileName.endsWith('.md')) {
        vscode.window.showErrorMessage('Please open a markdown file first');
        return;
      }

      try {
        const buffer = fs.readFileSync(editor.document.uri.fsPath);
        const charset = detectCharset(buffer);
        const markdown = iconv.decode(buffer, charset);

        const docName = path.basename(editor.document.uri.fsPath, path.extname(editor.document.uri.fsPath));

        // Pre-render Mermaid diagrams to PNG using a hidden webview
        const { mermaidSources } = extractMermaidBlocks(markdown);
        let mermaidImages: Record<string, string> = {};
        if (Object.keys(mermaidSources).length > 0) {
          await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Exporting DOCX: rendering Mermaid diagrams...', cancellable: false },
            async () => { mermaidImages = await renderMermaidToPng(mermaidSources, context); }
          );
        }

        const docx = await exportToDOCX(markdown, {
          title: docName,
          basePath: path.dirname(editor.document.uri.fsPath),
          mermaidImages,
        });

        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(path.dirname(editor.document.uri.fsPath), `${docName}.docx`)),
          filters: { 'Word Documents': ['docx'] },
        });

        if (uri) {
          fs.writeFileSync(uri.fsPath, docx);
          vscode.window.showInformationMessage(`Word document exported to ${path.basename(uri.fsPath)}`);
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to export Word document: ${error}`);
      }
    })
  );
  // Register command to import a Word DOCX file and convert it to Markdown
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.importDOCX', async (uri?: vscode.Uri) => {
      try {
        // Determine the DOCX file to import:
        // - If invoked from the Explorer context menu, `uri` is the selected file.
        // - If invoked from the Command Palette, show an Open dialog.
        let docxUri: vscode.Uri | undefined = uri;

        if (!docxUri) {
          const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'Word Documents': ['docx'] },
            openLabel: 'Import DOCX',
          });
          if (!picked || picked.length === 0) { return; }
          docxUri = picked[0];
        }

        const docxPath = docxUri.fsPath;
        const docName = path.basename(docxPath, path.extname(docxPath));

        // Show save dialog before conversion so we know the output path upfront
        // (needed to compute relative image paths during extraction)
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(path.dirname(docxPath), `${docName}.md`)),
          filters: { 'Markdown Files': ['md'] },
        });
        if (!saveUri) { return; }

        let markdown = '';
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Converting "${docName}.docx" to Markdown…`,
            cancellable: false,
          },
          async () => {
            markdown = await importFromDOCX(docxPath, saveUri.fsPath);
          }
        );

        fs.writeFileSync(saveUri.fsPath, markdown, 'utf8');

        const action = await vscode.window.showInformationMessage(
          `Markdown saved to ${path.basename(saveUri.fsPath)}`,
          'Open File'
        );
        if (action === 'Open File') {
          await vscode.commands.executeCommand('vscode.openWith', saveUri, 'rtf-markdown-editor.editor');
        }
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import DOCX: ${error}`);
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
