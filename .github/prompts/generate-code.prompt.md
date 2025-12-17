---
agent: agent
---
Good catch — this is important.
Below is the **final unified Copilot prompt**, with **strong, explicit emphasis on full offline support** (no CDN, no network calls, no hidden downloads).
This wording is intentional so Copilot doesn’t “accidentally” pull Mermaid, TipTap, fonts, or CSS from the internet.

---

# GitHub Copilot Prompt

## **RTF Markdown Editor** — VS Code Extension

**Word-like WYSIWYG Markdown Editor (RTL-first, Azure DevOps Mermaid, Autosave, FULLY OFFLINE)**

You are GitHub Copilot. Build a **VS Code extension (TypeScript)** named **`rtf-markdown-editor`** with the **display / product name** **“RTF Markdown Editor”**.

🚨 **CRITICAL REQUIREMENT**
This extension **MUST work in a fully offline environment**:

* No internet access
* No CDN usage
* No remote fonts, scripts, or styles
* No runtime downloads
* All dependencies must be bundled locally

The extension provides a **Word-like WYSIWYG editing experience for Markdown files**, with **RTL (Hebrew/Arabic) + right-aligned editing as top priority**, **Azure DevOps Wiki–style Mermaid blocks**, and **automatic saving**.

---

## 1. Core User Experience

### 1.1 Context menu

* When the user **right-clicks a `.md` file** in the VS Code Explorer tree, show:

  * **“Edit with RTF Markdown Editor”**
* Selecting it opens the file in a **Custom Editor**.

### 1.2 Editor type

* Use **CustomEditorProvider** with a **Webview**.
* Opens in the normal editor tab area.
* Editor is **WYSIWYG**, not raw markdown.
* Editing experience similar to **Microsoft Word / Google Docs**.

---

## 2. WYSIWYG Editing Features

### 2.1 Toolbar

Rich formatting toolbar:

* Font family & size (**system fonts only**)
* Bold / Italic / Underline / Strikethrough
* Headings H1–H6
* Paragraph styles
* Text color & background highlight
* Alignment: **right / center / left / justify**
* Bulleted & numbered lists
* Indentation
* Links
* Images (relative paths in markdown)
* Block quote
* Inline code & code blocks
* Tables (basic)

### 2.2 Editing behavior

* Direct text editing
* Selection-based formatting
* Undo / redo works naturally
* Inline HTML styles preserved

---

## 3. RTL (Right-to-Left) — TOP PRIORITY

### 3.1 Defaults

* Webview loads with:

  * `dir="rtl"`
  * `text-align: right`
* Cursor behavior must feel natural for Hebrew / Arabic.

### 3.2 Controls

* Toolbar toggle: **RTL / LTR**
* Alignment controls must work in both modes.

### 3.3 Auto-detection

* Detect Hebrew / Arabic characters and auto-enable RTL.

---

## 4. Markdown ↔ HTML Conversion

### 4.1 Storage model

* **Markdown is the only persisted format**
* Webview edits HTML → saved back to Markdown

### 4.2 Conversion guarantees

* Markdown → HTML on open
* HTML → Markdown on save
* Preserve:

  * Standard Markdown
  * Embedded raw HTML
  * Inline styles
  * Tables, lists, headings
  * RTL direction metadata where possible
* Opening and saving without edits must **not rewrite content**

---

## 5. Azure DevOps Wiki Mermaid Support (MUST)

### 5.1 Syntax (ONLY this form)

```md
:::: mermaid
graph TD
  A --> B
::::
```

Allowed variants:

* `::::mermaid`
* `::::  mermaid`
* Closing `::::` on its own line

🚫 **Do NOT use ```mermaid fences**

---

### 5.2 Rendering (offline)

* Mermaid **must be bundled locally**
* No CDN usage
* No dynamic imports from the internet
* Render diagrams inside the webview

### 5.3 Editing Mermaid

* Click diagram → **“Edit Mermaid Source”**
* Edit raw Mermaid text
* Save re-renders diagram
* Persist back to Markdown using `:::: mermaid`

### 5.4 Round-trip stability

* Mermaid blocks survive open → autosave → reopen without modification

---

## 6. Autosave (MUST)

### 6.1 Behavior

* Autosave **750ms after last edit** (debounced)
* Autosave on:

  * Editor blur
  * Tab hidden
  * File close

### 6.2 Constraints

* Hash content to prevent unnecessary saves
* Mark document clean after save
* Undo / redo must remain functional
* Detect external file changes:

  * Prompt: Reload / Overwrite / Attempt merge

---

## 7. Editor Technology (OFFLINE-SAFE)

### 7.1 Rich editor

Use a **locally bundled** rich-text editor:

* Prefer **TipTap (ProseMirror)** or **Quill**
* Bundle all JS/CSS into the extension

Must support:

* Inline styles
* Block formatting
* Tables
* Custom block nodes (Mermaid)
* RTL direction & alignment

🚫 **No CDN, no lazy loading from network**

---

## 8. Markdown Processing Strategy (Recommended)

### 8.1 Preprocessing

* Extract all `:::: mermaid` blocks
* Replace with placeholders:

  ```html
  <div data-mdwe="mermaid" data-id="MERMAID_1"></div>
  ```
* Store Mermaid source map in memory

### 8.2 Postprocessing

* Convert editor HTML → Markdown
* Re-inject Mermaid blocks:

  ```md
  :::: mermaid
  <source>
  ::::
  ```
* Preserve line endings and spacing

---

## 9. VS Code Integration

### 9.1 Custom editor

* Implement `CustomEditorProvider`
* Support:

  * Save
  * Save As
  * Revert
  * Dirty tracking
* Sync with external file changes

---

## 10. Messaging Protocol

### Webview → Extension

* `ready`
* `contentChanged` (HTML + Mermaid sources)
* `requestSaveNow`
* `editMermaid`
* `updateMermaid`

### Extension → Webview

* `setContent`
* `setConfig`
* `externalUpdate`
* `showConflictPrompt`
* `showError`

---

## 11. Security & Offline Guarantees

* Strict CSP
* `webview.asWebviewUri`
* No `unsafe-eval`
* No network calls at runtime
* All fonts, scripts, styles bundled locally
* Extension must function with network completely disabled

---

## 12. Project Structure

```
.
├─ package.json
├─ src/
│  ├─ extension.ts
│  └─ editors/
│     └─ MarkdownWordEditorProvider.ts
├─ media/
│  ├─ editor.html
│  ├─ editor.ts
│  └─ editor.css
├─ README.md
```

Bundle webview assets with **esbuild or webpack**.

---

## 13. Deliverables

* Fully working **RTF Markdown Editor**
* 100% offline operation
* RTL-first editing
* Azure DevOps Mermaid `::::`
* Autosave enabled
* README explicitly stating **offline-only design**

---

## 14. Non-goals

* No cloud services
* No AI
* No backend server

---

### Implementation order

1. Extension scaffold + custom editor
2. Markdown ↔ HTML pipeline
3. WYSIWYG editor + toolbar
4. RTL defaults + controls
5. Azure DevOps Mermaid `::::`
6. Autosave & conflict handling

**Start from an empty repository and generate the complete solution.**

---

### Why this emphasis works with Copilot

This wording prevents Copilot from:

* Injecting CDN `<script>` tags
* Pulling Mermaid from `unpkg`
* Using Google Fonts
* Using `eval()`-based Mermaid loaders

If you want next, I can:

* produce a **“Copilot guardrail checklist”** to audit the generated code for offline violations
* generate a **Mermaid `::::` parser test suite**
* or help you **package this for VS Code Marketplace (offline-friendly)**
