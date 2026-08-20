import type { SupabaseClient } from "@supabase/supabase-js";
import { getUpcomingEvents } from "@/services/events/ticketmasterService";
import { haversineDistanceKm, estimateTravelMinutes } from "./geo";
import { saveFinalItinerary, savePartialItinerary } from "./sessionService";
import { reviewItinerary } from "./qualityCheckService";
import { validateFinalItinerary, detectPlanBreakerWarnings } from "./validationService";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { generatePersonalizedDescriptions } from "./descriptionService";
import type { TripIntent } from "./tripIntentService";
import type { FinalItinerary, FinalItineraryEvent, FinalItineraryStop, LatLng, TripBuilderStop } from "./types";

interface LikedStopWithPlace extends TripBuilderStop {
  place: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    image_urls: string[];
    price_level: number | null;
    rating: number | null;
    estimated_visit_minutes: number | null;
    opening_hours: string[] | null;
    short_description: string | null;
  } | null;
}

const BUDGET_BAND_MAX_TOTAL: Record<string, number | null> = {
  // טיול יומי (DayTripAnswers.budgetBand)
  "0-100": 100,
  "100-300": 300,
  "300-600": 600,
  "600-1000": 1000,
  // תיקון באג אמיתי (זוהה ב-MASTER SPEC סעיף 65/250, ואומת בקוד): קריאות
  // finalizeItinerary עבור סופ"ש/חופשה בחו"ל העבירו answers.budgetBand -
  // שדה שלא קיים בכלל באף אחד מהם (השדה האמיתי הוא budgetPerPerson, כבר
  // Budget Envelope לכל הטיול, לא צריך שום חלוקה נוספת) - כך שבדיקת
  // "העלות המשוערת חורגת מהתקציב" (סעיף 66) תמיד קיבלה undefined וקצרה
  // ל-null (=ללא הגבלה), בלי קשר לתקציב שנבחר בפועל. מוסיפים כאן את
  // הערכים האמיתיים של שני סוגי הטיול (סופ"ש + חו"ל, סקאלות שונות),
  // כדי שאותה טבלה תשרת את שניהם נכון ברגע שהשדה הנכון מועבר בקריאה.
  "0-1000": 1000, // סופ"ש (WEEKEND_BUDGET_STEPS)
  "1000-3000": 3000,
  "3000+": null,
  "0-2500": 2500, // חופשה בחו"ל (VACATION_BUDGET_STEPS)
  "2500-7500": 7500,
  "7500-12000": 12000,
  "12000+": null,
  unlimited: null,
};

/**
 * מבצע אופטימיזציה סופית: מיון גיאוגרפי (nearest-neighbor, Haversine בלבד),
 * חישוב זמני נסיעה מצטברים, ובדיקת תקציב/משך זמן. בלי קריאת Claude - זהו
 * חישוב דטרמיניסטי, לא שיפוט איכותי.
 */
export async function finalizeItinerary(
  supabase: SupabaseClient,
  sessionId: string,
  origin: LatLng,
  budgetBand: string,
  durationBand?: string,
  tripIntent?: TripIntent | null,
  freeText?: string,
  /** בקשה מפורשת (ארכיטקטורת "יום 1 תוך 10-15 שניות + סקלטון לשאר
   *  הימים"): false עבור שמירת יום 1 בלבד באמצע בנייה מרובת-ימים - לא
   *  נוגע ב-status (נשאר "building"). ברירת המחדל true שומרת על ההתנהגות
   *  המקורית (המסלול המלא, status="completed") לכל שאר הקוראים. */
  isFinal: boolean = true,
  /** בקשה מפורשת ("תעשה שגיאות גלויות באפליקציה, לא רק בלוג של השרת") -
   *  אזהרות נוספות (למשל "יום 3 נכשל בבנייה: ...") שמוזרקות ישירות
   *  ל-warnings של המסלול הסופי - נראה בפועל בעמוד התוצאה, בלי צורך
   *  בגישה לטרמינל/לוגים בכלל. */
  extraWarnings: string[] = []
): Promise<FinalItinerary> {
  const { data: session } = await supabase
    .from("trip_builder_sessions")
    .select("id")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) throw new Error("ה-session לא נמצא");

