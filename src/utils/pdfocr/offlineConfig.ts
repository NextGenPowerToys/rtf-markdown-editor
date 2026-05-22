import * as fs from 'fs';
import * as path from 'path';

export interface OfflineTesseractPaths {
  corePath: string;
  langPath: string;
  cachePath?: string;
  gzip: false;
  cacheMethod: 'none';
}

/**
 * Resolve absolute filesystem paths to the bundled Tesseract.js assets so OCR
 * runs without any network access. Two layouts are supported:
 *
 *   <extensionRoot>/resources/tess-core/        — copied at build time
 *   <extensionRoot>/resources/tessdata/         — traineddata files
 *
 * Falls back to the in-tree `node_modules/tesseract.js-core` path during local
 * development if the bundled copy is missing.
 */
export function resolveOfflineTesseractPaths(extensionRoot: string): OfflineTesseractPaths {
  const bundledCore = path.join(extensionRoot, 'resources', 'tess-core');
  const devCore = path.join(extensionRoot, 'node_modules', 'tesseract.js-core');
  const corePath = fs.existsSync(bundledCore) ? bundledCore : devCore;

  const langPath = path.join(extensionRoot, 'resources', 'tessdata');
  if (!fs.existsSync(langPath)) {
    throw new Error(
      `Offline traineddata missing at ${langPath}. Bundled OCR cannot run without it.`,
    );
  }

  return {
    corePath,
    langPath,
    gzip: false,
    cacheMethod: 'none',
  };
}
