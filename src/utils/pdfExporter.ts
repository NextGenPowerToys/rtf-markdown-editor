import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exportToHTML, ExportOptions } from './htmlExporter';

export interface PdfExportOptions {
  title?: string;
  mermaidImages?: Record<string, string>;
  basePath?: string;
  rtl?: boolean;
}

function getChromePaths(): string[] {
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    ];
  }
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA || '';
    return [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(local, 'Google\\Chrome\\Application\\chrome.exe'),
      'C:\\Program Files\\Chromium\\Application\\chrome.exe',
    ].filter(Boolean);
  }
  // Linux / other POSIX
  return [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];
}

function findChrome(): string {
  for (const p of getChromePaths()) {
    if (fs.existsSync(p)) { return p; }
  }
  throw new Error(
    'PDF export requires Google Chrome or Chromium to be installed.\n' +
    'Please install it from https://www.google.com/chrome and try again.'
  );
}

export async function exportToPDF(
  markdown: string,
  options: PdfExportOptions = {}
): Promise<Buffer> {
  const { title = 'Untitled', mermaidImages, basePath, rtl } = options;

  // Reuse the existing HTML pipeline — fully self-contained (base64 images + Mermaid PNGs)
  const html = await exportToHTML(markdown, {
    title,
    includeStyles: true,
    standalone: true,
    selfContained: true,
    basePath,
    mermaidImages,
    rtl,
  } as ExportOptions);

  const executablePath = findChrome();

  // Dynamic import so a missing module fails at export time, not at extension activation
  const puppeteer = await import('puppeteer-core');

  const browser = await (puppeteer as any).launch({
    executablePath,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = await browser.newPage();
    // setContent avoids writing a temp file; networkidle0 ensures fonts/resources settle
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
      displayHeaderFooter: false,
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
