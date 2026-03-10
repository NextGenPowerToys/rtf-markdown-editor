import type { TextItem, ImageItem, PageData, Line, ContentBlock, TextSegment } from './types';
import { mergeSplitTables } from './tableMerger';

/**
 * Analyze positioned text items and detect document structure:
 * headers, paragraphs, tables, lists, images.
 */
export function analyzePages(pages: PageData[]): ContentBlock[] {
  const allBlocks: ContentBlock[] = [];

  for (const page of pages) {
    if (page.pageNumber > 1) {
      allBlocks.push({ type: 'page-break', pageNumber: page.pageNumber });
    }

    // Filter noise items before analysis
    const filteredItems = filterNoise(page.items);
    const lines = groupIntoLines(filteredItems, page.width);
    const textBlocks = detectBlocks(lines, page.width);

    // Interleave images with text blocks based on Y position
    if (page.images && page.images.length > 0) {
      allBlocks.push(...interleaveImages(textBlocks, page.images));
    } else {
      allBlocks.push(...textBlocks);
    }
  }

  return mergeSplitTables(allBlocks);
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
  // Sort items right-to-left (RTL) by X position descending
  const sorted = [...items].sort((a, b) => b.x - a.x);
  const avgFontSize = sorted.reduce((s, i) => s + i.fontSize, 0) / sorted.length;
  const avgY = sorted.reduce((s, i) => s + i.y, 0) / sorted.length;
  const allBold = sorted.every(i => i.isBold);

  const text = mergeLineText(sorted);

  return {
    y: avgY,
    items: sorted,
    fontSize: avgFontSize,
    isBold: allBold,
    text,
  };
}

function mergeLineText(items: TextItem[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0].text;

  let result = items[0].text;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    const gap = prev.x - (curr.x + curr.width);
    const avgCharWidth = prev.fontSize * 0.4;

    if (gap > avgCharWidth * 0.3) {
      result += ' ';
    }
    result += curr.text;
  }

  return result;
}

// ── Block detection ──

function detectBlocks(lines: Line[], pageWidth: number): ContentBlock[] {
  const blocks: ContentBlock[] = [];
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

    // Try to detect a table starting at this line
    const tableResult = tryDetectTable(lines, i, pageWidth);
    if (tableResult) {
      blocks.push(tableResult.table);
      i = tableResult.endIndex;
      continue;
    }

    // Detect headers
    if (isHeader(line, medianFontSize, pageWidth)) {
      const level = getHeaderLevel(line, medianFontSize, pageWidth);
      blocks.push({
        type: 'header',
        level,
        text: line.text.trim(),
      });
      i++;
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
      continue;
    }

    // Regular paragraph
    const segments = buildSegments(line);
    const startLine = line;
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

      // Check vertical gap
      const gap = nextLine.y - startLine.y;
      if (gap > startLine.fontSize * 3) break;

      segments.push({ text: ' ', isBold: false, isItalic: false });
      segments.push(...buildSegments(nextLine));
      i++;
    }

    // Skip paragraphs that are just noise
    const fullText = segments.map(s => s.text).join('').trim();
    if (fullText.length > 1) {
      blocks.push({ type: 'paragraph', segments });
    }
  }

  return blocks;
}

// ── Table detection ──

interface TableResult {
  table: ContentBlock;
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

  let headerStartIdx = firstMatchIdx;
  for (let j = firstMatchIdx - 1; j >= Math.max(startIdx, firstMatchIdx - 3); j--) {
    const line = lines[j];
    if (isNoiseLine(line) || isPageHeaderFooter(line, pageWidth)) continue;

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
    const cells: string[] = new Array(colBoundaries.length).fill('');

    const sortedItems = [...line.items]
      .filter(item => !/^\|+$/.test(item.text.trim()))
      .sort((a, b) => b.x - a.x);

    for (const item of sortedItems) {
      let bestCol = 0;
      let bestDist = Infinity;
      const itemMid = item.x + item.width / 2;

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

      if (cells[bestCol]) {
        cells[bestCol] += ' ' + item.text;
      } else {
        cells[bestCol] = item.text;
      }
    }

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

  // Bold and larger font
  if (line.fontSize > medianFontSize * 1.15 && line.isBold) return true;

  // Bold and short
  if (line.isBold && text.length < 60 && !isListItem(line)) return true;

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

function getHeaderLevel(line: Line, medianFontSize: number, _pageWidth: number): 1 | 2 | 3 {
  const text = line.text.trim();

  if (line.fontSize > medianFontSize * 1.4) return 1;

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
  const sorted = [...items].sort((a, b) => b.x - a.x);

  let currentText = '';
  let currentBold = sorted[0].isBold;
  let currentItalic = sorted[0].isItalic;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];

    if (item.isBold !== currentBold || item.isItalic !== currentItalic) {
      if (currentText) {
        segments.push({ text: currentText, isBold: currentBold, isItalic: currentItalic });
      }
      currentText = '';
      currentBold = item.isBold;
      currentItalic = item.isItalic;
    }

    if (i > 0) {
      const prev = sorted[i - 1];
      const gap = prev.x - (item.x + item.width);
      const avgCharWidth = item.fontSize * 0.4;
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
