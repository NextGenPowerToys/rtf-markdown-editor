import type { ContentBlock, TableBlock, ParagraphBlock, ListItemBlock } from './types';

/**
 * Post-process content blocks to merge tables that were split across page breaks.
 * A split table manifests as: TableBlock → loose text → PageBreakBlock → loose text → TableBlock
 * where both tables have the same column count.
 */
export function mergeSplitTables(blocks: ContentBlock[]): ContentBlock[] {
  const result = [...blocks];
  let i = 0;

  while (i < result.length) {
    if (result[i].type !== 'table') {
      i++;
      continue;
    }

    const table1 = result[i] as TableBlock;
    const numCols1 = columnCount(table1);
    if (numCols1 < 2) { i++; continue; }

    // Scan forward for a merge candidate
    let foundPageBreak = false;
    let table2Idx = -1;
    const looseBlockIndices: number[] = [];
    let abortMerge = false;

    for (let j = i + 1; j < result.length && j <= i + 20; j++) {
      const block = result[j];

      if (block.type === 'header') {
        abortMerge = true;
        break;
      }

      if (block.type === 'page-break') {
        if (foundPageBreak) {
          // Two page breaks before finding a second table — too far apart
          abortMerge = true;
          break;
        }
        foundPageBreak = true;
        continue;
      }

      if (block.type === 'table') {
        if (!foundPageBreak) {
          // Adjacent tables on same page — don't merge
          break;
        }
        table2Idx = j;
        break;
      }

      if (block.type === 'paragraph' || block.type === 'list-item') {
        looseBlockIndices.push(j);
      }
    }

    if (abortMerge || table2Idx === -1 || !foundPageBreak) {
      i++;
      continue;
    }

    const table2 = result[table2Idx] as TableBlock;
    const numCols2 = columnCount(table2);

    if (numCols1 !== numCols2) {
      i++;
      continue;
    }

    // ---- Perform the merge ----
    const numCols = numCols1;

    // Ensure table1 has at least one data row
    if (table1.rows.length === 0) {
      table1.rows.push(new Array(numCols).fill(''));
    }
    const lastRow = table1.rows[table1.rows.length - 1];

    // Absorb loose text into table1's last row
    const targetCell = findContinuationCell(lastRow, numCols);
    for (const looseIdx of looseBlockIndices) {
      const block = result[looseIdx];
      if (block.type === 'paragraph' || block.type === 'list-item') {
        const text = cleanLooseText(extractText(block));
        if (text) {
          lastRow[targetCell] = lastRow[targetCell]
            ? lastRow[targetCell] + ' ' + text
            : text;
        }
      }
    }

    // Merge table2's rows
    if (table2.rows.length > 0) {
      const lastRowNum = leadingRowNumber(lastRow);
      const firstT2RowNum = leadingRowNumber(table2.rows[0]);

      if (lastRowNum !== null && firstT2RowNum !== null && lastRowNum === firstT2RowNum) {
        // Continuation of same row — concatenate cells
        for (let c = 0; c < numCols; c++) {
          const cellText = (table2.rows[0][c] || '').trim();
          if (!cellText) continue;
          // Don't duplicate the row number
          if (c === 0 && /^\d+$/.test(cellText) && lastRow[c].trim() === cellText) continue;
          lastRow[c] = lastRow[c].trim()
            ? lastRow[c].trim() + ' ' + cellText
            : cellText;
        }
        table1.rows.push(...table2.rows.slice(1));
      } else {
        table1.rows.push(...table2.rows);
      }
    }

    // Remove all blocks between table1 and table2 (inclusive of table2)
    result.splice(i + 1, table2Idx - i);

    // Don't advance i — the merged table might chain with another table
  }

  return result;
}

function columnCount(table: TableBlock): number {
  return Math.max(
    table.headers.length,
    ...table.rows.map(r => r.length),
    0,
  );
}

function leadingRowNumber(row: string[]): number | null {
  if (row.length === 0) return null;
  const match = row[0].trim().match(/^(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : null;
}

/** Find the cell with the most content (skip row-number column 0) */
function findContinuationCell(row: string[], numCols: number): number {
  let bestCol = numCols - 1;
  let bestLen = 0;
  for (let c = 0; c < numCols; c++) {
    if (c === 0 && /^\d+$/.test((row[c] || '').trim())) continue;
    if ((row[c] || '').length > bestLen) {
      bestLen = (row[c] || '').length;
      bestCol = c;
    }
  }
  return bestCol;
}

function extractText(block: ParagraphBlock | ListItemBlock): string {
  if (block.type === 'paragraph') {
    return block.segments.map(s => s.text).join('').trim();
  }
  return block.marker + ' ' + block.segments.map(s => s.text).join('').trim();
}

/** Strip leading/trailing pipe characters from OCR table-border artifacts */
function cleanLooseText(text: string): string {
  return text.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim();
}
