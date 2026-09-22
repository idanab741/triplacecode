import { callClaude, logAiError } from "@/services/ai/claudeService";
import { PREFERENCES_TAXONOMY } from "@/locales/he/preferencesTaxonomy";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

/**
 * *** חדש (חיבור עמוד ההעדפות ל"למידת משתמש" - בקשה מפורשת): מסווג כל
 * מקום שנוסף ל-TripAdd לפי הטקסונומיה החדשה של עמוד ההעדפות
 * (PREFERENCES_TAXONOMY, locales/he/preferencesTaxonomy.ts) - עד 3
 * תגיות ספציפיות, לא קבוצות. נפרד לגמרי מ-subcategoryClassifier.ts
 * הקיים (טקסונומיה אחרת - TRIPADD_SUBCATEGORIES, תגית אחת בלבד) -
 * שתי המערכות ממשיכות לרוץ זו לצד זו, לא מחליפות זו את זו.
 *
 * התוצאה נשמרת ב-tripadd_submissions.taxonomy_tags, ומאפשרת ל-
 * tripMatchService.ts להצליב חפיפה מדויקת ברמת התגית מול
 * travel_dna.taxonomy_tags של המשתמש (ר' personalizationScore שם).
 *
 * נקרא באופן א-סינכרוני מתוך tripAddEnrichmentService.ts (fire-and-
 * forget אחרי השמירה) - לא חוסם את חוויית ההוספה של המשתמש.
 */
export async function classifyPreferencesTaxonomyTags(
  category: TripAddCategory,
  placeName: string,
  address?: string | null,
  existingSubcategory?: string | null
): Promise<string[]> {
  const categoryTaxonomy = PREFERENCES_TAXONOMY.find((c) => c.id === category);
  if (!categoryTaxonomy) return [];

  const allTags = categoryTaxonomy.groups.flatMap((g) => g.tags);
  if (allTags.length === 0) return [];

  const taxonomyText = categoryTaxonomy.groups.map((g) => `- ${g.group}: ${g.tags.join(", ")}`).join("\n");

  const prompt = `מקום בשם "${placeName}"${address ? `, בכתובת: ${address}` : ""}${
    existingSubcategory ? `, תת-קטגוריה שכבר זוהתה: ${existingSubcategory}` : ""
  }.

הנה רשימה סגורה של תגיות אפשריות עבור הקטגוריה שלו, מאורגנות לפי קבוצות:
${taxonomyText}

בחר עד 3 תגיות שהכי מתאימות למקום הזה, אך ורק מתוך התגיות הספציפיות ברשימה הזו בדיוק (אל תמציא ערך חדש, ואל תחזיר את שמות הקבוצות עצמן - רק תגיות ספציפיות מתוכן). אם מקום מתאים לפחות משלוש, החזר פחות.

השב אך ורק במבנה JSON תקין - מערך של מחרוזות - בלי שום טקסט נוסף, בלי Markdown:
["תגית1", "תגית2", "תגית3"]`;

  const { text, error } = await callClaude(prompt, 200);
  if (error || !text) {
    if (error) logAiError("סיווג טקסונומיית ההעדפות נכשל", { error, placeName });
    return [];
  }

  try {
    const cleaned = text.trim().replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];
    // ולידציה קפדנית - רק תגיות שבאמת קיימות ברשימה הסגורה, לא ממציאים.
    return parsed.filter((t): t is string => typeof t === "string" && allTags.includes(t)).slice(0, 3);
  } catch {
    logAiError("תשובת הסיווג לא הייתה JSON תקין", { rawText: text.slice(0, 200), placeName });
    return [];
  }
}
