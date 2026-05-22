import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { extractPdfText } from '../utils/pdfocr/pdfExtractor';
import type { PageData, TextItem } from '../utils/pdfocr/types';

// GitHub Copilot Chat is the only backend we route through. Detection just
// confirms that one (or one of its co-installed packages) is present.
interface KnownChatExtension { id: string; label: string }
const KNOWN_CHAT_EXTENSIONS: KnownChatExtension[] = [
  { id: 'GitHub.copilot-chat', label: 'GitHub Copilot Chat' },
  { id: 'GitHub.copilot', label: 'GitHub Copilot' },
];
const CONTEXT_KEY = 'rtf-markdown-editor.aiChatAvailable';
const PARTICIPANT_ID = 'rtf-markdown-editor.pdfChat';

/**
 * Per-chunk character budget when streaming the extracted text into the LM.
 * Pages stay grouped at boundaries — a chunk is closed as soon as adding the
 * next page would push it over the budget, so we never split a page across
 * requests. 40 K chars ≈ ~12 K tokens, well inside the smallest mainstream
 * context window.
 */
const CHUNK_CHAR_BUDGET = 40_000;

/**
 * Detect whether GitHub Copilot Chat is installed (either the dedicated
 * `GitHub.copilot-chat` extension or its `GitHub.copilot` host). Returns the
 * friendly label for menu/UI text.
 */
export function detectAiChat(): { available: boolean; label: string | null } {
  for (const ext of KNOWN_CHAT_EXTENSIONS) {
    if (vscode.extensions.getExtension(ext.id)) return { available: true, label: ext.label };
  }
  return { available: false, label: null };
}

/** Publish/refresh the `when`-clause context key the menu listens on. */
export async function refreshAvailabilityContext(): Promise<void> {
  const { available, label } = detectAiChat();
  try {
    await vscode.commands.executeCommand('setContext', CONTEXT_KEY, available);
    console.log(`[rtf-markdown-editor] aiChatAvailable=${available} (${label ?? 'none'})`);
  } catch (err) {
    console.warn('[rtf-markdown-editor] failed to set aiChatAvailable context:', err);
  }
}

/**
 * Register the PDF→Markdown chat participant. The handler loads the bundled
 * pdf SKILL.md, prepends it to the user's request as a system-level prompt,
 * and forwards everything to the active language model. The model streams
 * markdown back into the chat response.
 */
