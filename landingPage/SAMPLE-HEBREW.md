# RTF Markdown Editor - הדגמה מלאה של התכונות

!בברכה ל**RTF Markdown Editor** ל-VS Code! מסמך זה מדגים כל תכונה הנתמכת בעורך. ערוך אותו ישירות ב-VS Code באמצעות custom editor provider.

---

## עיצוב טקסט

### עיצוב בסיסי
פסקה זו כוללת **טקסט מודגש**, *טקסט בשיפוע*, ***מודגש ובשיפוע***, __קו תחתון__, ~~קו חציצה~~, ו-`inline code`.

באפשרותך גם להחיל **צבע טקסט** באמצעות color picker בטולבר, ולהדגיש טקסט עם צבעי רקע.

### בחירת Font
באפשרותך לשנות את משפחת הגופנים (font family) באמצעות dropdown בטולבר. גופנים נתמכים כוללים system fonts המותאמים לפלטפורמה שלך.

---

## רמות כותרים

# כותרת 1 (H1)
## כותרת 2 (H2)
### כותרת 3 (H3)
#### כותרת 4 (H4)
##### כותרת 5 (H5)
###### כותרת 6 (H6)

---

## יישור טקסט

פסקה זו **יושרה לימין** (ברירת מחדל).

פסקה זו **יושרה למרכז** באמצעות כפתור alignment בטולבר.

פסקה זו **יושרה לשמאל**.

פסקה זו **justified**, כלומר היא נמתחת למלוא רוחב הקונטיינר.

---

## תמיכה RTL (Right-to-Left)

העורך כולל תמיכה מלאה בעברית, ערבית וקשרו RTL אחרות. לחץ על **RTL/LTR toggle** בטולבר כדי להחליף את כיוון הטקסט.

דוגמה: אתה יכול לערוך טקסט בעברית וטקסט באנגלית בתוך אותו מסמך, והעורך יטפל בכיוון הטקסט באופן אוטומטי.

**תכונות:**
- Auto-detection של תווי RTL
- כפתור toggle RTL/LTR ידני בטולבר
- alignment controls שמודעים לכיוון הטקסט
- ריווח וגבולות מתאימים עבור layout RTL

---

## רשימות

### רשימה לא מסודרת (Bullet List)
- **פריט ראשון** ברשימה
  - פריט מקונן רמה 2
    - פריט מקונן רמה 3
  - חזרה לרמה 2
- **פריט שני** ברשימה
- **פריט שלישי** ברשימה

### רשימה מסודרת (Ordered List)
1. **שלב ראשון** - תיאור השלב הראשון
   1. תת-שלב A
   2. תת-שלב B
2. **שלב שני** - תיאור השלב השני
   1. תת-שלב A
3. **שלב שלישי** - תיאור השלב השלישי

---

## Block Elements

### Block Quote
> זהו blockquote. השתמש בו כדי להדגיש מידע חשוב או ציטוטים.
> 
> יכול להיות לך מספר פסקאות ב-blockquote על ידי הוספת `>` בכל שורה.

### Code Block
```python
# דוגמה Python code block
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10))  # Output: 55
```

אתה יכול לציין את ה-language עבור syntax highlighting: javascript, python, typescript, html, css, וכו'.

### Horizontal Rule
---

עוד Horizontal Rule:
---

## טבלאות

### טבלת השוואת מוצרים

| תכונה | RTF Editor | Standard Editor | Web Editor |
|---------|-----------|-----------------|-----------|
| WYSIWYG Editing | ✓ | ✗ | ✓ |
| Offline Support | ✓ | ✓ | ✗ |
| RTL Support | ✓ | ✗ | ✗ |
| Mermaid Diagrams | ✓ | ✗ | ✓ |
| Autosave | ✓ | ✗ | ✓ |

### Data Table
| שם | Email | ארגון | סטטוס |
|------|-------|--------------|--------|
| Alice Johnson | alice@example.com | TechCorp | Active |
| Bob Smith | bob@example.com | DevStudio | Active |
| Carol White | carol@example.com | WebDev Inc | Inactive |

---

## Links ותמונות

