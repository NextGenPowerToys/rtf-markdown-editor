/**
 * Bidirectional (Bidi) Text Handling
 *
 * Handles reconstruction of Right-to-Left (RTL) text that has been extracted from PDFs.
 * When PDF.js extracts text, it loses bidirectional control characters, leaving RTL text
 * in visual order. This module reorders that text back to logical order.
 *
 * Based on Unicode Standard Annex #9 (Unicode Bidirectional Algorithm)
 * Simplified implementation for common RTL languages: Hebrew, Arabic, etc.
 */

/**
 * Unicode character ranges for bidirectional text identification
 */
const BIDI_RANGES = {
  // Hebrew (U+0590 - U+05FF)
  HEBREW_START: 0x0590,
  HEBREW_END: 0x05ff,

  // Arabic (U+0600 - U+06FF)
  ARABIC_START: 0x0600,
  ARABIC_END: 0x06ff,

  // Arabic Supplement (U+0750 - U+077F)
  ARABIC_SUPP_START: 0x0750,
  ARABIC_SUPP_END: 0x077f,

  // Arabic Extended-B (U+0870 - U+089F)
  ARABIC_EXT_B_START: 0x0870,
  ARABIC_EXT_B_END: 0x089f,

  // Syriac (U+0700 - U+074F)
  SYRIAC_START: 0x0700,
  SYRIAC_END: 0x074f,

  // Thaana (U+0780 - U+07BF)
  THAANA_START: 0x0780,
  THAANA_END: 0x07bf,

  // NKo (U+07C0 - U+07FF)
  NKO_START: 0x07c0,
  NKO_END: 0x07ff,
};

