/**
 * Validation script for PDF to Markdown conversion fix
 * Tests the bidi handler with sample Hebrew text
 */

const { applyBidiReconstruction, hasRTLCharacters } = require('./src/utils/bidiHandler');

// Test 1: RTL text reconstruction
console.log('=== Test 1: RTL Text Reconstruction ===');
const corruptedHebrew = 'אינטגרציית :גבוהה ברמה ארכיטקטורה תכנון';
console.log('Corrupted (visual order):', corruptedHebrew);

const reconstructed = applyBidiReconstruction(corruptedHebrew, 'rtl');
console.log('Reconstructed:', reconstructed);
console.log('Text changed:', corruptedHebrew !== reconstructed);
console.log('Contains RTL chars:', hasRTLCharacters(reconstructed));

// Test 2: Mixed LTR/RTL
console.log('\n=== Test 2: Mixed LTR/RTL Text ===');
const mixedText = 'EasySend לבנק Integration';
console.log('Original:', mixedText);
const mixedResult = applyBidiReconstruction(mixedText, 'auto');
console.log('Result:', mixedResult);
console.log('Has RTL:', hasRTLCharacters(mixedResult));

// Test 3: English text (should pass through)
console.log('\n=== Test 3: English Text ===');
const english = 'INTRODUCTION\n\n1. Getting Started\n- First bullet';
console.log('Original:', english.replace(/\n/g, ' | '));
const englishResult = applyBidiReconstruction(english);
console.log('Result:', englishResult.replace(/\n/g, ' | '));
console.log('Unchanged:', english === englishResult);

// Test 4: Multiple lines with RTL
console.log('\n=== Test 4: Multi-line RTL ===');
const multiLine = 'תכנון מערכת\nתיאור פרויקט\nדרישות מערכת';
console.log('Original lines:');
multiLine.split('\n').forEach((line, i) => console.log(`  ${i + 1}: ${line}`));
const multiResult = applyBidiReconstruction(multiLine);
console.log('Reconstructed lines:');
multiResult.split('\n').forEach((line, i) => console.log(`  ${i + 1}: ${line}`));

console.log('\n=== All Validation Tests Complete ===');
