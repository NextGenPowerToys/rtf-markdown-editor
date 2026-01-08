# RTF Markdown Editor - Complete Feature Showcase

Welcome to the **RTF Markdown Editor** for VS Code! This document demonstrates every feature supported by the editor. Edit it directly in VS Code using the custom editor provider.

---
## Text Formatting
### Basic Formatting
This paragraph includes **bold text**, *italic text*, ***bold and italic***, **underline**, ~~strikethrough~~, and `inline code`.
You can also apply **text color** using the color picker in the toolbar, and highlight text with background colors for emphasis.
### Font Selection
You can change the font family using the font dropdown in the toolbar. Supported fonts include system fonts optimized for your platform.
## Heading Levels
# Heading 1 (H1)
## Heading 2 (H2)
### Heading 3 (H3)
#### Heading 4 (H4)
##### Heading 5 (H5)
###### Heading 6 (H6)
## Text Alignment
This paragraph is **left-aligned** (default).
This paragraph is **center-aligned** using the alignment toolbar button.
This paragraph is **right-aligned**.
This paragraph is **justified**, meaning it stretches to fill the full width of the container.
## RTL (Right-to-Left) Support
The editor includes full support for Hebrew, Arabic, and other RTL languages. Click the **RTL/LTR toggle** in the toolbar to switch text direction.
Example in English first, then you can toggle RTL mode to edit Hebrew or Arabic text seamlessly.
**Features:**
- Auto-detection of RTL characters

- Manual RTL/LTR toggle button in toolbar

- Direction-aware alignment controls

- Proper spacing and border adjustments for RTL layout

## Lists
### Unordered List (Bulleted)
- **First item** in the list
- Nested item level 2
- Nested item level 3

- Back to level 2

- **Second item** in the list

- **Third item** in the list

### Ordered List (Numbered)
- **First step** - Description of the first step
- Sub-step A

- Sub-step B

- **Second step** - Description of the second step
- Sub-step A

- **Third step** - Description of the third step

## Block Elements

### Block Quote

> This is a blockquote. Use it to highlight important information or citations.
> 
> You can have multiple paragraphs in a blockquote by adding a `>` on each line.

### Code Block
```javascript
// Example JavaScript code block
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log(fibonacci(10)); // Output: 55
```

You can specify the language for syntax highlighting: javascript, python, typescript, html, css, etc.

### Horizontal Rule
---

Another horizontal rule:

---
## Tables
### Product Comparison Table
| Feature | RTF Editor | Standard Editor | Web Editor |
| --- | --- | --- | --- |
| WYSIWYG Editing | ✓ | ✗ | ✓ |
| Offline Support | ✓ | ✓ | ✗ |
| RTL Support | ✓ | ✗ | ✗ |
| Mermaid Diagrams | ✓ | ✗ | ✓ |
| Autosave | ✓ | ✗ | ✓ |

### Data Table
| Name | Email | Organization | Status |
| --- | --- | --- | --- |
| Alice Johnson | alice@example.com | TechCorp | Active |
| Bob Smith | bob@example.com | DevStudio | Active |
| Carol White | carol@example.com | WebDev Inc | Inactive |

