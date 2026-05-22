import * as vscode from 'vscode';
import { MarkdownWordEditorProvider } from './editors/MarkdownWordEditorProvider';
import * as fs from 'fs';
import * as path from 'path';
import * as iconv from 'iconv-lite';
import * as chardet from 'chardet';
import { exportToHTML } from './utils/htmlExporter';
import { importFromDOCX } from './utils/docxImporter';
import { htmlToMarkdown } from './utils/htmlToMarkdown';
import { extractMermaidBlocks } from './utils/markdownProcessor';
import { renderMermaidToPng } from './utils/mermaidRenderer';
import { detectAiChat, refreshAvailabilityContext, registerPdfChatParticipant } from './pdfChat';
import { MarkdownExplorerProvider } from './explorer/MarkdownExplorerProvider';

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

  // Publish the `when`-clause context key the PDF→Markdown menu listens on
  // BEFORE registering anything else, so the menu can render the moment the
  // extension finishes activating (driven by `onStartupFinished`).
  refreshAvailabilityContext().catch(err =>
    console.warn('[rtf-markdown-editor] availability context failed:', err),
  );
  context.subscriptions.push(
    vscode.extensions.onDidChange(() => { refreshAvailabilityContext(); }),
  );

  // Chat participant that performs the actual PDF→Markdown conversion via
  // the bundled `resources/skills/pdf/SKILL.md`. Wrapped in try/catch so a
  // missing chat API on an older host can't tank the rest of activation.
  try {
    context.subscriptions.push(registerPdfChatParticipant(context));
  } catch (err) {
    console.warn('[rtf-markdown-editor] chat participant unavailable:', err);
  }

  // Activity-bar side panel that lists every Markdown file in the open
  // workspace. Selecting a file in the tree opens it directly in the RTF
  // Markdown editor (via the `vscode.openWith` command wired into each
  // TreeItem). A FileSystemWatcher refreshes the tree when .md / .markdown
  // files are added / removed / renamed anywhere in the workspace.
  const explorerProvider = new MarkdownExplorerProvider();
  context.subscriptions.push(
    vscode.window.createTreeView('rtfMarkdownEditor.files', {
      treeDataProvider: explorerProvider,
      showCollapseAll: true,
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.refreshFiles', () => explorerProvider.refresh()),
  );
  const mdWatcher = vscode.workspace.createFileSystemWatcher('**/*.{md,markdown,pdf,docx,html,htm}');
  context.subscriptions.push(
    mdWatcher,
    mdWatcher.onDidCreate(() => explorerProvider.refresh()),
    mdWatcher.onDidDelete(() => explorerProvider.refresh()),
    mdWatcher.onDidChange(() => explorerProvider.refresh()),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(() => explorerProvider.refresh()),
  );

  // Register command to open editor.
  // Callable from: Explorer context menu, Command Palette, and the
  // `editor/title` button. Each route passes the target through a slightly
  // different shape (raw Uri, tab-input object with a `uri` field, nothing
  // at all), so we resolve by walking every plausible source.
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.openEditor', async (...args: any[]) => {
      const target = resolveMarkdownTarget(args);
      if (!target) {
        vscode.window.showErrorMessage('Please open or select a Markdown file first');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, 'rtf-markdown-editor.editor');
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
  // Delegates to the provider so it uses the live editor content and webview Mermaid
  // rendering — identical to the toolbar button. Opens the editor in the background
  // if the file is not already open.
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.exportHTMLSelfContained', async (uri?: vscode.Uri) => {
      const target = uri ?? (vscode.window.activeTextEditor
        ? vscode.Uri.file(vscode.window.activeTextEditor.document.uri.fsPath)
        : undefined);
      if (!target || !/\.(md|markdown)$/i.test(target.fsPath)) {
        vscode.window.showErrorMessage('Please open or select a Markdown file first');
        return;
      }
      await provider.exportFromUri(target, 'html', {
        selfContained: true,
        basePath: path.dirname(target.fsPath),
      });
    })
  );

  // Register command to export current document as Word DOCX
  // Same delegation pattern as exportHTMLSelfContained.
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.exportDOCX', async (uri?: vscode.Uri) => {
      const target = uri ?? (vscode.window.activeTextEditor
        ? vscode.Uri.file(vscode.window.activeTextEditor.document.uri.fsPath)
        : undefined);
      if (!target || !/\.(md|markdown)$/i.test(target.fsPath)) {
        vscode.window.showErrorMessage('Please open or select a Markdown file first');
        return;
      }
      await provider.exportFromUri(target, 'docx');
    })
  );
  // Register command to export current document as PDF
  // Same delegation pattern as exportHTMLSelfContained and exportDOCX.
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.exportPDF', async (uri?: vscode.Uri) => {
      const target = uri ?? (vscode.window.activeTextEditor
        ? vscode.Uri.file(vscode.window.activeTextEditor.document.uri.fsPath)
        : undefined);
      if (!target || !/\.(md|markdown)$/i.test(target.fsPath)) {
        vscode.window.showErrorMessage('Please open or select a Markdown file first');
        return;
      }
      await provider.exportFromUri(target, 'pdf');
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

        vscode.window.showInformationMessage(`Markdown saved to ${path.basename(saveUri.fsPath)}`);
        await vscode.commands.executeCommand('vscode.openWith', saveUri, 'rtf-markdown-editor.editor');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import DOCX: ${error}`);
      }
    })
  );

  // Register command to import an HTML file and convert it to Markdown.
  // Reads the .html locally, runs it through the same turndown-based
  // converter used elsewhere in the extension, saves the result as a
  // sibling `.md`, and opens it in the RTF Markdown editor.
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.importHTML', async (uri?: vscode.Uri) => {
      try {
        let htmlUri: vscode.Uri | undefined = uri;
        if (!htmlUri) {
          const picked = await vscode.window.showOpenDialog({
            canSelectMany: false,
            filters: { 'HTML Files': ['html', 'htm'] },
            openLabel: 'Import HTML',
          });
          if (!picked || picked.length === 0) { return; }
          htmlUri = picked[0];
        }

        const htmlPath = htmlUri.fsPath;
        const docName = path.basename(htmlPath, path.extname(htmlPath));
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(path.join(path.dirname(htmlPath), `${docName}.md`)),
          filters: { 'Markdown Files': ['md'] },
        });
        if (!saveUri) { return; }

        let markdown = '';
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: `Converting "${path.basename(htmlPath)}" to Markdown…`,
            cancellable: false,
          },
          async () => {
            const buf = fs.readFileSync(htmlPath);
            const html = buf.toString('utf8');
            markdown = await htmlToMarkdown(html);
          },
        );

        fs.writeFileSync(saveUri.fsPath, markdown, 'utf8');
        vscode.window.showInformationMessage(`Markdown saved to ${path.basename(saveUri.fsPath)}`);
        await vscode.commands.executeCommand('vscode.openWith', saveUri, 'rtf-markdown-editor.editor');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to import HTML: ${error}`);
      }
    }),
  );

  // Register command to import a PDF file. The conversion itself is handled
  // by the @pdfmd chat participant — this command picks the PDF, confirms
  // intent with the user, and opens chat with the participant pre-invoked.
  context.subscriptions.push(
    vscode.commands.registerCommand('rtf-markdown-editor.importPDF', async (uri?: vscode.Uri) => {
      const ai = detectAiChat();
      if (!ai.available) {
        vscode.window.showErrorMessage(
          'PDF → Markdown conversion requires GitHub Copilot Chat to be installed.',
        );
        return;
      }

      let pdfUri: vscode.Uri | undefined = uri;
      if (!pdfUri) {
        const picked = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'PDF Files': ['pdf'] },
          openLabel: 'Convert PDF to Markdown',
        });
        if (!picked || picked.length === 0) { return; }
        pdfUri = picked[0];
      }

      const docName = path.basename(pdfUri.fsPath);
      const choice = await vscode.window.showInformationMessage(
        `Convert "${docName}" to Markdown using GitHub Copilot Chat?\n\n` +
        'This will open chat, load the bundled PDF skill, and ask the assistant ' +
        'to produce the Markdown. The result is saved next to the PDF and opened in the editor.',
        { modal: true },
        'Continue',
      );
      if (choice !== 'Continue') return;

      // Open chat and invoke the @pdfmd participant with the PDF path. The
      // path is wrapped in backticks so spaces, Hebrew, and other Unicode
      // characters survive the chat input intact — the participant strips
      // the backticks back off when extracting.
      const query = `@pdfmd convert \`${pdfUri.fsPath}\` to markdown`;
      try {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query });
      } catch {
        // Fallback for hosts that use a different chat open command id.
        await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
        await vscode.env.clipboard.writeText(query);
        vscode.window.showInformationMessage(
          'Chat opened. The @pdfmd prompt has been copied to your clipboard — paste it into chat.',
        );
      }
    })
  );
}

