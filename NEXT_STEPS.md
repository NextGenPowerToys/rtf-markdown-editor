# RTF Markdown Editor — Next Steps & Enhancement Plan

**Current Status**: ✅ Core features complete and tested
**Last Updated**: December 18, 2025

---

## 🎯 Prioritized Next Steps

### Phase 1: Code Container Styling ⭐ (HIGH PRIORITY)
**Goal**: Add professional syntax highlighting and styling to code blocks

#### Features to Implement:
- [x] **Code Block Styling**
  - Dark background with padding
  - Monospace font (Consolas, Monaco)
  - Line numbers (optional)
  - Syntax highlighting by language
  - Copy-to-clipboard button
  - Language indicator badge

- [x] **Inline Code Styling**
  - Light gray background
  - Inline monospace font
  - Subtle border/highlight

- [x] **Pre-formatted Text**
  - Preserve whitespace
  - Horizontal scrolling for long lines
  - Consistent padding

#### Design Reference:
```css
/* Code Block Container */
.ProseMirror pre {
  background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%);
  color: #e0e0e0;
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid #0078d4;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.5;
  margin: 1em 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.ProseMirror code {
  background: #f0f0f0;
  color: #d32f2f;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 0.9em;
}

/* Language Badge */
.code-language-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 120, 212, 0.8);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

/* Copy Button */
.code-copy-button {
  position: absolute;
  top: 8px;
  right: 80px;
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.code-copy-button:hover {
  background: rgba(0, 120, 212, 0.8);
  border-color: #0078d4;
}
```

#### Implementation Tasks:
1. Update `media/editor.css` with enhanced code styling
2. Add language detection in `media/editor.ts`
3. Add copy-to-clipboard functionality
4. Add language badge rendering
5. Update RTL support for code containers
6. Test with multiple languages (Python, JavaScript, SQL, YAML, etc.)

---

### Phase 2: Mermaid Diagram Enhancements 🔄 (HIGH PRIORITY)
**Goal**: Improve Mermaid diagram editing UX with visual diagram preview

#### Features to Implement:
- [ ] **Live Diagram Preview**
  - Split pane editing
  - Real-time Mermaid rendering
  - Error messages for invalid syntax

- [ ] **Diagram Type Support**
  - Flowchart (✅ already supported)
  - Sequence diagram
  - Class diagram
  - State machine
  - Gantt chart
  - Entity relationship diagram

- [ ] **Enhanced Modal**
  - Larger modal with side-by-side view
  - Live preview pane
  - Syntax hints/templates
  - Zoom controls

#### Design Reference (Split View):
```
┌─────────────────────────────────────────┐
│ Edit Mermaid Diagram                    │
├──────────────────┬──────────────────────┤
│                  │                      │
│  Source Code     │  Live Preview        │
│  (Textarea)      │  (SVG Render)        │
│                  │                      │
│  ```mermaid      │  ┌─────────────────┐ │
│  graph TD        │  │   Graph Title   │ │
│  A[Node A]       │  └────────┬────────┘ │
│  B[Node B]       │           │          │
│  A --> B         │      ┌────┴────┐     │
│  ```             │      ▼         ▼     │
│                  │   [Box1]   [Box2]    │
│                  │                      │
├──────────────────┴──────────────────────┤
│ Save             Cancel        Zoom: 100% │
└─────────────────────────────────────────┘
```

#### Implementation Tasks:
1. Create enhanced modal component
2. Add Mermaid live rendering in modal
3. Add diagram type selector/templates
4. Add zoom/pan controls
5. Improve error handling and display
6. Add keyboard shortcuts (Ctrl+Enter to save)
7. Test all diagram types

---

### Phase 3: Table Enhancements 📊 (MEDIUM PRIORITY)
**Goal**: Improve table editing and display

#### Features to Implement:
- [ ] **Table Insert Dialog**
  - Rows/columns input
  - Header row option
  - Quick insert from toolbar

- [ ] **Table Editing Controls**
  - Insert row above/below
  - Insert column left/right
  - Delete row/column
  - Merge cells (advanced)

- [ ] **Table Styling**
  - Alternating row colors
  - Header row highlight
  - Hover effects
  - Border customization

- [ ] **Markdown Table Preservation**
  - ✅ Already fixed in commit 7d1f70c
  - Verify with complex tables
  - Test with merged cells

#### Implementation Tasks:
1. Add table insert dialog to toolbar
2. Add row/column management buttons
3. Enhance table CSS for visual appeal
4. Add table context menu
5. Test round-trip preservation

---

### Phase 4: List & Block Elements ✅ (MEDIUM PRIORITY)
**Goal**: Enhanced formatting for lists and blockquotes

#### Features to Implement:
- [ ] **Ordered/Unordered Lists**
  - Nested list styling
  - Keyboard shortcuts (Tab/Shift+Tab)
  - Drag-to-reorder
  - List type selector (bullet, number, checkbox)