const { data: stops } = await supabase
    .from("trip_builder_stops")
.select(
      "*, place:places(id,name,latitude,longitude,image_urls,price_level,rating,estimated_visit_minutes,opening_hours,short_description)"
    )
    .eq("session_id", sessionId)
    .eq("status", "liked")
    .order("slot_index", { ascending: true });

  const likedStops = ((stops ?? []) as LikedStopWithPlace[]).filter(
    (stop) => stop.place && stop.place.latitude != null && stop.place.longitude != null
  );

  // עבור חופשה בחו"ל (יש day_index) - ממיינים לפי יום קודם, ורק בתוך כל
  // יום עושים nearest-neighbor. אחרת (יום בודד) - nearest-neighbor רגיל.
  const hasDays = likedStops.some((s) => s.day_index != null);
  const ordered = hasDays ? orderByDayThenNearestNeighbor(likedStops, origin) : orderByNearestNeighbor(likedStops, origin);

let cursor = origin;
  let cumulativeMinutes = 0;
  let cumulativeCost = 0;
  let previousDay: number | null = null;
  const finalStops: FinalItineraryStop[] = [];

  for (const stop of ordered) {
    // מאפסים את המונה **וגם** את ה-cursor בתחילת כל יום חדש - חוזרים
    // למיקום המוצא (מלון/יעד), לא ממשיכים מהתחנה האחרונה של היום הקודם.
    // בלי זה, מרחק גדול (או שגיאת geocoding נקודתית) בסוף יום אחד "מדביק"
    // את כל התחנות של היום הבא בזמן שגוי שמצטבר קדימה.
    const currentDay = stop.day_index ?? null;
    if (currentDay !== null && currentDay !== previousDay) {
      cumulativeMinutes = 0;
      cursor = origin;
      previousDay = currentDay;
    }

  const placeLatLng: LatLng = { lat: stop.place!.latitude!, lng: stop.place!.longitude! };
    const rawDistanceKm = haversineDistanceKm(cursor, placeLatLng);
    // תקרת שפיות: מרחק בין תחנות בתוך אותו יעד לא אמור לחרוג מ-100 ק"מ.
    // אם זה קורה - כנראה geocoding שגוי למקום ספציפי (נקודת "אפס" או עיר
    // אחרת) - מתעלמים מהמרחק החריג במקום לתת לו "להדביק" זמן ענק לכל השאר.
    const distanceKm = rawDistanceKm > 100 ? 5 : rawDistanceKm;
    const etaMinutes = estimateTravelMinutes(distanceKm, "drive");
    cumulativeMinutes += etaMinutes;

    // תחנת חיי לילה לא נפתחת לפני 19:00 - אם היום עדיין "מוקדם" בשלב הזה,
    // מקפיצים את הזמן המצטבר קדימה עד השעה הזו (ולא אחורה - אף פעם לא מוקדם יותר).
    if (stop.category === "nightlife" && cumulativeMinutes < NIGHTLIFE_MIN_OFFSET_MINUTES) {
      cumulativeMinutes = NIGHTLIFE_MIN_OFFSET_MINUTES;
    }

finalStops.push({
        stopId: stop.id,
        placeId: stop.place!.id,
        name: stop.place!.name,
        category: stop.category,
        role: stop.role,
        imageUrls: stop.place!.image_urls ?? [],
        etaMinutes,
        arrivalOffsetMinutes: cumulativeMinutes,
        estimatedVisitMinutes: stop.place!.estimated_visit_minutes,
        priceLevel: stop.place!.price_level,
        rating: stop.place!.rating,
        reason: stop.reason,
        shortDescription: stop.place!.short_description,
        latitude: placeLatLng.lat,
        longitude: placeLatLng.lng,
        openingHours: stop.place!.opening_hours,
        dayIndex: stop.day_index,
    });

    cumulativeMinutes += stop.place!.estimated_visit_minutes ?? 60;
    cumulativeCost += estimateCostFromPriceLevel(stop.place!.price_level);
    cursor = placeLatLng;
  }

  // Time Engine - דרישה קשיחה: המשתמש רואה אך ורק שעות עגולות (09:00,
  // 10:00...) - לעולם לא 09:23/14:45. החישוב המדויק-לדקה למעלה משמש רק
  // לקביעת הסדר/המרחק היחסי בין תחנות - עכשיו מיישרים כל תחנה לשעה
  // עגולה הכי קרובה, עם ערבות שהיא תמיד מאוחרת מהתחנה הקודמת (לא שתי
  // תחנות על אותה שעה) ולעולם לא מוקדמת ממנה.
  alignStopTimesToWholeHours(finalStops);

