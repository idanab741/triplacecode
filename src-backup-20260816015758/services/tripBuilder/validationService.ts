import type { FinalItineraryStop } from "./types";

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
