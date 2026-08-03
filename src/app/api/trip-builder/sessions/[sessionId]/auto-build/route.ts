import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getAttributeScoreMap, summarizeTopAttributes } from "@/services/travelDna/attributeLearningService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates } from "@/services/tripBuilder/rankingService";
import { likeStop } from "@/services/tripBuilder/swipeService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { dayTripBudgetToMaxPriceLevel, MAX_STOP_DISTANCE_KM } from "@/services/tripBuilder/rules/dayTrip";
import { finalizeItinerary } from "@/services/tripBuilder/finalizeService";
import { findBestCluster } from "@/services/tripBuilder/clusterService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { getOrCreateAreaExperience } from "@/services/tripBuilder/areaExperienceService";
import { suggestRealRestaurant } from "@/services/tripBuilder/restaurantSuggestionService";
import { generateVacationItinerary, type VacationDaySpec } from "@/services/tripBuilder/vacationAttractionListService";
import { pickSurpriseDestination } from "@/services/tripBuilder/vacationDestinationPickerService";
import { ensurePlaceExists } from "@/services/tripBuilder/aiPlaceInsertionService";
import type { DayTripAnswers, TripBuilderStop } from "@/services/tripBuilder/types";
import { getVacationTypeLabel, VACATION_CHILD_AGE_OPTIONS } from "@/locales/he/abroadVacation";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { generateTripIntent } from "@/services/tripBuilder/tripIntentService";
import { saveTripIntent } from "@/services/tripBuilder/sessionService";
import { normalizeAnswers } from "@/services/tripBuilder/categoryPlanService";
import { getWeeklyForecast } from "@/services/weather/weatherService";
import { describeWeatherCode } from "@/utils/weatherCodes";
import { generateDayTripPlaces } from "@/services/tripBuilder/dayTripAttractionListService";
import { reverseGeocodeToLocality } from "@/services/tripBuilder/geocodingService";
import { distanceBandToRadiusKm } from "@/services/tripBuilder/geo";

/**
 * זהה ל-getWeatherSummary ב-sessions/route.ts - כפילות מכוונת קטנה, כדי לא
 * ליצור תלות חדשה בין שני ה-route-ים על פונקציה משותפת לא-exported.
 */
async function getWeatherSummary(lat: number, lng: number): Promise<string | null> {
  try {
    const forecast = await Promise.race([
      getWeeklyForecast(lat, lng),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("weather timeout")), 4000)),
    ]);
    const today = forecast[0];
    if (!today) return null;
    const { label } = describeWeatherCode(today.weatherCode);
    return `${label}, ${today.maxTemp}°/${today.minTemp}°`;
  } catch {
    return null;
  }
}

