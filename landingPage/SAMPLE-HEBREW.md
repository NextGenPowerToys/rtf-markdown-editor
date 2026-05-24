# R T F M a r kd own E di tor - הדגמה מלאה של

## התכונות
- ברכה! ל R T F M a r kd own E di tor - V S C o de באמצעות custom editor provider ישירות.
- טקסט עיצוב בסיסי:
  - פסקה זו כוללת טקסט מודגש, בשיפוע טקסט, קו תחתון, חציצה, ו inline code.
  - באפשרותך להחיל טקסט צבעי ורקע צבעי באמצעות הטולבר color picker.
  - בחירת F ont: בטולבר drop down אפשר לשנות את משפחת הגופנים (font family).
  - כוללים syst e m f onts המותאמים לפלטפורמה שלך.

## כותרים רמות
- (H1) כותרת 1
- (H2) כותרת 2
- (H3) כותרת 3
- (H4) כותרת 4
- (H5) כותרת 5
- (H6) כותרת 6

## יישור טקסט
- פסקה זו יושרה לימין (ברירת מחדל).
- פסקה זו יושרה למרכז באמצעות כפתור alignment בטולבר.
- פסקה זו יושרה לשמאל.
- פסקה זו היא justified — כלומר נמתחת למלוא רוחב הקונטיינר.

## RTL (Right-to-Left) תמיכה
- לחץ על ה‑R T L / L T R toggle בטולבר כדי להחליף את כיוון הטקסט.
- העורך כולל תמיכה מלאה בעברית, ערבית ושפות RTL אחרות.
- תכונת Auto-detection של R T L תווים מטפלת באופן אוטומטי בכיוון הטקסט.

## כפתור ידני לטOGGLE R T L / L T R
- בקרה על כיוון הטקסט עם alignment controls מודעים ל‑R T L.
- layout וגבולות ריווח מתאימים ל‑R T L.

## רשימות
- (Bullet List) רשימה לא מסודרת
  - ברשימה ראשון פריט
  - 2 רמה מקונן פריט
    - 3 רמה מקונן פריט
    - 2 לרמה חזרה
  - ברשימה שני פריט
  - ברשימה שלישי פריט
- (Ordered List) רשימה מסודרת
  1. הראשון שלב תיאור - ראשון שלב
     - A שלב - תת
     - B שלב - תת
  2. השני השלב תיאור - שני שלב
     - A שלב - תת
  3. השלישי השלב תיאור - שלישי שלב

## Block Elements
### Block Quote
- זהו block quote. השתמש בו כדי להדגיש ציטוטים או מידע חשוב.
- על ידי הוספת < בכל שורה של פסקאות - יכול לך מספר פסקאות להיות ב‑block quote.

### Code Block
- דוגמת Python code block:
```python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

print(fibonacci(10)) # Output: 55
```
- ניתן לציין את ה‑lang עבור syntax highlighting: ja v a s c r i pt, pyt h on, typ e s c r i pt, h tml, css וכו'.

### Horizontal Rule
- H or i zont a l R ul e

## טבלאות
### טבלת השוואת מוצרים
| תכונה | R T F E di tor | S t a n da r d E di tor | W eb E di tor |
|---|---:|---:|---:|
| WY SI WY G E di t i n g | ✓ | ✗ | ✓ |
| O ff l i n e S upport | ✓ | ✓ | ✗ |
| R T L S upport | ✓ | ✗ | ✗ |
| M e rm aid D iag r a ms | ✓ | ✗ | ✓ |
| A utos a v e | ✓ | ✗ | ✓ |

### Data Table
| שם | Email | ארגון | סטטוס |
|---|---|---|---|
| Alice Johnson | alice@example.com | Tech Corp | Active |
| Bob Smith | bob@example.com | Dev Studio | Active |
| Carol White | carol@example.com | Web Dev Inc | Inactive |

## קישורים ותמונות
- External Links
- למציאת ההתקנות וה‑extensions עבור V S C o de בקר ב‑Marketplace.

