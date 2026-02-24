// ── Raw extracted text item from PDF ──
export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
  confidence?: number;
}

// ── Page data from extractor ──
export interface PageData {
  pageNumber: number;
  width: number;
  height: number;
  items: TextItem[];
}

// ── Grouped line of text items ──
export interface Line {
  y: number;
  items: TextItem[];
  fontSize: number;
  isBold: boolean;
  text: string;
}

// ── Text segment with formatting ──
export interface TextSegment {
  text: string;
  isBold: boolean;
  isItalic: boolean;
}

// ── Content blocks ──
export type ContentBlock =
  | HeaderBlock
  | ParagraphBlock
  | TableBlock
  | ListItemBlock
  | PageBreakBlock;

export interface HeaderBlock {
  type: 'header';
  level: 1 | 2 | 3;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  segments: TextSegment[];
}

export interface TableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface ListItemBlock {
  type: 'list-item';
  marker: string;
  segments: TextSegment[];
}

export interface PageBreakBlock {
  type: 'page-break';
  pageNumber: number;
}

// ── Extraction mode ──
export type ExtractionMode = 'text' | 'ocr' | 'hybrid';

// ── Converter options ──
export interface ConvertOptions {
  mode: ExtractionMode;
  ocrLanguage: string;
  scale: number;
  pageRange?: [number, number];
  progress?: (message: string) => void;
}
