# RTF Markdown Editor

**Word-like WYSIWYG Markdown Editor for VS Code** — RTL-first, Azure DevOps Mermaid, Autosave, **100% Offline**

A rich text editor extension for VS Code that provides a Microsoft Word / Google Docs-like editing experience for Markdown files, with special emphasis on right-to-left (RTL) languages like Hebrew and Arabic, automatic saving, and support for Azure DevOps Wiki Mermaid diagrams.

## Features

### ✅ Text Formatting
- **Bold** (Ctrl+B)
- **Italic** (Ctrl+I)
- **Underline** (Ctrl+U)
- **Strikethrough**
- **Inline Code**
- **Superscript & Subscript** (when supported in Markdown)

### ✅ Paragraph & Block Formatting
- **Headings**: H1–H6 style selection
- **Block Quotes**: Multi-level block quotes with > syntax
- **Code Blocks**: Syntax-highlighted with language detection
- **Horizontal Rules**: Visual separator lines
- **Line Breaks**: Soft and hard breaks preserved

### ✅ Lists & Tables
- **Unordered Lists** (bullet points)
- **Ordered Lists** (numbered)
- **Nested Lists**: Full nesting support
- **Tables**: Create, edit, and format markdown tables with:
  - Multiple columns and rows
  - Alignment (left, center, right)
  - Header rows
  - Pipes and delimiter preservation

### ✅ Links & Media
- **Hyperlinks**: Insert, edit, and remove links
- **Image Insertion**: Support for:
  - Relative paths (local files)
  - Absolute URLs
  - Image attributes (alt text, titles)
- **Link Previews**: Hover to see URLs
- **Image Scaling**: Respects markdown image syntax

### ✅ Colors & Styling
- **Text Color Picker**: Full RGB color selection
- **Highlight/Background Color**: Span-level highlighting
- **Alignment Controls**:
  - Left align
  - Center align
  - Right align
  - Justify (full)
- **Visual Feedback**: Toolbar buttons show current formatting

### ✅ RTL (Right-to-Left) Language Support
- **Hebrew**: Full first-class support
- **Arabic**: Full support (Persian, Urdu, etc.)
- **Automatic Detection**: Language detection from content
- **RTL Toggle Button**: Manual RTL/LTR switching
- **Proper Alignment**: Direction-aware alignment controls
- **Cursor Behavior**: Correct cursor movement in RTL text
- **Bidirectional Text**: Mixed LTR/RTL content support

### ✅ Diagram Support
- **Mermaid Diagrams**: Full integration with all Mermaid diagram types:
  - Flowcharts
  - Sequence diagrams
  - Gantt charts
  - Class diagrams
  - State diagrams
  - Entity-Relationship diagrams
  - User journey diagrams
  - Git graphs
  - Pie charts
- **Syntax**: Standard `\`\`\`mermaid` blocks (GitHub compatible) and `:::: mermaid` blocks (Azure DevOps compatible)
- **Live Editing**: Click diagram to open editor modal
- **Bundled Renderer**: No CDN required, fully offline

### ✅ Math Formulas (Partially Supported)
- **Block Math**: `$$formula$$` syntax with KaTeX rendering
- **Inline Math**: `$formula$` for inline mathematical notation
- **LaTeX Support**: Most standard LaTeX commands supported
- **KaTeX Engine**: Offline, bundled math renderer
- **Limitations**:
  - List item wrapping may break with complex inline math
  - Hebrew/Arabic text in `\text{}` commands not supported (English only)

### 🔒 100% Offline & Secure
- **No Internet Required**: All dependencies bundled locally
- **No CDN Calls**: Fonts, scripts, and styles are embedded
- **No Network Calls**: Extension functions completely offline
- **No Telemetry**: No data collection or tracking
- **Strict CSP**: Content Security Policy prevents external resource loading
- **No Runtime Downloads**: Everything needed is in the extension package
- **Complete Independence**: Works without VS Code Marketplace connection

