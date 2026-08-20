import type { FinalItineraryStop } from "./types";
import { haversineDistanceKm } from "./geo";

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 75-77 - Repair Engine):
 * מנוע Repair מלא (Detect→Replace→Recalculate→Revalidate, עם ניסיונות
 * חוזרים מוגבלים ו-rollback) הוא פרויקט הנדסי משמעותי בפני עצמו - צריך
 * להיכנס מחדש ל-candidate pool/ranking עם exclusions, ולוודא שאין לולאה
 * אינסופית או מצב "תחנה נעלמת בלי סיבה" בלי שיהיה אפשר להריץ ולבדוק את
 * זה בפועל. במקום זה - החלק הבטוח והבעל-ערך-מיידי ביותר: הסרת כפילויות
 * אוטומטית, בדיוק העיקרון של סעיף 77 ("עדיף פחות Stops מאשר Stop שבור").
 * זו הסרה בלבד (לא מוסיפה שום דבר חדש שעלול להיות שגוי) - ומייתרת את
 * אחד משני מצבי הכשל שקודם היו מפילים את *כל* הבנייה (validateFinalItinerary
 * זרק שגיאה על כפילות, במקום פשוט להסיר אותה).
 */
export function repairDuplicates(stops: FinalItineraryStop[]): { repaired: FinalItineraryStop[]; removedCount: number } {
  const seenPlaceIds = new Set<string>();
  const repaired: FinalItineraryStop[] = [];
  let removedCount = 0;
  for (const stop of stops) {
    if (stop.placeId && seenPlaceIds.has(stop.placeId)) {
      removedCount += 1;
      continue;
    }
    if (stop.placeId) seenPlaceIds.add(stop.placeId);
    repaired.push(stop);
  }
  return { repaired, removedCount };
}

/**
 * תיקון פער אמיתי שאותר ב-Audit מול ה-MASTER SPEC (סעיפים 74, 121, 202,
 * 32, 240): validateFinalItinerary בדק רק תקינות מבנית (placeId/
 * קואורדינטות/שם/כפילות) - אף אחד מ-20 ה"Plan Breakers" שהמפרט מפרט
 * (גיאוגרפיה, שעות, ...) לא נבדק בפועל. פונקציה זו בודקת breakers
 * דטרמיניסטיים שניתן לזהות בלי AI מתוך הנתונים שכבר קיימים ב-stops -
 * ומחזירה אזהרות (לא חוסמת את הבנייה, לא זורקת שגיאה) - כי אין עדיין
 * מנגנון Repair אמיתי (Detect→Replace→Recalculate→Revalidate) שיכול
 * לתקן אותן בבטחה; להחליט "מסלול שבור לגמרי" צריך יותר ודאות מזה, אבל
 * להראות למשתמש שיש בעיה אמיתית (למשל "40 ק"מ בין שתי תחנות") עדיף
 * בהרבה על שתיקה מוחלטת, בדיוק כמו שהתקציב כבר עושה (BUDGET_BAND_MAX_TOTAL
 * ב-finalizeService.ts).
 */
const MAX_REASONABLE_INTER_STOP_KM = 40; // MASTER SPEC סעיף 32 - "40km Rule"
const NIGHTLIFE_EARLIEST_OFFSET_MINUTES = 600; // 19:00 בהנחת יום שמתחיל 09:00 (סעיף 16/240)

