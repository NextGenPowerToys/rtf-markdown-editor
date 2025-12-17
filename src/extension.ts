import * as vscode from 'vscode';
import { MarkdownWordEditorProvider } from './editors/MarkdownWordEditorProvider';

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
}

export function deactivate() {
  // Cleanup
}
