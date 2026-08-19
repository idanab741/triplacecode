import { callClaude, logAiError } from "@/services/ai/claudeService";
import type { ChildAgeBand, LodgingType, VacationPace } from "./types";

/**
 * חילוץ שדות מהמלל החופשי הפתוח של סופ"ש ("ספרו לי על הסופ"ש שאתם
 * מדמיינים") - **אותו עיקרון בדיוק** כמו vacationIntentExtractionService.ts
 * (חופשה בחו"ל), בלי יעד/טיסה (סופ"ש הוא תמיד בארץ, בלי בחירת יעד).
 * בקשה מפורשת: המלל החופשי עבר להיות השאלה השנייה (אחרי תאריכים), לא
 * האחרונה - כדי שהשאלון ידלג בהמשך על מה שכבר נענה בתוכו.
 */
export interface ExtractedWeekendIntent {
  companions: ("couple" | "family" | "family_no_kids" | "friends" | "solo")[];
  childAgeBands: ChildAgeBand[];
  distanceBand: string | null;
  hasBookedLodging: boolean | null;
  lodgingType: LodgingType | null;
  budgetPerPerson: string | null;
  weekendStyles: string[];
  pace: VacationPace | null;
}

const EMPTY_RESULT: ExtractedWeekendIntent = {
  companions: [],
  childAgeBands: [],
  distanceBand: null,
  hasBookedLodging: null,
  lodgingType: null,
  budgetPerPerson: null,
  weekendStyles: [],
  pace: null,
};

const COMPANION_VALUES = new Set(["couple", "family", "family_no_kids", "friends", "solo"]);
const CHILD_AGE_VALUES = new Set(["0-3", "3-7", "7-12", "12-18"]);
const DISTANCE_VALUES = new Set(["10min", "20min", "30min", "40min", "50min", "1h", "1.5h", "2h", "2.5h", "3h", "4h", "5h"]);
const LODGING_VALUES = new Set(["hotel", "resort", "apartment", "cabin", "hostel", "camping", "glamping", "villa"]);
const BUDGET_VALUES = new Set(["0-1000", "1000-3000", "3000+", "unlimited"]);
const WEEKEND_STYLE_VALUES = new Set([
  "relax", "nature_adventure", "shopping", "sports_extreme", "culinary",
  "spa_wellness", "culture_art", "family", "romantic", "nightlife",
]);
const PACE_VALUES = new Set(["relaxed", "balanced", "packed"]);

function buildPrompt(freeText: string): string {
  return `אתה עוזר לתכנון סופ"ש ב-TRIPLACE. המשתמש כתב תיאור חופשי וקצר של
הסופ"ש שהוא מדמיין (לא מילא טופס). המשימה שלך: לחלץ ממנו רק את מה שנאמר
**במפורש או ברור לחלוטין** מההקשר, כדי שהשאלון לא ישאל שוב על דברים
שכבר נאמרו. אסור לנחש - עדיף null/ריק מאשר ערך לא בטוח.

טקסט המשתמש: ${JSON.stringify(freeText)}

חלץ את השדות הבאים (כל אחד null/ריק אם לא ברור מהטקסט):

- companions: מערך מתוך "couple" (זוג) | "family" (משפחה עם ילדים) | "family_no_kids"
  (משפחה בלי ילדים) | "friends" (חברים) | "solo" (לבד) - כל מי שנאמר במפורש שנוסע
  איתם, אפשר כמה יחד, אחרת מערך ריק.
- childAgeBands: מערך מתוך "0-3","3-7","7-12","12-18" - רק אם companions כולל family וגילאי הילדים הוזכרו.
- distanceBand: אחד מתוך "10min","20min","30min","40min","50min","1h","1.5h","2h","2.5h","3h","4h","5h"
  (זמן נסיעה) - רק אם צוין מרחק/זמן נסיעה מקסימלי בבירור.
- hasBookedLodging: true/false - רק אם המשתמש אמר במפורש שכבר סגר (או שעדיין לא סגר) מקום לינה, אחרת null.
- lodgingType: אחד מתוך "hotel","resort","apartment","cabin","hostel","camping","glamping","villa" -
  רק אם סוג הלינה נאמר בבירור, אחרת null.
- budgetPerPerson: אחד מתוך "0-1000","1000-3000","3000+","unlimited" (בשקלים לאדם) -
  רק אם תקציב הוזכר בבירור, אחרת null.
- weekendStyles: מערך מתוך "relax","nature_adventure","shopping","sports_extreme","culinary",
  "spa_wellness","culture_art","family","romantic","nightlife" -
  רק סוגים שברור שרלוונטיים, אחרת מערך ריק.
- pace: "relaxed" (רגוע) | "balanced" (מאוזן) | "packed" (מתוכנן/עמוס) - רק אם קצב הטיול ברור, אחרת null.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{
  "companions": ["couple" | "family" | "family_no_kids" | "friends" | "solo", ...],
  "childAgeBands": ["..."],
  "distanceBand": "string או null",
  "hasBookedLodging": true | false | null,
  "lodgingType": "string או null",
  "budgetPerPerson": "string או null",
  "weekendStyles": ["..."],
  "pace": "relaxed" | "balanced" | "packed" | null
}`;
}

export async function extractWeekendIntent(freeText: string): Promise<ExtractedWeekendIntent> {
  const trimmed = freeText.trim();
  if (!trimmed) return EMPTY_RESULT;

  const { text, error } = await callClaude(buildPrompt(trimmed), 700);
  if (error || !text) {
    logAiError('חילוץ כוונת סופ"ש מהמלל החופשי נכשל - ממשיכים בלי חילוץ', { error });
    return EMPTY_RESULT;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const companions = Array.isArray(parsed.companions)
      ? (parsed.companions as unknown[]).filter(
          (v): v is ExtractedWeekendIntent["companions"][number] => typeof v === "string" && COMPANION_VALUES.has(v)
        )
      : [];
    const childAgeBands = Array.isArray(parsed.childAgeBands)
      ? (parsed.childAgeBands as unknown[]).filter((v): v is ChildAgeBand => typeof v === "string" && CHILD_AGE_VALUES.has(v))
      : [];
    const distanceBand =
      typeof parsed.distanceBand === "string" && DISTANCE_VALUES.has(parsed.distanceBand) ? parsed.distanceBand : null;
    const lodgingType =
      typeof parsed.lodgingType === "string" && LODGING_VALUES.has(parsed.lodgingType)
        ? (parsed.lodgingType as LodgingType)
        : null;
    const budgetPerPerson =
      typeof parsed.budgetPerPerson === "string" && BUDGET_VALUES.has(parsed.budgetPerPerson) ? parsed.budgetPerPerson : null;
    const weekendStyles = Array.isArray(parsed.weekendStyles)
      ? (parsed.weekendStyles as unknown[]).filter((v): v is string => typeof v === "string" && WEEKEND_STYLE_VALUES.has(v))
      : [];
    const pace = typeof parsed.pace === "string" && PACE_VALUES.has(parsed.pace) ? (parsed.pace as VacationPace) : null;

    return {
      companions,
      childAgeBands,
      distanceBand,
      hasBookedLodging: typeof parsed.hasBookedLodging === "boolean" ? parsed.hasBookedLodging : null,
      lodgingType,
      budgetPerPerson,
      weekendStyles,
      pace,
    };
  } catch (parseError) {
    logAiError('כשל בפענוח חילוץ כוונת סופ"ש', {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return EMPTY_RESULT;
  }
}
