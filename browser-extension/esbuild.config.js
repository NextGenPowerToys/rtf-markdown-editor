const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

async function build() {
  const contexts = await Promise.all([
    // Background service worker
    esbuild.context({
      entryPoints: ['background/service-worker.ts'],
      bundle: true,
      outfile: 'dist/background.js',
      format: 'esm',
      platform: 'browser',
      target: 'chrome120',
      minify: production,
      sourcemap: !production
    }),
    
    // Content script
    esbuild.context({
      entryPoints: ['content/github-integration.ts'],
      bundle: true,
      outfile: 'dist/content.js',
      format: 'iife',
      platform: 'browser',
      target: 'chrome120',
      minify: production,
      sourcemap: !production
    }),
    
    // Editor page
    esbuild.context({
      entryPoints: ['editor/editor.ts'],
      bundle: true,
      outfile: 'dist/editor/editor.js',
      format: 'iife',
      platform: 'browser',
      target: 'chrome120',
      minify: production,
      sourcemap: !production
    }),
    
    // Options page
    esbuild.context({
      entryPoints: ['options/options.ts'],
      bundle: true,
      outfile: 'dist/options/options.js',
      format: 'iife',
      platform: 'browser',
      target: 'chrome120',
      minify: production,
      sourcemap: !production
    })
  ]);
  
  // Copy static files
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }
  
  // Create directories
  ['dist/editor', 'dist/options', 'dist/assets'].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Copy manifest
  fs.copyFileSync('manifest.json', 'dist/manifest.json');
  
  // Copy HTML files
  fs.copyFileSync('editor/editor.html', 'dist/editor/editor.html');
  fs.copyFileSync('editor/editor.css', 'dist/editor/editor.css');
  fs.copyFileSync('options/options.html', 'dist/options/options.html');
  fs.copyFileSync('options/options.css', 'dist/options/options.css');
  
  // Copy KaTeX CSS from parent project
  const katexSource = path.join('..', 'media', 'katex.css');
  if (fs.existsSync(katexSource)) {
    fs.copyFileSync(katexSource, 'dist/assets/katex.css');
  }
  
  if (watch) {
    await Promise.all(contexts.map(ctx => ctx.watch()));
    console.log('Watching for changes...');
  } else {
    await Promise.all(contexts.map(ctx => ctx.rebuild()));
    await Promise.all(contexts.map(ctx => ctx.dispose()));
    console.log('Build complete!');
  }
}

build().catch(() => process.exit(1));
