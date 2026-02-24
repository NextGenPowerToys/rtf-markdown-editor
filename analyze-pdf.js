const fs = require('fs');
const pdfParse = require('pdf-parse');

(async () => {
  const pdfPath = 'src/examples/pdf/EasySend-Bank-Integration-HLAD-HE.pdf';
  const buffer = fs.readFileSync(pdfPath);
  const data = await pdfParse(buffer);

  console.log('=== PDF Extraction Analysis ===\n');
  console.log('Total pages:', data.numpages);
  console.log('Total text length:', data.text.length);
  console.log('PDF Title:', data.info?.Title || '(none)');
  console.log('PDF Metadata:', JSON.stringify(data.info || {}, null, 2));

  console.log('\n=== First 1000 chars of extracted text ===');
  console.log(data.text.substring(0, 1000));

  console.log('\n=== Line-by-line structure (first 40 lines) ===');
  const lines = data.text.split('\n').slice(0, 40);
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed) {
      console.log(`[${i}] len=${line.length}: ${line.substring(0, 100)}`);
    } else {
      console.log(`[${i}] (blank line)`);
    }
  });

  // Check for formatting hints
  console.log('\n=== Checking for lost information ===');
  const text = data.text;
  console.log('Has bold markers (* or **):', /\*\*?[^*]+\*\*?/.test(text) ? 'YES' : 'NO');
  console.log('Has markdown headings (#):', /#+ /.test(text) ? 'YES' : 'NO');
  console.log('Has bullet dashes (-):', /^- /.test(text) ? 'YES' : 'NO');
  console.log('Has numbered lists (1.):', /^\d+\./.test(text) ? 'YES' : 'NO');
  console.log('Has code fences (`):', /`/.test(text) ? 'YES' : 'NO');

})();
