# Mortgage Amortization Calculator - .NET 8
# מחשבון משכנתא - .NET 8
# חאסבת סדאד אלרהן אלעקארי - .NET 8

This is a .NET 8 C# implementation of the COBOL Mortgage Amortization program (MORTGAGE.CBL).
זוהי הטמעה ב-C# .NET 8 של תוכנית COBOL לחישוב משכנתא (MORTGAGE.CBL).
הד'א הוא תנפיד' C# .NET 8 לברנאמג' חסאב אלרהן אלעקארי COBOL (MORTGAGE.CBL).

## Overview / סקירה כללית / נט'רה עאמה

The application calculates and generates a complete mortgage amortization schedule with:
האפליקציה מחשבת ומייצרת לוח סילוקין מלא למשכנתא הכולל:
יקום אלתטביק בחסאב ואנשא ג'דול זמני כאמל לסדאד אלרהן אלעקארי מע:

- Fixed or variable interest rates
  - שיעורי ריבית קבועים או משתנים
  - אסעאר פאידה ת'אבתה או מתג'ירה

- Monthly payment breakdown (principal vs. interest)
  - פירוט תשלום חודשי (קרן מול ריבית)
  - תפציל חסאב אלדפע אתשהרי (אסל אלדין מוקאבל אלפאידה)

- Running balance and cumulative totals
  - יתרה שוטפת וסכומים מצטברים
  - אלרציד אלג'ארי ואלמג'אמיע אלתראכמיה

- Support for interest rate changes during the loan period
  - תמיכה בשינויי ריבית במהלך תקופת ההלוואה
  - דעם לתג'ייראת אסעאר אלפאידה ח'לאל פתרת אלקרד

## Project Structure / מבנה הפרויקט / היכל אלמשרוע

```
MortgageAmortization/
├── Models/
│   ├── LoanDetails.cs           - Loan parameters / פרטי הלוואה / מעלומאת אלקרד
│   ├── PaymentScheduleEntry.cs  - Individual payment entry / רשומת תשלום בודדת / קייד דפע פרדי
│   ├── RateChange.cs            - Interest rate change event / אירוע שינוי ריבית / חד'ת' תג'ייר אלסער
│   └── AmortizationSummary.cs   - Summary statistics / סיכום סטטיסטיקה / מולח'ץ אלחסאיאת
├── Services/
│   ├── MortgageCalculator.cs    - Core calculation engine / מנוע חישוב עיקרי / מחרך אלחסאב אלאסאסי
│   ├── ReportGenerator.cs       - Report formatting and output / עיצוב דוח ופלט / תנסיק אלתקריר ואלמח'רג'את
│   └── RateChangeFileReader.cs  - File I/O for rate changes / קריאת קובץ לשינויי ריבית / קראה אלמלפ לתג'ייראת אלסער
├── Program.cs                   - Main entry point / נקודת כניסה ראשית / נקטה אלדח'ול אלראיסיה
├── MortgageAmortization.csproj  - Project file / קובץ פרויקט / מלפ אלמשרוע
└── RATECHANGE.DAT               - Sample rate change data / נתוני שינוי ריבית לדוגמה / ביאנאת עיינה לתג'ייר אלסער
```

## Building and Running / בנייה והרצה / אלבנא ואלתשג'יל

### Prerequisites / דרישות מוקדמות / אלמותטלמאת אלמסמקה
- .NET 8 SDK

### Build / בנייה / בנא
```bash
dotnet build
```

### Run / הרצה / תשג'יל
```bash
dotnet run
```

## Default Configuration / תצורה כברירת מחדל / אלתכוין אלאפתראדי

The program uses these default values (matching the COBOL program):
התוכנית משתמשת בערכי ברירת המחדל הבאים (תואמים לתוכנית ה-COBOL):
יסתח'דם אלברנאמג' הד'ה בקים אלאפתראדיה (אלמותאבקה לברנאמג' COBOL):

