# Image Support Test

## How to Use Image Support

1. Click the **🖼️ Image** button in the toolbar
2. Select a PNG, JPG/JPEG, or SVG file from your computer
3. The image will be embedded in the editor as base64
4. Images display with:
   - Max width 100% (responsive)
   - Auto height scaling
   - Rounded corners and shadow effects
   - Hover effects for better UX

## Supported Image Formats

- **PNG** (.png) - Lossless format, good for graphics
- **JPG/JPEG** (.jpg, .jpeg) - Lossy format, good for photos
- **SVG** (.svg) - Vector format, scalable without quality loss

## Image Properties

When you insert an image:
- It's stored as **base64** in the markdown (embedded in the file)
- Images are **responsive** - they scale to 100% of container width
- Images have **shadows** for better visual distinction
- Images support **RTL** layout correctly

## Example Markdown

You can also manually add images using markdown syntax:

```markdown
![Alt text](path/to/image.png)
![Alt text](path/to/image.jpg)
![Alt text](path/to/image.svg)
```

Or with base64:

```markdown
![Alt text](data:image/png;base64,iVBORw0KGgo...)
```

## Notes

- Base64 images are embedded directly in the file (no external dependencies)
- Images are stored in markdown format compatible with other editors
- File size: Embedded base64 images will increase file size (~33% larger than binary)
- For large images, consider using external URLs instead
