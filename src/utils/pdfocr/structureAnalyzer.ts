import type { TextItem, ImageItem, PageData, Line, ContentBlock, TextSegment, ParagraphBlock } from './types';
import { mergeSplitTables } from './tableMerger';

/**
 * Analyze positioned text items and detect document structure:
 * headers, paragraphs, tables, lists, images.
 */
export function analyzePages(pages: PageData[]): ContentBlock[] {
  const allBlocks: ContentBlock[] = [];
  const allRightEdges: number[] = [];

  for (const page of pages) {
    if (page.pageNumber > 1) {
      allBlocks.push({ type: 'page-break', pageNumber: page.pageNumber });
      allRightEdges.push(NaN);
    }

    // Filter noise items before analysis
    const filteredItems = filterNoise(page.items);
    const lines = groupIntoLines(filteredItems, page.width);
    const { blocks: textBlocks, rightEdges: textEdges } = detectBlocks(lines, page.width);

    // Interleave images with text blocks based on Y position
    if (page.images && page.images.length > 0) {
      const withImages = interleaveImages(textBlocks, page.images);
      // Images get NaN right-edges (not paragraphs).
      while (textEdges.length < withImages.length) textEdges.push(NaN);
      allBlocks.push(...withImages);
      allRightEdges.push(...textEdges);
    } else {
      allBlocks.push(...textBlocks);
      allRightEdges.push(...textEdges);
    }
  }

  const merged = mergeSplitTables(allBlocks);
  // After table merging the block list may have shrunk; recompute right-edges
  // for the (now shorter) list by re-aligning paragraphs in order.
  const mergedRightEdges = realignRightEdges(merged, allBlocks, allRightEdges);
  const bulletized = convertBulletRuns(merged, mergedRightEdges);
  return bulletized.map(boldifyLabels);
}

function realignRightEdges(
  merged: ContentBlock[],
  original: ContentBlock[],
  originalEdges: number[],
): number[] {
  // Walk both lists in lock-step. For paragraph blocks we transfer the
  // original right-edge; for any block whose identity isn't paragraph in
  // `merged` we record NaN.
  const out: number[] = new Array(merged.length).fill(NaN);
  const paraEdgesQueue: number[] = [];
  for (let i = 0; i < original.length; i++) {
    if (original[i].type === 'paragraph' && !Number.isNaN(originalEdges[i])) {
      paraEdgesQueue.push(originalEdges[i]);
    }
  }
  for (let i = 0; i < merged.length; i++) {
    if (merged[i].type === 'paragraph' && paraEdgesQueue.length > 0) {
      out[i] = paraEdgesQueue.shift()!;
    }
  }
  return out;
}

/**
 * Interleave ImageBlocks among text blocks based on Y position.
 * Images are inserted before the first text block whose Y position
 * is below the image's Y position.
 */
function interleaveImages(textBlocks: ContentBlock[], images: ImageItem[]): ContentBlock[] {
  if (images.length === 0) return textBlocks;

  // Sort images by Y position (top to bottom)
  const sortedImages = [...images].sort((a, b) => a.y - b.y);

  // Estimate Y positions for text blocks from the lines that produced them.
  // Since we don't track exact Y in ContentBlock, insert images between blocks
  // proportionally based on their order.
  const result: ContentBlock[] = [];
  let imgIdx = 0;

  // We need Y positions of text blocks. Since ContentBlock doesn't store Y,
  // insert all images before text content (they'll appear in document order).
  // A more precise interleaving would require tracking Y in ContentBlock,
  // but for now this produces good-enough results.
  for (const block of textBlocks) {
    result.push(block);
  }

  // Append image blocks at the end of each page's content.
  // This is simpler and avoids breaking text flow incorrectly.
  for (; imgIdx < sortedImages.length; imgIdx++) {
    result.push({ type: 'image', data: sortedImages[imgIdx].data });
  }

  return result;
}

// ── Noise filtering ──

function filterNoise(items: TextItem[]): TextItem[] {
  return items.filter(item => {
    const text = item.text.trim();
    if (!text) return false;
    // Filter out single Unicode control characters and directional marks
    if (text.length === 1 && /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(text)) return false;
    return true;
  });
}

// ── Line grouping ──

function groupIntoLines(items: TextItem[], _pageWidth: number): Line[] {
  if (items.length === 0) return [];

  // Sort by Y (top to bottom), then by X (right to left for RTL)
  const sorted = [...items].sort((a, b) => {
    const dy = a.y - b.y;
    if (Math.abs(dy) > 3) return dy;
    return b.x - a.x; // RTL: higher X first
  });

  const lines: Line[] = [];
  let currentLineItems: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    const tolerance = Math.max(item.fontSize * 0.5, 4);

    if (Math.abs(item.y - currentY) <= tolerance) {
      currentLineItems.push(item);
    } else {
      const line = buildLine(currentLineItems);
      if (line.text.trim()) lines.push(line);
      currentLineItems = [item];
      currentY = item.y;
    }
  }

  if (currentLineItems.length > 0) {
    const line = buildLine(currentLineItems);
    if (line.text.trim()) lines.push(line);
  }

  return lines;
}

function buildLine(items: TextItem[]): Line {
  // Reorder items into logical reading order, honoring mixed RTL/LTR runs.
  const logical = reorderToLogical(items);
  const avgFontSize = logical.reduce((s, i) => s + i.fontSize, 0) / logical.length;
  const avgY = logical.reduce((s, i) => s + i.y, 0) / logical.length;
  const allBold = logical.every(i => i.isBold);

  const text = mergeLineText(logical);

  return {
    y: avgY,
    items: logical,
    fontSize: avgFontSize,
    isBold: allBold,
    text,
  };
}

// ── Mixed-direction (bidi) reordering ──

type StrongDir = 'rtl' | 'ltr';

function itemDir(text: string): StrongDir | 'neutral' {
  for (const ch of text) {
    const c = ch.charCodeAt(0);
    if (c >= 0x0590 && c <= 0x07ff) return 'rtl';
    if ((c >= 0x0041 && c <= 0x005a) || (c >= 0x0061 && c <= 0x007a) || (c >= 0x0030 && c <= 0x0039)) return 'ltr';
  }
  return 'neutral';
}

