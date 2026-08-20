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

export function detectPlanBreakerWarnings(stops: FinalItineraryStop[]): string[] {
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
  }

  // סעיף 16/240 - Nightlife לא לפני 19:00.
  for (const stop of realStops) {
    if (stop.role === "nightlife" && stop.arrivalOffsetMinutes < NIGHTLIFE_EARLIEST_OFFSET_MINUTES) {
      warnings.push(`תחנת חיי הלילה "${stop.name}" מתוזמנת מוקדם מדי (לפני 19:00) - חיי לילה אמורים להיות אחת התחנות האחרונות של היום.`);
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
