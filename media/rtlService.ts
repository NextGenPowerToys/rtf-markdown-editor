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
  private static readonly RTL_CHAR_PATTERN = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F]/;

  /**
   * RTL language codes
   */
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