/**
 * Reorder text items from PDF.js stream order (typically visual, X-ascending)
 * into logical reading order, handling mixed RTL/LTR runs.
 *
 * Algorithm (simplified Unicode bidi for visually-stored text):
 *   1. Sort items by X-ascending (visual left-to-right).
 *   2. Determine line direction from majority of strong-directional items.
 *   3. Group consecutive items by strong direction; neutrals attach to the
 *      preceding group (or the line's base direction at the start).
 *   4. For RTL line: reverse group order. Within RTL groups, reverse items
 *      (visual→logical). LTR groups keep their stream/visual order.
 *      For LTR line: keep group order. RTL groups internally reverse.
 */
function reorderToLogical(items: TextItem[]): TextItem[] {
  if (items.length <= 1) return [...items];

  const visual = [...items].sort((a, b) => a.x - b.x);

  // If the line contains ANY RTL strong character, treat the line as RTL.
  // Pure-Latin lines stay LTR. This matches how mixed-direction text reads
  // inside an RTL document: embedded LTR runs are still kept in their natural
  // order via the per-group rule below.
  let baseRTL = false;
  outer: for (const it of visual) {
    for (const ch of it.text) {
      const c = ch.charCodeAt(0);
      if (c >= 0x0590 && c <= 0x07ff) { baseRTL = true; break outer; }
    }
  }

  // Resolve each item's effective direction. Strong items keep their own
  // class. For neutrals we use a position-based heuristic: attach to whichever
  // adjacent strong item is HORIZONTALLY closer in the visual layout. This
  // matches how brackets/quotes/periods are spatially placed in PDFs — they
  // sit immediately next to one strong run, so geometry is more reliable than
  // generic bidi rules.
  const raw: (StrongDir | 'neutral')[] = visual.map(it => itemDir(it.text));
  const resolved: StrongDir[] = raw.map((c, i) => {
    if (c !== 'neutral') return c;
    let prevIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (raw[j] !== 'neutral') { prevIdx = j; break; }
    }
    let nextIdx = -1;
    for (let j = i + 1; j < visual.length; j++) {
      if (raw[j] !== 'neutral') { nextIdx = j; break; }
    }
    if (prevIdx === -1 && nextIdx === -1) return baseRTL ? 'rtl' : 'ltr';
    if (prevIdx === -1) return raw[nextIdx] as StrongDir;
    if (nextIdx === -1) return raw[prevIdx] as StrongDir;
    if (raw[prevIdx] === raw[nextIdx]) return raw[prevIdx] as StrongDir;
    // Different-direction neighbors. Pick the spatially closer side.
    const me = visual[i];
    const prev = visual[prevIdx];
    const next = visual[nextIdx];
    const distPrev = me.x - (prev.x + prev.width);
    const distNext = next.x - (me.x + me.width);
    return distPrev <= distNext ? (raw[prevIdx] as StrongDir) : (raw[nextIdx] as StrongDir);
  });

  type Group = { items: TextItem[]; direction: StrongDir };
  const groups: Group[] = [];
  for (let i = 0; i < visual.length; i++) {
    const d = resolved[i];
    const tail = groups[groups.length - 1];
    if (tail && tail.direction === d) {
      tail.items.push(visual[i]);
    } else {
      groups.push({ items: [visual[i]], direction: d });
    }
  }

  const orderedGroups = baseRTL ? [...groups].reverse() : groups;
  const out: TextItem[] = [];
  for (const g of orderedGroups) {
    let groupItems: TextItem[];
    if (g.direction === 'rtl') {
      groupItems = [...g.items].reverse();
    } else if (baseRTL && isNumericLTRRun(g.items)) {
      // Numeric LTR runs (digits + periods only) inside an RTL paragraph are
      // often laid out with the period(s) to the LEFT of the digits (right-
      // aligned section numbering). Stream X-ascending would yield ".1" or
      // ".1.1"; reverse to recover the natural "1." or "1.1" form.
      groupItems = [...g.items].reverse();
    } else if (baseRTL && g.items.length >= 3
        && g.items[0].text === ':'
        && g.items[g.items.length - 1].text === '.') {
      // Bidi-flipped ".NET Core Backend:" — the leading "." of ".NET" and
      // the trailing ":" of "Backend:" end up swapped in visual X order.
      // Restore them to their natural positions and tighten the period so it
      // attaches directly to the next letter without a phantom space.
      const middle = g.items.slice(1, -1);
      const period = { ...g.items[g.items.length - 1] };
      const colon = { ...g.items[0] };
      // Force the period's X just before the first content letter and the
      // colon's X just after the last content letter so mergeLineText doesn't
      // insert spaces around them.
      if (middle.length > 0) {
        period.x = middle[0].x - period.width;
        colon.x = middle[middle.length - 1].x + middle[middle.length - 1].width;
      }
      groupItems = [period, ...middle, colon];
    } else {
      groupItems = g.items;
    }
    out.push(...groupItems);
  }
  return out;
}

function isNumericLTRRun(items: TextItem[]): boolean {
  let hasDigit = false;
  for (const it of items) {
    if (!/^[\d.]+$/.test(it.text)) return false;
    if (/\d/.test(it.text)) hasDigit = true;
  }
  return hasDigit;
}

function mergeLineText(items: TextItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].text;

  let result = items[0].text;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    // Visual gap between two items, regardless of which has higher X
    const gap = Math.max(prev.x, curr.x) - Math.min(prev.x + prev.width, curr.x + curr.width);
    const avgCharWidth = Math.max(prev.fontSize, curr.fontSize) * 0.4;
    if (gap > avgCharWidth * 0.3) result += ' ';
    result += curr.text;
  }

  return result;
}

// ── Block detection ──