const warnings: string[] = [];
  const maxBudget = BUDGET_BAND_MAX_TOTAL[budgetBand];
  if (maxBudget != null && cumulativeCost > maxBudget) {
    warnings.push("העלות המשוערת של המסלול עשויה לחרוג מהתקציב שנבחר");
  }
  
// בקרת איכות אחרונה - רק למסלולים ארוכים יותר, שבהם הסיכון לחוסר איזון גבוה יותר.
  // זהו כלי ניטור פנימי בלבד - הבעיות נרשמות ביומן (Vercel logs) לצורך מעקב איכות,
  // ולא מוצגות למשתמש כאזהרה. משתמש שרואה "רשימת תלונות" על הטיול שלו זו חוויה גרועה.
  //
  // תיקון מהירות: בכוונה **לא** ממתינים (await) לקריאת ה-Claude הזו - התוצאה
  // שלה היא ללוג פנימי בלבד ולעולם לא משפיעה על ה-itinerary שמוחזר למשתמש,
  // אין שום סיבה שהמשתמש יחכה עוד קריאת Claude מלאה (3-15+ שניות) רק כדי
  // שנרשום אזהרת ניטור. רץ ברקע, לא חוסם את התשובה.
  if (isFinal && finalStops.length >= 3) {
    reviewItinerary({ stops: finalStops, tripIntent })
      .then((issues) => {
        if (issues.length > 0) {
          console.warn("[Quality Check] נמצאו בעיות איכות במסלול", {
            sessionId,
            issues,
          });
        }
      })
      .catch(() => {
        // כלי ניטור פנימי בלבד - כשל כאן לא אמור להפריע לכלום
      });
  }

  // תיאורים אישיים - Claude כותב תיאור *רק* לתחנות שבאמת אין להן תיאור
  // אמיתי כבר (short_description ריק). קודם זה נקרא לכל התחנות ותמיד
  // דרס את מה שהיה שם - כולל תיאורים מדויקים שאדמין כתב וניפה בעצמו.
  // "השתמש בידע הכללי שלך, לא רק בתיאור מה-DB" גרם בפועל להמצאות: מקום
  // שהאדמין תייג ותיאר במדויק כ"מסעדת אוכל רחוב/פלאפל" יצא בתוצאה עם
  // תיאור שממציא "עגלת קפה" - עובדה שלא נתמכת בשום נתון אמיתי על המקום.
  // אין שום סיבה שתיאור אמיתי וקיים "יתחרה" מול ניחוש כללי של Claude.
  const MAX_STOPS_FOR_AI_DESCRIPTIONS = 15;
  const stopsNeedingDescription = finalStops.filter((s) => !s.shortDescription);
  if (stopsNeedingDescription.length > 0 && stopsNeedingDescription.length <= MAX_STOPS_FOR_AI_DESCRIPTIONS) {
    const descriptions = await generatePersonalizedDescriptions(stopsNeedingDescription, freeText ?? "", tripIntent);
    for (const stop of stopsNeedingDescription) {
      const generated = descriptions.get(stop.stopId);
      if (generated) {
        stop.shortDescription = generated;
      } else if (stop.reason) {
        // גיבוי: אם יצירת התיאור נכשלה/נקטעה לתחנה הזו ספציפית - עדיף
        // להציג את ה-reason (כבר קיים, נוצר בשלב הבחירה) מאשר תחנה בלי
        // שום תיאור בכלל.
        stop.shortDescription = stop.reason;
      }
    }
  } else if (stopsNeedingDescription.length > MAX_STOPS_FOR_AI_DESCRIPTIONS) {
    for (const stop of stopsNeedingDescription) {
      if (stop.reason) {
        stop.shortDescription = stop.reason;
      }
    }
  }