export function registerPdfChatParticipant(context: vscode.ExtensionContext): vscode.Disposable {
  const handler: vscode.ChatRequestHandler = async (request, _chatContext, response, token) => {
    const skill = await loadSkill(context.extensionUri);
    const pdfPath = extractPdfPath(request) ?? '';
    const outPath = guessOutputPath(pdfPath);

    if (!pdfPath) {
      response.markdown(
        'Please provide a path to a `.pdf` file in your request — for example:\n\n' +
        '`@pdfmd convert /Users/me/docs/report.pdf to markdown`',
      );
      return;
    }

    if (!fs.existsSync(pdfPath)) {
      response.markdown(`File not found: \`${pdfPath}\``);
      return;
    }

    // The model can't read local files itself, so we extract the PDF's text
    // (with positional info preserved) and feed it into the prompt. The model
    // only applies the SKILL.md rules to that text and emits Markdown.
    response.progress(`Reading and extracting text from \`${pdfPath}\`…`);
    let pageDumps: string[];
    let savedImages = 0;
    try {
      const pdfPages = await extractPdfText(pdfPath);
      // Save embedded page images to .attachments/.<pdfBaseName>/ and build
      // per-page reference lists so the prompt can tell the model where to
      // emit `![](.attachments/…)` markdown links. Mirrors the DOCX import.
      const pageImageRefs = persistPageImages(pdfPages, outPath);
      savedImages = pageImageRefs.reduce((s, list) => s + list.length, 0);
      pageDumps = pdfPages.map((p, idx) => formatSinglePage(p, pageImageRefs[idx] ?? []));
    } catch (err) {
      response.markdown(`Could not read the PDF: ${(err as Error).message}`);
      return;
    }
    if (savedImages > 0) {
      response.progress(`Saved ${savedImages} embedded image(s) to .attachments/`);
    }

    // Resolve a model via GitHub Copilot Chat (the only backend we route to).
    let model: vscode.LanguageModelChat | undefined;
    try {
      const copilotModels = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      if (copilotModels.length > 0) {
        model = copilotModels[0];
      } else {
        const any = await vscode.lm.selectChatModels({});
        model = any[0];
      }
    } catch (err) {
      response.markdown(`Could not access a language model: ${(err as Error).message}`);
      return;
    }
    if (!model) {
      response.markdown('No GitHub Copilot language model is available. Make sure GitHub Copilot Chat is installed and signed in.');
      return;
    }

    // Group pages into chunks within CHUNK_CHAR_BUDGET. Page boundaries are
    // preserved so the model never sees half a page.
    const chunks = chunkPages(pageDumps, CHUNK_CHAR_BUDGET);

    const totalChars = pageDumps.reduce((s, p) => s + p.length, 0);
    response.markdown(
      `Converting **${pageDumps.length}** page(s) (${totalChars.toLocaleString()} chars) in ` +
      `**${chunks.length}** chunk(s) via **${model.vendor}/${model.name}**…\n\n`,
    );

    const collectedChunks: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      response.progress(
        `Converting chunk ${i + 1} of ${chunks.length} ` +
        `(pages ${chunk.firstPage}–${chunk.lastPage}, ${chunk.text.length.toLocaleString()} chars)…`,
      );
      const userPrompt = buildChunkPrompt(skill, pdfPath, outPath, chunk, i + 1, chunks.length);
      let chunkText = '';
      try {
        const messages = [vscode.LanguageModelChatMessage.User(userPrompt)];
        const result = await model.sendRequest(messages, {}, token);
        for await (const fragment of result.text) {
          chunkText += fragment;
        }
      } catch (err) {
        response.markdown(`Chunk ${i + 1} failed: ${(err as Error).message}`);
        return;
      }
      collectedChunks.push(sanitizeMarkdownOutput(chunkText));
    }

    const cleaned = collectedChunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    if (!cleaned.trim()) {
      response.markdown('The model returned no markdown — nothing was saved.');
      return;
    }

    try {
      fs.writeFileSync(outPath, cleaned, 'utf-8');
    } catch (err) {
      response.markdown(`Could not write to \`${outPath}\`: ${(err as Error).message}`);
      return;
    }

    const fileUri = vscode.Uri.file(outPath);
    try {
      await vscode.commands.executeCommand('vscode.openWith', fileUri, 'rtf-markdown-editor.editor');
    } catch {
      try { await vscode.commands.executeCommand('vscode.open', fileUri); } catch { /* ignore */ }
    }

    response.markdown(`Saved Markdown to [${path.basename(outPath)}](${fileUri.toString()}) and opened it in the RTF Markdown editor.`);
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'media', 'icons', 'RTFMD.png');
  return participant;
}

async function loadSkill(extensionUri: vscode.Uri): Promise<string> {
  const skillUri = vscode.Uri.joinPath(extensionUri, 'resources', 'skills', 'pdf', 'SKILL.md');
  const bytes = await vscode.workspace.fs.readFile(skillUri);
  return Buffer.from(bytes).toString('utf-8');
}

function extractPdfPath(request: vscode.ChatRequest): string | null {
  // 1. Prefer an explicit #file: reference attached to the chat turn.
  const refs = request.references ?? [];
  for (const ref of refs) {
    const v: any = ref.value;
    if (v && typeof v === 'object' && 'fsPath' in v && /\.pdf$/i.test(v.fsPath)) {
      return v.fsPath;
    }
    if (typeof v === 'string' && /\.pdf$/i.test(v)) return v;
  }

  const prompt = request.prompt;

  // 2. Backtick-wrapped path (this is what the menu command emits — handles
  // spaces, Hebrew, and any other Unicode safely as a single token).
  const backtick = prompt.match(/`([^`\n]+?\.pdf)`/i);
  if (backtick) return backtick[1];

  // 3. Double-quoted path.
  const quoted = prompt.match(/"([^"\n]+?\.pdf)"/i);
  if (quoted) return quoted[1];

  // 4. Bare path. Allow ANY non-control character except a small set of
  // separators so spaces, Hebrew, CJK, accents, etc. all match. Anchor to a
  // POSIX-style "/" or a Windows drive prefix so we don't pick up a bare
  // word that just happens to end in ".pdf".
  const bare = prompt.match(/((?:\/|[A-Za-z]:[\\/])[^\n"'<>`]+?\.pdf)\b/iu);
  if (bare) return bare[1].trim();

  // 5. Last-ditch: any `<token>.pdf` segment in the prompt.
  const any = prompt.match(/(\S+\.pdf)\b/iu);
  return any ? any[1] : null;
}