export function detectPlanBreakerWarnings(
  stops: FinalItineraryStop[],
  requirements?: { requireKosher?: boolean; requireAccessible?: boolean; childAgeBands?: string[] }
): string[] {
  const warnings: string[] = [];

  // סעיף 32/139-142 - "40km Rule": מרחק גדול מדי בין תחנות עוקבות באותו
  // יום. בודקים רק בין תחנות **רגילות** (לא תחנות לוגיסטיקה סינתטיות -
  // אלה תמיד lat=0/lng=0, לא מיקום אמיתי).
  const realStops = stops.filter((s) => !s.specialType);
  const byDay = new Map<number, FinalItineraryStop[]>();
  for (const stop of realStops) {
    const day = stop.dayIndex ?? 1;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(stop);
  }
  for (const [day, dayStops] of byDay) {
    for (let i = 1; i < dayStops.length; i++) {
      const distanceKm = haversineDistanceKm(
        { lat: dayStops[i - 1].latitude, lng: dayStops[i - 1].longitude },
        { lat: dayStops[i].latitude, lng: dayStops[i].longitude }
      );
      if (distanceKm > MAX_REASONABLE_INTER_STOP_KM) {
        warnings.push(
          `יום ${day}: המרחק בין "${dayStops[i - 1].name}" ל-"${dayStops[i].name}" הוא כ-${Math.round(distanceKm)} ק"מ - רחוק מהמצופה בין תחנות עוקבות.`
        );
      }
    }

    // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 74 Breaker 6, סעיף 233):
    // יותר מדי תחנות ביום ביחס לכל pace סביר - גם "packed" לא אמור לחרוג
    // מ-8 תחנות אמיתיות ביום אחד (VACATION_PACE_DAILY_COUNTS: attractions
    // עד 5 + food עד 3 = 8, התקרה העליונה מכל הפרופילים).
    const MAX_REASONABLE_STOPS_PER_DAY = 8;
    if (dayStops.length > MAX_REASONABLE_STOPS_PER_DAY) {
      warnings.push(`יום ${day}: ${dayStops.length} תחנות ביום אחד - עמוס מהמצופה, גם לקצב "מתוכנן".`);
    }

    // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 131-132 Breaker 16):
    // חזרתיות קטגוריה ללא הצדקה - 3+ תחנות מאותה קטגוריה באותו יום
    // (לדוגמה 3 בתי קפה) בלי שהוזכר במפורש "סיבוב קפה/יין" וכדומה.
    // בדיקה שמרנית - לא בודקת freeText, רק סופרת, ומזהירה רק מ-3+.
    const categoryCounts = new Map<string, number>();
    for (const s of dayStops) categoryCounts.set(s.category, (categoryCounts.get(s.category) ?? 0) + 1);
    for (const [category, count] of categoryCounts) {
      if (count >= 3) {
        warnings.push(`יום ${day}: ${count} תחנות מאותה קטגוריה (${category}) - ודאו שזה מכוון ולא חזרתיות מיותרת.`);
      }
    }
  }

  // סעיף 16/240 - Nightlife לא לפני 19:00.
  for (const stop of realStops) {
    if (stop.role === "nightlife" && stop.arrivalOffsetMinutes < NIGHTLIFE_EARLIEST_OFFSET_MINUTES) {
      warnings.push(`תחנת חיי הלילה "${stop.name}" מתוזמנת מוקדם מדי (לפני 19:00) - חיי לילה אמורים להיות אחת התחנות האחרונות של היום.`);
    }
  }

  // תיקון פער אמיתי (Audit מול MASTER SPEC Breakers 9/10/11 - סעיף 74):
  // defense-in-depth על כשרות/נגישות/גיל ילדים - אלה כבר hard-filter
  // ב-Candidate Pool (rankCandidatesFast/fetchCandidatePool), אז זה לא
  // אמור לקרות בזרימה תקינה - אבל אם קרה בכל זאת (למשל תחנה שהוזנה
  // ידנית ע"י Chat Edit, שלא עוברת דרך אותו hard filter), עדיף להתריע
  // מאשר לשתוק. בודקים רק אם התחנה בכלל מתויגת (kosher/accessible לא
  // null) - אין עונש על "לא ידוע", רק על סתירה מפורשת בפועל.
  if (requirements?.requireKosher) {
    for (const stop of realStops) {
      if (stop.kosher === false) {
        warnings.push(`התחנה "${stop.name}" מתויגת כלא-כשרה, למרות שביקשתם כשרות.`);
      }
    }
  }
  if (requirements?.requireAccessible) {
    for (const stop of realStops) {
      if (stop.accessible === false) {
        warnings.push(`התחנה "${stop.name}" מתויגת כלא-נגישה, למרות שביקשתם נגישות.`);
      }
    }
  }
  if (requirements?.childAgeBands && requirements.childAgeBands.length > 0) {
    for (const stop of realStops) {
      if (stop.suitableChildAges && stop.suitableChildAges.length > 0) {
        const matches = stop.suitableChildAges.some((age) => requirements.childAgeBands!.includes(age));
        if (!matches) {
          warnings.push(`התחנה "${stop.name}" מתויגת כמתאימה לגילאים אחרים מגילאי הילדים שצוינו.`);
        }
      }
    }
  }

  return warnings;
}


/**
 * ולידציה קשיחה על המסלול הסופי, לפני שהוא נשמר/מוצג ב-Result Page.
 *
 * לפי המפרט (סעיף 23-24): "Generate → Validate → Display" ולא
 * "Generate → Display → Continue generating". אם יש בעיה מבנית אמיתית -
 * אסור להציג מסלול פגום למשתמש; יש לזרוק שגיאה ולתת ל-API route להחזיר
 * error במקום itinerary (ראה app/api/trip-builder/sessions/[sessionId]/finalize/route.ts,
 * שכבר עוטף את finalizeItinerary ב-try/catch ומחזיר { error } במקרה של חריגה).
 *
 * הבדיקות כאן הן "רשת ביטחון" מבנית (defense in depth) - הן לא אמורות להיכשל
 * בזרימה תקינה, כי finalizeService כבר מסנן stops בלי place/קואורדינטות.
 * המטרה היא לתפוס מקרי קצה (למשל: תקלה עתידית שתסיר את הסינון בטעות)
 * *לפני* שהם מגיעים למשתמש, לא רק לתעד אותם ביומן.
 */
export interface ItineraryValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFinalItinerary(stops: FinalItineraryStop[]): ItineraryValidationResult {
  const errors: string[] = [];

  if (stops.length === 0) {
    errors.push("המסלול שנבנה ריק - אין אף תחנה עם place תקין.");
  }

  const seenPlaceIds = new Set<string>();
  for (const stop of stops) {
    // סעיף 18+24: כל Stop חייב להיות מקושר ל-place אמיתי עם id תקין -
    // אין "name" בלבד בלי place identity.
    if (!stop.placeId) {
      errors.push(`תחנה "${stop.name || "ללא שם"}" חסרה placeId תקין.`);
      continue;
    }
    if (typeof stop.latitude !== "number" || typeof stop.longitude !== "number") {
      errors.push(`תחנה "${stop.name}" חסרה קואורדינטות תקינות.`);
    }
    if (!stop.name || !stop.name.trim()) {
      errors.push(`תחנה עם placeId ${stop.placeId} חסרה שם.`);
    }

    // סעיף 24: "שאין כפילויות מיותרות" - אותו place פעמיים באותו מסלול.
    // (כפילות בין ימים שונים במסלול רב-ימי מותרת בכוונה - למשל לחזור לאותו
    // בית קפה טוב פעמיים בטיול ארוך - לכן לא נבדק כאן day_index, רק חזרה
    // גורפת בכל המסלול, שסביר שהיא תקלה ולא בחירה מכוונת.)
    if (seenPlaceIds.has(stop.placeId)) {
      errors.push(`המקום "${stop.name}" מופיע יותר מפעם אחת במסלול.`);
    }
    seenPlaceIds.add(stop.placeId);
  }

  return { valid: errors.length === 0, errors };
}