function detectBlocks(lines: Line[], pageWidth: number): { blocks: ContentBlock[]; rightEdges: number[] } {
  const blocks: ContentBlock[] = [];
  // Parallel to `blocks`: first-line right-edge X for each paragraph; NaN for
  // any non-paragraph block. Used by the post-pass to spot bullet sequences
  // (consecutive single-line paragraphs sharing an indent).
  const paraRightEdges: number[] = [];
  let i = 0;

  const fontSizes = lines.map(l => l.fontSize).sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 12;

  while (i < lines.length) {
    const line = lines[i];

    // Skip noise lines
    if (isNoiseLine(line)) {
      i++;
      continue;
    }

    // Skip page header/footer lines
    if (isPageHeaderFooter(line, pageWidth)) {
      i++;
      continue;
    }

    // Try to detect a table starting at this line. If the detected table
    // actually begins a few lines later (e.g. it's preceded by a real section
    // heading), keep processing the lines above the table as normal blocks.
    const tableResult = tryDetectTable(lines, i, pageWidth);
    if (tableResult && tableResult.startIndex <= i) {
      blocks.push(tableResult.table);
      paraRightEdges.push(NaN);
      i = tableResult.endIndex;
      continue;
    }

    // Detect headers — and merge consecutive header lines into one header
    // when they share the same font size and are vertically adjacent (a long
    // title that wraps onto a second line).
    if (isHeader(line, medianFontSize, pageWidth)) {
      const level = getHeaderLevel(line, medianFontSize, pageWidth);
      const parts = [line.text.trim()];
      let prevHeaderLine = line;
      let j = i + 1;
      while (j < lines.length) {
        const candidate = lines[j];
        if (isNoiseLine(candidate) || isPageHeaderFooter(candidate, pageWidth)) { j++; continue; }
        if (!isHeader(candidate, medianFontSize, pageWidth)) break;
        if (Math.abs(candidate.fontSize - line.fontSize) > 0.5) break;
        if (getHeaderLevel(candidate, medianFontSize, pageWidth) !== level) break;
        const gap = candidate.y - prevHeaderLine.y;
        if (gap > prevHeaderLine.fontSize * 1.8) break;
        parts.push(candidate.text.trim());
        prevHeaderLine = candidate;
        j++;
      }
      blocks.push({
        type: 'header',
        level,
        text: parts.join(' '),
      });
      paraRightEdges.push(NaN);
      i = j;
      continue;
    }

    // Detect list items
    const listMatch = isListItem(line);
    if (listMatch) {
      // Build segments, stripping the marker from the text
      const segments = buildSegmentsStrippingPrefix(line, listMatch.textStart);
      i++;

      // Collect continuation lines
      while (i < lines.length) {
        const nextLine = lines[i];
        if (isNoiseLine(nextLine) || isPageHeaderFooter(nextLine, pageWidth)) { i++; continue; }
        if (isHeader(nextLine, medianFontSize, pageWidth)) break;
        if (isListItem(nextLine)) break;
        if (tryDetectTable(lines, i, pageWidth)) break;

        // Continuation: similar right-edge (indentation)
        const lineRightEdge = Math.max(...nextLine.items.map(it => it.x + it.width));
        const parentRightEdge = Math.max(...line.items.map(it => it.x + it.width));

        if (Math.abs(lineRightEdge - parentRightEdge) < line.fontSize * 4) {
          segments.push({ text: ' ', isBold: false, isItalic: false });
          segments.push(...buildSegments(nextLine));
          i++;
        } else {
          break;
        }
      }

      blocks.push({
        type: 'list-item',
        marker: listMatch.marker,
        segments,
      });
      paraRightEdges.push(NaN);
      continue;
    }

    // Regular paragraph
    const segments = buildSegments(line);
    const paraRightEdge = Math.max(...line.items.map(it => it.x + it.width));
    let prevLine = line;
    i++;

    // Collect continuation lines
    while (i < lines.length) {
      const nextLine = lines[i];
      if (isNoiseLine(nextLine) || isPageHeaderFooter(nextLine, pageWidth)) { i++; continue; }
      if (isHeader(nextLine, medianFontSize, pageWidth)) break;
      if (isListItem(nextLine)) break;
      if (tryDetectTable(lines, i, pageWidth)) break;

      // Don't absorb chapter/appendix lines into paragraphs (e.g. TOC entries)
      if (/^(פרק|נספח)\s+[א-ת]/.test(nextLine.text.trim())) break;

      // Vertical gap from PREVIOUS line. Normal in-paragraph line spacing is
      // ~1.2-1.4x fontSize; a gap of ~2x or more signals a paragraph break.
      const gap = nextLine.y - prevLine.y;
      if (gap > prevLine.fontSize * 1.9) break;

      // If both the current and next visual lines are SHORT (don't extend to
      // the left margin), they're likely separate metadata items like
      // "Label: value", not wrap continuations of one paragraph.
      const prevLeft = Math.min(...prevLine.items.map(it => it.x));
      const nextLeft = Math.min(...nextLine.items.map(it => it.x));
      const shortThreshold = pageWidth * 0.35;
      if (prevLeft > shortThreshold && nextLeft > shortThreshold) break;

      segments.push({ text: ' ', isBold: false, isItalic: false });
      segments.push(...buildSegments(nextLine));
      prevLine = nextLine;
      i++;
    }

    // Skip paragraphs that are just noise
    const fullText = segments.map(s => s.text).join('').trim();
    if (fullText.length > 1) {
      blocks.push({ type: 'paragraph', segments });
      paraRightEdges.push(paraRightEdge);
    }
  }

  return { blocks, rightEdges: paraRightEdges };
}

/**
 * Bold the "Label:" prefix of paragraph/list-item blocks that begin with a
 * label-value pattern (e.g. "Worker Pods: namespace ייעודי..."). Matches the
 * convention used in the skill output and in the source PDFs.
 */
