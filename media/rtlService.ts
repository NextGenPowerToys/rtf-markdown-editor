/**
 * RTL Service for Webview - Client-side RTL management
 * Handles RTL detection, configuration, and UI updates
 */

export interface RTLConfig {
  rtl: boolean;
  autoDetectRtl: boolean;
}

export class WebviewRTLService {
  /**
   * Unicode ranges for RTL characters (Hebrew, Arabic, Syriac, etc.)
   */
  public static readonly RTL_CHAR_PATTERN = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F]/;
  /**
   * Detect if text should be treated as RTL based on specific rules:
   * 1. One of the first 5 non-empty lines must have at least 2 RTL words
   * 2. At least 30% of the total text content must be RTL characters
   * @param text - The text to check
   * @returns true if RTL conditions are met
   */
  static detectRTLCharacters(text: string): boolean {
    if (!text) return false;

    const lines = text.split('\n');
    let hasRTLHeader = false;
    let checkedLines = 0;

    // Check condition 1: First 5 lines
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      if (checkedLines >= 5) break;
      checkedLines++;

      // Count RTL words in this line
      const words = trimmedLine.split(/\s+/);
      let rtlWordCount = 0;
      for (const word of words) {
        if (WebviewRTLService.RTL_CHAR_PATTERN.test(word)) {
          rtlWordCount++;
        }
      }

      if (rtlWordCount >= 2) {
        hasRTLHeader = true;
        break;
      }
    }

    if (!hasRTLHeader) {
      return false;
    }

    // Check condition 2: 30% threshold
    // Strip all whitespace to compare actual content
    const cleanText = text.replace(/\s/g, '');
    if (cleanText.length === 0) return false;

    // Count RTL characters
    const rtlMatches = cleanText.match(new RegExp(WebviewRTLService.RTL_CHAR_PATTERN, 'g'));
    const rtlCount = rtlMatches ? rtlMatches.length : 0;

    return (rtlCount / cleanText.length) >= 0.3;
  }

  /**
   * Check if a specific string contains ANY RTL characters (helper for word checks)
   */
  static containsRTL(text: string): boolean {
    return WebviewRTLService.RTL_CHAR_PATTERN.test(text);
  }
  private static readonly RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ji', 'iw', 'ps', 'sd'];

  /**
   * Get default RTL configuration
   */
  static getDefaultConfig(): RTLConfig {
    return {
      rtl: false,
      autoDetectRtl: true,
    };
  }

  /**
   * Get default text alignment based on RTL setting
   */
  static getDefaultAlignment(rtl: boolean): 'left' | 'right' {
    return rtl ? 'right' : 'left';
  }

  /**
   * Get direction string
   */
  static getDirection(rtl: boolean): 'rtl' | 'ltr' {
    return rtl ? 'rtl' : 'ltr';
  }

  /**
   * Apply RTL direction to document
   */
  static applyToDocument(rtl: boolean): void {
    document.documentElement.dir = WebviewRTLService.getDirection(rtl);
  }

  /**
   * Update RTL button UI state
   */
  static updateButtonUI(rtl: boolean, buttonId: string = 'rtl-btn'): void {
    const rtlBtn = document.getElementById(buttonId);
    if (rtlBtn) {
      rtlBtn.classList.toggle('active', rtl);
    }
  }

  /**
   * Check if JSON content has RTL characters
   */
  static hasRTLContent(jsonContent: any): boolean {
    const jsonString = JSON.stringify(jsonContent);
    return WebviewRTLService.RTL_CHAR_PATTERN.test(jsonString);
  }

  /**
   * Detect system language
   */
  static getSystemLanguage(): string {
    const userLang = navigator.language || navigator.languages?.[0] || 'en';
    return userLang.toLowerCase().split('-')[0];
  }

  /**
   * Check if language code is RTL
   */
  static isRTLLanguage(langCode: string): boolean {
    return WebviewRTLService.RTL_LANGUAGES.includes(langCode.toLowerCase());
  }

  /**
   * Apply RTL config to editor
   */
  static applyConfig(config: RTLConfig): void {
    WebviewRTLService.applyToDocument(config.rtl);
    WebviewRTLService.updateButtonUI(config.rtl);
  }
}