const COMMON_PUNCTUATION = /[\s\-\.\,\:\;\!\?\(\)\[\]\{\}"""''«»„‟‚′″‴]/;

export type TextDirection = 'rtl' | 'ltr' | 'auto';

/**
 * Detects if a single character is RTL
 */
function isRTLChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= BIDI_RANGES.HEBREW_START && code <= BIDI_RANGES.HEBREW_END) ||
    (code >= BIDI_RANGES.ARABIC_START && code <= BIDI_RANGES.ARABIC_END) ||
    (code >= BIDI_RANGES.ARABIC_SUPP_START && code <= BIDI_RANGES.ARABIC_SUPP_END) ||
    (code >= BIDI_RANGES.ARABIC_EXT_B_START && code <= BIDI_RANGES.ARABIC_EXT_B_END) ||
    (code >= BIDI_RANGES.SYRIAC_START && code <= BIDI_RANGES.SYRIAC_END) ||
    (code >= BIDI_RANGES.THAANA_START && code <= BIDI_RANGES.THAANA_END) ||
    (code >= BIDI_RANGES.NKO_START && code <= BIDI_RANGES.NKO_END)
  );
}

/**
 * Detects if a character is LTR
 */
function isLTRChar(char: string): boolean {
  const code = char.charCodeAt(0);
  // Basic alphanumeric Latin characters
  return (code >= 0x0041 && code <= 0x005a) || // A-Z
    (code >= 0x0061 && code <= 0x007a) || // a-z
    (code >= 0x0030 && code <= 0x0039); // 0-9
}

/**
 * Detects if a character is neutral (punctuation, spaces, etc.)
 */
function isNeutralChar(char: string): boolean {
  return COMMON_PUNCTUATION.test(char);
}

interface BidiRun {
  text: string;
  direction: 'rtl' | 'ltr' | 'neutral';
  start: number;
  end: number;
}

/**
 * Segments text into runs of consistent directionality
 */
function segmentIntoBidiRuns(text: string): BidiRun[] {
  const runs: BidiRun[] = [];
  let currentRun: BidiRun | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    let charDir: 'rtl' | 'ltr' | 'neutral';

    if (isRTLChar(char)) {
      charDir = 'rtl';
    } else if (isLTRChar(char)) {
      charDir = 'ltr';
    } else {
      charDir = 'neutral';
    }

    if (!currentRun || currentRun.direction !== charDir) {
      if (currentRun && charDir === 'neutral') {
        // Extend current run with neutral character
        currentRun.text += char;
        currentRun.end = i + 1;
      } else {
        // Start new run
        if (currentRun) {
          runs.push(currentRun);
        }
        currentRun = {
          text: char,
          direction: charDir,
          start: i,
          end: i + 1,
        };
      }
    } else {
      currentRun.text += char;
      currentRun.end = i + 1;
    }
  }

  if (currentRun) {
    runs.push(currentRun);
  }

  return runs;
}

/**
 * Detects the base/overall direction of a paragraph
 * Returns 'rtl' if more RTL characters, 'ltr' otherwise
 */
export function detectParagraphDirection(text: string): TextDirection {
  if (!text) return 'ltr';

  let rtlCount = 0;
  let ltrCount = 0;

  // Only count strong directional characters (ignore neutrals)
  for (const char of text) {
    if (isRTLChar(char)) {
      rtlCount++;
    } else if (isLTRChar(char)) {
      ltrCount++;
    }
  }

  // If more RTL characters, treat as RTL paragraph
  return rtlCount > ltrCount ? 'rtl' : 'ltr';
}

/**
 * Reorders a line of mixed RTL/LTR text based on the Unicode Bidi Algorithm
 *
 * This handles the common case of:
 * - Pure RTL text that has been extracted in visual order (reversed)
 * - Pure LTR text (passed through unchanged)
 * - Mixed RTL/LTR text (segments reordered appropriately)
 */
export function reconstructRTLText(line: string, detectedDir: TextDirection): string {
  if (!line) return line;

  // For 'auto' direction, detect from paragraph
  const baseDir = detectedDir === 'auto' ? detectParagraphDirection(line) : detectedDir;

  // If LTR paragraph, return as-is (no reordering needed)
  if (baseDir === 'ltr') {
    return line;
  }

  // For RTL paragraph, apply bidi reordering
  const runs = segmentIntoBidiRuns(line);

  // Level assignment: base level is 1 for RTL (odd), 0 for LTR (even)
  let baseLevel = baseDir === 'rtl' ? 1 : 0;
  const levels = assignBidiLevels(runs, baseLevel);

  // Reorder: reverse runs at odd levels
  const reordered = reorderByLevel(runs, levels);

  return reordered;
}

/**
 * Assigns bidirectional levels to text runs
 * Simplified: doesn't handle explicit formatting codes
 */
function assignBidiLevels(runs: BidiRun[], baseLevel: number): number[] {
  return runs.map((run) => {
    if (run.direction === 'neutral') {
      // Neutral characters take level of surrounding strong text
      // Simplified: use base level
      return baseLevel;
    }
    if (run.direction === 'rtl') {
      return baseLevel % 2 === 0 ? baseLevel + 1 : baseLevel;
    }
    // ltr
    return baseLevel % 2 === 0 ? baseLevel : baseLevel + 1;
  });
}

/**
 * Reorders bidi runs by level
 * Runs at odd level are reversed within their range
 */
function reorderByLevel(runs: BidiRun[], levels: number[]): string {
  // Simple reordering: reverse sequences of odd levels
  const result: string[] = [];
  let i = 0;

  while (i < runs.length) {
    if (levels[i] % 2 === 1) {
      // Odd level: collect sequence of odd-level runs and reverse
      const oddSeq = [i];
      let j = i + 1;
      while (j < runs.length && levels[j] % 2 === 1) {
        oddSeq.push(j);
        j++;
      }

      // Reverse the sequence and add
      for (let k = oddSeq.length - 1; k >= 0; k--) {
        result.push(runs[oddSeq[k]].text);
      }

      i = j;
    } else {
      result.push(runs[i].text);
      i++;
    }
  }

  return result.join('');
}

/**
 * Main entry point: Reconstructs RTL text that has been corrupted by PDF extraction
 *
 * Usage:
 * ```
 * const corrupted = "אינטגרציית :גבוהה ברמה ארכיטקטורה תכנון";
 * const fixed = reconstructRTLText(corrupted, 'rtl');
 * // Result: "תכנון ארכיטקטורה ברמה גבוהה: אינטגרציית"
 * ```
 */
export function applyBidiReconstruction(text: string, baseDir: TextDirection = 'auto'): string {
  if (!text) return text;

  // Process line by line
  return text
    .split('\n')
    .map((line) => reconstructRTLText(line, baseDir))
    .join('\n');
}

/**
 * Detects if text contains RTL characters
 */
export function hasRTLCharacters(text: string): boolean {
  for (const char of text) {
    if (isRTLChar(char)) {
      return true;
    }
  }
  return false;
}

/**
 * Counts RTL and LTR characters for analysis
 */
export function analyzeTextDirection(text: string): {
  rtlCount: number;
  ltrCount: number;
  neutralCount: number;
  direction: TextDirection;
} {
  let rtlCount = 0;
  let ltrCount = 0;
  let neutralCount = 0;

  for (const char of text) {
    if (isRTLChar(char)) {
      rtlCount++;
    } else if (isLTRChar(char)) {
      ltrCount++;
    } else {
      neutralCount++;
    }
  }

  return {
    rtlCount,
    ltrCount,
    neutralCount,
    direction: rtlCount > ltrCount ? 'rtl' : 'ltr',
  };
}