### External Links
בקר ב-[VS Code Marketplace](https://marketplace.visualstudio.com) כדי למצוא וההתקנת extensions.

קרא עוד על [Markdown syntax](https://www.markdownguide.org/) עבור תיעוד טוב יותר.

### Local Files ו-Relative Paths
אתה יכול לקשר לקבצים: [../README.md](../README.md)

אתה יכול להטבע תמונות עם relative paths:
![Editor Icon](./assets/RTFMD.png)

---

## Mermaid Diagrams

### דוגמה Flowchart
:::: mermaid
graph TD
    A[התחלה] --> B{החלטה}
    B -->|כן| C[Process A]
    B -->|לא| D[Process B]
    C --> E[סוף]
    D --> E
::::

### Sequence Diagram
:::: mermaid
sequenceDiagram
    participant User
    participant Editor
    participant FileSystem
    
    User->>Editor: לחץ Save
    Editor->>FileSystem: כתוב קובץ
    FileSystem-->>Editor: אשר שמירה
    Editor-->>User: הצג הודעת הצלחה
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

**לחץ על כל Mermaid diagram למעלה כדי לערוך אותו!** העורך פותח modal כאשר באפשרותך לשנות את ה-source של ה-diagram ולראות rendering בזמן אמת.

---

## נוסחאות מתמטיות (Mathematical Formulas)

### Inline Formulas
משפט פיתגורס קובע כי $a^2 + b^2 = c^2$ עבור משולשים ישרי זווית.

המשוואה המפורסמת של איינשטיין היא $E = mc^2$.

### Block Formulas
נוסחת ה-quadratic היא:

$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$

Integral calculus:

$$\int_0^{\infty} e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$

Matrix notation:

$$\begin{pmatrix} a & b \\ c & d \end{pmatrix} \begin{pmatrix} x \\ y \end{pmatrix} = \begin{pmatrix} ax + by \\ cx + dy \end{pmatrix}$$

---

## תכונות העורך

### Autosave
מסמך זה autosave כל **750ms** כשאתה עורך. אין צורך לשמור ידנית—שינויים נכתבים לדיסק באופן אוטומטי.

**Autosave מופעל על:**
- שינויים בתוכן (750ms debounce)
- Editor blur (כשאתה לוחץ במקום אחר)
- Tab hidden (כשאתה מחליף חלונות)
- File close

### Undo / Redo
השתמש ב-**Ctrl+Z** כדי לחזור אחורה ו-**Ctrl+Y** או **Ctrl+Shift+Z** כדי להתקדם. העורך שומר על היסטוריה מלאה של כל ה-edits.

### Copy / Paste
תמיכה clipboard עובדת בצורה חלקה. העתק טקסט מעוצב והדבק אותו בכל מקום—העורך משמר את העיצוב.

### Selection ו-Formatting
- בחר טקסט עם עכבר או keyboard
- השתמש בכפתורי טולבר או keyboard shortcuts להחיל עיצוב
- **Ctrl+B** עבור bold
- **Ctrl+I** עבור italic
- **Ctrl+U** עבור underline

---

## Keyboard Shortcuts

| פעולה | Windows/Linux | macOS |
|--------|---------------|-------|
| Bold | Ctrl+B | Cmd+B |
| Italic | Ctrl+I | Cmd+I |
| Underline | Ctrl+U | Cmd+U |
| Code | Ctrl+` | Cmd+` |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Y | Cmd+Shift+Z |
| Save | Ctrl+S | Cmd+S |
| Find | Ctrl+F | Cmd+F |

---

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
- Link (עם URL dialog)
- Image (עם path input)
- Table (configurable rows/columns)
- Horizontal Rule

**Direction:**
- RTL/LTR Toggle
- Auto-detection indicator

---

## Document Metadata

**Created**: January 2026
**Format**: Markdown
**Editor**: RTF Markdown Editor 1.1.0
**Status**: Production Ready
**License**: ראה LICENSE file

---

## טיפים ועיקרו הטובים

1. **השתמש ב-Mermaid diagrams** עבור flowcharts, sequence diagrams, וtimelines
2. **נצל את ה-RTL support** עבור תיעוד רב לשוני
3. **החל צבעים בחוכמה** כדי להדגיש מידע חשוב
4. **קינן רשימות בזהירות** כדי לשמור על readability
5. **השתמש ב-code blocks** עם language syntax עבור תיעוד טכני
6. **סמוך על autosave**—עבוד ללא דאגה לשמירות ידניות
7. **עדכן diagrams**—לחץ וערוך אותם inline

---

## משאבים נוספים

- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Mermaid Documentation](https://mermaid.js.org/)
- [KaTeX Math Reference](https://katex.org/)

---

**כתיבה מהנה!** ה-RTF Markdown Editor מעוצב כדי להפוך את יצירת התיעוד ותוכן לחלקה וזורמת.