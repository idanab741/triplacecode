import { hasInfantAgeBand } from "./types";
import type { VacationContext } from "./types";
import {
  VACATION_PACE_DAILY_COUNTS,
  DEFAULT_RESTAURANT_STOPS_PER_DAY,
  CULINARY_RESTAURANT_STOPS_PER_DAY,
} from "@/locales/he/abroadVacation";

/**
 * תיקון ארכיטקטוני (Audit מול "בחן מחדש את כל מנגנון בניית המסלול" -
 * "PLANNING-FIRST... 13. לבנות Trip Strategy"): עד עכשיו "כמה אטרקציות"
 * ו"כמה מסעדות" חושבו בנפרד, בכל קריאה ל-generateDayBlueprint, מפוזרים
 * בתוך dayBlueprintService.ts (pace + culinary + childAgeBands, כל אחד
 * נבדק שוב בכל יום). TripStrategy הוא האובייקט שמאחד את זה **פעם אחת
 * לכל טיול** (לא לכל יום) - מחושב ב-auto-build/route.ts מיד אחרי
 * buildVacationContext, ומועבר הלאה ל-generateDayBlueprint/
 * categoryPlanForDay בכל יום, שקוראים ממנו בלבד ולא מחשבים שוב.
 *
 * זה לא "עוד patch לניקוד" - זה שינוי סדר: הקיבולת/צפיפות של הטיול
 * נקבעת *לפני* שמתחילים לתכנן ימים בודדים, לא מחדש בכל יום. אם התינוק
 * או ה-Culinary Intent משתנים תוך כדי (לא קורה בפועל בטיול אחד, אבל
 * עקרונית), התוצאה תהיה עקבית לאורך כל הטיול - לא תלויה בסדר הקריאות.
 */
export interface TripStrategy {
  /** תחנות "אטרקציה" (role="attraction") ליום "רגיל" - נגזר מה-Pace,
   *  אלא אם יש תינוק (0-3) בטיול, ואז נכפה קיבולת "רגועה" (RELAXED)
   *  בלי קשר ל-Pace שנבחר - זו לא עוד תקרה מעל המספר, זו התחלה אחרת. */
  activityDensity: number;
  /** עצירות Restaurant אמיתיות (role="food", לא כולל ארוחת בוקר) ליום
   *  "רגיל" - 2 (צהריים+ערב) כברירת מחדל, 3 אם Culinary Intent מפורש
   *  (בשאלון או Free Text חד-משמעי). קבוע לרוחב כל Pace - האוכל אינו
   *  פונקציה של קצב, הוא פונקציה של כוונה קולינרית בלבד. */
  maxFoodStopsPerDay: number;
  /** true כשיש תינוק (0-3) בטיול - המקור היחיד לאמת הזו בכל הטיול;
   *  כל שירות אחר (Blueprint/Retrieval/Ranking) קורא מכאן, לא מחשב מחדש. */
  hasInfant: boolean;
  /** true אם Culinary Intent אומת (שאלון או Free Text מפורש וחד-משמעי -
   *  ר' detectsExplicitFoodEmphasis למטה) - קובע את maxFoodStopsPerDay. */
  isCulinaryFocused: boolean;
  /** רדיוס אשכול גיאוגרפי מועדף (ק"מ) בין תחנות עוקבות באותו יום - צר
   *  יותר כשיש תינוק (פחות נסיעה = פחות עומס), רחב יותר ביום "packed"
   *  רגיל. עדיין soft guidance ל-Retrieval הקיים (INTER_STOP_RADIUS_KM
   *  ב-auto-build/route.ts), לא מחליף אותו - ר' "Remaining Problems"
   *  בדוח: Geographic Clustering אמיתי (אשכול-מראש, לא cursor חמדני)
   *  עדיין לא ממומש, זה רק הכנה לכיוון הזה. */
  preferredInterStopRadiusKm: number;
  /** סיבות מפורשות (traceable) לכל סטייה מברירת המחדל - כדי שאפשר
   *  יהיה לבדוק בפועל *למה* טיול מסוים יצא שונה מאחר, לא רק *מה* יצא. */
  reasons: string[];
}

/** בקשה מפורשת ("Free Text חייב להשפיע... אבל אל תסיק דברים שלא נאמרו"):
 *  whitelist שמרני של ביטויים חד-משמעיים בלבד - לא כל אזכור "אוכל". */
/**
 * תיקון באג אמיתי שנמצא ע"י סימולציה בפועל (Golden Test #22 - "אנחנו
 * רוצים חופשה קולינרית"): whitelist של ביטויים מדויקים ("חופשת אוכל",
 * "סיור קולינרי"...) פספס את הניסוח המדויק הזה בעצמו - "חופשה קולינרית"
 * לא הופיע במילה במילה באף אחד מהם. התיקון: השורש "קולינרי"/"קולינריה"
 * הוא מילה חד-משמעית בעברית (לא ניסוח יומיומי כמו "אוכל טוב" - אף אחד
 * לא "נופל" למילה הזו בטעות) - זיהוי לפי השורש מכסה את כל הניסוחים
 * ("חופשה קולינרית", "סיור קולינרי", "מסלול קולינרי", "חוויה קולינרית"
 * וכו') בבת אחת, בלי צורך ברשימת ביטויים סגורה שתמיד תפספס ניסוח כלשהו.
 * בנוסף - מספר ביטויים מפורשים שלא כוללים את השורש הזה בכלל.
 */