## Links and Images
### External Links
Visit the [VS Code Marketplace](https://marketplace.visualstudio.com) to find and install extensions.
Learn more about [Markdown syntax](https://www.markdownguide.org/) for better documentation.
### Local Files and Relative Paths
You can link to files: [../README.md](../README.md)
You can embed images with relative paths:

![Editor Icon](assets/RTFMD.png)
## Mermaid Diagrams

### Flowchart Example
:::: mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E[End]
    D --> E
::::

### Sequence Diagram
:::: mermaid
sequenceDiagram
    participant User
    participant Editor
    participant FileSystem
    
    User->>Editor: Click Save
    Editor->>FileSystem: Write file
    FileSystem-->>Editor: Confirm save
    Editor-->>User: Show success message
::::

### Gantt Chart
:::: mermaid
gantt
    title Project Timeline
    dateFormat YYYY-MM-DD
    
    section Planning
    Requirements :req, 2026-01-08, 10d
    Design :des, 2026-01-18, 15d
    
    section Development
    Backend :crit, dev_b, 2026-02-02, 20d
    Frontend :dev_f, 2026-02-02, 20d
    
    section Testing
    QA :qa, 2026-02-22, 10d
    Release :rel, 2026-03-04, 5d
::::

### Class Diagram
:::: mermaid
classDiagram
    class Editor {
        -content: string
        -isDirty: boolean
        +save()
        +undo()
        +redo()
    }
    
    class Formatter {
        +bold(text)
        +italic(text)
        +code(text)
    }
    
    Editor --> Formatter
::::

### State Diagram
:::: mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Editing: User starts typing
    Editing --> Autosave: 750ms debounce
    Autosave --> Editing: Continue editing
    Autosave --> Idle: No changes
    Idle --> [*]
::::

**Click on any Mermaid diagram above to edit it!** The editor opens a modal where you can modify the diagram source and see real-time rendering.

---

## Mathematical Formulas

### Inline Formulas
The Pythagorean theorem states that $a^2 + b^2 = c^2$ for right triangles.

Einstein's famous equation is $E = mc^2$.

### Block Formulas
The quadratic formula is:

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

Integral calculus:

$$\int_0^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$

Matrix notation:

$$\begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix} = \begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}$$
## Editor Features

### Autosave
This document autosaves every **750ms** as you edit. There's no need to manually save—changes are written to disk automatically.

**Autosave triggers on:**
- Content changes (750ms debounce)
- Editor blur (when you click away)
- Tab hidden (when you switch windows)
- File close

### Undo / Redo
Use **Ctrl+Z** to undo and **Ctrl+Y** or **Ctrl+Shift+Z** to redo. The editor maintains full history of all edits.

### Copy / Paste
Standard clipboard support works seamlessly. Copy formatted text and paste it anywhere—the editor preserves formatting.

### Selection and Formatting
- Select text with mouse or keyboard
- Use toolbar buttons or keyboard shortcuts to apply formatting
- **Ctrl+B** for bold
- **Ctrl+I** for italic
- **Ctrl+U** for underline

---

## Keyboard Shortcuts
| Action | Windows/Linux | macOS |
| --- | --- | --- |
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Code | Ctrl+` | Cmd+` |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Save | Ctrl+S | Cmd+S |
| Find | Ctrl+F | Cmd+F |

## Editor Toolbar Controls

**Text Formatting:**
- Bold, Italic, Underline, Strikethrough
- Inline Code
- Text Color Picker
- Background/Highlight Color

**Paragraph Styles:**
- Heading dropdown (H1–H6)
- Paragraph style selector

**Alignment:**
- Left Align
- Center Align
- Right Align
- Justify

**Lists & Blocks:**
- Bullet List
- Ordered List
- Blockquote
- Code Block

**Insert:**
- Link (with URL dialog)
- Image (with path input)
- Table (configurable rows/columns)
- Horizontal Rule

**Direction:**
- RTL/LTR Toggle
- Auto-detection indicator

---

## Document Metadata

**Created**: January 2026
**Format**: Markdown
**Editor**: RTF Markdown Editor 1.1.1
**Status**: Production Ready
**License**: See LICENSE file

---

## Tips and Best Practices

1. **Use Mermaid diagrams** for flowcharts, sequence diagrams, and timelines
2. **Leverage RTL support** for multilingual documentation
3. **Apply colors strategically** to highlight important information
4. **Nest lists carefully** to maintain readability
5. **Use code blocks** with language syntax for technical documentation
6. **Trust autosave**—work without worrying about manual saves
7. **Keep diagrams updated** by clicking and editing them inline

---

## Additional Resources

- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Mermaid Documentation](https://mermaid.js.org/)
- [KaTeX Math Reference](https://katex.org/)

---

**Happy writing!** The RTF Markdown Editor is designed to make documentation and content creation seamless and enjoyable.