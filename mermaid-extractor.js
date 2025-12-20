#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration
const MARKDOWN_FILE = path.join(__dirname, 'hebrew_rtl.md');
const OUTPUT_DIR = path.join(__dirname, 'mermaid-diagrams');
const TEMP_DIR = path.join(__dirname, '.mermaid-temp');

/**
 * Extract all mermaid diagrams from markdown file
 */
function extractMermaidDiagrams(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const diagrams = [];
  
  // Regex to match mermaid code blocks
  const mermaidRegex = /```mermaid\n([\s\S]*?)\n```/g;
  let match;
  let diagramIndex = 1;
  
  while ((match = mermaidRegex.exec(content)) !== null) {
    const diagram = match[1].trim();
    
    // Extract diagram title if available
    const titleMatch = diagram.match(/title\s+(.+)/);
    const title = titleMatch ? titleMatch[1].trim() : `Diagram_${diagramIndex}`;
    
    diagrams.push({
      index: diagramIndex,
      title: sanitizeFilename(title),
      content: diagram
    });
    
    diagramIndex++;
  }
  
  return diagrams;
}

/**
 * Sanitize filename
 */
function sanitizeFilename(filename) {
  return filename
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .substring(0, 50);
}

/**
 * Create output directory if it doesn't exist
 */
function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
}

/**
 * Save diagram content to a temporary mmd file
 */
function saveTempDiagram(diagram, tempDir) {
  const tempFile = path.join(tempDir, `${diagram.index}_${diagram.title}.mmd`);
  fs.writeFileSync(tempFile, diagram.content, 'utf-8');
  return tempFile;
}

/**
 * Convert mermaid diagram to SVG using mermaid-cli
 */
async function convertToSvg(inputFile, outputFile) {
  try {
    // Using mmdc (mermaid-cli) command
    // Make sure mermaid-cli is installed globally or locally
    const command = `npx -y @mermaid-js/mermaid-cli@latest -i "${inputFile}" -o "${outputFile}" -t default`;
    
    await execAsync(command);
    return true;
  } catch (error) {
    console.error(`✗ Error converting ${inputFile}:`, error.message);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔍 Mermaid Diagram Extractor & SVG Converter');
  console.log('='.repeat(50));
  
  try {
    // Check if markdown file exists
    if (!fs.existsSync(MARKDOWN_FILE)) {
      console.error(`✗ File not found: ${MARKDOWN_FILE}`);
      process.exit(1);
    }
    
    // Extract diagrams
    console.log('\n📖 Extracting diagrams from markdown...');
    const diagrams = extractMermaidDiagrams(MARKDOWN_FILE);
    
    if (diagrams.length === 0) {
      console.log('⚠️  No mermaid diagrams found in the markdown file.');
      process.exit(0);
    }
    
    console.log(`✓ Found ${diagrams.length} mermaid diagram(s)`);
    
    // Display extracted diagrams
    console.log('\n📋 Extracted Diagrams:');
    diagrams.forEach(diagram => {
      console.log(`  ${diagram.index}. ${diagram.title}`);
    });
    
    // Create output directories
    console.log('\n📁 Creating output directories...');
    ensureDirectoryExists(OUTPUT_DIR);
    ensureDirectoryExists(TEMP_DIR);
    
    // Convert diagrams to SVG
    console.log('\n🔄 Converting diagrams to SVG...');
    let successCount = 0;
    let failureCount = 0;
    
    for (const diagram of diagrams) {
      // Save temporary mermaid file
      const tempFile = saveTempDiagram(diagram, TEMP_DIR);
      
      // Output SVG file path
      const outputFile = path.join(OUTPUT_DIR, `${diagram.index}_${diagram.title}.svg`);
      
      // Convert to SVG
      const success = await convertToSvg(tempFile, outputFile);
      
      if (success) {
        console.log(`✓ Converted: ${diagram.index}. ${diagram.title}.svg`);
        successCount++;
      } else {
        console.log(`✗ Failed: ${diagram.index}. ${diagram.title}.svg`);
        failureCount++;
      }
    }
    
    // Cleanup temporary files
    console.log('\n🧹 Cleaning up temporary files...');
    try {
      const tempFiles = fs.readdirSync(TEMP_DIR);
      for (const file of tempFiles) {
        fs.unlinkSync(path.join(TEMP_DIR, file));
      }
      fs.rmdirSync(TEMP_DIR);
      console.log('✓ Temporary files cleaned up');
    } catch (error) {
      console.warn('⚠️  Could not clean temporary files:', error.message);
    }
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('✅ Conversion Complete!');
    console.log(`   Success: ${successCount}/${diagrams.length}`);
    if (failureCount > 0) {
      console.log(`   Failures: ${failureCount}/${diagrams.length}`);
    }
    console.log(`   Output directory: ${OUTPUT_DIR}`);
    console.log('='.repeat(50));
    
    if (failureCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();