// ולידציה קשיחה לפני שמירה/הצגה (מפרט סעיף 23-24: Generate → Validate →
  // Display). אם יש בעיה מבנית אמיתית - לא שומרים ולא מחזירים מסלול פגום;
  // ה-API route (finalize/route.ts) כבר עוטף קריאה זו ב-try/catch ומחזיר
  // { error } למשתמש במקום itinerary, כך שאין סיכון להצגת "חצי מסלול".
  const validation = validateFinalItinerary(finalStops);
  if (!validation.valid) {
    console.error("[Validation] המסלול נכשל בבדיקת התקינות - לא נשמר ולא יוצג", {
      sessionId,
      errors: validation.errors,
    });
    throw new Error(`המסלול שנבנה אינו תקין: ${validation.errors.join("; ")}`);
  }

  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיפים 74/121/202): בדיקות
  // Plan Breaker דטרמיניסטיות (גיאוגרפיה/תזמון חיי-לילה) שלא נבדקו בשום
  // מקום קודם - לא חוסמות את הבנייה (עדיין אין Repair אמיתי), אבל כן
  // מגיעות בפועל למשתמש (warnings, כבר מוצג בעמוד התוצאה), לא רק ללוג.
  const planBreakerWarnings = detectPlanBreakerWarnings(finalStops);
  if (planBreakerWarnings.length > 0) {
    console.warn("[Validation] נמצאו Plan Breakers (לא חוסם, מוצג כאזהרה)", { sessionId, planBreakerWarnings });
  }

  const itinerary: FinalItinerary = {
    stops: finalStops,
    events: [],
    totalEtaMinutes: cumulativeMinutes,
    warnings: [...warnings, ...planBreakerWarnings, ...extraWarnings],
    dayTitles: deriveDayTitles(finalStops),
  };

  if (isFinal) {
    await saveFinalItinerary(supabase, sessionId, itinerary);
  } else {
    await savePartialItinerary(supabase, sessionId, itinerary);
  }
  return itinerary;
}

/**
 * Time Engine (בקשה מפורשת, "Requirement קשיח" + "למה השעה תמיד מסתיימת
 * לא יאוחר מ-15??"): מיישר את arrivalOffsetMinutes של כל תחנה לשעה עגולה.
 *
 * הגרסה הקודמת רק אכפה "לפחות שעה אחת אחרי הקודמת" - וכיוון שזמני
 * ביקור+נסיעה אמיתיים בד"כ קצרים יחסית (45-90 דקות), זה בפועל דחס כל
 * יום לרצף של שעות רצופות בדיוק (09-10-11-12...) שנגמר אחה"צ מוקדם,
 * במקום להיפרס לאורך יום אמיתי עד לארוחת ערב בערב. עכשיו: לכל יום
 * (מלבד חיי-לילה, שמטופל בנפרד) - פריסה שווה על פני חלון יום ריאלי:
 * אם יש שתי ארוחות (בוקר/צהריים בית קפה + מסעדה נוספת = יום "מלא") -
 * עד 20:00; אחרת (יום קליל - הגעה/עזיבה) - נשאר קומפקטי בבוקר.
 */
