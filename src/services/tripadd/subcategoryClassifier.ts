import { callClaude } from "@/services/ai/claudeService";
import { TRIPADD_SUBCATEGORIES } from "@/constants/tripAddSubcategories";
import type { TripAddCategory } from "@/services/tripadd/tripAddService";

export interface SubcategoryClassification {
  group: string;
  tag: string;
}

/**
 * *** סיווג AI סינכרוני, בזמן אמת בתוך AddPlaceModal (לא ברקע אחרי
 * השמירה כמו tripAddEnrichmentService) - בקשה מפורשת: "ברגע שלוחצים
 * קטגוריה - ה-AI אמור להשלים באופן אוטומטי גם את הקטגוריה משנה וגם
 * את תת הקטגוריה". בניגוד לסיווג החופשי הקיים ב-Enrichment, כאן
 * התשובה **מחויבת** להיות אחת משתי הרשימות הסגורות (group+tag) של
 * tripAddSubcategories.ts - כדי שהתוצאה תמיד תואמת לטקסונומיה
 * המוגדרת מראש, ולא ערך AI חופשי.
 *
 * מחזיר null אם ה-AI נכשל/הגיע ריק/לא תואם לרשימה - קורא לפונקציה
 * אחראי להציג הודעת שגיאה מתאימה (לא ממציא ערך).
 */
export async function classifySubcategory(
  category: TripAddCategory,
  placeName: string,
  address?: string | null
): Promise<SubcategoryClassification | null> {
  const groups = TRIPADD_SUBCATEGORIES[category];
  if (!groups || groups.length === 0) return null;

  const taxonomyText = groups.map((g) => `- ${g.group}: ${g.tags.join(", ")}`).join("\n");

  const prompt = `מקום בשם "${placeName}"${address ? `, בכתובת: ${address}` : ""}.

הנה רשימה סגורה של קבוצות-משנה ותגיות עבור הקטגוריה שלו:
${taxonomyText}

בחר את הקבוצה והתגית המתאימות ביותר למקום הזה, אך ורק מתוך הרשימה הזו בדיוק (אל תמציא ערך חדש).
השב אך ורק בפורמט JSON תקין, בלי שום טקסט נוסף, בלי מרכאות מסביב, בלי Markdown, בדיוק כך:
{"group": "<שם הקבוצה בדיוק כפי שמופיע ברשימה>", "tag": "<שם התגית בדיוק כפי שמופיעה ברשימה>"}`;

  try {
    const { text } = await callClaude(prompt, 128);
    if (!text) return null;

    const cleaned = text.trim().replace(/^```json\s*|```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { group?: string; tag?: string };
    if (!parsed.group || !parsed.tag) return null;

    const matchedGroup = groups.find((g) => g.group === parsed.group);
    if (!matchedGroup || !matchedGroup.tags.includes(parsed.tag)) return null;

    return { group: matchedGroup.group, tag: parsed.tag };
  } catch {
    return null;
  }
}
