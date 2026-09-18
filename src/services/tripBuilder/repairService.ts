import type { SupabaseClient } from "@supabase/supabase-js";
import { haversineDistanceKm } from "./geo";
import { fetchCandidatePool } from "./candidatePoolService";
import type { FinalItineraryStop } from "./types";
import { logPipelineWarning } from "./pipelineLogger";

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
        logPipelineWarning({ sessionId, stage: "repair" }, "תחנה הוחלפה בגלל מרחק גדול מדי", {
          stopId: currEntry.s.stopId,
          oldName: currEntry.s.name,
          newName: best.name,
          originalDistanceKm: Math.round(originalDistanceKm),
          newDistanceKm: Math.round(newDistanceKm),
        });
      } catch (err) {
        // Rollback: כל שגיאה בניסיון ההחלפה - משאירים את התחנה המקורית
        // כמו שהיא, לא זורקים שגיאה שמפילה את כל הבנייה בגלל ניסיון תיקון שנכשל.
        logPipelineWarning({ sessionId, stage: "repair" }, "ניסיון תיקון גיאוגרפי נכשל - נשארים עם התחנה המקורית", {
          stopId: currEntry.s.stopId,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (attemptedCount >= MAX_REPAIR_ATTEMPTS) break;
  }

  return { repaired: result, repairedCount, attemptedCount };
}

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 5 - "Breakfast לא מתאים
 * לבוקר"): אם התחנה הראשונה ביום (role=coffee_dessert) יצאה שלא
 * מקטגוריית coffee_carts_cafes בפועל (למשל שונתה ע"י מנגנון אחר בדיעבד) -
 * מנסים להחליף אותה בבית קפה/עגלת קפה אמיתי קרוב. Replace+Rollback,
 * בלי Retry Limit נפרד (מוגבל ממילא למספר הימים בטיול, קטן מטבעו).
 */
export async function attemptBreakfastRepair(
  supabase: SupabaseClient,
  stops: FinalItineraryStop[],
  sessionId: string
): Promise<{ repaired: FinalItineraryStop[]; repairedCount: number }> {
  const result = [...stops];
  let repairedCount = 0;
  const usedPlaceIds = new Set(result.filter((s) => s.placeId).map((s) => s.placeId));

  const byDay = new Map<number, number>(); // day -> index of first real stop in `result`
  for (let i = 0; i < result.length; i++) {
    const s = result[i];
    if (s.specialType) continue;
    const day = s.dayIndex ?? 1;
    if (!byDay.has(day)) byDay.set(day, i);
  }

  for (const [, idx] of byDay) {
    const stop = result[idx];
    if (stop.role !== "coffee_dessert" || stop.category === "coffee_carts_cafes") continue;

    try {
      const candidates = await fetchCandidatePool(supabase, {
        category: "coffee_carts_cafes",
        origin: { lat: stop.latitude, lng: stop.longitude },
        distanceBand: "1h",
        maxDistanceKm: REPAIR_SEARCH_RADIUS_KM,
        maxPriceLevel: null,
        excludePlaceIds: Array.from(usedPlaceIds),
      });
      const best = candidates[0];
      if (!best) continue; // Rollback: אין תחליף - משאירים כמו שהיה

      const oldPlaceId = stop.placeId;
      result[idx] = {
        ...stop,
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
        category: "coffee_carts_cafes",
        reason: "הוחלף אוטומטית - התחנה המקורית לא הייתה בית קפה/עגלת קפה כנדרש לבוקר",
      };
      if (oldPlaceId) usedPlaceIds.delete(oldPlaceId);
      usedPlaceIds.add(best.id);

      await supabase
        .from("trip_builder_stops")
        .update({ place_id: best.id, category: "coffee_carts_cafes", reason: result[idx].reason })
        .eq("id", stop.stopId);

      repairedCount += 1;
      logPipelineWarning({ sessionId, stage: "repair" }, "תחנת בוקר הוחלפה לבית קפה/עגלת קפה אמיתי", {
        stopId: stop.stopId,
        oldName: stop.name,
        newName: best.name,
      });
    } catch (err) {
      logPipelineWarning({ sessionId, stage: "repair" }, "ניסיון תיקון תחנת בוקר נכשל - נשארים עם התחנה המקורית", {
        stopId: stop.stopId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { repaired: result, repairedCount };
}

/**
 * תיקון פער אמיתי קריטי (Audit מול המסמך "תיקון קריטי - המסלול שמתקבל
 * כרגע אינו תקין", סעיפים 2/9-13/18): זהו הפער האמיתי היחיד שהיה עדיין
 * *לגמרי* חסר במנוע ה-Repair - עד עכשיו validateFinalItinerary/
 * detectPlanBreakerWarnings בדקו ומזהירים על הכל (מרחק, שעות, תקציב,
 * כשרות...) **חוץ** ממכסת מסעדות ליום, ושום Repair לא נגע בזה בכלל.
 * categoryPlanForDay/dayBlueprintService.ts כבר אוכפים בפועל מקסימום
 * ארוחה מתוכננת אחת ביום (שתיים רק אם culinary נבחר במפורש) *בזמן
 * הבנייה* - אבל זה Layer 2 (Candidate/Category Allocation) בלבד. בלי
 * Layer 3 (Final Validation, לפי דרישת המסמך המפורשת: "if restaurantCount
 * > allowedRestaurantCount: INVALID, REPAIR, REVALIDATE") - כל מנגנון
 * אחר שמוסיף/מחליף תחנה בדיעבד (Chat Edit, Swap, Instruct, must-see,
 * "הרחבת אתרי חובה") יכול עדיין "לדלוף" מסעדה נוספת לאותו יום בלי
 * שאף בדיקה תתפוס את זה. זו הבדיקה/תיקון הזה: **הבטחה בקוד**, לא רק
 * הנחיה בפרומפט - בסוף הריצה הזו, אף יום לא יכול להכיל יותר מ-
 * maxFoodPerDay תחנות role="food" (מסעדות בפועל), בלי יוצא מן הכלל.
 *
 * Repair, לא רק Warning (בניגוד ל-attemptGeographyRepair/attemptBudgetRepair
 * שיכולים "לוותר" ולהשאיר את הבעיה אם אין מועמד תחליף): כל תחנת "עודף"
 * מנסה קודם להיות **מוחלפת** באטרקציה מקטגוריה שחסרה ביום הזה (סעיף 12 -
 * "ה-Repair חייב להעדיף קטגוריה שחסרה ביום"). אם אין מועמד תחליף מתאים -
 * התחנה **מוסרת** (לא נשארת "מסעדה רביעית") - כך שהאינווריאנט
 * (restaurantCount <= maxFoodPerDay) מובטח תמיד, גם בלי תחליף. זה בדיוק
 * העיקרון שכבר קיים בקוד הזה (attemptRemovalRepair) - "עדיף פחות Stops
 * מאשר Stop שבור" - רק שכאן ההסרה היא הרשת ביטחון האחרונה שמבטיחה Hard
 * Constraint אמיתי, לא רק best-effort.
 *
 * maxFoodPerDay מגיע מבחוץ (finalizeService.ts) - 1 כברירת מחדל, 2 רק
 * אם Culinary Intent מפורש נבחר (isCulinaryFocused) - אף פעם לא בלתי
 * מוגבל, בדיוק לפי סעיף 3 במסמך ("גם אז - אין לתת ל-AI חופש בלתי מוגבל").
 * מופעל רק על תחנות עם dayIndex (מסלול רב-ימי - סופ"ש/חופשה בחו"ל) -
 * לטיול יומי/מסעדות-וקפה/יום אחד אין "יום" למכסה הזו בכלל, ובכוונה.
 */
export async function attemptFoodQuotaRepair(
  supabase: SupabaseClient,
  stops: FinalItineraryStop[],
  sessionId: string,
  maxFoodPerDay: number
): Promise<{ repaired: FinalItineraryStop[]; convertedCount: number; removedCount: number }> {
  const cap = Math.max(1, Math.round(maxFoodPerDay));
  const result = [...stops];
  const usedPlaceIds = new Set(result.filter((s) => s.placeId).map((s) => s.placeId));

  // "קטגוריות קלות/בטוחות" שמתאימות כאטרקציה חלופית כמעט בכל חופשה/סופ"ש -
  // אותו עיקרון בדיוק כמו LIGHT_LAST_DAY_CATEGORIES (categoryPlanService.ts),
  // מורחב מעט כדי לתת ל-Repair יותר סיכוי למצוא קטגוריה שבאמת חסרה היום.
  const REPLACEMENT_CATEGORY_CANDIDATES = [
    "nature_trails",
    "beaches_pools",
    "viewpoints",
    "parks_gardens",
    "attractions_activities",
    "culture_history",
    "shopping",
    "spa_relaxation",
  ];

  const byDay = new Map<number, { s: FinalItineraryStop; i: number }[]>();
  result.forEach((s, i) => {
    if (s.specialType || s.dayIndex == null) return;
    if (s.role !== "food") return;
    const day = s.dayIndex;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push({ s, i });
  });

  const indicesToRemove = new Set<number>();
  let convertedCount = 0;

  for (const [day, entries] of byDay) {
    if (entries.length <= cap) continue;

    // שומרים על ה-`cap` הראשונות (לפי הסדר המקורי - סדר slot_index, כבר
    // ממוין כך מהשאילתה שבנתה את finalStops), מתקנים רק את העודף.
    const excess = entries.slice(cap);

    const dayStopsAll = result.filter((s) => !s.specialType && s.dayIndex === day);
    const usedCategoriesToday = new Set(dayStopsAll.map((s) => s.category));

    for (const { s: excessStop, i } of excess) {
      const missingCategory = REPLACEMENT_CATEGORY_CANDIDATES.find((c) => !usedCategoriesToday.has(c));

      let replaced = false;
      if (missingCategory) {
        try {
          const candidates = await fetchCandidatePool(supabase, {
            category: missingCategory,
            origin: { lat: excessStop.latitude, lng: excessStop.longitude },
            distanceBand: "1h",
            maxDistanceKm: REPAIR_SEARCH_RADIUS_KM,
            maxPriceLevel: null,
            excludePlaceIds: Array.from(usedPlaceIds),
          });
          const best = candidates[0];
          if (best) {
            const oldPlaceId = excessStop.placeId;
            result[i] = {
              ...excessStop,
              placeId: best.id,
              name: best.name,
              category: missingCategory,
              role: "attraction",
              imageUrls: best.imageUrls,
              rating: best.rating,
              priceLevel: best.priceLevel,
              estimatedVisitMinutes: best.estimatedVisitMinutes,
              shortDescription: best.shortDescription,
              latitude: best.latitude,
              longitude: best.longitude,
              openingHours: null,
              reason: "הוחלף אוטומטית - יותר מדי מסעדות מתוכננות באותו יום; הוחלף באטרקציה כדי לשמור על חופשה מאוזנת (לא רשימת מסעדות)",
            };
            if (oldPlaceId) usedPlaceIds.delete(oldPlaceId);
            usedPlaceIds.add(best.id);
            usedCategoriesToday.add(missingCategory);

            await supabase
              .from("trip_builder_stops")
              .update({ place_id: best.id, category: missingCategory, role: "attraction", reason: result[i].reason })
              .eq("id", excessStop.stopId);

            convertedCount += 1;
            replaced = true;
            logPipelineWarning({ sessionId, stage: "repair" }, "מסעדת-עודף (מעבר למכסה היומית) הוחלפה באטרקציה", {
              day,
              stopId: excessStop.stopId,
              oldName: excessStop.name,
              newName: best.name,
              newCategory: missingCategory,
              maxFoodPerDay: cap,
            });
          }
        } catch (err) {
          logPipelineWarning({ sessionId, stage: "repair" }, "ניסיון החלפת מסעדת-עודף נכשל", {
            day,
            stopId: excessStop.stopId,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (!replaced) {
        // אין מועמד תחליף מתאים - מסירים (לא משאירים מסעדה רביעית),
        // בדיוק לפי העיקרון "עדיף פחות Stops מאשר Stop שבור"/"עדיף
        // פחות Stops מאשר חריגה ממכסה קשיחה".
        indicesToRemove.add(i);
      }
    }
  }

  if (indicesToRemove.size === 0) {
    return { repaired: result, convertedCount, removedCount: 0 };
  }

  let removedCount = 0;
  for (const i of indicesToRemove) {
    const stop = result[i];
    await supabase.from("trip_builder_stops").delete().eq("id", stop.stopId);
    removedCount += 1;
    logPipelineWarning({ sessionId, stage: "repair" }, "מסעדת-עודף הוסרה (אין קטגוריה חלופית זמינה קרובה - עדיף פחות תחנות מחריגה ממכסה)", {
      dayIndex: stop.dayIndex,
      stopId: stop.stopId,
      name: stop.name,
      maxFoodPerDay: cap,
    });
  }

  return { repaired: result.filter((_, i) => !indicesToRemove.has(i)), convertedCount, removedCount };
}

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 18 - "סתירת לינה")
 * ו-Breaker 2/3 (יום לא ריאלי מבחינת זמן): לשני אלה **אין** "מועמד
 * תקין" הגיוני להחליף אליו (מה בדיוק מחליפים תחנה שרחוקה מדי מהלינה,
 * או תחנה שרק "קרתה" להיות אחרונה ביום עמוס מדי?) - לפי המפרט המפורש
 * ("אם אין מועמד תקין - עדיף פחות Stops מאשר Stop שבור"), התיקון היחיד
 * הבטוח כאן הוא **הסרה**, לא ניחוש תחליף. מוגבל ל-2 הסרות לכל היותר
 * לבנייה אחת (Retry Limit) - כדי לא "לפרק" מסלול שלם בטעות.
 */
export async function attemptRemovalRepair(
  supabase: SupabaseClient,
  stops: FinalItineraryStop[],
  sessionId: string,
  lodgingCoords?: { lat: number; lng: number } | null
): Promise<{ repaired: FinalItineraryStop[]; removedCount: number }> {
  const MAX_REMOVALS = 2;
  const MAX_REASONABLE_DAY_MINUTES = 900;
  const MAX_DISTANCE_FROM_LODGING_KM = 50;

  const byDay = new Map<number, FinalItineraryStop[]>();
  for (const s of stops) {
    if (s.specialType) continue;
    const day = s.dayIndex ?? 1;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day)!.push(s);
  }

  const toRemoveStopIds = new Set<string>();

  for (const dayStops of byDay.values()) {
    if (toRemoveStopIds.size >= MAX_REMOVALS) break;
    // Breaker 2/3: אם היום נמשך אחרי חצות - מסירים את התחנה האחרונה בלבד
    // (לא כל התחנות שחורגות - שינוי הכי קטן שעדיין פותר את הבעיה).
    const sorted = [...dayStops].sort((a, b) => a.arrivalOffsetMinutes - b.arrivalOffsetMinutes);
    const last = sorted[sorted.length - 1];
    if (last && last.arrivalOffsetMinutes > MAX_REASONABLE_DAY_MINUTES) {
      toRemoveStopIds.add(last.stopId);
    }
  }

  if (lodgingCoords) {
    for (const s of stops) {
      if (s.specialType || toRemoveStopIds.size >= MAX_REMOVALS) continue;
      const d = haversineDistanceKm(lodgingCoords, { lat: s.latitude, lng: s.longitude });
      if (d > MAX_DISTANCE_FROM_LODGING_KM) toRemoveStopIds.add(s.stopId);
    }
  }

  if (toRemoveStopIds.size === 0) return { repaired: stops, removedCount: 0 };

  for (const stopId of toRemoveStopIds) {
    await supabase.from("trip_builder_stops").delete().eq("id", stopId);
    logPipelineWarning({ sessionId, stage: "repair" }, "תחנה הוסרה (אין מועמד תקין להחליף - עדיף פחות תחנות מתחנה שבורה)", { stopId });
  }

  return { repaired: stops.filter((s) => !toRemoveStopIds.has(s.stopId)), removedCount: toRemoveStopIds.size };
}

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 12 - "Budget breach
 * משמעותי"): קודם הייתה רק בדיקה (warning), בלי Repair בכלל. מחפש את
 * התחנה היקרה ביותר (לפי price_level אמיתי, לא המצאה), מנסה להחליף
 * אותה במועמד זול יותר מאותה קטגוריה קרוב אליה. Retry Limit קטן (3) -
 * לא ממשיך "לרדוף" אחרי תקציב שלא ניתן להשיג בלי לפרק את כל המסלול.
 * Rollback: אם אין תחליף זול יותר - משאירים את התחנה כמו שהיא (עדיין
 * מוצגת אזהרת התקציב, לא מוסרים תחנה סתם בגלל מחיר).
 */
export async function attemptBudgetRepair(
  supabase: SupabaseClient,
  stops: FinalItineraryStop[],
  sessionId: string,
  maxBudget: number,
  estimateCost: (priceLevel: number | null) => number
): Promise<{ repaired: FinalItineraryStop[]; repairedCount: number }> {
  const MAX_BUDGET_REPAIR_ATTEMPTS = 3;
  const result = [...stops];
  let repairedCount = 0;
  const usedPlaceIds = new Set(result.filter((s) => s.placeId).map((s) => s.placeId));

  const currentTotalCost = () => result.filter((s) => !s.specialType).reduce((sum, s) => sum + estimateCost(s.priceLevel), 0);

  for (let attempt = 0; attempt < MAX_BUDGET_REPAIR_ATTEMPTS; attempt++) {
    if (currentTotalCost() <= maxBudget) break;

    // מוצאים את התחנה הרגילה (לא לוגיסטיקה) עם price_level הגבוה ביותר שעדיין לא נוסתה
    const candidates = result
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !s.specialType && s.priceLevel != null && s.priceLevel > 0)
      .sort((a, b) => (b.s.priceLevel ?? 0) - (a.s.priceLevel ?? 0));
    const target = candidates[0];
    if (!target) break; // אין תחנה יקרה יותר להחליף - עוצרים, לא ממציאים פתרון

    try {
      const cheaperCandidates = await fetchCandidatePool(supabase, {
        category: target.s.category,
        origin: { lat: target.s.latitude, lng: target.s.longitude },
        distanceBand: "1h",
        maxDistanceKm: REPAIR_SEARCH_RADIUS_KM,
        maxPriceLevel: Math.max(0, (target.s.priceLevel ?? 4) - 1),
        excludePlaceIds: Array.from(usedPlaceIds),
      });
      const best = cheaperCandidates[0];
      if (!best) break; // Rollback: אין מועמד זול יותר - משאירים כמו שהיה, עוצרים

      const oldPlaceId = target.s.placeId;
      result[target.i] = {
        ...target.s,
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
        reason: "הוחלף אוטומטית - חלופה זולה יותר כדי להישאר בתקציב שנבחר",
      };
      if (oldPlaceId) usedPlaceIds.delete(oldPlaceId);
      usedPlaceIds.add(best.id);

      await supabase
        .from("trip_builder_stops")
        .update({ place_id: best.id, reason: result[target.i].reason })
        .eq("id", target.s.stopId);

      repairedCount += 1;
      logPipelineWarning({ sessionId, stage: "repair" }, "תחנה הוחלפה בחלופה זולה יותר בגלל חריגת תקציב", {
        stopId: target.s.stopId,
        oldName: target.s.name,
        newName: best.name,
      });
    } catch (err) {
      logPipelineWarning({ sessionId, stage: "repair" }, "ניסיון תיקון תקציב נכשל - נשארים עם התחנה המקורית", {
        stopId: target.s.stopId,
        message: err instanceof Error ? err.message : String(err),
      });
      break;
    }
  }

  return { repaired: result, repairedCount };
}