function boldifyLabels(block: ContentBlock): ContentBlock {
  if (block.type !== 'paragraph' && block.type !== 'list-item') return block;
  const segments = (block as { segments: TextSegment[] }).segments;
  if (!segments || segments.length === 0) return block;

  // Skip placeholder lines (decision-template fields with "Label: ___" form).
  // The skill renders them inside fenced code blocks, where bold is irrelevant.
  const fullText = segments.map(s => s.text).join('');
  if (/_{5,}/.test(fullText)) return block;

  const first = segments[0];
  // Strip a leading "- " / "– " / "* " artifact that some PDF bullets
  // emit as a literal dash before the actual content.
  const stripped = first.text.replace(/^[-–•*]\s+/, '');

  // Three patterns:
  //   1. "Label: rest"     — normal case
  //   2. "Label:"          — label-only (e.g. "שאלות לדיון:" introducing a list)
  //   3. ":Label rest"     — bidi-flipped form, when the colon ended up to the
  //      LEFT of an embedded LTR label inside an RTL paragraph.
  let label: string;
  let rest: string;
  const normal = stripped.match(/^([\S][^:\n]{0,40}):(?:\s+(.*))?$/);
  const flipped = !normal ? stripped.match(/^:([A-Za-z0-9][^֐-߿:\n]{0,40})\s+(.*)$/) : null;

  if (normal) {
    label = normal[1].trim();
    rest = normal[2] ?? '';
  } else if (flipped) {
    label = flipped[1].trim();
    rest = flipped[2];
  } else {
    return block;
  }

  if (label.length < 2 || label.length > 40) return block;
  if (/^https?$/i.test(label)) return block;
  // Avoid labelling lines that are just "1." / "2.1" headings.
  if (/^\d+(\.\d+){0,3}$/.test(label)) return block;

  const newSegments: TextSegment[] = [
    { text: `${label}:`, isBold: true, isItalic: first.isItalic },
  ];
  if (rest.length > 0) {
    newSegments.push({ text: ` ${rest}`, isBold: false, isItalic: first.isItalic });
  } else {
    newSegments.push({ text: ' ', isBold: false, isItalic: first.isItalic });
  }
  for (let k = 1; k < segments.length; k++) newSegments.push(segments[k]);

  if (block.type === 'paragraph') {
    return { type: 'paragraph', segments: newSegments };
  }
  return {
    type: 'list-item',
    marker: (block as { marker: string }).marker,
    segments: newSegments,
  };
}

/**
 * Post-pass: detect "implicit" bullet sequences — runs of 2+ consecutive
 * paragraph blocks whose first lines share a common right-edge X (within a
 * small tolerance) and whose right-edge is meaningfully less than the
 * surrounding non-bullet content. Such runs are visually indented from the
 * right margin and read as bullets in Hebrew docs that don't print a marker.
 */
function convertBulletRuns(blocks: ContentBlock[], rightEdges: number[]): ContentBlock[] {
  // Establish the document's main right margin from the maximum paragraph
  // right-edge. Real bulleted items in RTL docs sit visibly indented from
  // that margin (by ~20 units in this PDF); body/metadata lines extend all
  // the way to the margin. Requiring an actual indent prevents bolded
  // front-matter ("**נושא:** ...", "**גישה מאושרת:** ...") from being
  // mis-clustered into a list with the real bullets that follow.
  let mainRightEdge = 0;
  for (const e of rightEdges) {
    if (!Number.isNaN(e) && e > mainRightEdge) mainRightEdge = e;
  }
  const minIndent = 6; // pts; pages set the bullet indent at >=10 in practice

  // Bullet runs that appear BEFORE the first sub-H1 header are top-of-doc
  // front-matter; keep as paragraphs.
  let seenSubH1Header = false;
  const out: ContentBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const cur = blocks[i];
    if (cur.type === 'header' && cur.level >= 2) seenSubH1Header = true;
    if (cur.type !== 'paragraph' || Number.isNaN(rightEdges[i])) {
      out.push(cur);
      i++;
      continue;
    }
    const refEdge = rightEdges[i];
    const indented = mainRightEdge - refEdge >= minIndent;
    const tolerance = 4;
    let j = i + 1;
    while (
      j < blocks.length
      && blocks[j].type === 'paragraph'
      && !Number.isNaN(rightEdges[j])
      && Math.abs(rightEdges[j] - refEdge) <= tolerance
    ) {
      j++;
    }
    const runLen = j - i;
    // Reject the run if every paragraph in it looks like a decision-template
    // placeholder (e.g. "תאריך החלטה: _______________"). Those belong inside a
    // code block, not a bulleted list.
    const allPlaceholder = (() => {
      for (let k = i; k < j; k++) {
        const para = blocks[k] as ParagraphBlock;
        const text = para.segments.map(s => s.text).join('');
        if (!/_{5,}|:\s*$/.test(text)) return false;
      }
      return true;
    })();
    if (runLen >= 2 && seenSubH1Header && indented && !allPlaceholder) {
      for (let k = i; k < j; k++) {
        const para = blocks[k] as ParagraphBlock;
        out.push({ type: 'list-item', marker: '-', segments: para.segments });
      }
      i = j;
    } else {
      out.push(cur);
      i++;
    }
  }
  return out;
}

// ── Table detection ──

interface TableResult {
  table: ContentBlock;
  startIndex: number;
  endIndex: number;
}