### ✅ Autosave & Session Management
- **Automatic Saving**: 750ms debounce after changes stop
- **Smart Triggers**: Save on:
  - Editor blur (loses focus)
  - Tab hidden
  - File close
  - Window focus lost
- **Content Hashing**: Prevents unnecessary saves if no changes made
- **No Confirmation**: Seamless auto-save without dialogs
- **Preserves State**: Undo/redo history maintained during save

### ✅ File Handling
- **Markdown Format**: Always saved as standard Markdown (`.md`)
- **Round-Trip Preservation**: Open and save without edits = identical file
- **Syntax Preservation**: All original Markdown syntax preserved exactly
- **No Formatting**: No unwanted reformatting or style changes
- **Relative Paths**: Image and link paths handled correctly
- **UTF-8**: Full Unicode support including:
  - Hebrew
  - Arabic
  - Chinese
  - Japanese
  - Emojis
  - Special characters

### ✅ Editor Experience
- **WYSIWYG**: What-You-See-Is-What-You-Get editing
- **Toolbar**: Comprehensive formatting toolbar with visual feedback
- **Standard Shortcuts**: All VS Code keyboard shortcuts work:
  - Ctrl+Z (Undo)
  - Ctrl+Shift+Z (Redo)
  - Ctrl+A (Select All)
  - Ctrl+C/V (Copy/Paste)
  - And more...
- **Context Menus**: Right-click context menu support
- **Selection Formatting**: Apply formatting to selected text
- **Cursor Positioning**: Precise cursor control
- **Line Numbers**: Optional line numbering
- **Scroll Behavior**: Smooth scrolling and view management

## Installation

1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "RTF Markdown Editor"
4. Click Install

## Usage

### Opening a File

1. Right-click a `.md` file in the Explorer
2. Select **"Edit with RTF Markdown Editor"**
3. The file opens in a custom editor tab

### Toolbar Controls

#### Text Formatting
- **B** — Bold (Ctrl+B)
- **I** — Italic (Ctrl+I)
- **U** — Underline (Ctrl+U)
- **S** — Strikethrough
- **code** — Inline code

#### Paragraph Styles
- Dropdown to select: Paragraph, H1–H6

#### Alignment
- **◄** — Align left
- **◄►** — Align center
- **►** — Align right
- **◄ ►** — Justify

#### Lists
- **• List** — Bullet list
- **1. List** — Ordered list

#### Blocks
- **❝** — Block quote
- **{ }** — Code block

#### Colors & Highlight
- Color picker for text color
- Color picker for highlight/background color

#### Insert
- **🔗** — Insert link
- **🖼️** — Insert image (relative paths)
- **⊞** — Insert table
- **─** — Insert horizontal rule

#### Direction
- **RTL** — Toggle RTL/LTR mode

### Mermaid Diagrams

The editor supports **both** standard Markdown and Azure DevOps Wiki syntax for Mermaid diagrams:

**Standard Markdown (Triple Backticks):**
```markdown
\`\`\`mermaid
graph TD
  A[Start] --> B[Process]
  B --> C[End]
\`\`\`
```

**Azure DevOps Wiki (Triple/Quad Colons):**
```markdown
:::: mermaid
graph TD
  A[Start] --> B[Process]
  B --> C[End]
::::
```

**Format Preservation:** The editor automatically preserves the original fence format when you save. If you use backticks, it saves as backticks. If you use colons, it saves as colons.

**To edit a diagram:**
1. Click on the diagram placeholder
2. Edit the Mermaid source in the modal
3. Click **Save**

The diagram is automatically saved in your Markdown file using the original fence format.

### Math Formulas (Partially Supported)

The editor supports LaTeX math formulas using KaTeX:

**Block math:**
```markdown
$$\frac{a}{b}$$
```

**Inline math:**
```markdown
This is inline $x^2$ math.
```

**Limitations:**
- ⚠️ HTML list wrapping with complex inline math may break across lines
- ⚠️ Hebrew/Arabic text inside math mode (`\text{}`) is not supported—use English only
- KaTeX rendering is offline and fully bundled

