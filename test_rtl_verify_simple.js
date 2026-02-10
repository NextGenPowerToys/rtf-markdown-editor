
// Mocking the RTL_CHAR_PATTERN
const RTL_CHAR_PATTERN = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F]/;

function detectRTLCharacters(text) {
    if (!text) return false;

    const lines = text.split('\n');
    let hasRTLHeader = false;
    let checkedLines = 0;

    // Check condition 1: First 5 lines
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        if (checkedLines >= 5) break;
        checkedLines++;

        // Count RTL words in this line
        const words = trimmedLine.split(/\s+/);
        let rtlWordCount = 0;
        for (const word of words) {
            if (RTL_CHAR_PATTERN.test(word)) {
                rtlWordCount++;
            }
        }

        if (rtlWordCount >= 2) {
            hasRTLHeader = true;
            break;
        }
    }

    if (!hasRTLHeader) {
        return false;
    }

    // Check condition 2: 30% threshold
    // Strip all whitespace to compare actual content
    const cleanText = text.replace(/\s/g, '');
    if (cleanText.length === 0) return false;

    // Count RTL characters
    const rtlMatches = cleanText.match(new RegExp(RTL_CHAR_PATTERN, 'g'));
    const rtlCount = rtlMatches ? rtlMatches.length : 0;

    return (rtlCount / cleanText.length) >= 0.3;
}

// Test Data
// 1. English
const englishText = `Hello world
This is a test document
It contains only English text.
Nothing special here.`;

// 2. Fails Condition 2 (Percentage) - Header OK
// Header: "שלום עולם" (2 words)
const smallHebrewHeaderButMostlyEnglish = `שלום עולם
This document has a Hebrew header with two words.
But the rest of the content is extensive English text.
Line 4 is English.
Line 5 is English.
Line 6 is English.
Line 7 is English.
Line 8 is English.
Line 9 is English.
Line 10 is English.`;

// 3. Fails Condition 1 (Header) - Percentage OK (if logic allowed)
// Hebrew at end
const hebrewAtEnd = `Line 1 English
Line 2 English
Line 3 English
Line 4 English
Line 5 English
Line 6 English
Line 7 English
שלום עולם מה נשמע הכל טוב כאן אני כותב עברית רבה`;

// 4. Passes Both
const validReview = `סקירה כללית
זהו מסמך בעברית.
רוב הטקסט כאן הוא בשפה העברית.
word word word word
אבל יש גם קצת אנגלית.`;

console.log("T1_English_Expected_False: " + detectRTLCharacters(englishText));
console.log("T2_WeakHeader_Expected_False: " + detectRTLCharacters(smallHebrewHeaderButMostlyEnglish));
console.log("T3_WeakPercentage_Expected_False: " + detectRTLCharacters(hebrewAtEnd));
console.log("T4_Valid_Expected_True: " + detectRTLCharacters(validReview));
