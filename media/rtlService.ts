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
   * Detect if text should be treated as RTL based on character density:
   * At least 30% of the total text content must be RTL characters
   * @param text - The text to check
   * @returns true if RTL condition is met
   */
  static detectRTLCharacters(text: string): boolean {
    if (!text) return false;

    // Strip fenced code blocks — code is inherently LTR and should not
    // dilute the RTL character ratio for prose content.
    const proseText = text.replace(/```[\s\S]*?```/g, '');

    // Strip all whitespace to compare actual content
    const cleanText = proseText.replace(/\s/g, '');
    if (cleanText.length === 0) return false;

    // Count RTL characters
    const rtlMatches = cleanText.match(new RegExp(WebviewRTLService.RTL_CHAR_PATTERN, 'g'));
    const rtlCount = rtlMatches ? rtlMatches.length : 0;

    return (rtlCount / cleanText.length) >= 0.1;
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