const FOOD_EMPHASIS_ROOT = "קולינרי";
const FOOD_EMPHASIS_HINTS = ["אנחנו רוצים אוכל", "הכי חשוב לנו זה האוכל", "עולם האוכל", "חופשת אוכל", "טעימות יין"];
export function detectsExplicitFoodEmphasis(freeText: string): boolean {
  return freeText.includes(FOOD_EMPHASIS_ROOT) || FOOD_EMPHASIS_HINTS.some((hint) => freeText.includes(hint));
}

function clampAttractionsCount(value: unknown): number {
  const n = typeof value === "number" ? Math.round(value) : 3;
  // *** תיקון (בקשה מפורשת - "3 אטרקציות מקסימום!!! לא מעבר"): התקרה
  // ירדה מ-7 ל-3 - זו התקרה הקשיחה בפועל, בלי קשר ל-Pace/למספר
  // שהמשתמש ציין במלל חופשי (ר' requestedPlaceCount למטה - גם הוא
  // עובר דרך clampAttractionsCount, אז גם בקשה מפורשת ל"10 מקומות"
  // לא תחרוג מ-3 ליום).
  return Math.min(3, Math.max(2, n));
}

/**
 * בונה את ה-TripStrategy - קריאה דטרמיניסטית אחת (בלי AI, בלי ניחוש),
 * פעם אחת לכל טיול. כל קלט הוא עובדה שכבר קיימת ב-VacationContext -
 * אין כאן שום החלטה שרירותית, רק חישוב עקבי מתוך מה שכבר ידוע.
 */
export function buildTripStrategy(context: VacationContext): TripStrategy {
  const reasons: string[] = [];

  const hasInfant = hasInfantAgeBand(context.trip.childAgeBands);
  const isCulinaryFocused =
    context.trip.vacationTypes.includes("culinary") || detectsExplicitFoodEmphasis(context.trip.freeText || "");

  const paceCounts =
    VACATION_PACE_DAILY_COUNTS[context.trip.pace as keyof typeof VACATION_PACE_DAILY_COUNTS] ??
    VACATION_PACE_DAILY_COUNTS.balanced;

  let activityDensity = clampAttractionsCount(paceCounts.attractions);
  let preferredInterStopRadiusKm = 5; // ברירת מחדל קיימת (INTER_STOP_RADIUS_KM)

  if (hasInfant) {
    activityDensity = clampAttractionsCount(VACATION_PACE_DAILY_COUNTS.relaxed.attractions);
    preferredInterStopRadiusKm = 3;
    reasons.push(
      `יש תינוק/ה בגיל 0-3 בטיול - קיבולת היום נקבעה לפי קצב "רגוע" (${activityDensity} אטרקציות) במקום ה-Pace שנבחר (${context.trip.pace}), ורדיוס האשכול הגיאוגרפי צומצם ל-${preferredInterStopRadiusKm} ק"מ.`
    );
  } else {
    reasons.push(`אין תינוק בטיול - קיבולת היום נגזרת ישירות מה-Pace שנבחר (${context.trip.pace}): ${activityDensity} אטרקציות.`);
  }

  // *** תוספת (בקשה מפורשת - "המערכת מתעלמת ממספר, בונה כמו שלא נאמר
  // כלום" + "להתאים את כמות התוצאות לפי המלל החופשי"): אם המשתמש ציין
  // מפורשות כמות מקומות רצויה (ר' vacationIntentExtractionService.ts),
  // זה גובר על ה-Pace הרגיל - מחלקים את הסה"כ שווה בשווה בין ימי הטיול
  // (clampAttractionsCount שומר על אותו טווח סביר [2,7] ליום כמו תמיד,
  // כדי לא לייצר יום עם 0 או 40 אטרקציות אם המספר שהוזכר לא הגיוני
  // ביחס למספר הימים). לא חל כש-hasInfant=true - בטיחות/קצב "רגוע"
  // עם תינוק גוברים גם על בקשה מפורשת למספר.
  if (context.trip.requestedPlaceCount != null && !hasInfant) {
    const perDay = Math.round(context.trip.requestedPlaceCount / Math.max(1, context.trip.numDays));
    activityDensity = clampAttractionsCount(perDay);
    reasons.push(
      `המשתמש ציין מפורשות ${context.trip.requestedPlaceCount} מקומות בסך הכל - חלוקה שווה על פני ${context.trip.numDays} ימים נותנת ${activityDensity} אטרקציות ליום (גובר על ברירת המחדל של ה-Pace).`
    );
  }

  const maxFoodStopsPerDay = isCulinaryFocused ? CULINARY_RESTAURANT_STOPS_PER_DAY : DEFAULT_RESTAURANT_STOPS_PER_DAY;
  reasons.push(
    isCulinaryFocused
      ? `Culinary Intent אומת (שאלון ו/או ביטוי מפורש במלל החופשי) - מכסת Restaurant Stops ליום עלתה ל-${maxFoodStopsPerDay}.`
      : `אין Culinary Intent מפורש - מכסת Restaurant Stops ליום נשארת ברירת המחדל (${maxFoodStopsPerDay}, צהריים+ערב; ארוחת בוקר לא נספרת).`
  );

  return {
    activityDensity,
    maxFoodStopsPerDay,
    hasInfant,
    isCulinaryFocused,
    preferredInterStopRadiusKm,
    reasons,
  };
}
