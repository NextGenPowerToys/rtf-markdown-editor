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
}

export interface EditorConfig {
  rtl: boolean;
  autoDetectRtl: boolean;
}

export interface MermaidBlock {
  id: string;
  source: string;
  startLine: number;
  endLine: number;
}
