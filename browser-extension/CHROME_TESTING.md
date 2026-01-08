# Testing the Browser Extension in Chrome

## Loading the Extension

1. **Open Chrome** and navigate to `chrome://extensions/`

2. **Enable Developer Mode** - Toggle the switch in the top-right corner

3. **Load Unpacked Extension**
   - Click "Load unpacked"
   - Navigate to: `browser-extension/dist/`
   - Select the `dist` folder and click "Select"

## What to Expect

After loading, you should see:
- ✅ Extension icon appears in Chrome toolbar
- ✅ Extension loads without critical errors
- ✅ "Edit with RTF Markdown Editor" context menu appears when right-clicking on any page

## Testing the Extension

### 1. Test Context Menu
- Go to any webpage
- Right-click anywhere → Look for "Edit with RTF Markdown Editor"
- The menu should appear

### 2. Test on GitHub (Recommended)
- Go to any `.md` file on GitHub (e.g., a README.md)
- Right-click on the page
- Click "Edit with RTF Markdown Editor"
- **Expected result**: New tab opens with the editor

### 3. Debug Issues
If something goes wrong:

1. **Check Extension Errors**
   - Go to `chrome://extensions/`
   - Click "Details" on the RTF Markdown Editor extension
   - Scroll down and click "Errors"
   - You'll see all JavaScript errors

2. **Check Background Service Worker Logs**
   - Go to `chrome://extensions/`
   - Find RTF Markdown Editor
   - Click "background page" (or "Inspect views → service worker")
   - Check the Console tab for logs starting with `[RTF Editor]`

3. **Check Content Script Logs**
   - Go to any webpage
   - Open DevTools (F12)
   - Go to Console tab
   - Look for `[RTF Editor]` or `[GitHub Integration]` logs

## Common Issues & Fixes

### Issue: "Could not register contextMenus" error
**Solution**: Make sure manifest.json has `contextMenus` permission (it does)

### Issue: Editor tab opens but is blank
**Solution**: 
1. Check that `dist/editor/editor.html` exists
2. Check Chrome DevTools console (F12) for errors
3. Verify the context key was passed correctly in the URL

### Issue: Extension doesn't appear in toolbar
**Solution**:
1. Make sure you selected the `dist/` folder (not `browser-extension/`)
2. Try reloading the extension: Go to `chrome://extensions/` and click the refresh icon

## Rebuilding After Changes

If you make code changes:

```bash
cd browser-extension
npm run build
```

Then in Chrome:
- Go to `chrome://extensions/`
- Click the refresh icon on the extension
- Test again

## Testing Workflow

```
1. Make code changes in src files
2. Run: npm run build
3. Refresh extension in Chrome (chrome://extensions/)
4. Test functionality
5. Check Console for errors (F12)
6. Repeat
```

## Next Steps

After verifying basic functionality works:
1. Test GitHub markdown file editing
2. Test RTL (Arabic/Hebrew) text support
3. Test Mermaid diagram rendering
4. Test math equation rendering
5. Test file save/commit functionality
