/**
 * Content Script for GitHub Integration
 * Detects markdown files and enables context menu
 */

function isMarkdownFilePage(): boolean {
  const url = window.location.href;
  
  if (url.includes('github.com') && url.includes('/blob/') && url.endsWith('.md')) {
    return true;
  }
  
  if ((url.includes('dev.azure.com') || url.includes('.visualstudio.com')) 
      && url.includes('/_git/') && url.includes('path=') && url.includes('.md')) {
    return true;
  }
  
  return false;
}

if (isMarkdownFilePage()) {
  console.log('[RTF Editor] Markdown file detected, context menu enabled');
}

export {};
