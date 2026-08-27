import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getDestinationCandidates, type DestinationCandidate } from "@/services/destinations/destinationsServerService";
import type { ChildAgeBand, LodgingType, TravelStyle, VacationPace } from "./types";

/**
 * חילוץ שדות מהמלל החופשי הפתוח ("ספרו לי על החופשה שאתם מדמיינים"),
 * כדי לדלג בשאלון על מה שכבר נענה בפועל בתוכו. שמרני בכוונה: כל שדה
 * שלא נאמר במפורש/ברור לחלוטין נשאר null/ריק - עדיף לשאול שוב שאלה
 * שכבר נענתה (טעות קטנה, שקופה למשתמש כי הוא רואה את הבועה שוב) מאשר
 * "לנחש" תשובה ולדלג בטעות על שאלה שהמשתמש לא באמת התכוון אליה.
 */
export interface ExtractedVacationIntent {
  travelStyle: TravelStyle | null;
  /** יעד יחיד מפורש - רק אם הוא תואם *בדיוק* יעד קיים ברשימת ה-admin. */
  destination: string | null;
  /** כמה יעדים מפורשים (travelStyle multi) - כל אחד מהם מאומת מול הרשימה. */
  destinations: string[];
  /**
   * בקשה מפורשת (זרימת "טריפי AI" - שאלת המשך אחת שממוקדת ביעד): עד 3
   * הצעות יעד (מתוך אותה קריאת Claude היחידה - בלי קריאה נוספת/טוקנים
   * נוספים) שמתאימות לתיאור החופשי, לשימוש כצ'יפים בשאלת ההמשך כשלא
   * חולץ יעד מפורש. כל אחת מאומתת בדיוק כמו destination/destinations.
   */
  suggestedDestinations: string[];
  companions: ("couple" | "family" | "family_no_kids" | "friends" | "solo")[];
  childAgeBands: ChildAgeBand[];
  hasBookedFlightAndHotel: boolean | null;
  lodgingType: LodgingType | null;
  budgetPerPerson: string | null;
  vacationTypes: string[];
  pace: VacationPace | null;
  /** *** תוספת (בקשה מפורשת - "להתאים את כמות התוצאות לפי המלל
   *  החופשי"): מספר מקומות מפורש שהמשתמש ציין (למשל "5 מקומות",
   *  "3 אטרקציות ביום") - סה"כ למסלול, לא ליום בודד (מתחלק בין הימים
   *  ב-tripStrategyService.ts). null אם לא צוין מספר מפורש - במקרה
   *  הזה שום דבר לא משתנה, ה-Pace הרגיל עדיין קובע. */
  requestedPlaceCount: number | null;
}

const EMPTY_RESULT: ExtractedVacationIntent = {
  travelStyle: null,
  destination: null,
  destinations: [],
  suggestedDestinations: [],
  companions: [],
  childAgeBands: [],
  hasBookedFlightAndHotel: null,
  lodgingType: null,
  budgetPerPerson: null,
  vacationTypes: [],
  pace: null,
  requestedPlaceCount: null,
};

const COMPANION_VALUES = new Set(["couple", "family", "family_no_kids", "friends", "solo"]);
const CHILD_AGE_VALUES = new Set(["0-3", "3-7", "7-12", "12-18"]);
const LODGING_VALUES = new Set(["hotel", "resort", "apartment", "cabin", "hostel", "camping", "glamping", "villa"]);
const BUDGET_VALUES = new Set(["0-2500", "2500-7500", "7500-12000", "12000+", "unlimited"]);
const VACATION_TYPE_VALUES = new Set([
  "relax", "nature_adventure", "urban", "shopping", "culinary", "museums_history",
  "culture_art", "family", "nightlife", "sports_extreme", "spa_wellness", "ski",
]);
const PACE_VALUES = new Set(["relaxed", "balanced", "packed"]);
const TRAVEL_STYLE_VALUES = new Set(["single_destination", "multi_destination"]);

