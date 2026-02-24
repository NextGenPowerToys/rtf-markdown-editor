/**
 * PDF Table Detector
 *
 * Detects table structures from OCR-extracted text with position data (bounding boxes).
 * Uses column alignment analysis to identify table regions and extract cell data.
 *
 * Algorithm:
 * 1. For each line, find large gaps between words (column separators)
 * 2. Group consecutive lines with the same number of column separators at aligned positions
 * 3. A table is 3+ consecutive lines with 2-7 aligned columns separated by large gaps
 * 4. Extract cell text by assigning items to columns based on gap positions
 *
 * Key heuristic: table columns are separated by gaps MUCH larger than word spacing.
 * At 2x OCR scale (~1190px wide), normal word gaps are 30-80px, while table column
 * gaps are 150-400px+. We use this to distinguish tables from flowing text.
 */

import { type PageData, type TextLine } from './pdfTextExtractor';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface DetectedTable {
  headers: string[];
  rows: string[][];
  startLineIndex: number;
  endLineIndex: number;
  pageNumber: number;
}

export interface StructuredContent {
  type: 'text' | 'table';
  text?: string;         // For text type
  table?: DetectedTable; // For table type
  pageNumber: number;
  lineIndex: number;
}

// ─── Configuration ──────────────────────────────────────────────────────────

const COLUMN_ALIGNMENT_TOLERANCE = 30; // px — how close X positions must be to count as same column
const MIN_TABLE_ROWS = 3;              // minimum rows for a table region
const MIN_TABLE_COLUMNS = 2;           // minimum columns
const MAX_TABLE_COLUMNS = 7;           // maximum columns (more = likely flowing text)
const MIN_COLUMN_GAP = 150;           // minimum gap between columns in px (must be much larger than word spacing)

// ─── Main API ───────────────────────────────────────────────────────────────

/**
 * Detect tables across all pages and return structured content
 */
export function detectTablesAndStructure(pages: PageData[]): StructuredContent[] {
  const content: StructuredContent[] = [];

  for (const page of pages) {
    const tables = detectTablesInPage(page);
    const tableLineRanges = new Set<number>();
    for (const table of tables) {
      for (let i = table.startLineIndex; i < table.endLineIndex; i++) {
        tableLineRanges.add(i);
      }
    }

    let tableIdx = 0;
    for (let i = 0; i < page.lines.length; i++) {
      if (tableLineRanges.has(i)) {
        // This line is part of a table — emit the table when we hit its start
        if (tableIdx < tables.length && tables[tableIdx].startLineIndex === i) {
          content.push({
            type: 'table',
            table: tables[tableIdx],
            pageNumber: page.pageNumber,
            lineIndex: i,
          });
          tableIdx++;
        }
        // Skip table lines (they're handled by the table)
        continue;
      }

      // Regular text line
      const text = page.lines[i].text.trim();
      if (text) {
        content.push({
          type: 'text',
          text,
          pageNumber: page.pageNumber,
          lineIndex: i,
        });
      }
    }
  }

  return content;
}

// ─── Page-Level Table Detection ─────────────────────────────────────────────

function detectTablesInPage(page: PageData): DetectedTable[] {
  const lines = page.lines;
  if (lines.length < MIN_TABLE_ROWS) return [];

  // Step 1: For each line, find large gap positions (potential column separators)
  const lineGapData: Array<{ lineIdx: number; gapPositions: number[]; itemCount: number }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.items.length < MIN_TABLE_COLUMNS) continue;

    // Sort items by X position
    const sortedItems = [...line.items].sort((a, b) => a.x - b.x);

    // Find large gaps between consecutive items
    const gapPositions: number[] = [];
    for (let j = 1; j < sortedItems.length; j++) {
      const gap = sortedItems[j].x - (sortedItems[j - 1].x + sortedItems[j - 1].width);
      if (gap > MIN_COLUMN_GAP) {
        // Record the midpoint of the gap as the column separator position
        gapPositions.push(sortedItems[j - 1].x + sortedItems[j - 1].width + gap / 2);
      }
    }

    // Must have at least 1 large gap (= 2 columns) and not too many (= not flowing text)
    if (gapPositions.length >= MIN_TABLE_COLUMNS - 1 && gapPositions.length <= MAX_TABLE_COLUMNS - 1) {
      lineGapData.push({ lineIdx: i, gapPositions, itemCount: line.items.length });
    }
  }

  // Step 2: Find groups of consecutive lines with aligned gap positions
  const tables: DetectedTable[] = [];
  let groupStart = 0;

  while (groupStart < lineGapData.length) {
    const group = findAlignedGroup(lineGapData, groupStart);

    if (group.length >= MIN_TABLE_ROWS) {
      // Verify consistent column count across the group
      const columnCounts = group.map((g) => g.gapPositions.length + 1);
      const modeCount = mode(columnCounts);

      if (modeCount >= MIN_TABLE_COLUMNS && modeCount <= MAX_TABLE_COLUMNS) {
        // Extract the table
        const table = extractTableFromGaps(group, lines, page.pageNumber, page.width);
        if (table) {
          tables.push(table);
        }
      }
    }

    groupStart += Math.max(1, group.length);
  }

  return tables;
}

