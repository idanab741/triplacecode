import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm } from "./geo";
import { fetchCandidatePool } from "./candidatePoolService";
import type { FinalItineraryStop } from "./types";

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC סעיפים 75-77 - Repair Engine):
 * בהמשך ל-repairDuplicates (validationService.ts, שכבר מטפל בכפילויות) -
 * זהו החלק השני, המשמעותי יותר, של מנוע ה-Repair: ניסיון החלפה אמיתי
 * לתחנה ש"שוברת" את כלל ה-40 ק"מ (MASTER SPEC סעיף 32), עם כל ארבעת
 * הרכיבים שהמפרט דורש: Replacement, Revalidation, Retry Limit, Rollback.
 *
 * למה זה עדיין PARTIAL ולא Repair Engine מלא: זה מטפל אך ורק בפריצת
 * מרחק בין-תחנתי (השבר הדטרמיניסטי היחיד שניתן "לתקן" בבטחה בלי AI -
 * יש לו קריטריון הצלחה ברור: המרחק החדש קטן מהישן). זה **לא** מטפל
 * בשאר 18 ה-Plan Breakers (שעות פתיחה, כשרות, נגישות, תקציב וכו') - כל
 * אחד מהם דורש קריטריון "הצלחה" שונה, וחלקם (כשרות/נגישות) כבר מסוננים
 * מראש כ-Hard Filter לפני שהם מגיעים לכאן בכלל, אז לא אמורים לקרות.
 */
const MAX_REPAIR_ATTEMPTS = 5; // Retry Limit - תקרה כוללת לבנייה אחת, מונעת query storm/לולאה
const MAX_REASONABLE_INTER_STOP_KM = 40; // אותו סף בדיוק כמו detectPlanBreakerWarnings (סעיף 32)
const REPAIR_SEARCH_RADIUS_KM = 15; // חיפוש תחליף - רדיוס סביר סביב התחנה הקודמת, לא כל היעד

export async function attemptGeographyRepair(
  supabase: SupabaseClient,
  stops: FinalItineraryStop[],
  sessionId: string
): Promise<{ repaired: FinalItineraryStop[]; repairedCount: number; attemptedCount: number }> {
  const result = [...stops];
  const realIndices = result
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.specialType);

  const usedPlaceIds = new Set(result.filter((s) => s.placeId).map((s) => s.placeId));

  let attemptedCount = 0;
  let repairedCount = 0;

  const byDay = new Map<number, { s: FinalItineraryStop; i: number }[]>();
  for (const entry of realIndices) {
    const day = entry.s.dayIndex ?? 1;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(entry);
  }

  for (const dayEntries of byDay.values()) {
    for (let k = 1; k < dayEntries.length; k++) {
      if (attemptedCount >= MAX_REPAIR_ATTEMPTS) break; // Retry Limit

      const prevEntry = dayEntries[k - 1];
      const currEntry = dayEntries[k];
      const originalDistanceKm = haversineDistanceKm(
        { lat: prevEntry.s.latitude, lng: prevEntry.s.longitude },
        { lat: currEntry.s.latitude, lng: currEntry.s.longitude }
      );
      if (originalDistanceKm <= MAX_REASONABLE_INTER_STOP_KM) continue;

      attemptedCount += 1;

      try {
        // Replacement: חיפוש תחליף מאותה קטגוריה, קרוב לתחנה הקודמת בפועל,
        // בלי מקומות שכבר בשימוש במסלול הזה (מניעת כפילות חדשה).
        const candidates = await fetchCandidatePool(supabase, {
          category: currEntry.s.category,
          origin: { lat: prevEntry.s.latitude, lng: prevEntry.s.longitude },
          distanceBand: "1h",
          maxDistanceKm: REPAIR_SEARCH_RADIUS_KM,
          maxPriceLevel: null,
          excludePlaceIds: Array.from(usedPlaceIds),
        });

        const best = candidates[0];
        if (!best) continue; // Rollback: אין תחליף - משאירים את המקור כמו שהוא

        const newDistanceKm = haversineDistanceKm(
          { lat: prevEntry.s.latitude, lng: prevEntry.s.longitude },
          { lat: best.latitude, lng: best.longitude }
        );

        // Rollback: מחליפים רק אם זה שיפור אמיתי - לא סתם מקום אחר באותו
        // מרחק/רחוק יותר. "שיפור אמיתי" = בפועל בתוך הסף התקין, לא רק
        // "פחות גרוע".
        if (newDistanceKm > MAX_REASONABLE_INTER_STOP_KM) continue;

        const oldPlaceId = currEntry.s.placeId;
        const replacedStop: FinalItineraryStop = {
          ...currEntry.s,
          placeId: best.id,
          name: best.name,
          imageUrls: best.imageUrls,
          rating: best.rating,
          priceLevel: best.priceLevel,
          estimatedVisitMinutes: best.estimatedVisitMinutes,
          shortDescription: best.shortDescription,
          latitude: best.latitude,
          longitude: best.longitude,
          openingHours: null,
          reason: `הוחלף אוטומטית - התחנה המקורית הייתה ${Math.round(originalDistanceKm)} ק"מ מהתחנה הקודמת (רחוק מהמצופה)`,
        };

        result[currEntry.i] = replacedStop;
        if (oldPlaceId) usedPlaceIds.delete(oldPlaceId);
        usedPlaceIds.add(best.id);

        // כותבים ל-DB מיד (לא רק במערך בזיכרון) - אחרת ההחלפה "נעלמת"
        // בפעם הבאה שהמסלול נטען מחדש מה-DB.
        await supabase
          .from("trip_builder_stops")
          .update({ place_id: best.id, reason: replacedStop.reason })
          .eq("id", currEntry.s.stopId);

        repairedCount += 1;
        console.warn("[Repair] תחנה הוחלפה בגלל מרחק גדול מדי", {
          sessionId,
          stopId: currEntry.s.stopId,
          oldName: currEntry.s.name,
          newName: best.name,
          originalDistanceKm: Math.round(originalDistanceKm),
          newDistanceKm: Math.round(newDistanceKm),
        });
      } catch (err) {
        // Rollback: כל שגיאה בניסיון ההחלפה - משאירים את התחנה המקורית
        // כמו שהיא, לא זורקים שגיאה שמפילה את כל הבנייה בגלל ניסיון תיקון שנכשל.
        console.warn("[Repair] ניסיון תיקון גיאוגרפי נכשל - נשארים עם התחנה המקורית", {
          sessionId,
          stopId: currEntry.s.stopId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (attemptedCount >= MAX_REPAIR_ATTEMPTS) break;
  }

  return { repaired: result, repairedCount, attemptedCount };
}