function alignStopTimesToWholeHours(stops: FinalItineraryStop[]): void {
  const dayNumbers = Array.from(new Set(stops.map((s) => s.dayIndex).filter((d): d is number => d != null))).sort(
    (a, b) => a - b
  );

  for (const day of dayNumbers) {
    const dayStops = stops.filter((s) => s.dayIndex === day);
    const regularStops = dayStops.filter((s) => s.category !== "nightlife");
    const nightlifeStops = dayStops.filter((s) => s.category === "nightlife");

    if (regularStops.length === 1 && regularStops[0].role === "food") {
      // יום הגעה - ארוחת ערב יחידה (לא בוקר/צהריים) - זו ארוחת ערב בפועל,
      // לא ארוחת בוקר ב-09:00.
      regularStops[0].arrivalOffsetMinutes = 11 * 60; // 20:00
    } else if (regularStops.length > 0) {
      const foodCount = regularStops.filter((s) => s.role === "food").length;
      const endHourOffset = foodCount >= 2 ? 11 : Math.min(regularStops.length - 1, 3);
      regularStops.forEach((stop, i) => {
        const hourOffset = regularStops.length > 1 ? Math.round((i / (regularStops.length - 1)) * endHourOffset) : 0;
        stop.arrivalOffsetMinutes = hourOffset * 60;
      });
    }

    // חיי לילה - תמיד אחרי כל שאר התחנות של אותו יום, לא לפני 19:00
    // (hourOffset 10, כלומר 09:00+10h) - יכולה להיות מאוחרת יותר בהחלט.
    if (nightlifeStops.length > 0) {
      const lastRegularHourOffset =
        regularStops.length > 0 ? Math.round(regularStops[regularStops.length - 1].arrivalOffsetMinutes / 60) : 0;
      const nightlifeHourOffset = Math.max(lastRegularHourOffset + 1, 10);
      nightlifeStops.forEach((stop) => {
        stop.arrivalOffsetMinutes = nightlifeHourOffset * 60;
      });
    }
  }
}

/**
 * בקשה מפורשת (סעיף 46 במסמך): כותרת קצרה וטבעית לכל יום - "נחיתה
 * והיכרות", "יום קלאסי", "בוקר אחרון" וכו'. בכוונה **דטרמיניסטי, בלי
 * קריאת AI נוספת** (סעיף 35: קוד עושה מה שקוד יכול לעשות מהר) - נגזר
 * מהקטגוריות שבפועל כבר נבחרו לתחנות ה"אטרקציה" של אותו יום, לא ניחוש.
 * יום 1 ויום אחרון הם מקרה קבוע ונפרד (מותאם ללוגיסטיקת נחיתה/עזיבה).
 */
function deriveDayTitles(stops: FinalItineraryStop[]): Record<string, string> {
  const dayNumbers = Array.from(new Set(stops.map((s) => s.dayIndex).filter((d): d is number => d != null))).sort(
    (a, b) => a - b
  );
  if (dayNumbers.length === 0) return {};

  const lastDay = dayNumbers[dayNumbers.length - 1];
  const titles: Record<string, string> = {};
  const NON_ATTRACTION_CATEGORIES = new Set(["wineries_dining", "coffee_carts_cafes", "nightlife"]);

  for (const day of dayNumbers) {
    const dayStops = stops.filter((s) => s.dayIndex === day);
    const hasNightlife = dayStops.some((s) => s.category === "nightlife");

    if (day === 1) {
      titles[String(day)] = hasNightlife ? "נחיתה, היכרות וערב ראשון" : "נחיתה והיכרות";
      continue;
    }
    if (day === lastDay && dayNumbers.length > 1) {
      titles[String(day)] = "בוקר אחרון";
      continue;
    }

    const attractionLabels = dayStops
      .filter((s) => s.category && !NON_ATTRACTION_CATEGORIES.has(s.category))
      .map((s) => getCategoryLabel(s.category))
      .filter((label, idx, arr) => label && arr.indexOf(label) === idx);

    const baseLabel = attractionLabels.slice(0, 2).join(" ו");
    titles[String(day)] = baseLabel ? (hasNightlife ? `${baseLabel} ובילויים` : baseLabel) : hasNightlife ? "יום בילויים" : `יום ${day}`;
  }

  return titles;
}


/**
 * מתחילה מהתחנה **הראשונה בתוכנית המקורית** (כפי ש-Claude קבע לפי סדר
 * slot_index) - לא מהתחנה הכי קרובה גיאוגרפית לבית. זה קריטי כשהמשתמש
 * מבקש רצף מפורש במלל החופשי (למשל "קודם קפה, אחר כך טיול, ואז קניון") -
 * בלי זה, המיון הגיאוגרפי הטהור היה יכול לבחור כל תחנה כפתיחה, ומתעלם
 * לגמרי מהכוונה שהמשתמש ביקש. משם והלאה - nearest-neighbor רגיל, כדי
 * לבנות מסלול יעיל בין שאר התחנות.
 */