// ─── Column Analysis ────────────────────────────────────────────────────────

function findAlignedGroup(
  lineGapData: Array<{ lineIdx: number; gapPositions: number[]; itemCount: number }>,
  startIdx: number
): Array<{ lineIdx: number; gapPositions: number[]; itemCount: number }> {
  const group = [lineGapData[startIdx]];
  const refGaps = lineGapData[startIdx].gapPositions;

  for (let i = startIdx + 1; i < lineGapData.length; i++) {
    const current = lineGapData[i];

    // Must be consecutive (or nearly consecutive) lines
    const prevLineIdx = group[group.length - 1].lineIdx;
    if (current.lineIdx - prevLineIdx > 2) break; // Allow 1 gap line

    // Must have the same number of gap positions (same column count)
    if (current.gapPositions.length !== refGaps.length) break;

    // Check if gap positions align
    let allAligned = true;
    for (let g = 0; g < refGaps.length; g++) {
      if (Math.abs(refGaps[g] - current.gapPositions[g]) > COLUMN_ALIGNMENT_TOLERANCE) {
        allAligned = false;
        break;
      }
    }

    if (allAligned) {
      group.push(current);
    } else {
      break;
    }
  }

  return group;
}

// ─── Table Extraction ───────────────────────────────────────────────────────

function extractTableFromGaps(
  group: Array<{ lineIdx: number; gapPositions: number[]; itemCount: number }>,
  lines: TextLine[],
  pageNumber: number,
  _pageWidth: number
): DetectedTable | null {
  const gapPositions = group[0].gapPositions;
  const numColumns = gapPositions.length + 1;
  const startLineIdx = group[0].lineIdx;
  const endLineIdx = group[group.length - 1].lineIdx + 1;

  const rows: string[][] = [];

  for (const { lineIdx } of group) {
    const line = lines[lineIdx];
    const row = assignItemsToColumnsByGaps(line, gapPositions);
    rows.push(row);
  }

  if (rows.length < MIN_TABLE_ROWS) return null;

  // Validate: ensure we have meaningful content (not too many empty cells)
  const nonEmptyCells = rows.flat().filter((c) => c.trim()).length;
  const totalCells = rows.length * numColumns;
  if (nonEmptyCells / totalCells < 0.4) return null;

  // Validate: reject if cells look like flowing paragraph fragments.
  // True table cells are short; paragraph fragments are long.
  const allCellLengths = rows.flat().map((c) => c.trim().length).filter((l) => l > 0);
  const avgCellLen = allCellLengths.reduce((a, b) => a + b, 0) / allCellLengths.length;
  if (avgCellLen > 50) return null;

  // First row is header
  const headers = rows[0];
  const bodyRows = rows.slice(1);

  return {
    headers,
    rows: bodyRows,
    startLineIndex: startLineIdx,
    endLineIndex: endLineIdx,
    pageNumber,
  };
}

/**
 * Assign items to columns using gap positions as separators.
 * Items before the first gap → column 0
 * Items between gap[i-1] and gap[i] → column i
 * Items after the last gap → last column
 */
function assignItemsToColumnsByGaps(line: TextLine, gapPositions: number[]): string[] {
  const numColumns = gapPositions.length + 1;
  const cells: string[] = new Array(numColumns).fill('');

  for (const item of line.items) {
    // Find which column this item belongs to
    let col = 0;
    for (let g = 0; g < gapPositions.length; g++) {
      if (item.x > gapPositions[g]) {
        col = g + 1;
      } else {
        break;
      }
    }

    // Append text to the cell
    if (cells[col]) {
      cells[col] += ' ' + item.str;
    } else {
      cells[col] = item.str;
    }
  }

  return cells;
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Find the mode (most frequent value) of an array of numbers */
function mode(values: number[]): number {
  const counts = new Map<number, number>();
  for (const v of values) {
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  let bestVal = 0;
  let bestCount = 0;
  for (const [val, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestVal = val;
    }
  }
  return bestVal;
}