function tryDetectTable(lines: Line[], startIdx: number, pageWidth: number): TableResult | null {
  if (startIdx >= lines.length) return null;

  // Look ahead in a window to find lines with multi-column structure
  const windowSize = Math.min(25, lines.length - startIdx);
  const columnAnalysis: { line: Line; columns: TextColumn[]; idx: number }[] = [];

  for (let j = startIdx; j < startIdx + windowSize; j++) {
    const line = lines[j];
    if (isNoiseLine(line) || isPageHeaderFooter(line, pageWidth)) continue;

    const columns = detectColumns(line, pageWidth);
    if (columns.length >= 2) {
      columnAnalysis.push({ line, columns, idx: j });
    }
  }

  if (columnAnalysis.length < 2) return null;

  // Find the best column pattern — prefer highest column count with >= 2 consistent rows.
  const colCountGroups = new Map<number, typeof columnAnalysis>();
  for (const analysis of columnAnalysis) {
    const count = analysis.columns.length;
    if (!colCountGroups.has(count)) colCountGroups.set(count, []);
    colCountGroups.get(count)!.push(analysis);
  }

  let consistentRows: typeof columnAnalysis = [];
  const sortedCounts = [...colCountGroups.keys()].sort((a, b) => b - a);
  for (const count of sortedCounts) {
    const group = colCountGroups.get(count)!;
    if (group.length < 2) continue;

    let bestConsistent: typeof columnAnalysis = [];
    for (let k = 0; k < Math.min(group.length, 5); k++) {
      const refCols = group[k].columns;
      const consistent = group.filter(a => columnsMatch(refCols, a.columns, pageWidth));
      if (consistent.length > bestConsistent.length) {
        bestConsistent = consistent;
      }
    }
    if (bestConsistent.length < 2) continue;

    // Check proximity: the first matching line must be close to startIdx.
    const firstIdx = bestConsistent[0].idx;
    let nonNoiseBefore = 0;
    for (let j = startIdx; j < firstIdx; j++) {
      if (!isNoiseLine(lines[j]) && !isPageHeaderFooter(lines[j], pageWidth)) {
        nonNoiseBefore++;
      }
    }
    if (nonNoiseBefore > 2) continue;

    consistentRows = bestConsistent;
    break;
  }

  if (consistentRows.length < 2) return null;

  // Reject false positives: if any column spans > 55% of page width, this is likely
  // a numbered paragraph not a table
  const colBoundaries = computeColumnBoundaries(consistentRows);
  for (const boundary of colBoundaries) {
    const colWidth = boundary.xStart - boundary.xEnd;
    if (colWidth > pageWidth * 0.55) {
      return null;
    }
  }

  // Also reject if any column is extremely narrow (< 2% of page width) and there are only 2 columns
  if (colBoundaries.length === 2) {
    for (const boundary of colBoundaries) {
      const colWidth = boundary.xStart - boundary.xEnd;
      if (colWidth < pageWidth * 0.02) {
        return null;
      }
    }
  }

  const firstMatchIdx = consistentRows[0].idx;
  const lastMatchIdx = consistentRows[consistentRows.length - 1].idx;

  // Look backwards from the first match for a header row.
  const tableXMax = Math.max(...colBoundaries.map(b => b.xStart));
  const tableXMin = Math.min(...colBoundaries.map(b => b.xEnd));

  // Look at the median font size of the table rows to decide what counts as
  // a real section heading vs an extension of the table header.
  const tableFontSizes = consistentRows.map(a => a.line.fontSize).sort((a, b) => a - b);
  const tableMedianFont = tableFontSizes[Math.floor(tableFontSizes.length / 2)] || 12;

  let headerStartIdx = firstMatchIdx;
  for (let j = firstMatchIdx - 1; j >= Math.max(startIdx, firstMatchIdx - 3); j--) {
    const line = lines[j];
    if (isNoiseLine(line) || isPageHeaderFooter(line, pageWidth)) continue;

    // Don't absorb a real section heading — numbered patterns ("3.3 ...",
    // "5.1 ...") or visibly larger font lines belong above the table, not in it.
    if (isHeader(line, tableMedianFont, pageWidth)) break;

    const cols = detectColumns(line, pageWidth);
    if (cols.length >= 2 && cols.length < colBoundaries.length
        && columnsAlignWithBoundaries(cols, colBoundaries, pageWidth)) {
      headerStartIdx = j;
      break;
    }

    if (line.items.length <= 10 && line.text.length < 80) {
      const itemsInSpan = line.items.filter(item => {
        const mid = item.x + item.width / 2;
        return mid >= tableXMin - 10 && mid <= tableXMax + 10;
      });
      if (itemsInSpan.length > 0) {
        headerStartIdx = j;
        continue;
      }
    }
    break;
  }

  // Collect all lines from header start to last match
  const tableLines: Line[] = [];
  for (let j = headerStartIdx; j <= lastMatchIdx; j++) {
    const line = lines[j];
    if (isNoiseLine(line) || isPageHeaderFooter(line, pageWidth)) continue;
    tableLines.push(line);
  }

  // Look for trailing continuation lines after the last multi-col match
  let endIdx = lastMatchIdx + 1;
  let trailingContinuations = 0;
  const maxTrailingContinuations = 12;

  for (let j = lastMatchIdx + 1; j < lines.length; j++) {
    const line = lines[j];
    if (isNoiseLine(line) || isPageHeaderFooter(line, pageWidth)) continue;

    const cols = detectColumns(line, pageWidth);
    if (cols.length >= 2) {
      if (cols.length <= colBoundaries.length && columnsAlignWithBoundaries(cols, colBoundaries, pageWidth)) {
        tableLines.push(line);
        endIdx = j + 1;
        continue;
      }
      if (cols.length === colBoundaries.length && isCellContinuation(line, colBoundaries, pageWidth)) {
        tableLines.push(line);
        endIdx = j + 1;
        trailingContinuations++;
        continue;
      }
      break;
    }

    if (trailingContinuations < maxTrailingContinuations && isCellContinuation(line, colBoundaries, pageWidth)) {
      tableLines.push(line);
      endIdx = j + 1;
      trailingContinuations++;
    } else {
      break;
    }
  }

  if (tableLines.length < 2) return null;

  const { headers, rows } = extractTableData(tableLines, colBoundaries);

  // Reject tables that ended up with no data rows
  if (rows.length === 0 && headers.length > 0) {
    const totalHeaderLen = headers.reduce((s, h) => s + h.length, 0);
    if (totalHeaderLen > 200) return null;
  }

  // Reject 2-column "tables" with very long cell text — these are typically
  // 2-column page layouts, not actual tables.
  if (colBoundaries.length === 2 && rows.length > 0) {
    const totalRowText = rows.reduce((sum, row) =>
      sum + row.reduce((s, cell) => s + cell.length, 0), 0);
    const avgRowText = totalRowText / rows.length;
    const threshold = rows.length > 6 ? 70 : 200;
    if (avgRowText > threshold) return null;
  }

  repairTocTable(rows);

  return {
    table: { type: 'table', headers, rows },
    startIndex: headerStartIdx,
    endIndex: endIdx,
  };
}

/**
 * Detect and repair TOC tables where OCR missed chapter prefixes or Hebrew letters.
 */