/**
 * "TripLace" - בונה מסלול מלא אוטומטית, בלי לשאול את המשתמש בכלל.
 * לכל תחנה: שולף מועמדים, מדרג, ובוחר את המדורג הראשון - כאילו המשתמש
 * עשה Like על הראשון בכל שלב. משתמש באותה שרשרת בדיוק כמו ההחלקות הרגילות.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const { session, stops } = result;
  if (session.origin_latitude == null || session.origin_longitude == null) {
    return NextResponse.json({ error: "חסר מיקום מוצא ל-session" }, { status: 400 });
  }

  const answers = session.answers as unknown as DayTripAnswers;
  let tripIntent = session.trip_intent;

  try {
    const dna = await getTravelDna(supabase, user.id);
    const attributeScoreMap = await getAttributeScoreMap(supabase, user.id);
    const learnedAttributes = summarizeTopAttributes(attributeScoreMap);
    const rules = getTripTypeRules(session.trip_type);
    const remainingBudgetLabel = answers.budgetBand === "unlimited" ? "ללא הגבלה" : answers.budgetBand;

    const origin = { lat: session.origin_latitude, lng: session.origin_longitude };
    const pendingStops = stops
      .filter((s) => s.status === "pending")
      .sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0) || a.slot_index - b.slot_index);
    const excludePlaceIds = stops.filter((s) => s.place_id).map((s) => s.place_id as string);

    // עבור חופשה בחו"ל: מיקום ה"בית" לכל יום הוא מיקום המלון של אותו יום
    // (אם המשתמש הזין כמה מלונות), לא מיקום ה-GPS המקורי של המשתמש
    let dayOriginOverride: { lat: number; lng: number } | null = null;
    if (session.trip_type === "abroad_vacation") {
      const hotels = (session as unknown as { hotels?: { name: string; address: string }[] }).hotels ?? [];
      if (hotels.length > 0 && hotels[0].address) {
        dayOriginOverride = await geocodePlaceName(hotels[0].address);
      }
    }

    // אם המלל החופשי ביקש אזור ספציפי (למשל "יום ביפו") - בונים את הטיול
    // סביב האזור הזה, לא סביב הבית של המשתמש. משתמשים בבית רק לחישוב
    // זמני נסיעה אמיתיים בהמשך (ב-finalizeItinerary), לא לחיפוש המקומות עצמם.
    // כשיש אזור מבוקש מפורש - משתמשים ברדיוס קטן וקבוע סביבו (לא ב-distanceBand,
    // שהוא "מרחק מקסימלי מהבית" ולא רלוונטי כשהמשתמש כבר ציין איפה הוא רוצה להיות).
    let searchOrigin = origin;
    let requestedAreaRadiusKm: number | undefined;

    // חופשה בחו"ל: קובעים יעד קבוע לכל הטיול, לפני כל בחירת תחנה. אם המשתמש
    // בחר יעד מפורש - משתמשים בו. אם בחר "תפתיעו אותי" - Claude בוחר יעד
    // אחד עכשיו (לא לפי מלל חופשי שעלול "לתפוס" אזור לא רלוונטי כמו דיסנילנד).
    let vacationDestinationName: string | null = null;
    if (session.trip_type === "abroad_vacation") {
      const vacationAnswers = answers as unknown as {
        destination?: string | null;
        surpriseMe?: boolean;
        vacationTypes?: string[];
        travelStyle?: string;
      };

      if (vacationAnswers.destination) {
        vacationDestinationName = vacationAnswers.destination;
        const geocoded = await geocodePlaceName(vacationAnswers.destination);
        if (geocoded) {
          searchOrigin = geocoded;
          requestedAreaRadiusKm = 20;
        }
      } else if (vacationAnswers.surpriseMe) {
        const chosen = await pickSurpriseDestination({
          vacationTypeLabels: (vacationAnswers.vacationTypes ?? []).map(getVacationTypeLabel),
          freeText: answers.freeText,
          budgetLabel: remainingBudgetLabel,
          travelStyle: vacationAnswers.travelStyle ?? "single_destination",
        });
        if (chosen) {
          vacationDestinationName = `${chosen.city}, ${chosen.country}`;
          searchOrigin = chosen.coords;
          requestedAreaRadiusKm = 20;

          // שומרים את היעד שנבחר בפועל ל-session, כדי שהתצוגה בהמשך
          // (עמוד תוצאות) תדע להציג אותו למשתמש
          await supabase
            .from("trip_builder_sessions")
            .update({ answers: { ...answers, destination: vacationDestinationName } })
            .eq("id", sessionId);
        }
      }
    }

    if (tripIntent?.requestedArea && session.trip_type !== "abroad_vacation") {
      const geocoded = await geocodePlaceName(tripIntent.requestedArea);
      if (geocoded) {
        searchOrigin = geocoded;
        requestedAreaRadiusKm = 3;
      }
    }

    // חופשה בחו"ל: קריאת AI **אחת בלבד** לכל הטיול (כל הימים יחד), לא
    // קריאה נפרדת לכל יום. זה קריטי למניעת כפילויות אמיתית - קריאות
    // מקבילות נפרדות (הגישה הקודמת) לא יכולות לדעת אחת על השנייה ולכן לא
    // יכולות למנוע חפיפה בין הימים. בנוסף, קריאה אחת חוסכת טוקנים (בלי
    // חזרה על אותו boilerplate לכל יום) ומפחיתה round-trips.
    if (session.trip_type === "abroad_vacation") {
      const vacationAnswers = answers as unknown as {
        vacationTypes?: string[];
        companions?: string;
        childAgeBands?: string[];
      };
      const destinationName = vacationDestinationName ?? "היעד המבוקש";

      // פרופיל טעם מלא: גם העדפות אונבורדינג (עמוד הפרופיל - מטבח, כשרות,
      // נגישות, סגנון חופשה), וגם למידה מהתנהגות בפועל (מה שהמשתמש אהב/דחה
      // בעבר) - קודם הקוד הקודם השתמש רק ב-interests/preferred_categories
      // וזרק את שאר הפרופיל, למרות שהוא כבר מחושב למעלה (dna, learnedAttributes).
      // וגם גילאי הילדים מהשאלון - קודם לא הועברו ל-AI בכלל, כך שהמלצות
      // לא היו מותאמות-גיל אף פעם, גם למשפחות עם ילדים קטנים.
      const dnaSummaryParts: string[] = [];
      if (dna) {
        if (dna.interests?.length) dnaSummaryParts.push(`תחומי עניין: ${dna.interests.map(getCategoryLabel).join(", ")}`);
        if (dna.preferred_categories?.length)
          dnaSummaryParts.push(`קטגוריות מועדפות (מהתנהגות): ${dna.preferred_categories.map(getCategoryLabel).join(", ")}`);
        if (dna.culinary_styles?.length) dnaSummaryParts.push(`סגנונות אוכל מועדפים: ${dna.culinary_styles.join(", ")}`);
        if (dna.dietary_restrictions?.length)
          dnaSummaryParts.push(`הגבלות תזונתיות (חובה לכבד): ${dna.dietary_restrictions.join(", ")}`);
        if (dna.kosher) dnaSummaryParts.push("חובה: כשרות");
        if (dna.accessibility) dnaSummaryParts.push("חובה: נגישות");
        if (dna.vacation_preferences?.length) dnaSummaryParts.push(`העדפות חופשה: ${dna.vacation_preferences.join(", ")}`);
      }
      if (learnedAttributes.liked.length) dnaSummaryParts.push(`נלמד מהתנהגות שאהב: ${learnedAttributes.liked.join(", ")}`);
      if (learnedAttributes.disliked.length) dnaSummaryParts.push(`נלמד מהתנהגות שלא אהב: ${learnedAttributes.disliked.join(", ")}`);
      if (vacationAnswers.companions === "family" && vacationAnswers.childAgeBands?.length) {
        const ageLabels = vacationAnswers.childAgeBands.map(
          (band) => VACATION_CHILD_AGE_OPTIONS.find((o) => o.value === band)?.label ?? band
        );
        dnaSummaryParts.push(
          `חובה: נוסעים עם ילדים בגילאי ${ageLabels.join(", ")} - כל מקום מוצע חייב להתאים לגילאים האלה (בטיחות, שעות, עניין), לא רק מקומות למבוגרים`
        );
      }
      const dnaSummary = dnaSummaryParts.length ? dnaSummaryParts.join(". ") : null;

      const stopsByDay = new Map<number, TripBuilderStop[]>();
      for (const stop of pendingStops) {
        const day = stop.day_index ?? 1;
        if (!stopsByDay.has(day)) stopsByDay.set(day, []);
        stopsByDay.get(day)!.push(stop);
      }

      const daySpecs: VacationDaySpec[] = Array.from(stopsByDay.entries()).map(([day, dayStops]) => {
        const totalFood = dayStops.filter((s) => s.role === "food" || s.role === "coffee_dessert").length;
        return { day, totalFood, totalAttractions: dayStops.length - totalFood };
      });

      // רדיוס תקין סביב מרכז היעד: אם המשתמש/AI כבר קבע רדיוס אזור מפורש
      // (requestedAreaRadiusKm) - נותנים מרווח פי 2 ממנו (יעד יכול להתפרס
      // מעבר למרכז המדויק); אחרת ברירת מחדל של עיר גדולה + פרברים.
      const destinationMaxDistanceKm = requestedAreaRadiusKm ? requestedAreaRadiusKm * 2 : 60;

      // "כוונת הטיול" (tripIntent) - אם עדיין לא חושבה ב-session creation (הנתיב
      // המהיר של "חופשה בחו\"ל" מדלג עליה שם בכוונה) - מחשבים אותה *במקביל*
      // לקריאת ה-AI הכבדה שבונה את המסלול, לא ברצף לפניה. כך זמן ההמתנה
      // הכולל הוא רק זמן הקריאה הכבדה מביניהן (הארוכה יותר), לא סכום שתיהן.
      const tripIntentPromise: Promise<typeof tripIntent> = tripIntent
        ? Promise.resolve(tripIntent)
        : (async () => {
            try {
              const weatherSummary = await getWeatherSummary(origin.lat, origin.lng);
              const generated = await generateTripIntent({
                dna,
                answers: normalizeAnswers(session.trip_type, answers),
                weatherSummary,
              });
              if (generated) await saveTripIntent(supabase, sessionId, generated);
              return generated;
            } catch (err) {
              console.error("[auto-build] חישוב trip intent במקביל נכשל", err);
              return null;
            }
          })();

      const [allSuggestions, computedTripIntent] = await Promise.all([
        generateVacationItinerary({
          destination: destinationName,
          destinationOrigin: searchOrigin,
          maxDistanceKm: destinationMaxDistanceKm,
          days: daySpecs,
          vacationTypeLabels: (vacationAnswers.vacationTypes ?? []).map(getVacationTypeLabel),
          freeText: answers.freeText,
          budgetLabel: remainingBudgetLabel,
          travelDnaSummary: dnaSummary,
        }),
        tripIntentPromise,
      ]);
      tripIntent = computedTripIntent;

      if (allSuggestions.length === 0) {
        // נקודת בקרה קריטית: אם הגענו לפה עם רשימה ריקה, המסלול יגיע לעמוד
        // התוצאות בלי אף תחנה ("לא נבחרו מספיק תחנות"), בלי שום שגיאת HTTP
        // בדרך - כי שום דבר לא "נכשל" ברמת ה-response, פשוט לא נבחרו מקומות.
        // בלי הלוג הזה, זה בדיוק התרחיש שהיה בלתי אפשרי לאבחן.
        console.error("[auto-build] generateVacationItinerary החזיר 0 מקומות", {
          sessionId,
          destinationName,
          daySpecs,
        });
      }

      // הקצאה לפי יום, עם "רשת ביטחון": אם Claude תייג יום לא נכון או החזיר
      // פחות פריטים מהמבוקש ליום מסוים, לא משאירים את התחנה ריקה בשקט (זו
      // בדיוק הסיבה שקטגוריות שלמות - כמו "חיי לילה" - או ארוחות שלמות
      // נעלמו בעבר) - שואבים תחנה פנויה מה"עודף" הכללי (מיום אחר, אותו role)
      // לפני שמוותרים על המקום.
      const usedSuggestionIds = new Set<string>();
      const leftoverByRole = (role: "food" | "attraction") =>
        allSuggestions.filter(
          (s) =>
            !usedSuggestionIds.has(s.id) &&
            (role === "food" ? s.role === "food" || s.role === "coffee_dessert" : s.role === "attraction")
        );

      // שלב 1: התאמה (stop -> suggestion) - בזיכרון בלבד, בלי await, כי זה
      // תלוי בסדר (usedSuggestionIds/leftover pool) ולא ניתן להריץ במקביל.
      const assignments: { stopId: string; suggestion: (typeof allSuggestions)[number] }[] = [];

      for (const [day, dayStops] of stopsByDay.entries()) {
        const daySuggestions = allSuggestions.filter((s) => s.day === day);
        const foodSuggestions = daySuggestions.filter((s) => s.role === "food" || s.role === "coffee_dessert");
        const attractionSuggestions = daySuggestions.filter((s) => s.role === "attraction");
        let foodCursor = 0;
        let attractionCursor = 0;

        for (const stop of dayStops) {
          const isFoodRole = stop.role === "food" || stop.role === "coffee_dessert";
          let suggestion = isFoodRole ? foodSuggestions[foodCursor++] : attractionSuggestions[attractionCursor++];
          if (!suggestion) {
            suggestion = leftoverByRole(isFoodRole ? "food" : "attraction")[0];
          }
          if (!suggestion) continue;
          usedSuggestionIds.add(suggestion.id);
          assignments.push({ stopId: stop.id, suggestion });
        }
      }

      // שלב 2: כל השמירות בפועל (DB insert/update) **במקביל**, לא אחת-אחת.
      // בטיול רב-ימים זה בקלות 30-50+ תחנות - בלי המקבול הזה, כל תחנה
      // מחכה בתור ל-round-trip נפרד ל-DB, ומצטבר לעשרות שניות מיותרות.
      await Promise.all(
        assignments.map(async ({ stopId, suggestion }) => {
          const realPlace = await ensurePlaceExists(suggestion, destinationName);
          await likeStop(supabase, user.id, stopId, realPlace);
        })
      );

      const itinerary = await finalizeItinerary(
        supabase,
        sessionId,
        searchOrigin,
        answers.budgetBand,
        answers.durationBand,
        tripIntent,
        answers.freeText
      );
      return NextResponse.json({ itinerary });
    }

    // טיול יומי: כמו בחופשה בחו"ל - Claude מציע ישירות מקומות אמיתיים
    // וספציפיים מתוך הידע הכללי שלו, במקום להיות מוגבל למאגר הפנימי שלנו
    // (fetchCandidatePool + rankCandidates) - זו הייתה בדיוק הסיבה שאותם
    // מקומות חוזרים על עצמם שוב ושוב: מאגר קטן ומקומי, לא כל העולם.
    if (session.trip_type === "day_trip" || session.trip_type === "nature_trip") {
      // שם אזור קריא ל-Claude ולחיפוש Google: אם המשתמש ציין אזור ספציפי
      // במלל החופשי - זה כבר בתוך searchOrigin (geocoded למעלה); אחרת
      // הופכים את מיקום ה-GPS הגולמי לשם עיר/אזור בעזרת reverse geocoding.
      const areaLabel =
        (tripIntent?.requestedArea as string | undefined) ?? (await reverseGeocodeToLocality(searchOrigin)) ?? "האזור המבוקש";

      const maxDistanceKm = requestedAreaRadiusKm ?? distanceBandToRadiusKm(answers.distanceBand);

      const dnaSummaryParts: string[] = [];
      if (dna) {
        if (dna.interests?.length) dnaSummaryParts.push(`תחומי עניין: ${dna.interests.map(getCategoryLabel).join(", ")}`);
        if (dna.preferred_categories?.length)
          dnaSummaryParts.push(`קטגוריות מועדפות (מהתנהגות): ${dna.preferred_categories.map(getCategoryLabel).join(", ")}`);
        if (dna.culinary_styles?.length) dnaSummaryParts.push(`סגנונות אוכל מועדפים: ${dna.culinary_styles.join(", ")}`);
        if (dna.dietary_restrictions?.length)
          dnaSummaryParts.push(`הגבלות תזונתיות (חובה לכבד): ${dna.dietary_restrictions.join(", ")}`);
        if (dna.kosher) dnaSummaryParts.push("חובה: כשרות");
        if (dna.accessibility) dnaSummaryParts.push("חובה: נגישות");
      }
      if (learnedAttributes.liked.length) dnaSummaryParts.push(`נלמד מהתנהגות שאהב: ${learnedAttributes.liked.join(", ")}`);
      if (learnedAttributes.disliked.length) dnaSummaryParts.push(`נלמד מהתנהגות שלא אהב: ${learnedAttributes.disliked.join(", ")}`);

      let interestLabels: string[];
      if (session.trip_type === "nature_trip") {
        const natureAnswers = session.answers as unknown as import("@/services/tripBuilder/types").NatureTripAnswers;
        const { getNatureTypeLabel, getDifficultyLabel } = await import("@/locales/he/natureTrip");
        interestLabels = (natureAnswers.natureTypes ?? []).map(getNatureTypeLabel);
        dnaSummaryParts.push(`רמת קושי מבוקשת: ${getDifficultyLabel(natureAnswers.difficulty)} - חובה לכבד, אל תציע מסלול קשה יותר`);
      } else {
        interestLabels = (answers.interests ?? []).map(getCategoryLabel);
      }
      const dnaSummary = dnaSummaryParts.length ? dnaSummaryParts.join(". ") : null;

      const resolvedPlaces = await generateDayTripPlaces({
        areaLabel,
        areaOrigin: searchOrigin,
        maxDistanceKm,
        slots: pendingStops.map((stop) => ({ slotId: stop.id, category: stop.category, role: stop.role })),
        interestLabels,
        freeText: answers.freeText,
        budgetLabel: remainingBudgetLabel,
        travelDnaSummary: dnaSummary,
      });

      if (resolvedPlaces.length === 0) {
        console.error("[auto-build] generateDayTripPlaces החזיר 0 מקומות", { sessionId, areaLabel, tripType: session.trip_type });
      }

      // שמירות בפועל במקביל - לא אחת-אחת.
      await Promise.all(
        resolvedPlaces.map(async (place) => {
          const realPlace = await ensurePlaceExists(place, areaLabel);
          await likeStop(supabase, user.id, place.slotId, realPlace);
        })
      );

      const itinerary = await finalizeItinerary(
        supabase,
        sessionId,
        searchOrigin,
        answers.budgetBand,
        answers.durationBand,
        tripIntent,
        answers.freeText
      );
      return NextResponse.json({ itinerary });
    }

    // Area Detection: לפני שבוחרים תחנה אחת, אוספים מועמדים מכל הקטגוריות
    // בתוכנית ומזהים את האזור הגיאוגרפי הצפוף ביותר במקומות איכותיים.
    // כל המסלול נבנה סביב האזור הזה, במקום לזחול תחנה-אחר-תחנה בלי לראות
    // את התמונה הכוללת - מונע קפיצות גיאוגרפיות ומסלולים לא רציפים.
    const clusteringPools = await Promise.all(
      pendingStops.map(async (stop) => ({
        category: stop.category,
        candidates: await fetchCandidatePool(supabase, {
          category: stop.category,
          origin: searchOrigin,
          distanceBand: answers.distanceBand,
          maxDistanceKm: requestedAreaRadiusKm,
          maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
          excludePlaceIds,
        }),
      }))
    );
    const clusterCenter = findBestCluster(clusteringPools, searchOrigin);

    // רץ ברצף (לא במקביל): כל תחנה יוצאת מהתחנה הקודמת שבאמת נבחרה,
    // ומתחיל מהאזור שזוהה (לא מהבית) - כדי שהמסלול יהיה קרוב פיזית ולא מפוזר.
    let cursor = clusterCenter;

    for (let i = 0; i < pendingStops.length; i++) {
      const stop = pendingStops[i];
      const isFirstStop = i === 0;

      // עבור מסעדות ובתי קפה - Claude מוביל עם המלצה אמיתית מהידע הכללי שלו,
      // לא רק בוחר מתוך המאגר הקיים. המאגר הוא רק גיבוי אם Claude לא בטוח.
      if (session.trip_type === "restaurants_cafes") {
        const restaurantAnswers = answers as unknown as { cuisine?: string[] };
        const aiSuggestion = await suggestRealRestaurant({
          city: tripIntent?.requestedArea ?? "האזור המבוקש",
          cuisine: restaurantAnswers.cuisine ?? [],
          freeText: answers.freeText,
          budgetLabel: remainingBudgetLabel,
        });

        if (aiSuggestion) {
          const realPlace = await ensurePlaceExists(aiSuggestion, tripIntent?.requestedArea ?? "");
          await likeStop(supabase, user.id, stop.id, realPlace);
          excludePlaceIds.push(realPlace.id);
          cursor = { lat: realPlace.latitude, lng: realPlace.longitude };
          continue;
        }
      }

      // כשיש אזור מבוקש מפורש - כל התחנות (לא רק הראשונה) נשארות ברדיוס קטן
      // וקבוע ממרכז האזור עצמו, לא מהתחנה הקודמת. אחרת כל תחנה "מרשה לעצמה"
      // לנוע עוד קצת רחוק יותר, ולאורך כמה תחנות זה מצטבר לדליפה גדולה
      // הרחק מהאזור שהמשתמש ביקש בפועל.
      const effectiveOrigin = dayOriginOverride ?? (requestedAreaRadiusKm ? searchOrigin : cursor);
      const pool = await fetchCandidatePool(supabase, {
        category: stop.category,
        origin: effectiveOrigin,
        distanceBand: answers.distanceBand,
        maxDistanceKm: dayOriginOverride ? 15 : requestedAreaRadiusKm ?? (isFirstStop ? undefined : MAX_STOP_DISTANCE_KM[answers.durationBand]),
        maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
        excludePlaceIds,
      });

      // אין מועמד מתאים ב-DB, אבל המשתמש ביקש אזור ספציפי - ה-AI יוצר בעצמו
      // חוויית הסתובבות באזור, במקום פשוט לדלג על התחנה. ה-DB הוא רק גיבוי,
      // לא תנאי מקדים - ככה המנוע "מוביל" את התוצאה, לא מוגבל לרשימה קיימת.
      if (pool.length === 0 && tripIntent?.requestedArea) {
        const generatedStop = await getOrCreateAreaExperience(supabase, {
          areaName: tripIntent.requestedArea,
          category: stop.category,
          coords: cursor,
          origin: cursor,
        });

        if (generatedStop) {
          await likeStop(supabase, user.id, stop.id, generatedStop);
          excludePlaceIds.push(generatedStop.id);
          cursor = { lat: generatedStop.latitude, lng: generatedStop.longitude };
          continue;
        }
      }

      if (pool.length === 0) continue;

      // עבור מסעדות (ורק שם) - בחירת סוג המטבח לא מגיעה דרך "interests" הרגיל,
      // אלא דרך שדה "cuisine" נפרד. מוסיפים אותה למלל שנשלח לדירוג, אחרת
      // הבחירה הספציפית של המשתמש (למשל "המבורגר") אף פעם לא מגיעה ל-Claude.
      const cuisineSelection = (answers as unknown as { cuisine?: string[] }).cuisine;
      const combinedFreeText = cuisineSelection?.length
        ? `${answers.freeText}. סוג מטבח מועדף: ${cuisineSelection.map(getCategoryLabel).join(", ")}`
        : answers.freeText;

      const ranked = await rankCandidates({
        dna,
        candidates: pool,
        freeText: combinedFreeText,
        remainingBudgetLabel,
        rankingPromptRules: rules.rankingPromptRules,
        attributeScoreMap,
        learnedAttributes,
        tripIntent,
      });

      const top = ranked[0];
      if (!top) continue;

      await likeStop(supabase, user.id, stop.id, top);

      excludePlaceIds.push(top.id);
      cursor = { lat: top.latitude, lng: top.longitude };

      // Area Experience: אם התחנה שנבחרה היא אזור חוויה שלם (למשל "נווה צדק"),
      // התחנות הבאות לא אמורות להיבחר מתוכו - הן כבר "בפנים" את החוויה הזו.
      // מרחיבים משמעותית את המרחק המינימלי הבא, כדי לא לבחור עוד תחנה
      // שנמצאת בתוך אותו אזור ממש.
      if (top.isAreaExperience) {
        excludePlaceIds.push(
          ...(await getPlaceIdsWithinRadius(supabase, cursor, 0.8, excludePlaceIds))
        );
      }
    }

    const itinerary = await finalizeItinerary(
      supabase,
      sessionId,
      { lat: session.origin_latitude, lng: session.origin_longitude },
      answers.budgetBand,
      answers.durationBand,
      tripIntent,
      answers.freeText
    );

    return NextResponse.json({ itinerary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * מוצא מזהי מקומות שנמצאים ברדיוס נתון מנקודה - משמש למניעת בחירת עוד תחנות
 * בתוך אזור חוויה שכבר נבחר (Area Experience), כי הן כבר חלק מאותה חוויה.
 */
async function getPlaceIdsWithinRadius(
  supabase: Awaited<ReturnType<typeof createClient>>,
  center: { lat: number; lng: number },
  radiusKm: number,
  alreadyExcluded: string[]
): Promise<string[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));

  let query = supabase
    .from("places")
    .select("id")
    .gte("latitude", center.lat - latDelta)
    .lte("latitude", center.lat + latDelta)
    .gte("longitude", center.lng - lngDelta)
    .lte("longitude", center.lng + lngDelta);

  if (alreadyExcluded.length > 0) {
    query = query.not("id", "in", `(${alreadyExcluded.join(",")})`);
  }

  const { data } = await query;
  return (data ?? []).map((row) => row.id as string);
}
