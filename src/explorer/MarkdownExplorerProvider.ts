import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Tree node used by `MarkdownExplorerProvider`. Either a folder containing
 * sub-folders / files, or a single `.md` (or `.markdown`) file.
 */
type Node = FolderNode | FileNode;

interface FolderNode {
  type: 'folder';
  label: string;
  folderUri?: vscode.Uri;
  children: Map<string, Node>;
}

interface FileNode {
  type: 'file';
  label: string;
  uri: vscode.Uri;
}

/**
 * TreeDataProvider that surfaces every Markdown file in the open workspace
 * — and only Markdown files. Selecting a node opens the file in the RTF
 * Markdown editor via `vscode.openWith`.
 *
 * The implementation mirrors the layout pattern used by Mermaid Live
 * Editor's diagram-files sidebar: a single activity-bar icon → a tree view
 * that scans the workspace once on demand, then debounces refreshes when
 * the user adds/removes/renames Markdown files.
 */
export class MarkdownExplorerProvider implements vscode.TreeDataProvider<Node> {
  private readonly _changeEmitter = new vscode.EventEmitter<Node | undefined>();
  readonly onDidChangeTreeData = this._changeEmitter.event;

  private _scanPromise: Promise<{ wsRoots: Map<string, FolderNode>; singleWs: vscode.WorkspaceFolder | null }> | null = null;
  private _refreshTimer: NodeJS.Timeout | null = null;

  refresh(): void {
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    this._refreshTimer = setTimeout(() => {
      this._refreshTimer = null;
      this._scanPromise = null;
      this._changeEmitter.fire(undefined);
    }, 200);
  }

  // ── TreeDataProvider ────────────────────────────────────────────────────
  async getChildren(element?: Node): Promise<Node[]> {
    if (!element) {
      const { wsRoots, singleWs } = await this.scan();
      if (wsRoots.size === 0) return [];
      // Single workspace folder → skip the redundant ws-folder row and
      // surface its immediate children at the top. Multiple folders → list
      // each as a collapsible group.
      if (singleWs && wsRoots.size === 1) {
        const root = wsRoots.get(singleWs.uri.toString());
        if (root) return sortedChildren(root);
      }
      return [...wsRoots.values()];
    }
    if (element.type === 'folder') return sortedChildren(element);
    return [];
  }

  getTreeItem(element: Node): vscode.TreeItem {
    if (element.type === 'folder') {
      const item = new vscode.TreeItem(element.label, vscode.TreeItemCollapsibleState.Expanded);
      item.iconPath = vscode.ThemeIcon.Folder;
      if (element.folderUri) item.resourceUri = element.folderUri;
      item.contextValue = 'mdFolder';
      return item;
    }
    // file — icon, tooltip, and click action vary by extension
    const item = new vscode.TreeItem(element.uri, vscode.TreeItemCollapsibleState.None);
    item.label = element.label;
    const ext = path.extname(element.uri.fsPath).toLowerCase();
    switch (ext) {
      case '.md':
      case '.markdown':
        item.iconPath = new vscode.ThemeIcon('markdown');
        item.tooltip = 'Open in RTF Markdown Editor';
        item.command = {
          command: 'vscode.openWith',
          title: 'Open in RTF Markdown Editor',
          arguments: [element.uri, 'rtf-markdown-editor.editor'],
        };
        item.contextValue = 'mdFile';
        break;
      case '.docx':
        item.iconPath = new vscode.ThemeIcon('file-text');
        item.tooltip = 'Convert to Markdown (opens in RTF Markdown Editor)';
        item.description = 'DOCX → MD';
        item.command = {
          command: 'rtf-markdown-editor.importDOCX',
          title: 'Convert DOCX to Markdown',
          arguments: [element.uri],
        };
        item.contextValue = 'docxFile';
        break;
      case '.pdf':
        item.iconPath = new vscode.ThemeIcon('file-pdf');
        item.tooltip = 'Convert PDF → Markdown via GitHub Copilot Chat';
        item.description = 'PDF → MD';
        item.command = {
          command: 'rtf-markdown-editor.importPDF',
          title: 'Convert PDF to Markdown',
          arguments: [element.uri],
        };
        item.contextValue = 'pdfFile';
        break;
      case '.html':
      case '.htm':
        item.iconPath = new vscode.ThemeIcon('symbol-misc');
        item.tooltip = 'Convert HTML → Markdown';
        item.description = 'HTML → MD';
        item.command = {
          command: 'rtf-markdown-editor.importHTML',
          title: 'Convert HTML to Markdown',
          arguments: [element.uri],
        };
        item.contextValue = 'htmlFile';
        break;
      default:
        item.iconPath = vscode.ThemeIcon.File;
        item.contextValue = 'otherFile';
    }
    return item;
  }

  // ── internals ───────────────────────────────────────────────────────────
  private scan(): Promise<{ wsRoots: Map<string, FolderNode>; singleWs: vscode.WorkspaceFolder | null }> {
    if (!this._scanPromise) {
      this._scanPromise = scanMarkdownFiles()
        .then(files => buildFolderTree(files))
        .catch(() => ({ wsRoots: new Map<string, FolderNode>(), singleWs: null }));
    }
    return this._scanPromise;
  }
}

// ── workspace scan ─────────────────────────────────────────────────────────

async function scanMarkdownFiles(): Promise<vscode.Uri[]> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return [];
  // Include every doc type we know how to surface: Markdown for editing, and
  // PDF/DOCX/HTML for one-click conversion to Markdown.
  const include = '**/*.{md,markdown,pdf,docx,html,htm}';
  const exclude = '**/{node_modules,.git,dist,out,.vscode-test}/**';
  return vscode.workspace.findFiles(include, exclude);
}

function buildFolderTree(files: vscode.Uri[]): { wsRoots: Map<string, FolderNode>; singleWs: vscode.WorkspaceFolder | null } {
  const wsRoots = new Map<string, FolderNode>();
  const folders = vscode.workspace.workspaceFolders ?? [];

  for (const file of files) {
    const ws = vscode.workspace.getWorkspaceFolder(file);
    if (!ws) continue;
    const wsKey = ws.uri.toString();
    let root = wsRoots.get(wsKey);
    if (!root) {
      root = { type: 'folder', label: ws.name, folderUri: ws.uri, children: new Map() };
      wsRoots.set(wsKey, root);
    }
    const rel = path.relative(ws.uri.fsPath, file.fsPath);
    const segments = rel.split(path.sep);
    let current = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const dir = segments[i];
      let child = current.children.get(dir);
      if (!child || child.type !== 'folder') {
        const dirUri = vscode.Uri.file(path.join(ws.uri.fsPath, ...segments.slice(0, i + 1)));
        child = { type: 'folder', label: dir, folderUri: dirUri, children: new Map() };
        current.children.set(dir, child);
      }
      current = child;
    }
    const fname = segments[segments.length - 1];
    if (!current.children.has(fname)) {
      current.children.set(fname, { type: 'file', label: fname, uri: file });
    }
  }

  const singleWs = folders.length === 1 ? folders[0] : null;
  return { wsRoots, singleWs };
}

function sortedChildren(folder: FolderNode): Node[] {
  return [...folder.children.values()].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}
