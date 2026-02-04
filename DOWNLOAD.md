# Download RTF Markdown Editor from Marketplace

## PowerShell (Windows)

```powershell
Invoke-WebRequest -Uri "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/NGPowerToys/vsextensions/rtf-markdown-editor/1.1.5/vspackage" -OutFile "rtf-markdown-editor-1.1.5.vsix"
```

## curl.exe (Windows)

```bash
curl.exe -L "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/NGPowerToys/vsextensions/rtf-markdown-editor/1.1.5/vspackage" -o rtf-markdown-editor-1.1.5.vsix
```

## curl (Linux/Mac)

```bash
curl -L "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/NGPowerToys/vsextensions/rtf-markdown-editor/1.1.5/vspackage" -o rtf-markdown-editor-1.1.5.vsix
```

After downloading, install with:

```bash
code --install-extension rtf-markdown-editor-1.1.5.vsix
```
