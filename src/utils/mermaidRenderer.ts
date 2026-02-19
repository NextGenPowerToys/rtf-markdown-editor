import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

function getMermaidScript(context: vscode.ExtensionContext): string {
  const possiblePaths = [
    path.join(context.extensionUri.fsPath, 'media', 'mermaid.min.js'),
    path.join(__dirname, '..', 'media', 'mermaid.min.js'),
    path.join(process.cwd(), 'media', 'mermaid.min.js'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf-8');
    }
  }
  throw new Error('mermaid.min.js not found in media/ folder');
}

function buildRendererHtml(mermaidScript: string, nonce: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:; font-src data:;">
</head>
<body>
  <div id="render-target"
       style="position:absolute;left:-9999px;top:-9999px;visibility:hidden;width:1200px;"></div>
  <script nonce="${nonce}">
${mermaidScript}
  </script>
  <script nonce="${nonce}">
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      maxTextSize: 50000,
      flowchart: {
        htmlLabels: false,
        useMaxWidth: true,
        padding: 15,
        nodeSpacing: 50,
        rankSpacing: 50
      },
      sequence: {
        useMaxWidth: true,
        showSequenceNumbers: false,
        boxMargin: 10,
        noteMargin: 10,
        messageMargin: 35,
        mirrorActors: true,
        bottomMarginAdj: 1,
        rightAngles: false
      }
    });

    function preprocessSource(source) {
      // Replicate editor.ts renderMermaidDiagrams() preprocessing exactly
      // 1. Quote unquoted participant aliases containing special characters
      let processed = source.replace(
        /^[\t ]*participant\s+([a-zA-Z0-9_\-]+)\s+as\s+([^"\n]+?)(?:\s*)$/gm,
        function(match, id, alias) {
          var trimmed = alias.trim();
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) { return match; }
          return '\tparticipant ' + id + ' as "' + trimmed + '"';
        }
      );
      // 2. Convert <br/> tags to escaped newlines for plain-text mode (htmlLabels: false)
      processed = processed.replace(/<br\s*\/?>/gi, '\\n');
      return processed;
    }

    function svgToPng(svgString, width, height) {
      return new Promise(function(resolve, reject) {
        // Use a data: URL to avoid needing blob: in img-src CSP
        var svgBase64 = btoa(unescape(encodeURIComponent(svgString)));
        var dataUrl = 'data:image/svg+xml;base64,' + svgBase64;
        var img = new Image();
        img.onload = function() {
          var W = width || img.naturalWidth || 1200;
          var H = height || img.naturalHeight || 800;
          var canvas = document.createElement('canvas');
          canvas.width = W;
          canvas.height = H;
          var ctx = canvas.getContext('2d');
          // White background (Mermaid SVGs have transparent background)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, W, H);
          ctx.drawImage(img, 0, 0, W, H);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = function() {
          reject(new Error('Failed to load SVG as data URL'));
        };
        img.src = dataUrl;
      });
    }

    function parseSvgDimensions(svgString) {
      var width = null, height = null;
      try {
        var parser = new DOMParser();
        var svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        var svgEl = svgDoc.querySelector('svg');
        if (svgEl) {
          var vb = svgEl.getAttribute('viewBox');
          if (vb) {
            var parts = vb.trim().split(/[\s,]+/);
            if (parts.length >= 4) {
              width = parseFloat(parts[2]) || null;
              height = parseFloat(parts[3]) || null;
            }
          }
          if (!width) { width = parseFloat(svgEl.getAttribute('width')) || null; }
          if (!height) { height = parseFloat(svgEl.getAttribute('height')) || null; }
        }
      } catch (e) { /* ignore parse errors */ }
      return { width: width, height: height };
    }

    async function renderDiagram(mermaidId, source) {
      var containerId = 'render-' + mermaidId;
      var container = document.createElement('div');
      container.id = containerId;
      document.getElementById('render-target').appendChild(container);

      try {
        var processed = preprocessSource(source);
        var svgId = containerId + '-svg';
        var result = await mermaid.render(svgId, processed);
        var svg = result.svg;

        var dims = parseSvgDimensions(svg);
        var dataUrl = await svgToPng(svg, dims.width, dims.height);
        container.remove();
        return { id: mermaidId, success: true, dataUrl: dataUrl };
      } catch (err) {
        container.remove();
        return { id: mermaidId, success: false, error: String(err) };
      }
    }

    window.addEventListener('message', async function(event) {
      var msg = event.data;
      if (msg.type !== 'renderDiagrams') { return; }

      var diagrams = msg.diagrams;
      var results = {};

      for (var id of Object.keys(diagrams)) {
        results[id] = await renderDiagram(id, diagrams[id]);
      }

      vscodeApi.postMessage({ type: 'renderComplete', results: results });
    });

    var vscodeApi = acquireVsCodeApi();
    vscodeApi.postMessage({ type: 'rendererReady' });
  </script>
</body>
</html>`;
}

/**
 * Render Mermaid diagrams to PNG using a hidden VS Code WebviewPanel (Chromium).
 * Returns a map of diagram IDs to PNG data URLs (data:image/png;base64,...).
 * Diagrams that fail to render are absent from the returned map.
 * Returns {} immediately if mermaidSources is empty.
 */
export async function renderMermaidToPng(
  mermaidSources: Record<string, string>,
  context: vscode.ExtensionContext,
  timeoutMs = 30000
): Promise<Record<string, string>> {
  if (Object.keys(mermaidSources).length === 0) {
    return {};
  }

  const mermaidScript = getMermaidScript(context);
  const nonce = getNonce();
  const html = buildRendererHtml(mermaidScript, nonce);

  const panel = vscode.window.createWebviewPanel(
    'mermaidRenderer',
    'Mermaid Renderer',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      retainContextWhenHidden: false,
      localResourceRoots: [],
    }
  );

  panel.webview.html = html;

  return new Promise<Record<string, string>>((resolve) => {
    const pngResults: Record<string, string> = {};
    let settled = false;

    const settle = (results: Record<string, string>) => {
      if (settled) { return; }
      settled = true;
      clearTimeout(timer);
      panel.dispose();
      resolve(results);
    };

    const timer = setTimeout(() => {
      console.warn('[MermaidRenderer] Timed out waiting for render results');
      settle(pngResults);
    }, timeoutMs);

    panel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'rendererReady') {
        panel.webview.postMessage({
          type: 'renderDiagrams',
          diagrams: mermaidSources,
        });
      } else if (msg.type === 'renderComplete') {
        const results = msg.results as Record<string, { success: boolean; dataUrl?: string; error?: string }>;
        for (const [id, result] of Object.entries(results)) {
          if (result.success && result.dataUrl) {
            pngResults[id] = result.dataUrl;
          } else {
            console.warn(`[MermaidRenderer] Diagram ${id} failed to render: ${result.error}`);
          }
        }
        settle(pngResults);
      }
    });

    panel.onDidDispose(() => {
      settle(pngResults);
    });
  });
}
