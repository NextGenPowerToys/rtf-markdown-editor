# Restoring Image Alignment Feature

## Overview
This document describes how to restore the image alignment (positioning) feature that was temporarily removed.

## Date Removed
December 20, 2025

## Reason for Removal
Image resize was working properly and storing correctly, but positioning/alignment was not persisting. Feature temporarily disabled for troubleshooting.

---

## Files to Modify

### 1. `media/editor.ts`

#### A. Restore Alignment Toolbar Creation (in `selectImage()` function)

**Location:** Around line 720-735 in the `selectImage()` function, after resize handles are created.

**Code to restore:**
```typescript
// Create alignment toolbar
const toolbar = document.createElement('div');
toolbar.className = 'image-align-toolbar';
toolbar.style.position = 'fixed';
toolbar.style.left = `${rect.left}px`;
toolbar.style.top = `${rect.top - 40}px`;
toolbar.style.zIndex = '10000';
toolbar.innerHTML = `
  <button class="image-align-btn" data-align="left" title="Align Left">◄</button>
  <button class="image-align-btn" data-align="center" title="Center">◄►</button>
  <button class="image-align-btn" data-align="right" title="Align Right">►</button>
`;
document.body.appendChild(toolbar);
handleElements.push(toolbar);

// Add alignment button listeners
toolbar.querySelectorAll('.image-align-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const align = (e.target as HTMLElement).dataset.align;
    if (align && selectedImage) {
      applyImageAlignment(selectedImage, align);
    }
  });
});
```

#### B. Restore Toolbar Position Update (in `updateHandlePositions()` function)

**Location:** Around line 775 in the `updateHandlePositions()` function.

**Code to restore:**
```typescript
handles.forEach(handle => {
  if (handle.classList.contains('image-align-toolbar')) {
    // Update toolbar position
    handle.style.left = `${rect.left}px`;
    handle.style.top = `${rect.top - 40}px`;
  } else {
    // ... existing handle position update code ...
  }
});
```

#### C. Restore `applyImageAlignment()` Function

**Location:** Around line 791-841.

**Complete function to restore:**
```typescript
function applyImageAlignment(img: HTMLImageElement, align: string) {
  // Remove all alignment classes
  img.classList.remove('image-align-left', 'image-align-center', 'image-align-right');
  img.removeAttribute('style');
  
  // Apply new alignment
  if (align === 'left') {
    img.classList.add('image-align-left');
    img.style.display = 'block';
    img.style.marginLeft = '0';
    img.style.marginRight = 'auto';
  } else if (align === 'center') {
    img.classList.add('image-align-center');
    img.style.display = 'block';
    img.style.marginLeft = 'auto';
    img.style.marginRight = 'auto';
  } else if (align === 'right') {
    img.classList.add('image-align-right');
    img.style.display = 'block';
    img.style.marginLeft = 'auto';
    img.style.marginRight = '0';
  }
  
  // Preserve width and height
  if (img.hasAttribute('width')) {
    img.style.width = img.getAttribute('width') + 'px';
  }
  if (img.hasAttribute('height')) {
    img.style.height = img.getAttribute('height') + 'px';
  }
  
  // Update handle positions after alignment
  setTimeout(() => updateHandlePositions(), 10);
  
  // Force editor to detect changes and save
  if (editor) {
    const html = editor.getHTML();
    editor.commands.setContent(html, false);
    setTimeout(() => saveContent(), 100);
  }
  
  console.log('[Image] Applied alignment:', align);
}
```

#### D. Restore Canvas Alignment Buttons (in toolbar HTML)

**Location:** Around line 1175-1177 in the toolbar setup.

**Code to restore in toolbar HTML:**
```html
<button class="toolbar-button" data-action="alignLeft" title="Align Left">
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path fill="currentColor" d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z"/>
  </svg>
</button>
<button class="toolbar-button" data-action="alignCenter" title="Center">
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path fill="currentColor" d="M3,3H21V5H3V3M7,7H17V9H7V7M3,11H21V13H3V11M7,15H17V17H7V15M3,19H21V21H3V19Z"/>
  </svg>
</button>
<button class="toolbar-button" data-action="alignRight" title="Align Right">
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path fill="currentColor" d="M3,3H21V5H3V3M9,7H21V9H9V7M3,11H21V13H3V11M9,15H21V17H9V15M3,19H21V21H3V19Z"/>
  </svg>
</button>
```

#### E. Restore Canvas Alignment Button Handlers

**Location:** Around line 1225-1237 in the toolbar button event handlers.

**Code to restore in switch statement:**
```typescript
case 'alignLeft':
  editor?.chain().focus().setTextAlign('left').run();
  break;
case 'alignCenter':
  editor?.chain().focus().setTextAlign('center').run();
  break;
case 'alignRight':
  editor?.chain().focus().setTextAlign('right').run();
  break;
```

---

### 2. `media/editor.css`

#### Restore Alignment Toolbar Styles

**Location:** Around line 200-250.

**Code to restore:**
```css
/* Image alignment toolbar */
.image-align-toolbar {
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  padding: 4px;
  display: flex;
  gap: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.image-align-btn {
  background: #3e3e42;
  border: 1px solid #555;
  color: #ccc;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 2px;
  font-size: 14px;
  transition: background 0.2s;
}

.image-align-btn:hover {
  background: #505050;
  color: white;
}

.image-align-btn:active {
  background: #007acc;
}
```

---

## Testing After Restoration

1. **Image Alignment (from image toolbar):**
   - Select an image (click on it)
   - Verify alignment toolbar appears above image with 3 buttons (◄, ◄►, ►)
   - Click each button and verify image alignment changes
   - Check markdown file to ensure alignment persists with style attributes

2. **Canvas Text Alignment (from main toolbar):**
   - Select text in editor
   - Click align left/center/right buttons in main toolbar
   - Verify text alignment changes
   - Check markdown file to ensure text alignment persists

3. **Persistence Test:**
   - Align an image to center
   - Save file (Ctrl+S)
   - Close and reopen file
   - Verify image is still centered

---

## Known Issues Before Removal

- Image resize was storing properly with width/height attributes
- Image positioning was NOT persisting to markdown file
- Root cause: Alignment styles may not have been properly handled in `htmlProcessor.ts`

## Suggested Fix Before Re-enabling

Check `src/utils/htmlProcessor.ts` to ensure:
1. Style attributes (margin-left, margin-right, display) are preserved on `<img>` tags
2. Alignment classes (image-align-left/center/right) are handled correctly
3. The placeholder system doesn't strip style attributes during processing
