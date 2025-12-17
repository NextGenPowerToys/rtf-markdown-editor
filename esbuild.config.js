const esbuild = require('esbuild');

const baseConfig = {
  bundle: true,
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
};

// Extension main entry
esbuild.build({
  ...baseConfig,
  entryPoints: ['./src/extension.ts'],
  outfile: './dist/extension.js',
  sourcemap: process.argv.includes('--watch'),
  watch: process.argv.includes('--watch'),
}).catch(() => process.exit(1));

// Webview entry
const webviewConfig = {
  bundle: true,
  external: [],
  format: 'iife',
  platform: 'browser',
};

esbuild.build({
  ...webviewConfig,
  entryPoints: ['./media/editor.ts'],
  outfile: './media/editor.bundle.js',
  sourcemap: process.argv.includes('--watch'),
  watch: process.argv.includes('--watch'),
}).catch(() => process.exit(1));
