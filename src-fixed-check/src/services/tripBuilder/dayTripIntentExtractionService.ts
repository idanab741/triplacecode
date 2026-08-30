import { callClaude, logAiError } from "@/services/ai/claudeService";

/**
 * חילוץ שדות מהמלל החופשי של טיול יומי - **אותו עיקרון בדיוק** כמו
 * vacationIntentExtractionService.ts (חופשה בחו"ל): שמרני בכוונה, כל
 * שדה שלא נאמר במפורש/ברור נשאר null/ריק. בקשה מפורשת: המלל החופשי עבר
 * להיות השאלה השנייה (אחרי "מתי יוצאים"), לא האחרונה - כדי שהשאלון
 * ידלג בהמשך על מה שכבר נענה בתוכו.
 */
export interface ExtractedDayTripIntent {
  companions: ("couple" | "family" | "family_no_kids" | "friends" | "solo")[];
  hasPet: boolean;
  childAgeBands: string[];
  distanceBand: string | null;
  budgetBand: string | null;
  interests: string[];
  durationBand: string | null;
}

const EMPTY_RESULT: ExtractedDayTripIntent = {
  companions: [],
  hasPet: false,
  childAgeBands: [],
  distanceBand: null,
  budgetBand: null,
  interests: [],
  durationBand: null,
};

const COMPANION_VALUES = new Set(["couple", "family", "family_no_kids", "friends", "solo"]);
const CHILD_AGE_VALUES = new Set(["0-3", "3-7", "7-12", "12-18"]);
const DISTANCE_VALUES = new Set(["10min", "20min", "30min", "40min", "50min", "1h", "1.5h", "2h", "2.5h", "3h"]);
const BUDGET_VALUES = new Set(["0-100", "100-300", "300-600", "600-1000", "unlimited"]);
const INTEREST_VALUES = new Set([
  "coffee_carts_cafes", "nature_trails", "beaches_pools", "viewpoints", "parks_gardens",
  "water_amusement_parks", "attractions_activities", "sports_extreme", "wineries_dining", "culture_history",
]);
const DURATION_VALUES = new Set(["1-2h", "half_day", "full_day"]);

function buildPrompt(freeText: string): string {
  return `אתה עוזר לתכנון טיול יומי ב-TRIPLACE. המשתמש כתב תיאור חופשי וקצר של
הטיול שהוא מדמיין (לא מילא טופס). המשימה שלך: לחלץ ממנו רק את מה שנאמר
**במפורש או ברור לחלוטין** מההקשר, כדי שהשאלון לא ישאל שוב על דברים
שכבר נאמרו. אסור לנחש - עדיף null/ריק מאשר ערך לא בטוח.

טקסט המשתמש: ${JSON.stringify(freeText)}

חלץ את השדות הבאים (כל אחד null/ריק אם לא ברור מהטקסט):

- companions: מערך מתוך "couple" (זוג) | "family" (משפחה עם ילדים) | "family_no_kids" (משפחה
  בלי ילדים) | "friends" (חברים) | "solo" (לבד) - רק מי שנאמר במפורש שנוסע איתם, אפשר כמה יחד
  (למשל זוג שנוסע עם חברים = ["couple","friends"]), אחרת מערך ריק.
- hasPet: true רק אם נאמר במפורש שיוצאים עם כלב/חיית מחמד, אחרת false.
- childAgeBands: מערך מתוך "0-3","3-7","7-12","12-18" - רק אם companions=family וגילאי הילדים הוזכרו.
- distanceBand: אחד מתוך "10min","20min","30min","40min","50min","1h","1.5h","2h","2.5h","3h"
  (זמן נסיעה מהבית) - רק אם צוין מרחק/זמן נסיעה מקסימלי בבירור.
- budgetBand: אחד מתוך "0-100","100-300","300-600","600-1000","unlimited" (בשקלים) - רק אם תקציב הוזכר בבירור.
- interests: מערך מתוך "coffee_carts_cafes","nature_trails","beaches_pools","viewpoints",
  "parks_gardens","water_amusement_parks","attractions_activities","sports_extreme",
  "wineries_dining","culture_history" - רק סוגים שברור שרלוונטיים, אחרת מערך ריק.
- durationBand: "1-2h" | "half_day" | "full_day" - רק אם משך הטיול הרצוי ברור, אחרת null.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{
  "companions": ["couple" | "family" | "family_no_kids" | "friends" | "solo", ...],
  "hasPet": true | false,
  "childAgeBands": ["..."],
  "distanceBand": "string או null",
  "budgetBand": "string או null",
  "interests": ["..."],
  "durationBand": "string או null"
}`;
}

export async function extractDayTripIntent(freeText: string): Promise<ExtractedDayTripIntent> {
  const trimmed = freeText.trim();
  if (!trimmed) return EMPTY_RESULT;

  const { text, error } = await callClaude(buildPrompt(trimmed), 600);
  if (error || !text) {
    logAiError("חילוץ כוונת טיול יומי מהמלל החופשי נכשל - ממשיכים בלי חילוץ", { error });
    return EMPTY_RESULT;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const companions =
      Array.isArray(parsed.companions)
        ? (parsed.companions as unknown[]).filter(
            (v): v is ExtractedDayTripIntent["companions"][number] =>
              typeof v === "string" && COMPANION_VALUES.has(v)
          )
        : [];
    const childAgeBands = Array.isArray(parsed.childAgeBands)
      ? (parsed.childAgeBands as unknown[]).filter((v): v is string => typeof v === "string" && CHILD_AGE_VALUES.has(v))
      : [];
    const distanceBand =
      typeof parsed.distanceBand === "string" && DISTANCE_VALUES.has(parsed.distanceBand) ? parsed.distanceBand : null;
    const budgetBand =
      typeof parsed.budgetBand === "string" && BUDGET_VALUES.has(parsed.budgetBand) ? parsed.budgetBand : null;
    const interests = Array.isArray(parsed.interests)
      ? (parsed.interests as unknown[]).filter((v): v is string => typeof v === "string" && INTEREST_VALUES.has(v))
      : [];
    const durationBand =
      typeof parsed.durationBand === "string" && DURATION_VALUES.has(parsed.durationBand) ? parsed.durationBand : null;

    return {
      companions,
      hasPet: parsed.hasPet === true,
      childAgeBands,
      distanceBand,
      budgetBand,
      interests,
      durationBand,
    };
  } catch (parseError) {
    logAiError("כשל בפענוח חילוץ כוונת טיול יומי", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return EMPTY_RESULT;
  }
}
