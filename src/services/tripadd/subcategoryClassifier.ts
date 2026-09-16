import { callClaude } from "@/services/ai/claudeService";
import { TRIPADD_SUBCATEGORIES } from "@/constants/tripAddSubcategories";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

export interface SubcategoryClassification {
  tag: string;
}

export interface SubcategoryClassificationResult {
  data: SubcategoryClassification | null;
  /** סיבת הכשלון בפועל (לא ידידותית למשתמש קצה) - כדי שאפשר יהיה
   *  להציג/ללוגג את השגיאה האמיתית במקום הודעה גנרית, ולאבחן מהר
   *  יותר בעיות סביבה (מפתח API חסר, timeout, JSON לא תקין וכו'). */
  errorReason: string | null;
}

/**
 * *** סיווג AI סינכרוני, בזמן אמת בתוך AddPlaceModal (לא ברקע אחרי
 * השמירה כמו tripAddEnrichmentService) - בקשה מפורשת: "ברגע שלוחצים
 * קטגוריה - ה-AI אמור להשלים באופן אוטומטי גם את תת הקטגוריה". בניגוד
 * לסיווג החופשי הקיים ב-Enrichment, כאן התשובה **מחויבת** להיות אחת
 * מתוך הרשימה הסגורה (השטוחה) של tripAddSubcategories.ts - כדי שהתוצאה
 * תמיד תואמת לטקסונומיה המוגדרת מראש, ולא ערך AI חופשי.
 *
 * מחזיר null אם ה-AI נכשל/הגיע ריק/לא תואם לרשימה - קורא לפונקציה
 * אחראי להציג הודעת שגיאה מתאימה (לא ממציא ערך).
 */
export async function classifySubcategory(
  category: TripAddCategory,
  placeName: string,
  address?: string | null
): Promise<SubcategoryClassificationResult> {
  const tags = TRIPADD_SUBCATEGORIES[category];
  if (!tags || tags.length === 0) {
    return { data: null, errorReason: `אין רשימת תת-קטגוריות מוגדרת לקטגוריה "${category}"` };
  }

  const taxonomyText = tags.join(", ");

  const prompt = `מקום בשם "${placeName}"${address ? `, בכתובת: ${address}` : ""}.

הנה רשימה סגורה של תתי-קטגוריה עבור הקטגוריה שלו:
${taxonomyText}

בחר את תת-הקטגוריה המתאימה ביותר למקום הזה, אך ורק מתוך הרשימה הזו בדיוק (אל תמציא ערך חדש).
השב אך ורק בפורמט JSON תקין, בלי שום טקסט נוסף, בלי מרכאות מסביב, בלי Markdown, בדיוק כך:
{"tag": "<שם תת-הקטגוריה בדיוק כפי שמופיעה ברשימה>"}`;

  const { text, error } = await callClaude(prompt, 128);
  if (error) {
    return { data: null, errorReason: `קריאת Claude נכשלה: ${error}` };
  }
  if (!text) {
    return { data: null, errorReason: "קריאת Claude חזרה ריקה (בלי טקסט)" };
  }

  const cleaned = text.trim().replace(/^```json\s*|```$/g, "").trim();
  let parsed: { tag?: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { data: null, errorReason: `תשובת Claude לא הייתה JSON תקין: "${cleaned.slice(0, 200)}"` };
  }

  if (!parsed.tag) {
    return { data: null, errorReason: `תשובת Claude חסרה tag: ${JSON.stringify(parsed).slice(0, 200)}` };
  }

  if (!tags.includes(parsed.tag)) {
    return { data: null, errorReason: `התגית "${parsed.tag}" שהוחזרה לא קיימת ברשימה של "${category}"` };
  }

  return { data: { tag: parsed.tag }, errorReason: null };
}