function repairTocTable(rows: string[][]): void {
  if (rows.length < 3) return;
  const hebrewLetters = 'אבגדהוזחטיכלמנסעפצקרשת';

  const firstCols = rows.map(r => r[0]?.trim() ?? '');
  const perekCount = firstCols.filter(c => c.includes('פרק')).length;
  if (perekCount < rows.length * 0.4) return;

  const letterPattern = /^פרק\s+([א-ת])/;
  const letterOnlyPattern = /^([א-ת])['׳"]/;

  const knownLetters: { idx: number; letter: string }[] = [];
  for (let i = 0; i < firstCols.length; i++) {
    let m = firstCols[i].match(letterPattern);
    if (m) {
      knownLetters.push({ idx: i, letter: m[1] });
      continue;
    }
    m = firstCols[i].match(letterOnlyPattern);
    if (m) {
      knownLetters.push({ idx: i, letter: m[1] });
    }
  }

  if (knownLetters.length < 2) return;

  const firstKnown = knownLetters[0];
  const startLetterIdx = hebrewLetters.indexOf(firstKnown.letter) - firstKnown.idx;
  if (startLetterIdx < 0) return;

  for (let i = 0; i < firstCols.length; i++) {
    const expectedLetterIdx = startLetterIdx + i;
    if (expectedLetterIdx >= hebrewLetters.length) break;
    const cell = firstCols[i];

    if (letterOnlyPattern.test(cell) && !cell.includes('פרק')) {
      rows[i][0] = 'פרק ' + cell;
    } else if (/^פרק\s*$/.test(cell)) {
      const expectedLetter = hebrewLetters[expectedLetterIdx];
      rows[i][0] = "פרק " + expectedLetter + "'";
    }
  }
}

interface TextColumn {
  xStart: number; // right edge (RTL)
  xEnd: number;   // left edge (RTL)
  text: string;
}

function detectColumns(line: Line, pageWidth: number): TextColumn[] {
  if (line.items.length < 2) return [];

  // Filter out pipe characters — OCR artifacts of table vertical borders
  const nonPipeItems = line.items.filter(item => !/^\|+$/.test(item.text.trim()));
  if (nonPipeItems.length < 2) return [];

  const sorted = [...nonPipeItems].sort((a, b) => b.x - a.x);

  const gaps: { index: number; gap: number }[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const gap = prev.x - (curr.x + curr.width);
    if (gap > 0) {
      gaps.push({ index: i, gap });
    }
  }

  if (gaps.length === 0) return [];

  const sortedGaps = [...gaps].sort((a, b) => b.gap - a.gap);
  const minColumnGap = Math.max(pageWidth * 0.028, 14);

  const significantGapIndices: number[] = [];
  for (const g of sortedGaps) {
    if (g.gap >= minColumnGap) {
      significantGapIndices.push(g.index);
    }
  }

  if (significantGapIndices.length === 0) return [];

  significantGapIndices.sort((a, b) => a - b);

  const columns: TextColumn[] = [];
  let startColumnIdx = 0;

  for (const gapIdx of significantGapIndices) {
    const colItems = sorted.slice(startColumnIdx, gapIdx);
    if (colItems.length > 0) {
      columns.push(buildColumn(colItems));
    }
    startColumnIdx = gapIdx;
  }

  const lastItems = sorted.slice(startColumnIdx);
  if (lastItems.length > 0) {
    columns.push(buildColumn(lastItems));
  }

  return columns;
}

function buildColumn(items: TextItem[]): TextColumn {
  const xStart = Math.max(...items.map(i => i.x + i.width));
  const xEnd = Math.min(...items.map(i => i.x));
  const text = items.map(i => i.text).join(' ');
  return { xStart, xEnd, text };
}

function columnsMatch(cols1: TextColumn[], cols2: TextColumn[], pageWidth: number): boolean {
  if (cols1.length !== cols2.length) return false;

  const tolerance = pageWidth * 0.06;
  for (let i = 0; i < cols1.length; i++) {
    const mid1 = (cols1[i].xStart + cols1[i].xEnd) / 2;
    const mid2 = (cols2[i].xStart + cols2[i].xEnd) / 2;
    if (Math.abs(mid1 - mid2) > tolerance) return false;
  }
  return true;
}

interface ColumnBoundary {
  xStart: number;
  xEnd: number;
}

function computeColumnBoundaries(analyses: { columns: TextColumn[] }[]): ColumnBoundary[] {
  if (analyses.length === 0) return [];

  const numCols = analyses[0].columns.length;
  const boundaries: ColumnBoundary[] = [];

  for (let c = 0; c < numCols; c++) {
    const starts = analyses.map(a => a.columns[c].xStart);
    const ends = analyses.map(a => a.columns[c].xEnd);
    boundaries.push({
      xStart: Math.max(...starts),
      xEnd: Math.min(...ends),
    });
  }

  return boundaries;
}

function isCellContinuation(line: Line, colBoundaries: ColumnBoundary[], _pageWidth: number): boolean {
  if (colBoundaries.length === 0) return false;

  const items = line.items.filter(item => !/^\|+$/.test(item.text.trim()));
  if (items.length === 0) return false;

  for (const item of items) {
    let withinColumn = false;
    for (const boundary of colBoundaries) {
      const colWidth = boundary.xStart - boundary.xEnd;
      const margin = colWidth * 0.3;
      if (item.x >= boundary.xEnd - margin && item.x + item.width <= boundary.xStart + margin) {
        withinColumn = true;
        break;
      }
    }
    if (!withinColumn) return false;
  }
  return true;
}

function columnsAlignWithBoundaries(
  cols: TextColumn[],
  colBoundaries: ColumnBoundary[],
  pageWidth: number,
): boolean {
  const tolerance = pageWidth * 0.06;
  for (const col of cols) {
    const colMid = (col.xStart + col.xEnd) / 2;
    const matchesBoundary = colBoundaries.some(b => {
      const bMid = (b.xStart + b.xEnd) / 2;
      return Math.abs(colMid - bMid) < tolerance;
    });
    if (!matchesBoundary) return false;
  }
  return true;
}

function extractTableData(
  tableLines: Line[],
  colBoundaries: ColumnBoundary[],
): { headers: string[]; rows: string[][] } {
  if (colBoundaries.length === 0 || tableLines.length === 0) {
    return { headers: [], rows: [] };
  }

  const rawRows: { cells: string[]; y: number }[] = [];

  for (const line of tableLines) {
    // Bucket each text item into its column by horizontal midpoint, then run
    // `reorderToLogical` per cell so embedded LTR (e.g. "WebHook", "OAuth2")
    // stays in reading order instead of getting reversed by an X-descending sort.
    const cellItems: TextItem[][] = Array.from({ length: colBoundaries.length }, () => []);

    const filtered = line.items.filter(item => !/^\|+$/.test(item.text.trim()));
    for (const item of filtered) {
      const itemMid = item.x + item.width / 2;
      let bestCol = 0;
      let bestDist = Infinity;
      for (let c = 0; c < colBoundaries.length; c++) {
        const { xStart, xEnd } = colBoundaries[c];
        if (itemMid >= xEnd && itemMid <= xStart) {
          bestCol = c;
          bestDist = 0;
          break;
        }
        const distToEdge = Math.min(
          Math.abs(itemMid - xStart),
          Math.abs(itemMid - xEnd),
        );
        if (distToEdge < bestDist) {
          bestDist = distToEdge;
          bestCol = c;
        }
      }
      cellItems[bestCol].push(item);
    }

    const cells = cellItems.map(items => mergeLineText(reorderToLogical(items)));
    rawRows.push({ cells, y: line.y });
  }

  // Compute Y-gaps and determine row separation strategy
  const yGaps: number[] = [];
  for (let i = 1; i < rawRows.length; i++) {
    yGaps.push(rawRows[i].y - rawRows[i - 1].y);
  }
  const sortedYGaps = [...yGaps].sort((a, b) => a - b);
  const medianYGap = sortedYGaps.length > 0
    ? sortedYGaps[Math.floor(sortedYGaps.length / 2)]
    : 20;
  const maxYGap = yGaps.length > 0 ? Math.max(...yGaps) : 0;

  const hasRowSeparators = medianYGap > 0 && maxYGap > medianYGap * 1.3;
  const rowBoundaryGap = medianYGap * 1.4;

  // Merge lines into logical rows
  const mergedRows: string[][] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const nonEmptyCells = row.cells.filter(c => c.trim()).length;

    if (mergedRows.length === 0) {
      mergedRows.push(row.cells.map(c => c.trim()));
      continue;
    }

    if (nonEmptyCells === 0) continue;

    if (mergedRows.length === 1 && i === 1) {
      mergedRows.push(row.cells.map(c => c.trim()));
      continue;
    }

    const yGap = rawRows[i].y - rawRows[i - 1].y;
    let isNewRow: boolean;

    if (hasRowSeparators) {
      isNewRow = yGap > rowBoundaryGap;
    } else {
      if (nonEmptyCells >= colBoundaries.length) {
        isNewRow = true;
      } else {
        isNewRow = false;
      }
    }

    if (isNewRow) {
      mergedRows.push(row.cells.map(c => c.trim()));
    } else {
      const prevRow = mergedRows[mergedRows.length - 1];
      for (let c = 0; c < row.cells.length; c++) {
        const cellText = row.cells[c].trim();
        if (cellText) {
          prevRow[c] = prevRow[c].trim()
            ? prevRow[c].trim() + ' ' + cellText
            : cellText;
        }
      }
    }
  }

  // Clean up cell text
  for (const row of mergedRows) {
    for (let c = 0; c < row.length; c++) {
      row[c] = row[c].replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // Auto-fill sequential numbers in the first column when OCR missed a digit
  if (mergedRows.length >= 3) {
    const col0Values = mergedRows.map(r => r[0].trim());
    const nums = col0Values.map(v => /^\d+$/.test(v) ? parseInt(v, 10) : null);

    const numCount = nums.filter(n => n !== null).length;
    const emptyCount = nums.filter((n, i) => n === null && col0Values[i] === '').length;

    if (numCount >= 2 && emptyCount >= 1 && emptyCount <= 2) {
      const nonNull = nums.map((n, i) => ({ n, i })).filter(x => x.n !== null) as { n: number; i: number }[];
      const isSequential = nonNull.every((x, idx) => {
        if (idx === 0) return true;
        return x.n! - nonNull[idx - 1].n! >= 1 && x.n! - nonNull[idx - 1].n! <= 2;
      });

      if (isSequential && nonNull.length >= 2) {
        for (let i = 0; i < mergedRows.length; i++) {
          if (nums[i] === null && col0Values[i] === '') {
            const prev = nums.slice(0, i).reverse().find(n => n !== null);
            const next = nums.slice(i + 1).find(n => n !== null);
            if (prev !== undefined && prev !== null && prev + 1 >= 1) {
              mergedRows[i][0] = String(prev + 1);
            } else if (next !== undefined && next !== null && next - 1 >= 1) {
              mergedRows[i][0] = String(next - 1);
            }
          }
        }
      }
    }
  }

  // Determine header vs data rows
  if (mergedRows.length >= 2) {
    const firstStr = mergedRows[0][0].trim();
    const secondStr = mergedRows[1][0].trim();
    if (/^\d+$/.test(firstStr) && /^\d+$/.test(secondStr)) {
      const first = parseInt(firstStr, 10);
      const second = parseInt(secondStr, 10);
      if (second === first + 1 && first >= 1) {
        return { headers: new Array(colBoundaries.length).fill(''), rows: mergedRows };
      }
    }
  }

  const headers = mergedRows.length > 0 ? mergedRows[0] : [];
  const rows = mergedRows.slice(1);

  return { headers, rows };
}

// ── Header detection ──

function isHeader(line: Line, medianFontSize: number, _pageWidth: number): boolean {
  const text = line.text.trim();
  if (text.length === 0) return false;
  if (text.length > 100) return false;

  // Significantly larger font is a header even without bold
  if (line.fontSize >= medianFontSize * 1.2) return true;

  // Bold and larger font
  if (line.fontSize > medianFontSize * 1.15 && line.isBold) return true;

  // Bold and short
  if (line.isBold && text.length < 60 && !isListItem(line)) return true;

  // Numbered section pattern: "1." / "1.1" / "2.1.1" followed by title text.
  // Either there's a trailing dot ("1.") or at least one inner dot ("1.1"),
  // so we don't accidentally match a bare leading integer in body content.
  if (/^(\d+\.|\d+(?:\.\d+)+)\s+\S/.test(text) && text.length < 80) return true;

  // Reject TOC entries
  if (/^(פרק|נספח)\s+[א-ת]/.test(text) && /\s\d{1,3}\s*$/.test(text)) {
    return false;
  }

  // Known Hebrew header patterns
  const headerPatterns = [
    /^פרק\s+[א-ת]/,
    /^נספח\s+[א-ת][\s']*[-–]?\s/,
    /^מבוא$/,
    /^הגדרות$/,
    /^תחולה$/,
    /^תחילה$/,
    /^כללי$/,
    /^דברי הסבר$/,
    /^עדכון הקובץ$/,
    /^עדכונים$/,
    /^תיקונים עיק/,
    /^פירוט הסעיפים$/,
    /^דירקטוריון$/,
    /^הנהלה בכירה$/,
    /^סגירת משרדים$/,
    /^תוכן.{0,3}ענ/,
  ];

  for (const pattern of headerPatterns) {
    if (pattern.test(text)) return true;
  }

  if (/הנדון\s*:/.test(text)) return true;
  if (/^סעיף\s+\d+\s*[-–]/.test(text) && text.length < 80) return true;

  return false;
}

function getHeaderLevel(line: Line, medianFontSize: number, _pageWidth: number): 1 | 2 | 3 | 4 {
  const text = line.text.trim();

  // The title-page heading is the only thing in a sharply larger font.
  if (line.fontSize > medianFontSize * 1.8) return 1;

  // Numbered-section hierarchy: depth of the leading "N.N.N" prefix.
  //   "1.    X"  → ## (H2)
  //   "1.1   X"  → ### (H3)
  //   "1.1.1 X"  → #### (H4)
  const numMatch = text.match(/^(\d+(?:\.\d+){0,3})[.\s]+\S/);
  if (numMatch) {
    const depth = numMatch[1].split('.').length;
    if (depth === 1) return 2;
    if (depth === 2) return 3;
    return 4;
  }

  if (/^פרק\s+[א-ת]/.test(text)) return 2;
  if (/^נספח\s+[א-ת]/.test(text)) return 2;

  if (/^(דברי הסבר|כללי|מבוא|הגדרות|תחולה|תחילה|עדכונים|עדכון הקובץ|דירקטוריון|הנהלה בכירה|סגירת משרדים)$/.test(text)) return 3;

  if (line.isBold && text.length < 40) return 3;
  if (line.fontSize > medianFontSize * 1.15) return 2;
  return 3;
}

// ── List item detection ──

interface ListMatch {
  marker: string;
  textStart: number;
}

function isListItem(line: Line): ListMatch | null {
  const text = line.text.trim();

  const numberedMatch = text.match(/^(\d{1,3})\.\s/);
  if (numberedMatch) {
    return { marker: numberedMatch[1] + '.', textStart: numberedMatch[0].length };
  }

  const numberedSpaceMatch = text.match(/^(\d{1,3})\s+\.\s/);
  if (numberedSpaceMatch) {
    return { marker: numberedSpaceMatch[1] + '.', textStart: numberedSpaceMatch[0].length };
  }

  const hebrewParenMatch = text.match(/^\(([א-ת])\)\s/);
  if (hebrewParenMatch) {
    return { marker: '(' + hebrewParenMatch[1] + ')', textStart: hebrewParenMatch[0].length };
  }

  const hebrewDotMatch = text.match(/^([א-ת])\.\s/);
  if (hebrewDotMatch) {
    return { marker: hebrewDotMatch[1] + '.', textStart: hebrewDotMatch[0].length };
  }

  return null;
}

// ── Noise detection ──

function isNoiseLine(line: Line): boolean {
  const text = line.text.trim();
  if (!text) return true;
  if (text.length === 1 && /[-–—.*·•]/.test(text)) return true;
  if (/^\d{1,3}$/.test(text)) return true;
  return false;
}

function isPageHeaderFooter(line: Line, _pageWidth: number): boolean {
  const text = line.text.trim();

  if (/עמ['"]?\s*\d/.test(text) && text.length < 40) return true;
  if (/^המפקח על הבנקים/.test(text) && text.length < 60) return true;
  if (/^ניהול בנקאי תקין/.test(text) && text.length < 40) return true;
  if (/^ניהול מערך שירות ותמיכה ללקוחות/.test(text) && text.length < 50) return true;
  if (/^מתן מענה טלפוני אנושי מקצועי/.test(text) && text.length < 50) return true;
  if (/^ימי פתיחה של משרדי/.test(text) && text.length < 50) return true;

  if (/^\d+\s*[-–]\s*\d+$/.test(text)) return true;
  if (/^עמי?\s*\d/.test(text) && text.length < 30) return true;

  return false;
}

// ── Segment building ──

function buildSegments(line: Line): TextSegment[] {
  return buildSegmentsFromItems(line.items);
}

function buildSegmentsStrippingPrefix(line: Line, prefixLen: number): TextSegment[] {
  const fullText = line.text;
  const strippedText = fullText.substring(prefixLen).trim();

  if (line.items.every(i => i.isBold === line.items[0].isBold)) {
    return [{
      text: strippedText,
      isBold: line.items[0]?.isBold ?? false,
      isItalic: line.items[0]?.isItalic ?? false,
    }];
  }

  const segments = buildSegmentsFromItems(line.items);
  return stripPrefixFromSegments(segments, prefixLen);
}

function buildSegmentsFromItems(items: TextItem[]): TextSegment[] {
  if (items.length === 0) return [];

  const segments: TextSegment[] = [];
  const ordered = reorderToLogical(items);

  let currentText = '';
  let currentBold = ordered[0].isBold;
  let currentItalic = ordered[0].isItalic;

  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];

    if (item.isBold !== currentBold || item.isItalic !== currentItalic) {
      if (currentText) {
        segments.push({ text: currentText, isBold: currentBold, isItalic: currentItalic });
      }
      currentText = '';
      currentBold = item.isBold;
      currentItalic = item.isItalic;
    }

    if (i > 0) {
      const prev = ordered[i - 1];
      const gap = Math.max(prev.x, item.x) - Math.min(prev.x + prev.width, item.x + item.width);
      const avgCharWidth = Math.max(prev.fontSize, item.fontSize) * 0.4;
      if (gap > avgCharWidth * 0.3) {
        currentText += ' ';
      }
    }

    currentText += item.text;
  }

  if (currentText) {
    segments.push({ text: currentText, isBold: currentBold, isItalic: currentItalic });
  }

  return segments;
}

function stripPrefixFromSegments(segments: TextSegment[], prefixLen: number): TextSegment[] {
  let remaining = prefixLen;
  const result: TextSegment[] = [];

  for (const seg of segments) {
    if (remaining <= 0) {
      result.push(seg);
    } else if (remaining >= seg.text.length) {
      remaining -= seg.text.length;
    } else {
      result.push({
        text: seg.text.substring(remaining).trimStart(),
        isBold: seg.isBold,
        isItalic: seg.isItalic,
      });
      remaining = 0;
    }
  }

  return result;
}
