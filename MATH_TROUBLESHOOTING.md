# Math Display Troubleshooting Guide

## Issues Fixed in Latest Update

### 1. ✅ KaTeX Import
- **Problem**: KaTeX library reference was not available in editor.ts
- **Solution**: Added `import katex from 'katex'` to editor.ts
- **Why**: The updateMathPreview function needs direct access to katex

### 2. ✅ Math Node Attributes
- **Problem**: Attributes were using string keys like `'data-formula'` instead of proper attribute names
- **Solution**: Changed to use `formula` as the attribute key with proper parseHTML/renderHTML handlers
- **Why**: TipTap expects attributes to be defined properly with parse/render methods

### 3. ✅ Math Rendering on Content Load
- **Problem**: Formulas were not re-rendering when content was loaded from file
- **Solution**: Added `renderMathBlocks()` call to both `setContent` and `externalUpdate` message handlers
- **Why**: When content is restored, the math elements need to be rendered

### 4. ✅ Rendering Timing
- **Problem**: Math might not render if DOM isn't ready
- **Solution**: Increased setTimeout delays and added proper logging
- **Why**: ProseMirror needs time to render the custom nodes before we can find and process them

### 5. ✅ Comprehensive Logging
- **Problem**: No way to debug what's happening
- **Solution**: Added detailed console logging in renderMathBlocks
- **What to check**: Open DevTools (F12) console to see [Math] logs

## How to Test

### Test 1: Insert a Simple Formula
1. Click the **Math** button (∑∫)
2. Type: `\frac{1}{2}`
3. Select "Display (Block)"
4. Click "Insert"
5. **Expected**: You should see a fraction displayed: ½
6. **Check console**: You should see `[Math] Block 0: Rendered successfully...`

### Test 2: Inline Formula
1. Click the **Math** button
2. Type: `E = mc^2`
3. Select "Inline"
4. Click "Insert"
5. **Expected**: Formula flows within text
6. **Check console**: You should see `[Math] Inline 0: Rendered successfully...`

### Test 3: Complex Formula
1. Type: `\sum_{i=1}^{n} x_i`
2. **Expected**: Proper summation notation with limits
3. **Check console**: HTML length should be > 100 characters

### Test 4: Invalid Formula
1. Type: `\frac{a` (missing closing brace)
2. **Expected**: Error message in preview showing what's wrong
3. **Check console**: Should show error message

## Browser Console Debugging

### Expected Log Output When Inserting Math
```
[Math] Starting render math blocks
[Math] Found 1 math blocks
[Math] Block 0: formula="E = mc^2"
[Math] Block 0: Rendered successfully, HTML length: 245
[Math] Block 0: Inserted into DOM
[Math] Finished rendering all math
```

### If You Don't See These Logs
1. **KaTeX not loaded**: Check if `katex` is in the bundle
   - In console: `typeof katex` should return `"object"`
   - If not, the import failed

2. **Elements not found**: Check if math nodes are in DOM
   - In console: `document.querySelectorAll('[data-mdwe="math-block"]').length`
   - Should return the number of math blocks you added

3. **data-formula attribute missing**: Check if attribute is being set
   - In console: `document.querySelector('[data-mdwe="math-block"]').getAttribute('data-formula')`
   - Should return your formula text

## Debug Checklist

- [ ] Open browser Developer Tools (F12)
- [ ] Switch to Console tab
- [ ] Click Math button and insert a formula
- [ ] Check for `[Math]` log messages
- [ ] Verify `[Math] Found X math blocks`
- [ ] Verify `[Math] Rendered successfully`
- [ ] Check if HTML element has `data-formula` attribute
- [ ] Check if `.math-rendered` element was created
- [ ] Verify no red error messages

## Common Issues & Solutions

### Issue: Modal doesn't open
- **Check**: Is the math button visible?
- **Solution**: Rebuild the extension and reload the editor

### Issue: Formula doesn't show after insert
- **Check**: Open DevTools console
- **Check**: Look for `[Math] Found 0 math blocks` - means nodes not being created
- **Solution**: Check that TipTap extension is registered (see editor.ts line ~200)

### Issue: Formula shows as error
- **Check**: Is the LaTeX syntax correct?
- **Check**: Console should show the error message
- **Solution**: Try a simpler formula like `\frac{a}{b}`

### Issue: Modal preview is blank
- **Check**: Is KaTeX library loaded? Type in console: `katex.version`
- **Should show**: A version number like "0.16.27"
- **If undefined**: KaTeX import failed, need to rebuild

### Issue: Wrong preview then wrong insert
- **Cause**: Formula text is being lost between preview and insert
- **Check**: The textarea value in the modal
- **Solution**: Add logging to updateMathPreview() to see formula value

## Critical File Locations

| File | What to Check |
|------|---------------|
| `media/editor.ts` | Math button handler, renderMathBlocks calls, imports |
| `media/mathExtension.ts` | Math node definitions, renderMathBlocks function |
| `media/editor.html` | Math modal HTML, CSS links |
| `media/editor.css` | `.math-block-placeholder`, `.math-rendered` styles |
| `media/katex.css` | KaTeX styling (should be linked in HTML) |
| `media/fonts/` | Should have 60 font files |

## Performance Considerations

- First render: ~100ms per formula (KaTeX processing)
- Subsequent renders: < 50ms (cached fonts)
- Heavy documents: May see 1-2 second total render time
- Very complex formulas: May take 200-300ms each

## Advanced Debugging

### Get HTML of a Math Element
```javascript
const el = document.querySelector('[data-mdwe="math-block"]');
console.log(el.outerHTML);
```

### Manually Trigger Rendering
```javascript
// In browser console:
renderMathBlocks();
```

### Check KaTeX Version
```javascript
katex.version // Should show "0.16.27"
```

### Test KaTeX Directly
```javascript
const html = katex.renderToString('\\frac{a}{b}', {displayMode: true});
console.log(html);
```

## If All Else Fails

1. **Clear Cache**: Ctrl+Shift+R to hard refresh browser
2. **Reload Extension**: Close and reopen editor
3. **Rebuild**: Run `npm run build` in terminal
4. **Check npm install**: Run `npm install` to ensure katex is available
5. **Verify Files**: Check that `media/katex.css` and `media/fonts/` exist

---

**Last Updated**: 2025-12-22  
**Build Status**: ✅ Ready for testing  
**Testing Guide**: Use steps above to verify functionality