function buildPrompt(freeText: string, candidates: DestinationCandidate[]): string {
  const candidateList = candidates.map((c) => `${c.name}, ${c.country}`).join("\n");

  return `אתה עוזר לתכנון חופשה ב-TRIPLACE. המשתמש כתב תיאור חופשי וקצר של
החופשה שהוא מדמיין (לא מילא טופס). המשימה שלך: לחלץ ממנו רק את מה שנאמר
**במפורש או ברור לחלוטין** מההקשר, כדי שהשאלון לא ישאל שוב על דברים
שכבר נאמרו. אסור לנחש או להסיק דברים שלא נאמרו בבירור - עדיף להחזיר
null/ריק מאשר לחלץ ערך לא בטוח.

טקסט המשתמש: ${JSON.stringify(freeText)}

חלץ את השדות הבאים (כל אחד null/ריק אם לא ברור מהטקסט):

- travelStyle: "single_destination" אם ברור שמדובר ביעד אחד, "multi_destination"
  אם ברור שמדובר בכמה יעדים/מדינות ברצף - אחרת null.
- destination: אם travelStyle=single_destination והמשתמש הזכיר יעד ספציפי
  (עיר/מדינה) - **רק אם הוא מופיע בדיוק ברשימת היעדים הזמינים למטה**. העתק
  את השם *בדיוק* כפי שהוא מופיע ברשימה (עיר, מדינה נפרדים). אם היעד שהוזכר
  לא ברשימה, או שלא הוזכר יעד - null.
- destinations: אותו עיקרון, מערך של כמה יעדים (רק אם travelStyle=multi_destination
  והם מופיעים ברשימה) - אחרת מערך ריק.
- suggestedDestinations: **רק אם לא הוזכר יעד מפורש בכלל** (destination ו-destinations
  שניהם ריקים/null) - עד 3 יעדים מתוך רשימת היעדים הזמינים למטה שהכי מתאימים לתיאור
  (לפי אווירה/סוג חופשה/מה שמשתמע מהטקסט, למשל "ים ומסעדות טובות" -> יעדי חוף/קולינריה).
  **חובה** להעתיק כל שם *בדיוק* כפי שהוא מופיע ברשימה. אם כבר הוזכר יעד מפורש - מערך ריק.
- companions: מערך מתוך "couple" (זוג) | "family" (משפחה עם ילדים) | "family_no_kids"
  (משפחה בלי ילדים) | "friends" (חברים) | "solo" (לבד) - כל מי שנאמר במפורש שנוסע
  איתם, אפשר כמה יחד (למשל זוג עם חברים = ["couple","friends"]), אחרת מערך ריק.
- childAgeBands: מערך מתוך "0-3","3-7","7-12","12-18" - רק אם companions=family
  וגילאי הילדים הוזכרו, אחרת מערך ריק.
- hasBookedFlightAndHotel: true/false - רק אם המשתמש אמר במפורש שכבר הזמין
  (או שעדיין לא הזמין) טיסה ומלון, אחרת null.
- lodgingType: אחד מתוך "hotel","resort","apartment","cabin","hostel","camping",
  "glamping","villa" - רק אם סוג הלינה נאמר בבירור, אחרת null.
- budgetPerPerson: אחד מתוך "0-2500","2500-7500","7500-12000","12000+","unlimited"
  (בשקלים לאדם) - רק אם תקציב הוזכר בבירור (גם אם לא במספרים מדויקים, למשל
  "תקציב מוגבל"->0-2500, "לא חוסכים"->unlimited) - אחרת null.
- vacationTypes: מערך מתוך "relax","nature_adventure","urban","shopping","culinary",
  "museums_history","culture_art","family","nightlife","sports_extreme",
  "spa_wellness","ski" - רק סוגים שברור שרלוונטיים מהטקסט, אחרת מערך ריק.
- pace: "relaxed" (רגוע) | "balanced" (מאוזן) | "packed" (מתוכנן/עמוס) -
  רק אם קצב הטיול הרצוי ברור, אחרת null.
- requestedPlaceCount: מספר שלם אם המשתמש ציין **מפורשות** כמות מקומות/
  אטרקציות רצויה לכל הטיול (למשל "5 מקומות", "רוצה בערך 8 אטרקציות",
  "2-3 דברים ליום" - במקרה של טווח/ליום, תחשב סה"כ משוער לכל הטיול) -
  אחרת null. אל תנחש/תמציא מספר שלא נאמר - ברירת המחדל הבטוחה היא null.

רשימת היעדים הזמינים (ל-destination/destinations בלבד):
${candidateList}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף לפני או אחרי:
{
  "travelStyle": "single_destination" | "multi_destination" | null,
  "destination": "string או null",
  "destinations": ["..."],
  "suggestedDestinations": ["..."],
  "companions": ["couple" | "family" | "family_no_kids" | "friends" | "solo", ...],
  "childAgeBands": ["..."],
  "hasBookedFlightAndHotel": true | false | null,
  "lodgingType": "string או null",
  "budgetPerPerson": "string או null",
  "vacationTypes": ["..."],
  "pace": "relaxed" | "balanced" | "packed" | null,
  "requestedPlaceCount": מספר שלם או null
}`;
}

/**
 * מוודא שיעד מוצע תואם *בדיוק* יעד קיים ברשימת ה-admin - אותה הגנה כמו
 * pickSurpriseDestination.
 *
 * תיקון באג אמיתי (בקשה מפורשת - "למה זה לא מזהה את היעד, כתבתי אתונה
 * במפורש!"): הפרומפט מציג לClaude את הרשימה בפורמט "עיר, מדינה" (ר'
 * candidateList למעלה) ומבקש ממנו להעתיק בדיוק את אותו פורמט - אבל
 * הפונקציה הזו השוותה מול c.name **בלבד** (בלי המדינה). "אתונה, יוון"
 * (בדיוק מה שClaude התבקש להחזיר) לעולם לא היה שווה ל-"אתונה" (c.name
 * לבדו) - אז יעד שחולץ נכון לגמרי נדחה תמיד כ"לא ברשימה". עכשיו משווים
 * מול אותו פורמט משולב בדיוק שהוצג לClaude.
 */
