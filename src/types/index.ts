export interface MessageFromWebview {
  type: 'ready' | 'contentChanged' | 'requestSaveNow' | 'editMermaid' | 'updateMermaid';
  content?: string;
  html?: string;
  mermaidSources?: Record<string, string>;
  mermaidId?: string;
  mermaidSource?: string;
}

export interface MessageToWebview {
  type: 'setContent' | 'setConfig' | 'externalUpdate' | 'showConflictPrompt' | 'showError' | 'mermaidRendered';
  content?: string;
  html?: string;
  mermaidSources?: Record<string, string>;
  config?: EditorConfig;
  options?: string[];
  message?: string;
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
