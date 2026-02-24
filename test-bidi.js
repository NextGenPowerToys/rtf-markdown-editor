const { applyBidiReconstruction, hasRTLCharacters, detectParagraphDirection } = require('./src/utils/bidiHandler');

console.log('=== Testing Bidi Handler ===\n');

// Test case from EasySend PDF
const corruptedLine = 'אינטגרציית :גבוהה ברמה ארכיטקטורה תכנון';
console.log('Original corrupted:', corruptedLine);
console.log('Direction detected:', detectParagraphDirection(corruptedLine));
console.log('Has RTL:', hasRTLCharacters(corruptedLine));

const reconstructed = applyBidiReconstruction(corruptedLine, 'rtl');
console.log('After reconstruction:', reconstructed);
console.log('Is different:', corruptedLine !== reconstructed);

// Test with full title
const fullLine = `אינטגרציית :גבוהה ברמה ארכיטקטורה תכנון
לבנק EasySend
3.1:מסמך גרסת`;

console.log('\n=== Multi-line test ===');
console.log('Original:');
console.log(fullLine);
console.log('\nAfter reconstruction:');
const fullResult = applyBidiReconstruction(fullLine, 'rtl');
console.log(fullResult);

// Character-by-character analysis
console.log('\n=== Character analysis ===');
const testLine = 'אינטגרציית :גבוהה ברמה ארכיטקטורה תכנון';
console.log('String length:', testLine.length);
console.log('Characters:');
for (let i = 0; i < Math.min(testLine.length, 20); i++) {
  const code = testLine.charCodeAt(i);
  const isRTL = (code >= 0x0590 && code <= 0x05ff) || (code >= 0x0600 && code <= 0x06ff);
  console.log(`[${i}] '${testLine[i]}' U+${code.toString(16).toUpperCase()} ${isRTL ? 'RTL' : 'NEUTRAL'}`);
}
