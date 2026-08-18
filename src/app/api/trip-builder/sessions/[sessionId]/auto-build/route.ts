import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getAttributeScoreMap, summarizeTopAttributes } from "@/services/travelDna/attributeLearningService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates, rankCandidatesFast } from "@/services/tripBuilder/rankingService";
import { likeStop } from "@/services/tripBuilder/swipeService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { dayTripBudgetToMaxPriceLevel, MAX_STOP_DISTANCE_KM } from "@/services/tripBuilder/rules/dayTrip";
import { finalizeItinerary } from "@/services/tripBuilder/finalizeService";
import { findBestCluster } from "@/services/tripBuilder/clusterService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { getOrCreateAreaExperience } from "@/services/tripBuilder/areaExperienceService";
import { suggestRealRestaurant } from "@/services/tripBuilder/restaurantSuggestionService";
import { findRequestedPlaceNear } from "@/services/tripBuilder/placeResolutionService";
import { generateVacationItinerary, type VacationDaySpec } from "@/services/tripBuilder/vacationAttractionListService";
import { pickSurpriseDestination } from "@/services/tripBuilder/vacationDestinationPickerService";
import { suggestMustSeeLandmarks, findMustSeePlaces } from "@/services/tripBuilder/vacationMustSeeService";
import { ensurePlaceExists } from "@/services/tripBuilder/aiPlaceInsertionService";
import type { DayTripAnswers, TripBuilderStop, WeekendAnswers } from "@/services/tripBuilder/types";
import { getVacationTypeLabel, VACATION_CHILD_AGE_OPTIONS } from "@/locales/he/abroadVacation";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { generateTripIntent } from "@/services/tripBuilder/tripIntentService";
import { saveTripIntent } from "@/services/tripBuilder/sessionService";
import { normalizeAnswers, decideCategoryPlan } from "@/services/tripBuilder/categoryPlanService";
import { saveCategoryPlan } from "@/services/tripBuilder/sessionService";
import { saveFinalItinerary } from "@/services/tripBuilder/sessionService";
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

  const { session } = result;
  let stops = result.stops;
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

    // "חיי לילה ובילויים", "דייט רומנטי", "טיול בטבע" ו"טיול יומי": ה-POST
    // שיצר את ה-session החזיר תשובה מיד בלי שום תחנות (כדי לא לחסום את
    // הניווט למסך הטעינה בקריאת Claude) - אם עדיין אין תוכנית בכלל (stops
    // ריק), בונים אותה כאן, אחרי שהמשתמש כבר במסך הטעינה. Claude עדיין
    // רץ במלואו (לא מדלגים עליו) - רק לא לפני הניווט.
    //
    // תיקון קריטי: קודם חשבתי (בטעות!) שטיול בטבע/יומי לא צריכים בכלל
    // את ה-category_plan/stops - טעות. הענף הייעודי למטה
    // (session.trip_type === "day_trip" || "nature_trip") כן משתמש
    // ב-pendingStops בפועל - הוא ממיר כל "תחנה מתוכננת" (עם role/category/
    // note) ל"סלוט" ששולח ל-Claude דרך generateDayTripPlaces({ slots: ... }).
    // כשהסרתי את בניית התוכנית, pendingStops תמיד היה ריק - ולכן
    // generateDayTripPlaces קיבל slots: [] וקיבל אין שום מקומות ליצור,
    // מה שגרם ל"generateDayTripPlaces החזיר 0 מקומות" -> ולידציה נכשלת ->
    // 500 -> ה-session נשאר תקוע לנצח ב-status="building". התוכנית כן
    // חיונית לכל 4 סוגי הטיול האלה - רק **מתי** מחשבים אותה זה מה שהשתנה
    // (בתוך auto-build, לא חוסם את ה-POST המקורי).
    if (
      (session.trip_type === "nightlife" ||
        session.trip_type === "romantic_date" ||
        session.trip_type === "nature_trip" ||
        session.trip_type === "day_trip") &&
      stops.length === 0
    ) {
      try {
        const weatherSummary = await getWeatherSummary(session.origin_latitude, session.origin_longitude);
        const generated = await generateTripIntent({
          dna,
          answers: normalizeAnswers(session.trip_type, answers),
          weatherSummary,
        });
        if (generated) {
          tripIntent = generated;
          await saveTripIntent(supabase, sessionId, generated);
        }
        const plan = await decideCategoryPlan({
          tripType: session.trip_type,
          dna,
          answers,
          weatherSummary,
          tripIntent,
        });
        stops = await saveCategoryPlan(supabase, sessionId, plan);
        // נקודת אבחון קריטית: בלי הלוג הזה, אי אפשר להבדיל בין "התוכנית
        // עצמה יצאה ריקה" (Claude/הפולבאק לא הצליחו לייצר אף תחנה מתוכננת)
        // לבין "התוכנית תקינה אבל generateDayTripPlaces נכשל בשלב הבא" -
        // שני תרחישים שונים לגמרי עם תיקונים שונים לגמרי.
        console.error("[auto-build] תוכנית נבנתה", {
          sessionId,
          tripType: session.trip_type,
          planLength: plan.length,
          // מציג את הקטגוריה/role שנבחרו בפועל לכל תחנה מתוכננת - קריטי
          // כדי להבדיל בין "התוכנית עצמה בחרה קטגוריה לא נכונה" (למשל
          // "beaches_pools" כשהמשתמש ביקש "מסלול טבע") לבין "התוכנית
          // תקינה אבל החיפוש/הדירוג בהמשך הביא תוצאה לא מתאימה מהקטגוריה
          // הנכונה". בלי זה, כל "המסלול לא מתאים" נשאר ניחוש בין שתי
          // סיבות שונות לגמרי עם תיקונים שונים לגמרי.
          planCategories: plan.map((p) => ({ category: p.category, role: p.role, note: p.note ?? null })),
          openAreaChoice: tripIntent?.openAreaChoice ?? null,
          requestedArea: tripIntent?.requestedArea ?? null,
        });
      } catch (err) {
        console.error("[auto-build] בניית תוכנית נכשלה", { sessionId, tripType: session.trip_type, err });
      }
    }

    const origin = { lat: session.origin_latitude, lng: session.origin_longitude };
    const pendingStops = stops
      .filter((s) => s.status === "pending")
      .sort((a, b) => (a.day_index ?? 0) - (b.day_index ?? 0) || a.slot_index - b.slot_index);
    const excludePlaceIds = stops.filter((s) => s.place_id).map((s) => s.place_id as string);

    // "מסעדות ובתי קפה": ה-POST שיצר את ה-session (sessions/route.ts) מדלג
    // בכוונה על חישוב tripIntent שם (כדי לא לחסום את הניווט למסך הטעינה
    // בקריאת Claude נוספת) - מחשבים אותו כאן, אחרי שהמשתמש כבר במסך
    // הטעינה. עדיין קריטי: הוא מזהה requestedPlaceName/requestedArea
    // שהחיפוש למטה תלוי בהם.
    if (session.trip_type === "restaurants_cafes" && !tripIntent) {
      try {
        const weatherSummary = await getWeatherSummary(session.origin_latitude, session.origin_longitude);
        const generated = await generateTripIntent({
          dna,
          answers: normalizeAnswers(session.trip_type, answers),
          weatherSummary,
        });
        if (generated) {
          tripIntent = generated;
          await saveTripIntent(supabase, sessionId, generated);
        }
      } catch (err) {
        console.error("[auto-build] חישוב trip intent למסעדות/קפה נכשל", err);
      }
    }

    // עבור חופשה בחו"ל: מיקום ה"בית" לכל יום הוא מיקום המלון של אותו יום
    // (אם המשתמש הזין כמה מלונות), לא מיקום ה-GPS המקורי של המשתמש
    let dayOriginOverride: { lat: number; lng: number } | null = null;
    if (session.trip_type === "abroad_vacation") {
      const hotels = (session as unknown as { hotels?: { name: string; address: string }[] }).hotels ?? [];
      if (hotels.length > 0 && hotels[0].address) {
        dayOriginOverride = await geocodePlaceName(hotels[0].address);
      }
    } else if (session.trip_type === "weekend") {
      // סופ"ש: אותו רעיון כמו חופשה בחו"ל - כל הימים "מתחילים" ממיקום
      // הלינה בפועל (אם כבר נסגרה), לא מהבית. שדה יחיד (lodgingAddress),
      // לא מערך hotels - סופ"ש הוא בדרך כלל לינה אחת לכל הטיול.
      const weekendAnswers = answers as unknown as { hasBookedLodging?: boolean; lodgingAddress?: string | null };
      if (weekendAnswers.hasBookedLodging && weekendAnswers.lodgingAddress) {
        dayOriginOverride = await geocodePlaceName(weekendAnswers.lodgingAddress);
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
        // תיקון (בקשה מפורשת): ב"אמשיך לבד" (המלל החופשי בלבד, בלי לעבור
        // את שאר השאלון) vacationTypes/budgetPerPerson/travelStyle נשארים
        // בברירת המחדל - הם *לא* משקפים בחירה אמיתית של המשתמש. הפרופיל
        // האישי (Travel DNA - תחומי עניין, כשרות, נגישות, מה שנלמד
        // מהתנהגות) הוא לעומת זאת אות אמיתי תמיד, גם כשהמשתמש דילג על
        // השאלון. מעבירים אותו עכשיו ל-pickSurpriseDestination כדי שהוא
        // ישקול קודם כל את הפרופיל האישי + המלל החופשי - לא רק את שדות
        // ברירת המחדל של השאלון.
        const dnaSummaryPartsForDestination: string[] = [];
        if (dna) {
          if (dna.interests?.length) dnaSummaryPartsForDestination.push(`תחומי עניין: ${dna.interests.map(getCategoryLabel).join(", ")}`);
          if (dna.preferred_categories?.length)
            dnaSummaryPartsForDestination.push(`קטגוריות מועדפות (מהתנהגות): ${dna.preferred_categories.map(getCategoryLabel).join(", ")}`);
          if (dna.culinary_styles?.length) dnaSummaryPartsForDestination.push(`סגנונות אוכל מועדפים: ${dna.culinary_styles.join(", ")}`);
          if (dna.dietary_restrictions?.length)
            dnaSummaryPartsForDestination.push(`הגבלות תזונתיות: ${dna.dietary_restrictions.join(", ")}`);
          if (dna.kosher) dnaSummaryPartsForDestination.push("חובה: כשרות");
          if (dna.accessibility) dnaSummaryPartsForDestination.push("חובה: נגישות");
          if (dna.vacation_preferences?.length) dnaSummaryPartsForDestination.push(`העדפות חופשה: ${dna.vacation_preferences.join(", ")}`);
        }
        if (learnedAttributes.liked.length) dnaSummaryPartsForDestination.push(`נלמד מהתנהגות שאהב: ${learnedAttributes.liked.join(", ")}`);
        if (learnedAttributes.disliked.length) dnaSummaryPartsForDestination.push(`נלמד מהתנהגות שלא אהב: ${learnedAttributes.disliked.join(", ")}`);
        const dnaSummaryForDestination = dnaSummaryPartsForDestination.length ? dnaSummaryPartsForDestination.join(". ") : null;

        const chosen = await pickSurpriseDestination({
          vacationTypeLabels: (vacationAnswers.vacationTypes ?? []).map(getVacationTypeLabel),
          freeText: answers.freeText,
          budgetLabel: remainingBudgetLabel,
          travelStyle: vacationAnswers.travelStyle ?? "single_destination",
          travelDnaSummary: dnaSummaryForDestination,
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
    } else if (session.trip_type === "weekend") {
      // סופ"ש: אין שדה "יעד" מפורש כמו בחו"ל (זה תמיד בארץ) - שם אזור
      // קריא נגזר מ-reverse geocoding, בדיוק כמו areaLabel בטיול יומי.
      // אם כבר יש לינה - האזור נגזר ממנה (שם העיר/אזור של המלון), לא
      // מהבית, כי שם בפועל מתרחש הסופ"ש. requestedAreaRadiusKm נשאר
      // undefined בכוונה - הרדיוס עצמו מחושב למטה (destinationMaxDistanceKm)
      // ישירות מ-distanceBand, בלי הכפלה פי 2 (זו לא "עיר בחו"ל שמתפרסת").
      searchOrigin = dayOriginOverride ?? origin;
      vacationDestinationName = (await reverseGeocodeToLocality(searchOrigin)) ?? "האזור המבוקש";
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
    if (session.trip_type === "abroad_vacation" || session.trip_type === "weekend") {
      const vacationAnswers = answers as unknown as {
        vacationTypes?: string[];
        weekendStyles?: string[];
        companions?: string;
        childAgeBands?: string[];
      };
      // סופ"ש משתמש ב-weekendStyles (לא vacationTypes) - אותו רעיון, שם שדה שונה.
      const vacationTypeValues = vacationAnswers.vacationTypes ?? vacationAnswers.weekendStyles ?? [];
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

      // רדיוס תקין סביב מרכז היעד: אם המשתמש/AI כבר קבע רדיוס אזור מפורש
      // (requestedAreaRadiusKm) - נותנים מרווח פי 2 ממנו (יעד יכול להתפרס
      // מעבר למרכז המדויק); אחרת ברירת מחדל של עיר גדולה + פרברים.
      // סופ"ש בארץ - קנה מידה קטן בהרבה מ"עיר בחו"ל", אז ברירת המחדל
      // (בלי רדיוס מפורש) נשענת על distanceBand של המשתמש, לא על 60 ק"מ קבוע.
      const destinationMaxDistanceKm = requestedAreaRadiusKm
        ? requestedAreaRadiusKm * 2
        : session.trip_type === "weekend"
          ? distanceBandToRadiusKm((answers as unknown as WeekendAnswers).distanceBand)
          : 60;

      // בקשה מפורשת: אתרי "חובה" מובהקים ליעד (למשל מגדל אייפל + שייט
      // בסיין לפריז) חייבים להיכנס למסלול כשקיימים אצלנו במאגר - לא
      // "אולי ייבחרו" דרך הדירוג הרגיל. Claude מציע שמות (בלי שום קריאת
      // Google), ומחפשים כל שם **רק** במאגר שלנו; שם שלא נמצא נשמט בשקט
      // (לא מומצא/מאומת דרך Google). קריאת AI אחת נוספת כאן - עלות זמן
      // קטנה (כמה שניות) מול הערך של לא לפספס את הסמלים המובהקים.
      const mustSeeNames = await suggestMustSeeLandmarks({
        destination: destinationName,
        vacationTypeLabels: vacationTypeValues.map(getVacationTypeLabel),
        freeText: answers.freeText,
      });
      // סדר העדיפות של Claude (השם הראשון = הכי מובהק/מתאים לטיול הזה)
      // נשמר - זה מה שקובע אילו אתרי חובה "זוכים" למקום כשיש יותר אתרי
      // חובה שנמצאו מאשר סלוטים פנויים בטיול קצר (מצמצמים, לא מרחיבים ימים).
      const mustSeePlaces = await findMustSeePlaces(supabase, mustSeeNames, searchOrigin, destinationMaxDistanceKm);
      console.error("[auto-build] אתרי חובה שנמצאו במאגר", {
        sessionId,
        destinationName,
        suggested: mustSeeNames,
        foundInDb: mustSeePlaces.map((p) => p.name),
      });
      let mustSeeCursor = 0;

      // תיקון לפי בקשה מפורשת: קודם מנסים למלא כל תחנה מהמאגר הפנימי
      // (ADMIN PLACES) - בדיוק כמו שכבר נעשה לטיול יומי/טבע/מסעדות/חיי
      // לילה/דייט רומנטי. יש גם תוכן מחו"ל במאגר (לא רק ישראל), אז זה
      // רלוונטי גם לחופשה בחו"ל, לא רק לסופ"ש. Claude (generateVacationItinerary)
      // הוא **רק** גיבוי לתחנות שהמאגר לא הצליח למלא - לא הנתיב הראשי יותר.
      // בניגוד לטיול יומי (שם לכל סלוט יש origin/cursor זז) - כאן כל התחנות
      // (בכל הימים) מחפשות סביב אותה נקודת מוצא אחת (מרכז היעד, searchOrigin) -
      // תואם בדיוק למה ש-generateVacationItinerary כבר עושה (destinationOrigin
      // יחיד לכל הימים), לא רדיוס נודד בין תחנות כמו בטיול יומי.
      const excludePlaceIdsForVacation = [...excludePlaceIds];
      const remainingStops: TripBuilderStop[] = [];
      for (const stop of pendingStops) {
        // אתרי חובה תופסים סלוטים מסוג "attraction" קודם לכל דבר אחר -
        // כל עוד יש עוד אתר חובה שלא נוצל, הוא זוכה לסלוט הבא, בלי לעבור
        // דרך fetchCandidatePool/rankCandidatesFast הרגילים בכלל.
        if (stop.role === "attraction" && mustSeeCursor < mustSeePlaces.length) {
          const mustSee = mustSeePlaces[mustSeeCursor];
          if (!excludePlaceIdsForVacation.includes(mustSee.id)) {
            await likeStop(supabase, user.id, stop.id, mustSee);
            excludePlaceIdsForVacation.push(mustSee.id);
            mustSeeCursor += 1;
            continue;
          }
          mustSeeCursor += 1;
        }

        const pool = await fetchCandidatePool(supabase, {
          category: stop.category,
          origin: searchOrigin,
          distanceBand: "5h", // לא בשימוש בפועל - maxDistanceKm המפורש למטה גובר תמיד
          maxDistanceKm: destinationMaxDistanceKm,
          maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
          excludePlaceIds: excludePlaceIdsForVacation,
          requireKosher: dna?.kosher === true,
          requireAccessible: dna?.accessibility === true,
        });

        if (pool.length === 0) {
          remainingStops.push(stop);
          continue;
        }

        // תיקון ביצועים (בקשה מפורשת - "יש הכל אצלי באדמין, למה AI לכל
        // תחנה?"): טיול חו"ל/סופ"ש יכול להיות 20-40 תחנות - קריאת
        // rankCandidates (עם Claude) לכל תחנה בנפרד, ברצף, הייתה בפועל
        // הגורם המרכזי לזמן ההמתנה (עשרות שניות, לפעמים דקות). המאגר
        // כבר admin-curated ומתויג (rating, tags) - דירוג דטרמיניסטי
        // מהיר (rankCandidatesFast, בלי שום קריאת AI) מספיק כדי לבחור
        // את המקום הכי מתאים מתוך המועמדים, בלי "לחשוב" עם Claude על
        // כל תחנה. אותה לוגיקת דירוג בדיוק שכבר משמשת כ-fallback הרגיל
        // כשקריאת Claude נכשלת - רק בלי לנסות את קריאת ה-AI קודם בכלל.
        const ranked = rankCandidatesFast(pool, dna, stop.note ? `${answers.freeText}. ${stop.note}` : answers.freeText, attributeScoreMap);

        const top = ranked[0];
        if (!top) {
          remainingStops.push(stop);
          continue;
        }

        await likeStop(supabase, user.id, stop.id, top);
        excludePlaceIdsForVacation.push(top.id);
      }


      console.error("[auto-build] מילוי מהמאגר הפנימי לפני AI (חופשה/סופ\"ש)", {
        sessionId,
        tripType: session.trip_type,
        totalSlots: pendingStops.length,
        filledFromDb: pendingStops.length - remainingStops.length,
        remainingForAi: remainingStops.length,
      });

      // מכאן והלאה - כל ה"תחנות" (stopsByDay/daySpecs) הן רק מה שנשאר,
      // כלומר מה שהמאגר לא הצליח למלא. אם הכול התמלא מהמאגר - remainingStops
      // ריק, ו-generateVacationItinerary פשוט לא ייקרא בכלל (allSuggestions=[]).
      const remainingStopsByDay = new Map<number, TripBuilderStop[]>();
      for (const stop of remainingStops) {
        const day = stop.day_index ?? 1;
        if (!remainingStopsByDay.has(day)) remainingStopsByDay.set(day, []);
        remainingStopsByDay.get(day)!.push(stop);
      }

      const daySpecs: VacationDaySpec[] = Array.from(remainingStopsByDay.entries()).map(([day, dayStops]) => {
        const totalFood = dayStops.filter((s) => s.role === "food" || s.role === "coffee_dessert").length;
        return { day, totalFood, totalAttractions: dayStops.length - totalFood };
      });

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
        daySpecs.length > 0
          ? generateVacationItinerary({
              destination: destinationName,
              destinationOrigin: searchOrigin,
              maxDistanceKm: destinationMaxDistanceKm,
              days: daySpecs,
              vacationTypeLabels: vacationTypeValues.map(getVacationTypeLabel),
              freeText: answers.freeText,
              budgetLabel: remainingBudgetLabel,
              travelDnaSummary: dnaSummary,
            })
          : Promise.resolve([]),
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

      for (const [day, dayStops] of remainingStopsByDay.entries()) {
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
      //
      // חריג חשוב: אם המשתמש ביקש במפורש שה-AI יבחר את האזור בעצמו
      // (tripIntent.openAreaChoice, למשל "בעיר שתבחר") - אסור לחזור
      // אוטומטית למיקום הנוכחי/לרדיוס הקטן מהשאלון, כי זה בדיוק מבטל את
      // הבקשה המפורשת של המשתמש לחופש בחירה. נותנים ל-Claude רדיוס גדול
      // בהרבה ומודיעים לו בפרומפט שהוא רשאי לבחור עיר/אזור אחר לגמרי.
      const areaLabel = tripIntent?.openAreaChoice
        ? "כל אזור בישראל שתבחר בעצמך כמתאים ביותר לבקשה - לא חייב להיות קרוב למיקום הנוכחי של המשתמש"
        : (tripIntent?.requestedArea as string | undefined) ?? (await reverseGeocodeToLocality(searchOrigin)) ?? "האזור המבוקש";

      const maxDistanceKm = requestedAreaRadiusKm ?? distanceBandToRadiusKm(answers.distanceBand);
      // הערה חשובה: openAreaChoice ("בעיר שתבחר") משפיע רק על areaLabel
      // (איזה אזור/עיר Claude בוחר) - **לא** על maxDistanceKm. "תבחר בעצמך
      // את העיר" ו"תתעלם מהמרחק שביקשתי" הם שני דברים שונים לגמרי; קודם
      // זה היה מוגדר יחד (150 ק"מ קבוע כש-openAreaChoice=true), מה שגרם
      // למרחקים אבסורדיים (עד גבול סוריה) גם כשהמשתמש ביקש רדיוס קטן
      // בפירוש (למשל "40 דקות"). "חופש בחירת עיר" עדיין כפוף לרדיוס
      // שהמשתמש קבע - הוא רק לא נסגר אוטומטית סביב מיקום הבית.

      // מרחק יעד אקראי בטווח 0-maxDistanceKm - בלי זה, Claude נוטה באופן
      // עקבי למקום הכי קרוב/מוכר בטווח (הטיה טבעית, לא רק ברירת מחדל
      // אקראית) - "עד X ק"מ" מתפרש בפועל כ"הכי קרוב שעדיין בגבול", לא
      // כפיזור אמיתי על פני כל הטווח שהמשתמש אישר.
      const targetDistanceKm = Math.round(Math.random() * maxDistanceKm);

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
      let hardDifficultyConstraint: string | null = null;
      if (session.trip_type === "nature_trip") {
        const natureAnswers = session.answers as unknown as import("@/services/tripBuilder/types").NatureTripAnswers;
        const { getNatureTypeLabel, getDifficultyLabel } = await import("@/locales/he/natureTrip");
        interestLabels = (natureAnswers.natureTypes ?? []).map(getNatureTypeLabel);
        // הוצא מ-dnaSummaryParts (שם זה קבור ברשימה כללית) לשדה ייעודי -
        // ר' הבלוק המודגש בפרומפט של generateDayTripPlaces.
        hardDifficultyConstraint = getDifficultyLabel(natureAnswers.difficulty);
      } else {
        interestLabels = (answers.interests ?? []).map(getCategoryLabel);
      }
      const dnaSummary = dnaSummaryParts.length ? dnaSummaryParts.join(". ") : null;

      const questionnaireSummaryParts: string[] = [];
      if (answers.companions) questionnaireSummaryParts.push(`הרכב מטיילים: ${answers.companions}`);
      if (answers.childAgeBands?.length) questionnaireSummaryParts.push(`גילאי ילדים: ${answers.childAgeBands.join(", ")}`);
      if (answers.timing) questionnaireSummaryParts.push(`תזמון: ${answers.timing}`);
      if (answers.distanceBand) questionnaireSummaryParts.push(`מרחק מבוקש: ${answers.distanceBand}`);
      const questionnaireSummary = questionnaireSummaryParts.length ? questionnaireSummaryParts.join(". ") : null;

      // תיקון לפי בקשה מפורשת: קודם מנסים למלא כל תחנה מהמאגר הפנימי
      // (ADMIN PLACES) - בדיוק כמו שכבר נעשה למסעדות/חיי לילה/דייט רומנטי.
      // Claude (generateDayTripPlaces) הוא **רק** גיבוי לתחנות שהמאגר לא
      // הצליח למלא - לא הנתיב הראשי יותר. לפני התיקון הזה, טיול יומי/טבע
      // דילגו על המאגר הפנימי לגמרי ותמיד השתמשו ב-AI, גם כשהיו מקומות
      // מתאימים וממותגים אצלנו כבר.
      // *** תיקון לפי בקשה מפורשת: "עד 3 ק"מ מרחק ממקום למקום". דבר חשוב:
      // dbCursor כן זז לתחנה הקודמת (לא נשאר קבוע על searchOrigin) - אבל
      // עד עכשיו החיפוש עדיין השתמש ב-maxDistanceKm המלא (רדיוס *כל היום*
      // מהבית, יכול להיות עשרות ק"מ) לכל תחנה, גם תחנות 2+. כלומר התחנה
      // הראשונה יכולה להיות בקצה אחד של הרדיוס והשנייה בקצה הנגדי -
      // רחוקות זו מזו בעשרות ק"מ, גם ששתיהן בנפרד "בטווח" מהבית. עכשיו
      // רק התחנה *הראשונה* מחפשת בכל רדיוס היום; מהתחנה השנייה והלאה,
      // החיפוש מוגבל ל-MAX_INTER_STOP_DISTANCE_KM מהתחנה הקודמת בפועל -
      // לא מהבית - כדי שהמסלול יהיה רציף וקרוב פיזית, לא מפוזר.
      const MAX_INTER_STOP_DISTANCE_KM = 3;
      let dbCursor = searchOrigin;
      const remainingSlots: typeof pendingStops = [];
      for (let stopIndex = 0; stopIndex < pendingStops.length; stopIndex++) {
        const stop = pendingStops[stopIndex];
        const pool = await fetchCandidatePool(supabase, {
          category: stop.category,
          origin: dbCursor,
          distanceBand: answers.distanceBand,
          maxDistanceKm: stopIndex === 0 ? maxDistanceKm : MAX_INTER_STOP_DISTANCE_KM,
          maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
          excludePlaceIds,
          requireKosher: dna?.kosher === true,
          requireAccessible: dna?.accessibility === true,
        });

        if (pool.length === 0) {
          remainingSlots.push(stop);
          continue;
        }

        const ranked = await rankCandidates({
          dna,
          candidates: pool,
          freeText: stop.note ? `${answers.freeText}. ${stop.note}` : answers.freeText,
          remainingBudgetLabel,
          rankingPromptRules: rules.rankingPromptRules,
          attributeScoreMap,
          learnedAttributes,
          tripIntent,
          questionnaireAnswers: undefined,
        });

        const top = ranked[0];
        if (!top) {
          remainingSlots.push(stop);
          continue;
        }

        await likeStop(supabase, user.id, stop.id, top);
        excludePlaceIds.push(top.id);
        dbCursor = { lat: top.latitude, lng: top.longitude };
      }

      console.error("[auto-build] מילוי מהמאגר הפנימי לפני AI", {
        sessionId,
        tripType: session.trip_type,
        totalSlots: pendingStops.length,
        filledFromDb: pendingStops.length - remainingSlots.length,
        remainingForAi: remainingSlots.length,
      });

      const resolvedPlaces =
        remainingSlots.length > 0
          ? await generateDayTripPlaces({
              areaLabel,
              areaOrigin: searchOrigin,
              maxDistanceKm,
              targetDistanceKm,
              slots: remainingSlots.map((stop) => ({ slotId: stop.id, category: stop.category, role: stop.role, note: stop.note })),
              interestLabels,
              freeText: answers.freeText,
              budgetLabel: remainingBudgetLabel,
              travelDnaSummary: dnaSummary,
              hardDifficultyConstraint,
              questionnaireSummary,
            })
          : [];

      if (remainingSlots.length > 0 && resolvedPlaces.length === 0) {
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
          requireKosher: dna?.kosher === true,
          requireAccessible: dna?.accessibility === true,
        }),
      }))
    );
    const clusterCenter = findBestCluster(clusteringPools, searchOrigin);

    // רץ ברצף (לא במקביל): כל תחנה יוצאת מהתחנה הקודמת שבאמת נבחרה,
    // ומתחיל מהאזור שזוהה (לא מהבית) - כדי שהמסלול יהיה קרוב פיזית ולא מפוזר.
    let cursor = clusterCenter;

    // תיקון: קודם נשלח ל-Claude city="האזור המבוקש" כברירת מחדל קבועה
    // (המחרוזת המילולית עצמה, לא שם אזור אמיתי) בכל פעם שהמשתמש לא כתב
    // אזור מפורש במלל חופשי - כלומר כמעט תמיד. "המלץ על מסעדה אמיתית
    // ב'האזור המבוקש'" הוא פרומפט חסר-משמעות ל-Claude, ולכן ההמלצה נוטה
    // להיכשל/להיפסל באימות מול Google כמעט בכל פעם - מה שדחף כל בקשה
    // כמעט תמיד ל-fallback של המאגר המקומי, גם כשהיה מקום מתאים אמיתי.
    // עכשיו, בהיעדר אזור מפורש, הופכים את מיקום הבית לשם עיר/אזור קריא
    // (reverse geocoding) - בדיוק כמו ש-day_trip/nature_trip כבר עושים.
    const restaurantAreaLabel =
      session.trip_type === "restaurants_cafes"
        ? tripIntent?.requestedArea ?? (await reverseGeocodeToLocality(searchOrigin)) ?? "האזור המבוקש"
        : null;

    for (let i = 0; i < pendingStops.length; i++) {
      const stop = pendingStops[i];
      const isFirstStop = i === 0;

      // עדיפות מוחלטת (חדש): אם המשתמש נקב בשם עסק ספציפי במלל החופשי
      // (tripIntent.requestedPlaceName, למשל "עדיפות במסעדת מלכה") - מחפשים
      // אותו ישירות ב-DB לפי שם, לפני כל דבר אחר ובלי סינון קטגוריה/תיוג
      // בכלל (המשתמש כבר אמר בדיוק מה הוא רוצה). קודם בקשה כזו הייתה נטמעת
      // בתוך freeText הכללי, מקבלת רק משקל "רך" בדירוג בין המועמדים שכבר
      // חזרו מהחיפוש הרגיל - ואם המקום המבוקש לא נכנס למאגר הזה מלכתחילה
      // (למשל תיוג לא מדויק, או שלא היה בטווח distanceBand הרגיל), הוא
      // מעולם לא קיבל סיכוי אמיתי, גם אם המשתמש ביקש אותו בפירוש בשמו.
      if (session.trip_type === "restaurants_cafes" && tripIntent?.requestedPlaceName) {
        const requestedPlaceMaxDistanceKm = Math.max(
          25,
          requestedAreaRadiusKm ?? distanceBandToRadiusKm(answers.distanceBand)
        );
        const requestedPlace = await findRequestedPlaceNear(
          supabase,
          tripIntent.requestedPlaceName,
          cursor,
          requestedPlaceMaxDistanceKm
        );
        if (requestedPlace && !excludePlaceIds.includes(requestedPlace.id)) {
          await likeStop(supabase, user.id, stop.id, requestedPlace);
          excludePlaceIds.push(requestedPlace.id);
          cursor = { lat: requestedPlace.latitude, lng: requestedPlace.longitude };
          continue;
        }
      }

      // סדר עדיפויות (תוקן): קודם המאגר הפנימי שלנו (ADMIN PLACES,
      // fetchCandidatePool) - כי אלה מקומות שאדמין בדק/אצר בעצמו. Claude +
      // Google Places הם *רק* רשת ביטחון, למקרה שהמאגר הפנימי ריק לגמרי
      // באזור המבוקש - לא הנתיב הראשי כמו שהיה קודם. קודם הסדר היה הפוך
      // (Claude קודם, DB רק גיבוי) - זו הייתה בדיוק הסיבה שמקום קיים ומאומת
      // באדמין (למשל "מלכה", 3 דק' מהבית) יכול להיות מתעלם: ברגע ש-Claude
      // הצליח להציע *משהו* שעבר אימות Google (גם אם רחוק/פחות מתאים), הקוד
      // היה משתמש בו ולעולם לא פונה בכלל למאגר הפנימי.
      const effectiveOrigin = dayOriginOverride ?? (requestedAreaRadiusKm ? searchOrigin : cursor);
      const pool = await fetchCandidatePool(supabase, {
        category: stop.category,
        origin: effectiveOrigin,
        distanceBand: answers.distanceBand,
        maxDistanceKm: dayOriginOverride ? 15 : requestedAreaRadiusKm ?? (isFirstStop ? undefined : MAX_STOP_DISTANCE_KM[answers.durationBand]),
        maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
        excludePlaceIds,
        requireKosher: dna?.kosher === true,
        requireAccessible: dna?.accessibility === true,
      });

      if (pool.length > 0) {
        // עבור מסעדות (ורק שם) - בחירת סוג המטבח לא מגיעה דרך "interests" הרגיל,
        // אלא דרך שדה "cuisine" נפרד. מוסיפים אותה למלל שנשלח לדירוג, אחרת
        // הבחירה הספציפית של המשתמש (למשל "המבורגר") אף פעם לא מגיעה ל-Claude.
        const cuisineSelection = (answers as unknown as { cuisine?: string[] }).cuisine;
        const combinedFreeText = cuisineSelection?.length
          ? `${answers.freeText}. סוג מטבח מועדף: ${cuisineSelection.map(getCategoryLabel).join(", ")}`
          : answers.freeText;

        // תשובות השאלון המפורשות לפרומפט הדירוג (rankCandidates) - עדיין לא
        // מחובר לאף סוג טיול (day_trip לא מגיע לכאן בכלל - יש לו נתיב נפרד,
        // ר' questionnaireSummary ב-generateDayTripPlaces למעלה). יחובר לכאן
        // כשנעבור על שאר סוגי הטיול אחד-אחד.
        const questionnaireAnswers = undefined;

        const ranked = await rankCandidates({
          dna,
          candidates: pool,
          freeText: combinedFreeText,
          remainingBudgetLabel,
          rankingPromptRules: rules.rankingPromptRules,
          attributeScoreMap,
          learnedAttributes,
          tripIntent,
          questionnaireAnswers,
        });

        const top = ranked[0];
        if (top) {
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
          continue;
        }
      }

      // המאגר הפנימי ריק (או שהדירוג לא החזיר מועמד) - fallback ל-Claude,
      // רק עבור מסעדות/בתי קפה, ורק אם לא נדרשה כשרות (Claude לא יכול
      // לערוב לכשרות של מקום שהוא ממליץ עליו מהידע הכללי שלו - אין לו
      // איך לדעת, אז כשכשרות נדרשת נשארים עם "לא נמצא" ולא מסתכנים).
      if (pool.length === 0 && session.trip_type === "restaurants_cafes" && dna?.kosher !== true) {
        const restaurantAnswers = answers as unknown as { cuisine?: string[]; distanceBand?: string };
        const baseRestaurantMaxDistanceKm =
          requestedAreaRadiusKm ?? distanceBandToRadiusKm((restaurantAnswers.distanceBand ?? "30min") as never);

        // אם הרדיוס המבוקש (למשל "10 דקות") לא מניב שום תוצאה - לא נותנים
        // "לא מצאנו כלום" מיד; מרחיבים פעם אחת (עד פי 3, מקסימום 25 ק"מ)
        // לפני שמוותרים. עדיף מקום קצת רחוק יותר ממסך ריק לגמרי.
        const distanceAttemptsKm = [
          baseRestaurantMaxDistanceKm,
          Math.min(baseRestaurantMaxDistanceKm * 3, 25),
        ];

        let aiSuggestion = null as Awaited<ReturnType<typeof suggestRealRestaurant>>;
        for (const attemptMaxDistanceKm of distanceAttemptsKm) {
          aiSuggestion = await suggestRealRestaurant(supabase, {
            city: restaurantAreaLabel ?? "האזור המבוקש",
            cuisine: restaurantAnswers.cuisine ?? [],
            freeText: answers.freeText,
            budgetLabel: remainingBudgetLabel,
            areaOrigin: cursor,
            maxDistanceKm: attemptMaxDistanceKm,
            requestedPlaceName: tripIntent?.requestedPlaceName ?? null,
          });
          if (aiSuggestion) break;
        }

        if (aiSuggestion) {
          const realPlace = await ensurePlaceExists(aiSuggestion, restaurantAreaLabel ?? "");
          await likeStop(supabase, user.id, stop.id, realPlace);
          excludePlaceIds.push(realPlace.id);
          cursor = { lat: realPlace.latitude, lng: realPlace.longitude };
          continue;
        }
      }

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

      // נקודת בקרה קריטית (כמו הלוגים המקבילים למעלה ב-vacation/day_trip):
      // בלי הלוג הזה, תחנה שנפסלת בשקט (לא DB, לא AI) הופכת בעמוד
      // התוצאות ל"לא מצאנו מקום מתאים" בלי שום עקבה לאבחון למה.
      console.error("[auto-build] לא נמצא מועמד (לא ב-DB ולא דרך AI) - התחנה מדולגת", {
        sessionId,
        tripType: session.trip_type,
        category: stop.category,
        origin: effectiveOrigin,
        distanceBand: answers.distanceBand,
      });
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
    // רשת ביטחון קריטית: בלי זה, כל שגיאה כאן (כולל "המסלול שנבנה ריק" -
    // 0 תחנות תקינות, למשל כשה-AI לא הצליח למצוא מקום מתאים אמיתי) הייתה
    // משאירה את ה-session תקוע לנצח ב-status="building" - הלקוח ממשיך
    // לבצע polling בלי סוף, בלי שום דרך לצאת מהמצב הזה. במקום זאת,
    // מסמנים "completed" עם מסלול ריק - בדיוק המצב שהעמודים כבר יודעים
    // להציג בצורה מכובדת ("לא נבחרו מספיק תחנות"), ולא מסך תקוע/שגיאה.
    try {
      await saveFinalItinerary(supabase, sessionId, { stops: [], events: [], totalEtaMinutes: 0, warnings: [] });
    } catch {
      // אם גם השמירה הזו נכשלת - אין מה לעשות מעבר לזה כאן, ה-error
      // המקורי כבר מתועד למטה.
    }
    console.error("[auto-build] נכשל, ה-session סומן completed עם מסלול ריק כדי לא להישאר תקוע", {
      sessionId,
      tripType: session.trip_type,
      error,
    });
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
