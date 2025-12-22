# Math Formula Testing Procedure

## Pre-Test Checklist
- [ ] npm run build completed successfully  
- [ ] No TypeScript errors in console
- [ ] extension.js and editor.bundle.js are generated
- [ ] media/fonts/ folder contains files
- [ ] media/katex.css exists

## Step-by-Step Testing

### Setup
1. Open the editor with a .md file
2. Open Browser DevTools (F12)
3. Go to Console tab
4. You should see initialization logs

### Test 1: Simple Block Formula (✅ BASIC)

**Steps:**
1. Click the Math button (∑∫ icon)
2. In the formula input, type: `x + y = z`
3. Verify the preview updates with formula display
4. Select "Display (Block)" from dropdown
5. Click "Insert"

**Verify:**
- [ ] Modal closes
- [ ] Formula appears in document on its own line
- [ ] Formula is centered and has dark background
- [ ] Console shows: `[Math] Block X: Rendered successfully`
- [ ] Console shows: `[Math] Block X: Inserted into DOM`

**Expected Visual:**
```
        x + y = z
        (dark background, centered)
```

---

### Test 2: Inline Formula (✅ BASIC)

**Steps:**
1. Click Math button
2. Type: `E=mc^2`
3. Select "Inline" mode
4. Click "Insert"

**Verify:**
- [ ] Formula appears in text flow
- [ ] Formula has subtle background (lighter than block)
- [ ] Text wraps around it naturally
- [ ] Console shows: `[Math] Inline X: Rendered successfully`

**Expected Visual:**
```
Some text with E=mc^2 formula inline.
        (subtle background)
```

---

### Test 3: Fraction (✅ INTERMEDIATE)

**Steps:**
1. Click Math button
2. Type: `\frac{\sum_{i=1}^{n} x_i}{n}`
3. Use Block mode
4. Click Insert

**Verify:**
- [ ] Fraction displays properly
- [ ] Summation symbol shows with limits
- [ ] Layout is correct (numerator above denominator)
- [ ] Console: "Rendered successfully"

**Expected Visual:**
```
        ∑ⁿᵢ₌₁ xᵢ
        ─────────
           n
```

---

### Test 4: Greek Letters (✅ INTERMEDIATE)

**Steps:**
1. Click Math button
2. Type: `\alpha \beta \gamma \pi`
3. Block mode
4. Click Insert

**Verify:**
- [ ] Greek letters render correctly
- [ ] Spacing is proper
- [ ] Formula renders without errors

**Expected Visual:**
```
        α β γ π
```

---

### Test 5: Square Root (✅ INTERMEDIATE)

**Steps:**
1. Click Math button
2. Type: `\sqrt{x^2 + y^2}`
3. Block mode
4. Click Insert

**Verify:**
- [ ] Square root symbol displays
- [ ] Content under radical is correct
- [ ] Proper nested formatting

**Expected Visual:**
```
        √(x² + y²)
```

---

### Test 6: Error Handling (✅ ERROR CASE)

**Steps:**
1. Click Math button
2. Type: `\frac{incomplete` (missing closing brace)
3. Watch the preview area

**Verify:**
- [ ] Preview shows error message
- [ ] Error message explains what's wrong
- [ ] Insert button is disabled (optional)
- [ ] User can fix and try again

**Expected:**
```
Error: "Unexpected end of input" (or similar)
```

---

### Test 7: Hebrew with Math (✅ RTL SUPPORT)

**Steps:**
1. Type Hebrew text: `סכום מתמטי:`
2. Click Math button
3. Type: `\sum x_i`
4. Use Inline
5. Click Insert
6. Type more Hebrew text after

**Verify:**
- [ ] Hebrew text displays correctly
- [ ] Math formula displays in correct direction
- [ ] No mixing of text directions in formula
- [ ] Layout looks clean

**Expected:**
```
סכום מתמטי: ∑xᵢ ו​עוד טקסט
(Hebrew RTL with inline LTR math)
```

---

### Test 8: Save and Reload (✅ PERSISTENCE)

**Steps:**
1. Insert a formula (any type)
2. Close the file (Ctrl+W)
3. Reopen the same file
4. Wait for content to load

**Verify:**
- [ ] Formula is still there
- [ ] Formula still renders correctly
- [ ] No console errors
- [ ] Console shows rendering log messages

**This tests:** Data persistence and content reloading

---

### Test 9: Multiple Formulas (✅ BATCH RENDERING)

**Steps:**
1. Insert 3-5 different formulas (mix of block and inline)
2. Mix with regular text
3. Check console output

**Verify:**
- [ ] All formulas render
- [ ] Console shows: `[Math] Found 5 math blocks`
- [ ] Console shows: `[Math] Found X inline math elements`
- [ ] Each formula logs as rendered
- [ ] No formulas are skipped

**This tests:** Batch rendering performance

---

### Test 10: Complex Nested Formula (✅ ADVANCED)

**Steps:**
1. Click Math button
2. Type: `\frac{\sqrt{a^2 + b^2}}{c + \frac{d}{e}}`
3. Block mode
4. Insert

**Verify:**
- [ ] Complex nesting renders correctly
- [ ] All parts are visible and properly formatted
- [ ] No overlapping elements
- [ ] Mathematical hierarchy is clear

**This tests:** Complex formula capability

---

## Quick Verification Checklist

After each formula insertion, verify:
- [ ] No JavaScript errors in console
- [ ] No red error messages in preview
- [ ] Console shows `[Math]` logs
- [ ] Formula renders visually
- [ ] Dark theme styling applied
- [ ] Proper spacing and sizing

## Console Check

Open DevTools Console and verify:

```javascript
// Should return the version
katex.version
// Expected: "0.16.27"

// Should return number of math blocks
document.querySelectorAll('[data-mdwe="math-block"]').length
// Should match visible formulas

// Should return the formula text
document.querySelector('[data-mdwe="math-block"]').getAttribute('data-formula')
// Expected: your formula text
```

## Final Acceptance Criteria

✅ **All formulas render visually**  
✅ **No JavaScript errors in console**  
✅ **Formulas persist after save/reload**  
✅ **Block and Inline modes work**  
✅ **Error messages display for invalid formulas**  
✅ **Hebrew/RTL text works with formulas**  
✅ **Multiple formulas render correctly**  
✅ **Console logs show successful rendering**  

## If Tests Fail

1. **Check console for `[Math]` logs** → tells you if rendering is happening
2. **Check if formulas exist in DOM** → `querySelectorAll('[data-mdwe]')`
3. **Check if `data-formula` attribute has value** → `.getAttribute('data-formula')`
4. **Check KaTeX availability** → `typeof katex` should be "object"
5. **Rebuild and reload** → `npm run build` + refresh browser

---

**Test Date**: ___________  
**Tester**: ___________  
**Pass/Fail**: ___________  
**Notes**: ___________________________________________