function validateDestinationName(name: unknown, candidates: DestinationCandidate[]): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const normalized = name.trim().toLowerCase();
  const match = candidates.find((c) => `${c.name}, ${c.country}`.trim().toLowerCase() === normalized);
  // מחזירים את השם *כפי שהוא שמור אצלנו* (לא כפי שקלוד כתב אותו) - כדי
  // שהתאמות מאוחרות יותר בקוד (autocomplete, geocoding) יעבדו על ערך עקבי.
  return match ? `${match.name}, ${match.country}` : null;
}

/**
 * קריאת Claude אחת (מודל מהיר - Haiku, אותו מודל כמו שאר השירותים כאן)
 * שמנסה לחלץ תשובות מוכנות מראש מהמלל החופשי. חוזרת עם אובייקט "ריק"
 * (הכל null/ריק) אם הקריאה נכשלת - השאלון פשוט ישאל את כל השאלות כרגיל,
 * בלי לחסום את המשתמש.
 */
export async function extractVacationIntent(freeText: string): Promise<ExtractedVacationIntent> {
  const trimmed = freeText.trim();
  if (!trimmed) return EMPTY_RESULT;

  const candidates = await getDestinationCandidates();
  const prompt = buildPrompt(trimmed, candidates);

  // 800 טוקנים - התשובה כאן היא JSON קומפקטי עם כמה שדות קצרים בלבד
  // (לא summary/priorities חופשיים כמו ב-tripIntentService), אין סיבה
  // לתקציב גדול יותר שרק יאט את הקריאה. suggestedDestinations (עד 3
  // שמות קצרים) נכלל באותה קריאה בדיוק - לא קריאת Claude נוספת.
  const { text, error } = await callClaude(prompt, 800);
  if (error || !text) {
    logAiError("חילוץ כוונת חופשה מהמלל החופשי נכשל - ממשיכים בלי חילוץ", { error });
    return EMPTY_RESULT;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("לא נמצא JSON בתשובת Claude");
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const travelStyle =
      typeof parsed.travelStyle === "string" && TRAVEL_STYLE_VALUES.has(parsed.travelStyle)
        ? (parsed.travelStyle as TravelStyle)
        : null;

    const destinations = Array.isArray(parsed.destinations)
      ? (parsed.destinations as unknown[])
          .map((d) => validateDestinationName(d, candidates))
          .filter((d): d is string => d != null)
      : [];

    return {
      travelStyle,
      destination: travelStyle === "multi_destination" ? null : validateDestinationName(parsed.destination, candidates),
      destinations: travelStyle === "multi_destination" ? destinations : [],
      suggestedDestinations: Array.isArray(parsed.suggestedDestinations)
        ? (parsed.suggestedDestinations as unknown[])
            .map((d) => validateDestinationName(d, candidates))
            .filter((d): d is string => d != null)
            .slice(0, 3)
        : [],
      companions: Array.isArray(parsed.companions)
        ? (parsed.companions as unknown[]).filter(
            (v): v is ExtractedVacationIntent["companions"][number] => typeof v === "string" && COMPANION_VALUES.has(v)
          )
        : [],
      childAgeBands: Array.isArray(parsed.childAgeBands)
        ? (parsed.childAgeBands as unknown[]).filter((v): v is ChildAgeBand => typeof v === "string" && CHILD_AGE_VALUES.has(v))
        : [],
      hasBookedFlightAndHotel: typeof parsed.hasBookedFlightAndHotel === "boolean" ? parsed.hasBookedFlightAndHotel : null,
      lodgingType:
        typeof parsed.lodgingType === "string" && LODGING_VALUES.has(parsed.lodgingType)
          ? (parsed.lodgingType as LodgingType)
          : null,
      budgetPerPerson:
        typeof parsed.budgetPerPerson === "string" && BUDGET_VALUES.has(parsed.budgetPerPerson) ? parsed.budgetPerPerson : null,
      vacationTypes: Array.isArray(parsed.vacationTypes)
        ? (parsed.vacationTypes as unknown[]).filter((v): v is string => typeof v === "string" && VACATION_TYPE_VALUES.has(v))
        : [],
      pace: typeof parsed.pace === "string" && PACE_VALUES.has(parsed.pace) ? (parsed.pace as VacationPace) : null,
      requestedPlaceCount:
        typeof parsed.requestedPlaceCount === "number" && Number.isFinite(parsed.requestedPlaceCount) && parsed.requestedPlaceCount > 0
          ? Math.round(parsed.requestedPlaceCount)
          : null,
    };
  } catch (parseError) {
    logAiError("כשל בפענוח חילוץ כוונת חופשה", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
      rawText: text.slice(0, 300),
    });
    return EMPTY_RESULT;
  }
}
