# Plan: RFC 7763 Full Compliance + Custom Extensions

Implement complete RFC 7763 (text/markdown Media Type) compliance while preserving all existing extensions (Math, Mermaid, RTL, inline styles). Transform the editor into a standards-compliant markdown processor with enhanced interoperability.

## Steps

### 1. Add `.markdown` extension and settings infrastructure

Update [package.json](package.json#L27-L31) to support both `.md` and `.markdown` file patterns, add configuration properties for `defaultCharset` (UTF-8/UTF-16/ISO-8859-1) and `defaultVariant` (CommonMark/GFM/Original), register settings schema in contributes.configuration section.

### 2. Implement charset detection and metadata system

Add `chardet`, `iconv-lite`, and `he` dependencies to [package.json](package.json), create new `MarkdownMetadata` interface in [src/types/index.ts](src/types/index.ts) with charset/variant/fragment/previewType fields, modify [src/editors/MarkdownWordEditorProvider.ts](src/editors/MarkdownWordEditorProvider.ts#L389) to detect file encoding on open using `chardet`, store metadata in `WebviewDocument` class, add charset conversion on read/write operations.

### 3. Implement fragment identifier support for line navigation

Parse `uri.fragment` in [openCustomDocument](src/editors/MarkdownWordEditorProvider.ts#L21-L25) to extract `#line=N` syntax, pass fragment data to webview via [sendInitialContent](src/editors/MarkdownWordEditorProvider.ts#L155), implement scroll-to-line functionality in [media/editor.ts](media/editor.ts#L126) handleMessageFromExtension, add line highlighting in TipTap editor, create "Copy Link to Line" command in [src/extension.ts](src/extension.ts).

### 4. Add variant tracking and processing

Detect markdown variant (GFM features like tables, task lists, strikethrough) in [src/utils/markdownProcessor.ts](src/utils/markdownProcessor.ts#L4-L9), store detected variant in metadata, add variant selector UI in webview toolbar, adjust markdown-it configuration based on variant, preserve variant parameter across save operations.

### 5. Enhance entity handling and Setext preservation

Replace custom `decodeHtmlEntities` in [src/utils/htmlProcessor.ts](src/utils/htmlProcessor.ts#L324-L337) with `he` library for comprehensive HTML entity support (all HTML5 named + numeric entities), detect Setext heading style (underline with `=`/`-`) during parse, store original heading style in metadata, modify [htmlToMarkdown](src/utils/htmlProcessor.ts#L178-L184) to preserve Setext format on round-trip.

### 6. Add charset/variant UI and documentation

Create status bar items showing current charset and variant, add charset selector dropdown in editor toolbar, add variant selector (Original/CommonMark/GFM/MultiMarkdown) in settings, update [README.md](README.md) with RFC 7763 compliance section, document fragment identifier syntax, create charset troubleshooting guide for non-UTF-8 files.

## Further Considerations

### Backward compatibility

Should existing `.md` files automatically detect variant, or require explicit opt-in? Metadata can be stored in file frontmatter (YAML) or VS Code file properties.

### Extension isolation

Math/Mermaid/RTL extensions should be marked as non-standard in variant declaration. Recommend variant identifier: `GFM-Extended` or custom `RTFMarkdown`.

### Performance impact

Charset detection adds ~10-50ms per file open. Should we cache charset metadata in workspace state? Consider lazy detection for large files.

## Offline Guarantee

All proposed changes maintain 100% offline capability:

- **chardet** (~80KB) - Pure algorithmic charset detection
- **iconv-lite** (~150KB) - Local encoding conversion tables
- **he** (~40KB) - Bundled HTML5 entity maps

Total bundle increase: ~100KB compressed (~270KB uncompressed)

All libraries are pure JavaScript with zero network calls, bundled via esbuild like existing dependencies (markdown-it, mermaid, katex).

## Bundle Size Impact

| Component | Before | After RFC | Change |
|-----------|--------|-----------|--------|
| Extension | ~2.5MB | ~2.6MB | +100KB |
| Mermaid | ~800KB | ~800KB | Same |
| KaTeX | ~600KB | ~600KB | Same |
| **Total** | ~3.9MB | ~4.0MB | **+2.5%** |

## RFC 7763 Compliance Checklist

- [ ] **Required**: Charset parameter support (UTF-8/UTF-16/ISO-8859-1)
- [ ] **Required**: File extension support (both `.md` and `.markdown`)
- [ ] **Optional**: Variant parameter (Original/CommonMark/GFM)
- [ ] **Specified**: Fragment identifiers (`#line=N` syntax)
- [ ] **Processing Rule**: Comprehensive HTML entity references
- [ ] **Processing Rule**: Backslash escapes (already supported via markdown-it)
- [ ] **Optional**: Setext heading preservation (underline style)
- [ ] **Proposed**: Preview-type parameter metadata

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. Add `.markdown` extension support
2. Add dependencies (chardet, iconv-lite, he)
3. Add configuration schema for charset/variant

### Phase 2: Core RFC Compliance (3-5 days)
4. Implement charset detection on file open
5. Add MarkdownMetadata interface and storage
6. Implement variant detection (GFM features)
7. Replace entity decoder with `he` library

### Phase 3: Advanced Features (5-7 days)
8. Implement fragment identifier parsing
9. Add scroll-to-line functionality
10. Add charset/variant status bar items
11. Preserve Setext heading style

### Phase 4: Documentation & Testing (2-3 days)
12. Update README with RFC 7763 compliance section
13. Add charset troubleshooting guide
14. Document fragment identifier syntax
15. Test with various encodings and variants