- [ ] **Blockquotes**
  - Enhanced styling with left border
  - Quote decoration/icons
  - Nested blockquotes

- [ ] **Dividers/Horizontal Lines**
  - Insert separator
  - Visual styling

#### Implementation Tasks:
1. Update list styling in CSS
2. Add list control buttons
3. Implement keyboard shortcuts
4. Add blockquote styling
5. Test nested structures

---

### Phase 5: Link & Image Management 🔗 (MEDIUM PRIORITY)
**Goal**: Improved link and image handling

#### Features to Implement:
- [ ] **Link Dialog**
  - URL input with validation
  - Link text editor
  - Open link button
  - Link preview

- [ ] **Image Support**
  - Image upload/drag-drop
  - Image URL input
  - Alt text editor
  - Image size controls
  - Image gallery preview

#### Implementation Tasks:
1. Create link insertion dialog
2. Create image insertion dialog
3. Add drag-drop image support
4. Add image resize handles
5. Test with various formats

---

### Phase 6: Find & Replace 🔍 (LOW PRIORITY)
**Goal**: Add search and replace functionality

#### Features to Implement:
- [ ] **Find Dialog**
  - Case-sensitive toggle
  - Regex support
  - Highlight all matches
  - Navigate matches (prev/next)

- [ ] **Replace Dialog**
  - Replace single
  - Replace all
  - Undo replace capability

#### Implementation Tasks:
1. Add find toolbar
2. Implement find logic
3. Add replace functionality
4. Add keyboard shortcuts (Ctrl+F, Ctrl+H)

---

### Phase 7: QA & Testing 🧪 (HIGH PRIORITY)
**Goal**: Comprehensive testing and quality assurance

#### Testing Checklist:
- [ ] **Feature Testing**
  - Code blocks with all languages
  - Mermaid diagrams (all types)
  - Tables (complex structures)
  - Lists (nested)
  - Links and images
  - RTL/LTR mixed content
  - Hebrew/Arabic support

- [ ] **Performance Testing**
  - Large files (100KB+)
  - Rapid editing
  - Memory usage
  - Autosave under load

- [ ] **Edge Cases**
  - Empty document
  - Unicode characters
  - Very long lines
  - Malformed Markdown
  - Corrupted tables

- [ ] **Cross-Platform**
  - Windows
  - macOS
  - Linux

#### Implementation Tasks:
1. Create test suite
2. Manual testing on all platforms
3. Performance profiling
4. Bug fixing and regression testing

---

### Phase 8: VSIX Packaging & Marketplace 📦 (FINAL)
**Goal**: Package and publish extension

#### Steps:
1. [ ] Minified production build
   ```bash
   npm run vscode:prepublish
   ```

2. [ ] Create VSIX package
   ```bash
   npm install -g vsce
   vsce package
   ```

3. [ ] Create publisher account on VS Code Marketplace

4. [ ] Submit for review

5. [ ] Monitor for issues and feedback

6. [ ] Version bump (0.0.1 → 0.1.0 → 1.0.0)

---

## 📋 Recommended Work Order

```
Week 1-2:  Code Container Styling (Phase 1)
Week 2-3:  Mermaid Enhancements (Phase 2)
Week 3-4:  Table & List Enhancements (Phases 3-4)
Week 4-5:  Link & Image Management (Phase 5)
Week 5-6:  Find & Replace (Phase 6)
Week 6-8:  QA & Testing (Phase 7)
Week 8-9:  VSIX & Marketplace (Phase 8)
```

---

## 🎨 Styling Standards

### Color Palette:
- **Primary**: #0078d4 (Blue)
- **Success**: #107c10 (Green)
- **Warning**: #ffb900 (Orange)
- **Error**: #d13438 (Red)
- **Background**: #ffffff (White)
- **Text**: #333333 (Dark Gray)
- **Border**: #e0e0e0 (Light Gray)
- **Code BG**: #f0f0f0 (Lighter Gray)
- **Code Dark**: #1e1e2e (Dark Blue-Gray)

### Typography:
- **UI**: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto
- **Code**: 'Consolas', 'Monaco', 'Courier New', monospace
- **Sizes**: 12px (small), 14px (regular), 16px (large)

### Spacing:
- **Padding**: 8px, 12px, 16px, 20px
- **Margin**: 1em, 1.5em, 2em
- **Gap**: 4px, 8px, 12px

---

## 📝 Notes

- All changes must maintain RTL/LTR support
- Offline operation must remain guaranteed
- No external dependencies without bundling
- All code must be TypeScript with strict mode
- Security: Strict CSP, no eval, no unsafe code

---

## 🔗 Related Documentation

- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Current implementation status
- [FINAL_REPORT.md](./FINAL_REPORT.md) - Production readiness report
- [QUICKSTART.md](./QUICKSTART.md) - Developer quick start
- [README.md](./README.md) - User documentation