function guessOutputPath(pdfPath: string): string {
  if (!pdfPath) return '';
  const dir = path.dirname(pdfPath);
  const base = path.basename(pdfPath, path.extname(pdfPath));
  return path.join(dir, `${base}.md`);
}

interface PageChunk {
  text: string;
  firstPage: number;
  lastPage: number;
}

/**
 * Group already-formatted per-page dumps into chunks no larger than
 * `budget` characters each. A chunk is closed before the page that would
 * exceed the budget, so page boundaries are always preserved. A single page
 * larger than the budget still travels alone (we never split mid-page).
 */
function chunkPages(pageDumps: string[], budget: number): PageChunk[] {
  const chunks: PageChunk[] = [];
  let current: string[] = [];
  let currentSize = 0;
  let currentFirstPage = 0;
  let pageNum = 0;

  const flush = (lastPage: number) => {
    if (current.length === 0) return;
    chunks.push({
      text: current.join('\n\n'),
      firstPage: currentFirstPage,
      lastPage,
    });
    current = [];
    currentSize = 0;
  };

  for (const dump of pageDumps) {
    pageNum++;
    const size = dump.length + 2; // +2 for the joining "\n\n"
    if (current.length > 0 && currentSize + size > budget) {
      flush(pageNum - 1);
    }
    if (current.length === 0) currentFirstPage = pageNum;
    current.push(dump);
    currentSize += size;
  }
  flush(pageNum);
  return chunks;
}

function buildChunkPrompt(
  skill: string,
  pdfPath: string,
  outPath: string,
  chunk: PageChunk,
  chunkIndex: number,
  chunkTotal: number,
): string {
  return [
    'You are converting a PDF file to Markdown.',
    'Use the following SKILL document as your authoritative guide for PDF processing:',
    '',
    '---BEGIN PDF SKILL---',
    skill,
    '---END PDF SKILL---',
    '',
    `Source PDF path (for reference only): ${pdfPath}`,
    `Suggested output Markdown path:       ${outPath}`,
    '',
    `This is **chunk ${chunkIndex} of ${chunkTotal}** of the document.`,
    `It contains pages ${chunk.firstPage}..${chunk.lastPage}.`,
    'The full document is split because of context-window limits — your output for this chunk will be concatenated with the other chunks IN ORDER. Treat the chunks as one continuous document.',
    '',
    'You DO NOT need to read the file from disk — the raw extracted text for THIS chunk is included below. ',
    'Each "## Page N" section lists the visible text on that page, one logical line per row, in left-to-right document order.',
    'For Hebrew/Arabic (RTL) content, the words within a line appear in VISUAL order; reorder them to logical reading order before emitting Markdown.',
    '',
    '---BEGIN PDF TEXT DUMP---',
    chunk.text,
    '---END PDF TEXT DUMP---',
    '',
    'Produce GitHub-flavored Markdown for THIS CHUNK ONLY:',
    chunkIndex === 1
      ? '- The document starts here: H1 for the title, nested numbered sections become H2/H3/H4 by depth ("1." → H2, "1.1" → H3, "2.1.1" → H4).'
      : '- Do NOT repeat the document title (an earlier chunk emitted it). Continue with the section headings as they appear.',
    '- Use `- ` for bullets, `**Label:**` for labelled list items, `| col | col |` GFM tables for tabular data.',
    '- Preserve embedded Latin/English fragments inside Hebrew sentences exactly (no character-reversal).',
    '- IMAGES: Each `[IMAGE: <relative_path>]` line in the page dump represents an',
    '  embedded image (diagram, chart, illustration) saved to disk. Emit it as a',
    '  real markdown image reference at that point in the document:',
    '  `![](<relative_path>)`. Keep the path EXACTLY as given — do not rename,',
    '  resolve, prefix, or URL-encode it. If a page contains only `[IMAGE: …]`',
    '  markers and no other text, that page is an image-only page — emit just',
    '  the image link(s).',
    '- If a page has NO text and NO `[IMAGE: …]` marker, emit `*(diagram)*` as a placeholder.',
    '',
    'Output ONLY the Markdown content for this chunk — no explanations, no opening/closing code fences, no Python scripts, no chunk headers.',
  ].join('\n');
}

