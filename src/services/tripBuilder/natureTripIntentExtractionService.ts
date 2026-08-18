import { callClaude, logAiError } from "@/services/ai/claudeService";

/** חילוץ שדות מהמלל החופשי של טיול טבע - אותו עיקרון בדיוק כמו
 *  dayTripIntentExtractionService.ts, רק עם natureTypes/difficulty
 *  במקום interests. */
export interface ExtractedNatureTripIntent {
  companions: "couple" | "family" | "friends" | "solo" | null;
  hasPet: boolean;
  childAgeBands: string[];
  distanceBand: string | null;
  budgetBand: string | null;
  natureTypes: string[];
  difficulty: string | null;
  durationBand: string | null;
}

const EMPTY_RESULT: ExtractedNatureTripIntent = {
  companions: null,
  hasPet: false,
  childAgeBands: [],
  distanceBand: null,
  budgetBand: null,
  natureTypes: [],
  difficulty: null,
  durationBand: null,
};

const COMPANION_VALUES = new Set(["couple", "family", "friends", "solo"]);
const CHILD_AGE_VALUES = new Set(["0-3", "3-7", "7-12", "12-18"]);
const DISTANCE_VALUES = new Set(["10min", "20min", "30min", "40min", "50min", "1h", "1.5h", "2h", "2.5h", "3h"]);
const BUDGET_VALUES = new Set(["0-100", "100-300", "300-600", "600-1000", "unlimited"]);
const NATURE_TYPE_VALUES = new Set([
  "springs_streams", "viewpoints_scenery", "forests_groves", "hiking_trails", "seasonal_bloom",
  "caves_phenomena", "desert_canyons", "waterfalls", "wildlife", "sunrise_sunset",
]);
const DIFFICULTY_VALUES = new Set(["easy", "moderate", "challenging"]);
const DURATION_VALUES = new Set(["1-2h", "half_day", "full_day", "custom"]);

function buildPrompt(freeText: string): string {
  return `אתה עוזר לתכנון טיול טבע ב-TRIPLACE. המשתמש כתב תיאור חופשי וקצר של
הטיול שהוא מדמיין. המשימה שלך: לחלץ ממנו רק את מה שנאמר **במפורש או ברור
לחלוטין** - אסור לנחש, עדיף null/ריק מאשר ערך לא בטוח.

טקסט המשתמש: ${JSON.stringify(freeText)}

חלץ את השדות הבאים (כל אחד null/ריק אם לא ברור מהטקסט):

- companions: "couple" | "family" | "friends" | "solo" - רק אם נאמר במפורש, אחרת null.
- hasPet: true רק אם נאמר במפורש שיוצאים עם כלב/חיית מחמד, אחרת false.
- childAgeBands: מערך מתוך "0-3","3-7","7-12","12-18" - רק אם companions=family וגילאי הילדים הוזכרו.
- distanceBand: אחד מתוך "10min","20min","30min","40min","50min","1h","1.5h","2h","2.5h","3h" - רק אם צוין מרחק/זמן נסיעה.
- budgetBand: אחד מתוך "0-100","100-300","300-600","600-1000","unlimited" - רק אם תקציב הוזכר בבירור.
- natureTypes: מערך מתוך "springs_streams","viewpoints_scenery","forests_groves","hiking_trails",
  "seasonal_bloom","caves_phenomena","desert_canyons","waterfalls","wildlife","sunrise_sunset" -
  רק סוגים שברור שרלוונטיים, אחרת מערך ריק.
- difficulty: "easy" | "moderate" | "challenging" - רק אם רמת קושי רצויה ברורה, אחרת null.
- durationBand: "1-2h" | "half_day" | "full_day" | "custom" - רק אם משך הטיול ברור, אחרת null.

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{
  "companions": "couple" | "family" | "friends" | "solo" | null,
  "hasPet": true | false,
  "childAgeBands": ["..."],
  "distanceBand": "string או null",
  "budgetBand": "string או null",
  "natureTypes": ["..."],
  "difficulty": "string או null",
  "durationBand": "string או null"
}`;
}

export async function extractNatureTripIntent(freeText: string): Promise<ExtractedNatureTripIntent> {
  const trimmed = freeText.trim();
  if (!trimmed) return EMPTY_RESULT;

  const { text, error } = await callClaude(buildPrompt(trimmed), 600);
  if (error || !text) {
    logAiError("חילוץ כוונת טיול טבע מהמלל החופשי נכשל - ממשיכים בלי חילוץ", { error });
    return EMPTY_RESULT;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const companions =
      typeof parsed.companions === "string" && COMPANION_VALUES.has(parsed.companions)
        ? (parsed.companions as ExtractedNatureTripIntent["companions"])
        : null;
    const childAgeBands = Array.isArray(parsed.childAgeBands)
      ? (parsed.childAgeBands as unknown[]).filter((v): v is string => typeof v === "string" && CHILD_AGE_VALUES.has(v))
      : [];
    const distanceBand =
      typeof parsed.distanceBand === "string" && DISTANCE_VALUES.has(parsed.distanceBand) ? parsed.distanceBand : null;
    const budgetBand =
      typeof parsed.budgetBand === "string" && BUDGET_VALUES.has(parsed.budgetBand) ? parsed.budgetBand : null;
    const natureTypes = Array.isArray(parsed.natureTypes)
      ? (parsed.natureTypes as unknown[]).filter((v): v is string => typeof v === "string" && NATURE_TYPE_VALUES.has(v))
      : [];
    const difficulty =
      typeof parsed.difficulty === "string" && DIFFICULTY_VALUES.has(parsed.difficulty) ? parsed.difficulty : null;
    const durationBand =
      typeof parsed.durationBand === "string" && DURATION_VALUES.has(parsed.durationBand) ? parsed.durationBand : null;

    return {
      companions,
      hasPet: parsed.hasPet === true,
      childAgeBands,
      distanceBand,
      budgetBand,
      natureTypes,
      difficulty,
      durationBand,
    };
  } catch (parseError) {
    logAiError("כשל בפענוח חילוץ כוונת טיול טבע", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return EMPTY_RESULT;
  }
}