/**
 * Detect character encoding
 */
/**
 * Resolve which Markdown file the `openEditor` command should act on. The
 * command is reachable from multiple entry points and VS Code passes the
 * target in slightly different shapes for each:
 *
 *   - Explorer context menu             → Uri as the 1st arg
 *   - Command Palette                   → no args at all
 *   - `editor/title` button (text)      → Uri as the 1st arg
 *   - `editor/title` button (custom)    → a TabInputCustom-like object
 *
 * On top of that, when the user hasn't actually focused the editor (e.g. the
 * Explorer tree still has focus after they clicked the title button) the
 * old code's `activeTextEditor` would be `undefined` and the command would
 * incorrectly say "open or select a Markdown file first" even though one is
 * clearly selected. We resolve by walking, in order: args → activeTextEditor
 * → the active tab in any tab group.
 */
function resolveMarkdownTarget(args: any[]): vscode.Uri | undefined {
  const matchesMd = (u: vscode.Uri | undefined): u is vscode.Uri =>
    !!u && /\.(md|markdown)$/i.test(u.fsPath);
  const fromArg = (a: any): vscode.Uri | undefined => {
    if (!a) return undefined;
    if (a instanceof vscode.Uri) return a;
    if (typeof a === 'string') {
      try { return vscode.Uri.file(a); } catch { return undefined; }
    }
    if (typeof a === 'object') {
      if (a.uri instanceof vscode.Uri) return a.uri;
      if (a.resource instanceof vscode.Uri) return a.resource;
      if (typeof a.fsPath === 'string') return vscode.Uri.file(a.fsPath);
    }
    return undefined;
  };

  for (const a of args) {
    const u = fromArg(a);
    if (matchesMd(u)) return u;
  }
  if (vscode.window.activeTextEditor) {
    const u = vscode.window.activeTextEditor.document.uri;
    if (matchesMd(u)) return u;
  }
  for (const group of vscode.window.tabGroups.all) {
    const active = group.activeTab;
    if (!active) continue;
    const input: any = active.input;
    const u = fromArg(input);
    if (matchesMd(u)) return u;
  }
  return undefined;
}

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
