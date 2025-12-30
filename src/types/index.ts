export interface MessageFromWebview {
  type: 'ready' | 'contentChanged' | 'requestSaveNow' | 'editMermaid' | 'updateMermaid' | 'saveImageFile';
  content?: string;
  html?: string;
  mermaidSources?: Record<string, string>;
  mermaidId?: string;
  mermaidSource?: string;
  imageData?: string;
  fileName?: string;
}

export interface MessageToWebview {
  type: 'setContent' | 'setConfig' | 'externalUpdate' | 'showConflictPrompt' | 'showError' | 'mermaidRendered' | 'imageSaved';
  content?: string;
  html?: string;
  mermaidSources?: Record<string, string>;
  config?: EditorConfig;
  options?: string[];
  message?: string;
  imagePath?: string;
  imageUrl?: string;
  imageWidth?: number | null;
  imageHeight?: number | null;
  fragment?: { startLine?: number; endLine?: number }; // RFC 7763 fragment identifier
}

export interface EditorConfig {
  rtl: boolean;
  autoDetectRtl: boolean;
  charset?: string;
  variant?: string;
}

/**
 * RFC 7763 (text/markdown Media Type) metadata
 * Stores charset, variant, and fragment identifier information
 */
export interface MarkdownMetadata {
  /** Character encoding (RFC 7763 required parameter) */
  charset: string;
  
  /** Markdown variant/flavor (RFC 7763 optional parameter) */
  variant?: 'Original' | 'CommonMark' | 'GFM' | 'MultiMarkdown' | string;
  
  /** Fragment identifier for line navigation (RFC 7763 Section 3) */
  fragment?: {
    startLine?: number;
    endLine?: number;
  };
  
  /** Preview type parameter (RFC 7763 Section 4) */
  previewType?: 'source' | 'rendered';
  
  /** Whether Setext headings (underline style) were detected in source */
  hasSetextHeadings?: boolean;
}

export interface MermaidBlock {
  id: string;
  source: string;
  startLine: number;
  endLine: number;
}
