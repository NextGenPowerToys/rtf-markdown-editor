/**
 * RTL Service - Centralized management of RTL (Right-to-Left) detection and configuration
 * Handles detection of RTL characters, language-based RTL detection, and RTL configuration
 */

export interface RTLConfig {
  rtl: boolean;
  autoDetectRtl: boolean;
}

export class RTLService {
  // Unicode ranges for RTL languages
  private static readonly RTL_CHAR_PATTERN = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F]/;
  
  // RTL language codes
  private static readonly RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur', 'yi', 'ji', 'iw', 'ps', 'sd'];

  /**
   * Detect if text contains RTL characters (Hebrew, Arabic, Syriac, etc.)
   * @param text - The text to check for RTL characters
   * @returns true if RTL characters are found
   */
  static detectRTLCharacters(text: string): boolean {
    return RTLService.RTL_CHAR_PATTERN.test(text);
  }

  /**
   * Detect system language direction based on browser language settings
   * @returns true if system language is an RTL language
   */
  static detectSystemLanguageDirection(): boolean {
    // Get user language preference (browser language)
    const userLang = typeof navigator !== 'undefined' 
      ? (navigator.language || (navigator.languages && navigator.languages[0]) || 'en')
      : 'en';
    
    const langCode = userLang.toLowerCase().split('-')[0];
    return RTLService.RTL_LANGUAGES.includes(langCode);
  }

  /**
   * Create initial RTL configuration based on content detection
   * @param content - The markdown content to analyze
   * @param autoDetect - Whether to enable automatic RTL detection
   * @returns RTL configuration object
   */
  static createConfig(content: string, autoDetect: boolean = true): RTLConfig {
    return {
      rtl: RTLService.detectRTLCharacters(content),
      autoDetectRtl: autoDetect,
    };
  }

  /**
   * Get the appropriate text alignment based on RTL config
   * @param rtl - Whether the content is RTL
   * @returns 'right' for RTL, 'left' for LTR
   */
  static getDefaultAlignment(rtl: boolean): 'left' | 'right' {
    return rtl ? 'right' : 'left';
  }

  /**
   * Get the appropriate direction attribute for HTML
   * @param rtl - Whether the content is RTL
   * @returns 'rtl' or 'ltr'
   */
  static getDirection(rtl: boolean): 'rtl' | 'ltr' {
    return rtl ? 'rtl' : 'ltr';
  }

  /**
   * Apply RTL direction to document root
   * @param rtl - Whether to apply RTL direction
   */
  static applyToDocument(rtl: boolean): void {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = RTLService.getDirection(rtl);
    }
  }

  /**
   * Update RTL button UI state
   * @param rtl - Current RTL state
   * @param buttonId - HTML id of the RTL button
   */
  static updateButtonState(rtl: boolean, buttonId: string = 'rtl-btn'): void {
    if (typeof document === 'undefined') return;
    
    const button = document.getElementById(buttonId);
    if (button) {
      if (rtl) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  }

  /**
   * Check if content contains RTL characters (deep JSON object search)
   * This is useful for editor content that's stored as JSON
   * @param jsonContent - JSON-serializable content to check
   * @returns true if RTL characters are found
   */
  static hasRTLContent(jsonContent: any): boolean {
    const jsonString = JSON.stringify(jsonContent);
    return RTLService.detectRTLCharacters(jsonString);
  }

  /**
   * Get RTL language code if detected in user's browser, otherwise fallback to default
   * @returns Language code (e.g., 'he', 'ar', or 'en')
   */
  static getSystemLanguage(): string {
    if (typeof navigator === 'undefined') return 'en';
    
    const userLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
    return userLang.toLowerCase().split('-')[0];
  }

  /**
   * Check if a specific language code is RTL
   * @param langCode - Two-letter language code
   * @returns true if language is RTL
   */
  static isRTLLanguage(langCode: string): boolean {
    return RTLService.RTL_LANGUAGES.includes(langCode.toLowerCase());
  }
}