### Autosave

The editor automatically saves your work:
- **750ms** after you stop typing
- When the editor loses focus (blur)
- When the tab is hidden
- When the file is closed

Content hashing prevents unnecessary saves if no changes were made.

### RTL (Right-to-Left) Languages

The editor defaults to RTL mode and automatically detects Hebrew and Arabic text.

**To toggle RTL/LTR:**
- Click the **RTL** button in the toolbar

Alignment controls work correctly in both modes:
- In RTL mode: left/right buttons are visually reversed
- Alignment is automatically applied based on direction

### Code Formatting

**Important:** All code (inline and code blocks) always uses left alignment, regardless of RTL/LTR mode:
- Inline code: `text-align: left`
- Code blocks: `text-align: left`
- This ensures code readability across all languages (code is language-neutral and follows universal programming conventions)

## File Format

Files are always saved in **Markdown** format. The editor:
1. Converts Markdown → HTML when opening
2. Edits as WYSIWYG HTML
3. Converts HTML → Markdown when saving
4. Preserves all original Markdown syntax
5. Preserves Mermaid `:::: mermaid` blocks exactly

### Round-Trip Stability

Opening and saving a file without edits produces identical output. No unwanted reformatting.

## Keyboard Shortcuts

All standard VS Code editor shortcuts work:
- **Ctrl+Z** — Undo
- **Ctrl+Shift+Z** — Redo
- **Ctrl+B** — Bold
- **Ctrl+I** — Italic
- **Ctrl+U** — Underline
- **Ctrl+A** — Select all
- **Ctrl+C** — Copy
- **Ctrl+V** — Paste

## Offline Mode

This extension is designed to work completely offline:

- ✅ No internet connection required
- ✅ No CDN dependencies
- ✅ No remote font loading
- ✅ No cloud storage integration
- ✅ Mermaid library is bundled locally
- ✅ All fonts and styles are system fonts

**The extension will function even with network completely disabled.**

## Security

- **Strict Content Security Policy (CSP)**: Prevents inline scripts, unsafe eval
- **Webview URI Sandboxing**: All assets are loaded via `webview.asWebviewUri()`
- **No `unsafe-eval`**: Extension code is pre-compiled, no runtime code generation
- **Local-only**: No data is sent to external servers

## Troubleshooting

### Editor doesn't appear
- Ensure VS Code is at least version 1.85.0
- Close and reopen the file
- Reload the VS Code window (Ctrl+R)

### Markdown not rendering correctly
- Check that the file is saved (Ctrl+S)
- Verify the Markdown syntax
- Try closing and reopening the file

### Mermaid diagrams not showing
- Check the Mermaid syntax using the official [Mermaid documentation](https://mermaid.js.org/)
- Ensure you're using `:::: mermaid` syntax (not ` ``` mermaid`)
- Try clicking the diagram to edit and re-save

### RTL text not displaying correctly
- Ensure the content includes Hebrew/Arabic characters, or manually enable RTL mode
- Try toggling the RTL button in the toolbar

## Technical Stack

- **Framework**: VS Code Extension API
- **Language**: TypeScript
- **Editor**: TipTap (ProseMirror)
- **Markdown**: markdown-it
- **Diagrams**: Mermaid (bundled locally)
- **Build**: esbuild
- **Runtime**: Node.js (extension host), Browser (webview)

## Development

### Build

```bash
npm install
npm run build
```

### Watch Mode

```bash
npm run watch
```

### Debug

1. Open the folder in VS Code
2. Press **F5** to start the debug session
3. Edit code and changes will reload automatically

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT

## Support

For issues, feature requests, or questions:
- Open an issue on GitHub
- Check existing issues for similar problems
- Provide details about your environment and steps to reproduce

---

**RTF Markdown Editor** — Offline, RTL-first, WYSIWYG Markdown editing for VS Code.