/**
 * Render one PDF page as a `## Page N` block of line-grouped text, with any
 * embedded-image references listed in front as `[IMAGE: <relpath>]` lines so
 * the prompt can tell the model exactly which markdown image link to emit.
 */
function formatSinglePage(page: PageData, imageRefs: string[]): string {
  const lines = groupItemsIntoLines(page.items);
  const header = `## Page ${page.pageNumber}`;
  const imageLines = imageRefs.map(p => `[IMAGE: ${p}]`);
  const bodyLines = lines.length > 0 ? lines : (imageRefs.length > 0 ? [] : ['*(no extractable text)*']);
  const all = [header, ...imageLines, ...bodyLines];
  return all.join('\n');
}

/**
 * Save every embedded image extracted from the PDF pages to
 * `<mdDir>/.attachments/.<pdfBaseName>/image_<N>.png` and return, for each
 * page, the list of RELATIVE paths the markdown file should reference.
 * Mirrors the DOCX importer's `.attachments/.<filename>/` convention.
 *
 * If pdfjs-dist's image extractor couldn't get any image data (e.g. the
 * native `canvas` package isn't available on this host), the returned lists
 * are empty arrays and we just fall back to the no-image flow.
 */
function persistPageImages(pdfPages: PageData[], outPath: string): string[][] {
  const result: string[][] = pdfPages.map(() => []);
  const mdDir = path.dirname(outPath);
  const mdBase = path.basename(outPath, path.extname(outPath));
  const attachDir = path.join(mdDir, '.attachments', `.${mdBase}`);
  let dirCreated = false;
  let imgCounter = 0;

  for (let i = 0; i < pdfPages.length; i++) {
    const page = pdfPages[i];
    if (!page.images || page.images.length === 0) continue;
    for (const img of page.images) {
      if (!img.data || img.data.length === 0) continue;
      imgCounter++;
      const filename = `image_${imgCounter}.png`;
      const absPath = path.join(attachDir, filename);
      try {
        if (!dirCreated) {
          fs.mkdirSync(attachDir, { recursive: true });
          dirCreated = true;
        }
        fs.writeFileSync(absPath, img.data);
        const relPath = path.relative(mdDir, absPath).replace(/\\/g, '/');
        result[i].push(relPath);
      } catch {
        // Image save failed (permission etc.) — skip silently.
      }
    }
  }
  return result;
}

/**
 * Some models (despite the prompt instruction) wrap their entire reply in
 * a ```markdown … ``` fence, or prefix it with "Here is the converted
 * Markdown:" prose. Strip those before persisting so the saved `.md` is
 * pure document content.
 */
function sanitizeMarkdownOutput(raw: string): string {
  let text = raw.trim();

  // Drop a leading sentence of pre-amble like "Here is the converted markdown:"
  // when the next blank line precedes actual markdown.
  const preamble = text.match(/^(?:Here|Below)[^\n]{0,200}:\s*\n+/i);
  if (preamble) text = text.slice(preamble[0].length);

  // Unwrap a full-document fence (```markdown … ```), if present.
  const fenceMatch = text.match(/^```(?:markdown|md|gfm)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fenceMatch) text = fenceMatch[1].trim();

  return text;
}

function groupItemsIntoLines(items: TextItem[]): string[] {
  if (items.length === 0) return [];
  // Sort by Y top-to-bottom, then X left-to-right within the same line.
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 3) return a.y - b.y;
    return a.x - b.x;
  });
  const out: string[] = [];
  let currentY = sorted[0].y;
  let buf: string[] = [];
  for (const it of sorted) {
    if (Math.abs(it.y - currentY) > 3) {
      const joined = buf.join(' ').replace(/\s+/g, ' ').trim();
      if (joined) out.push(joined);
      buf = [];
      currentY = it.y;
    }
    if (it.text.trim()) buf.push(it.text);
  }
  const joined = buf.join(' ').replace(/\s+/g, ' ').trim();
  if (joined) out.push(joined);
  return out;
}