## נתיבים יחסיים וקבצים מקומיים
- ניתן לקשר לקבצים באמצעות README.md/.. .
- ניתן להטביע תמונות עם relative paths.

## אייקון העורך ו‑Mermaid
- Mermaid Diagrams: Flow chart דוגמה, Sequence Diagram, Gantt Chart, Class Diagram, State Diagram.
- העורך מציע render בזמן אמת — לחץ על source כדי לערוך ולראות את ה‑Mermaid diagram מתעדכן.

## נוסחאות מתמטיות (Mathematical Formulas)
- Inline formulas:
  - משפט פיתגורס עבור משולשים ישרי זווית.
  - משוואת איינשטיין המפורסמת.
- Block formulas:
  - נוסחה ריבועית (quadratic).
  - אינטגרל חישובי (Integral calculus).
  - Matrix notation.

## תכונות העורך
- **Autosave:** שינויים נכתבים לדיסק באופן אוטומטי — אין צורך לשמור ידנית. Autosave מופעל על מסמך זה (750 ms debounce).
- **Editor blur:** שמירה בעת איבוד פוקוס (כאשר לוחץ במקום אחר).
- **Tab hidden:** חלונות מחליף כשאתה Tab hidden.
- **File close, Undo/Redo:** השתמש ב‑Ctrl+Z ללחזור אחורה וב‑Ctrl+Shift+Z או Ctrl+Y להתקדם.

## העתק/הדבק
- העורך שומר על העיצוב בעת העתק/הדבק באותו מקום — תמיכה ב‑clipboard חלקה.

## Formatting & Selection
- בחר טקסט בעזרת מקלדת או עכבר.
- העבר עיצוב באמצעות קיצורי מקלדת או כפתורי טולבר:
  - Ctrl + B — bold
  - Ctrl + I — italic
  - Ctrl + U — underline

## קיצורי מקלדת
| macOS | Windows / Linux | פעולה |
|---:|---:|---|
| Cmd + B | Ctrl + B | Bold |
| Cmd + I | Ctrl + I | Italic |
| Cmd + U | Ctrl + U | Underline |
| ` + Cmd | ` + Ctrl | Code |
| Cmd + Z | Ctrl + Z | Undo |
| Cmd + Shift + Z | Ctrl + Y | Redo |
| Cmd + S | Ctrl + S | Save |
| Cmd + F | Ctrl + F | Find |

## Editor Toolbar Controls
- **Text Formatting:** Bold, Italic, Underline, Strike through
- **Inline Code**
- **Text Color Picker**
- **Background / Highlight Color**
- **Paragraph Styles:** Heading dropdown (H1–H6), paragraph style selector
- **Alignment:** Left Align, Center Align, Right Align, Justify
- **Lists & Blocks:** Bullet List, Ordered List, Block quote, Code Block
- **Insert:** Link (עם URL dialog), Image (עם path input), Table (configurable rows/columns), Horizontal Rule
- **Direction:** R T L / L T R Toggle, Auto-detection indicator

## מסמך Metadata
- **Created:** January 2026
- **Format:** Markdown
- **Editor:** R T F M a r kd own E di tor 1.1.0
- **Status:** Production Ready
- **LICENSE file:** ראה : License

## טיפים ועיקרי הטובים
- השתמש ב‑Mermaid diagrams עבור timelines, flow charts ו‑sequence diagrams.
- נצל היטב את התיעוד הרב עבור R T L support.
- הדגש מידע חשוב בחוכמה עם צבעים.
- שמור על readability על ידי זהירות ברשימות מקוננות.
- השתמש ב‑code blocks עבור תיעוד טכני של שפות.
- התבסס על autosave כדי לדאוג ללא שמירות ידניות.
- עדכן ולחץ כדי לערוך ולהתאים inline diagrams.

## משאבים נוספים
- V S C o de Extension Marketplace
- Markdown Guide
- Mermaid Documentation
- KaTeX Math Reference

*(מהנה הכתיבה ועיצובה R T F M a r kd own E di tor — להפוך את התיעוד שלך לחלקה וזורמת.)*