- **Principal Amount**: 1,000,000 ILS (סכום הקרן Principal Amount / מבליג' אסל אלקרד)
- **Term**: 28 years (336 months) (תקופה Term / אלמדה)
- **Initial Annual Rate**: 5.0000% (ריבית שנתית התחלתית Initial Annual Rate / אלפאידה אלסנויה אלאוליה)
- **Start Date**: January 1, 2026 (תאריך התחלה Start Date / תאריך אלבד')

## Rate Changes / שינויי ריבית / תג'ייראת אלסער
Rate changes can be configured in `RATECHANGE.DAT` file:
ניתן להגדיר שינויי ריבית בקובץ `RATECHANGE.DAT`:
ימכן תכוין תג'ייראת אלסער פי מלפ `RATECHANGE.DAT`:

```
<month> <new_rate>
```
Example / דוגמה / מת'אל:
```
120 5.5000
240 6.0000
```
This will change the rate to 5.5% at month 120 and 6.0% at month 240.
זה ישנה את הריבית ל-5.5% בחודש 120 ול-6.0% בחודש 240.
סיק'ום הד'א בתג'ייר אלסער אלי 5.5% פי אלשהר 120 ו-6.0% פי אלשהר 240.

## Output / פלט / אלמח'רג'את

The program generates:
התוכנית מייצרת:
יוולד אלברנאמג':

- **Console output** - Summary information
  - פלט קונסולה - מידע סיכום
  - מח'רג'את וחדה אלתחכם - מעלומאת מולח'צה

- **SCHEDULE.TXT** - Complete amortization schedule
  - SCHEDULE.TXT - לוח סילוקין מלא
  - SCHEDULE.TXT - ג'דול סדאד כאמל

## Key Formulas / נוסחאות מפתח / אלציג' אלאסאסיה

### Monthly Interest Rate / ריבית חודשית / אלפאידה אלשהריה
```
monthly_rate = (1 + annual_rate)^(1/12) - 1
```

### Monthly Payment (PMT) / תשלום חודשי / אלדפעה אלשהריה
```
PMT = P × [r(1+r)^n] / [(1+r)^n - 1]

Where:
  P = Principal balance (יתרת הקרן / רציד אסל אלדין)
  r = Monthly interest rate (ריבית חודשית / סער אלפאידה אלשהרי)
  n = Number of periods remaining (מספר תקופות נותרות / עדד אלפתראת אלמותבקיה)
```

### Monthly Breakdown / פירוט חודשי / אלתפציל אלשהרי
```
Interest Payment = Balance × Monthly Rate (תשלום ריבית = יתרה * ריבית חודשית)
Principal Payment = PMT - Interest Payment (תשלום קרן = תשלום חודשי - תשלום ריבית)
New Balance = Balance - Principal Payment (יתרה חדשה = יתרה - תשלום קרן)
```

## COBOL to .NET Mapping / מיפוי COBOL ל-.NET / תח'טיט COBOL אלי .NET

| COBOL Component | .NET Component | רכיב COBOL | רכיב .NET |
| --- | --- | --- | --- |
| WORKING-STORAGE SECTION | Models/ classes | אזור אחסון עבודה | מחלקות Models |
| PROCEDURE DIVISION | Services/ classes | חטיבת פרוצדורה | מחלקות Services |
| PERFORM statements | Method calls | הצהרות ביצוע | קריאות לפונקציות |
| COMPUTE statements | C# expressions | הצהרות חישוב | ביטויי C# |
| FILE CONTROL | File.ReadAllLines(), File.WriteAllText() | בקרת קבצים | קריאה וכתיבה לקבצים |
| DISPLAY statements | Console.WriteLine() | הצהרות תצוגה | הדפסה לקונסולה |

## Features / תכונות / אלמיזאת
✅ Variable interest rate support / תמיכה בריבית משתנה / דעם סער פאידה מתג'יר
✅ Accurate financial calculations / חישובים פיננסיים מדויקים / חסאבאת מאליה דקיקה
✅ Formatted console output / פלט קונסולה מעוצב / מח'רג'את וחדה תחכם מנסקה
✅ Text file report generation / יצירת דוחות בקובץ טקסט / אנשא תקאריר מלפאת נציה
✅ Cumulative totals tracking / מעקב סכומים מצטברים / תתבע אלמג'אמיע אלתראכמיה
✅ Rate change handling / טיפול בשינויי ריבית / מעאלג'ה תג'ייראת אלסער
✅ Final payment adjustment / התאמת תשלום סופי / תעדיל אלדפעה אלהאיה

## License / רישיון / אלתרח'יץ
This is a demonstration project for COBOL to .NET conversion.
זהו פרויקט הדגמה להמרה מ-COBOL ל-.NET.
הד'א משרוע תודיחי לתחויל מן COBOL אלי .NET.

## Workflow Diagram
::: mermaid
sequenceDiagram
    participant User as User
    participant Program
    participant CalculatorService
    participant ReportService

    User->>Program: Start Application
    Program->>CalculatorService: Load Loan Configuration
    CalculatorService->>CalculatorService: Calculate Payment Schedule
    CalculatorService-->>Program: Return Amortization Schedule
    Program->>ReportService: Generate Report
    ReportService-->>Program: Report Generated (SCHEDULE.TXT)
    Program-->>User: Print Summary to Console
:::

::: mermaid
sequenceDiagram
    participant Client as Client<br/>(Web/Mobile/3rd-Party)
    participant BFF as BFF
    participant APIC as APIC Gateway
    participant BFB as BFB
    participant Data as Data Source<br/>(DB/API/MQ)

    Client->>BFF: HTTPS Request<br/>Session Auth
    BFF->>BFF: Gets OAuth token from IdP<br/>or uses existing session
    BFF->>APIC: X-IBM-ClientId<br/>X-IBM-ClientSecret
    APIC->>APIC: Validates credentials<br/>Enforces quotas & rate limiting
    APIC->>BFB: JWT Bearer Token
    BFB->>BFB: Validates JWT<br/>Extracts claims
    BFB->>Data: Query/Command
    Data-->>BFB: Response
    BFB-->>APIC: Result
    APIC-->>BFF: Response
    BFF-->>Client: Final Response
:::