function orderByNearestNeighbor(stops: LikedStopWithPlace[], _origin: LatLng): LikedStopWithPlace[] {
  if (stops.length === 0) return [];

  const remaining = [...stops];
  const [first] = remaining.splice(0, 1);
  const ordered: LikedStopWithPlace[] = [first];
  let cursor = { lat: first.place!.latitude!, lng: first.place!.longitude! };

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    remaining.forEach((stop, index) => {
      const distance = haversineDistanceKm(cursor, {
        lat: stop.place!.latitude!,
        lng: stop.place!.longitude!,
      });
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const [next] = remaining.splice(nearestIndex, 1);
    ordered.push(next);
    cursor = { lat: next.place!.latitude!, lng: next.place!.longitude! };
  }

  return ordered;
}

/**
 * שומר על הסדר המתוכנן בפועל (slot_index, כבר ממוין כך מהשאילתה למעלה) -
 * לא nearest-neighbor גיאוגרפי. תיקון קריטי (בקשה מפורשת - "למה יש 3
 * רופטופים ברצף?"): הגרסה הקודמת מיינה כל יום מחדש לפי קרבה גיאוגרפית
 * גרידא, מה שדרס לגמרי את דפוס האינטרליבינג (מסעדה-אטרקציה-מסעדה...,
 * ר' interleaveDayRoles) - כמה מועמדי "food" מאותו סגנון (רופטופים) שהיו
 * קרובים גיאוגרפית "נדבקו" ברצף במקום להתפזר בין אטרקציות. שומרים על
 * הסדר המתוכנן, לא מערבבים בין ימים. תחנת חיי-לילה (role="nightlife")
 * כבר מקבלת מלכתחילה את ה-slot_index הגבוה ביותר ביום שלה
 * (buildMultiDayVacationPlan) - כלומר היא כבר אחרונה בלי טיפול מיוחד כאן.
 */
function orderByDayThenNearestNeighbor(stops: LikedStopWithPlace[], _origin: LatLng): LikedStopWithPlace[] {
  const days = Array.from(new Set(stops.map((s) => s.day_index ?? 0))).sort((a, b) => a - b);
  const ordered: LikedStopWithPlace[] = [];

  for (const day of days) {
    ordered.push(...stops.filter((s) => (s.day_index ?? 0) === day));
  }

  return ordered;
}

/** תואם את ברירת המחדל הקיימת בעמוד התוצאה (dayStartMinutes[day] ?? 9*60) -
 *  היום "מתחיל" ב-09:00 אלא אם המשתמש שינה ידנית. */
const ASSUMED_DAY_START_HOUR = 9;
/** בקשה מפורשת: תחנת חיי לילה - אף פעם לא לפני 19:00, אבל יכולה בהחלט
 *  להיות מאוחרת יותר אם היום כבר התארך טבעית מעבר לזה. */
const NIGHTLIFE_MIN_HOUR = 19;
const NIGHTLIFE_MIN_OFFSET_MINUTES = (NIGHTLIFE_MIN_HOUR - ASSUMED_DAY_START_HOUR) * 60;

/**
 * אירועים ופסטיבלים אמיתיים בסביבה (Ticketmaster) - מוצגים כהמלצה משלימה
 * בסוף המסלול, לא כתחנה מוחלקת, כי הם תלויי-תאריך ולא מקום קבוע.
 */
async function fetchNearbyEvents(origin: LatLng): Promise<FinalItineraryEvent[]> {
  try {
    const events = await getUpcomingEvents(origin.lat, origin.lng);
    return events.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      venueName: event.venueName,
      imageUrl: event.imageUrl,
      url: event.url,
    }));
  } catch {
    return [];
  }
}

function estimateCostFromPriceLevel(priceLevel: number | null): number {
  if (priceLevel == null) return 80;
  return [40, 80, 150, 250, 400][Math.min(priceLevel, 4)] ?? 80;
}

