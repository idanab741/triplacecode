import { NextResponse } from "next/server";

/**
 * בקשה מפורשת ("יש workers?"): אין - כל auto-build רץ בתוך קריאת HTTP
 * אחת ארוכה (לא תור/worker אמיתי). ברירת המחדל של Vercel ל-serverless
 * function (בד"כ 10 שניות ב-Hobby) קצרה מדי לבנייה הזו - במיוחד עכשיו
 * שנוספה לולאת Blueprint (AI) לכל יום. אם ה-function נהרגת באמצע, ימים
 * שעוד לא נשמרו נשארים בסקלטון לנצח (שום דבר לא ממשיך לעדכן אותם). זה
 * מרים את התקרה ל-5 דקות - עדיין דורש תוכנית Vercel שתומכת בזה (Pro
 * ומעלה; ב-Hobby התקרה בפועל 60 שניות גם עם ההגדרה הזו).
 */
export const maxDuration = 300;

import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getAttributeScoreMap, summarizeTopAttributes } from "@/services/travelDna/attributeLearningService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool, fetchNightlifeCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates, rankCandidatesFast } from "@/services/tripBuilder/rankingService";
import { likeStop } from "@/services/tripBuilder/swipeService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { dayTripBudgetToMaxPriceLevel, MAX_STOP_DISTANCE_KM } from "@/services/tripBuilder/rules/dayTrip";
import { finalizeItinerary } from "@/services/tripBuilder/finalizeService";
import { findBestCluster } from "@/services/tripBuilder/clusterService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { getOrCreateAreaExperience } from "@/services/tripBuilder/areaExperienceService";
import { findCentralNeighborhood } from "@/services/tripBuilder/centralNeighborhoodService";
import { suggestRealRestaurant } from "@/services/tripBuilder/restaurantSuggestionService";
import { findRequestedPlaceNear } from "@/services/tripBuilder/placeResolutionService";
import { findPlaceStatusAndPhoto } from "@/services/tripBuilder/placePhotoService";
import { generateVacationItinerary, type VacationDaySpec } from "@/services/tripBuilder/vacationAttractionListService";
import { pickSurpriseDestination, pickWeekendDestination } from "@/services/tripBuilder/vacationDestinationPickerService";
import { findAdminDestinationByName } from "@/services/destinations/destinationsServerService";
import { logAiError } from "@/services/ai/claudeService";
import { suggestMustSeeLandmarks, findMustSeePlaces } from "@/services/tripBuilder/vacationMustSeeService";
import { ensurePlaceExists } from "@/services/tripBuilder/aiPlaceInsertionService";
import type { DayTripAnswers, TripBuilderStop, WeekendAnswers } from "@/services/tripBuilder/types";
import type { LatLng, AbroadVacationAnswers } from "@/services/tripBuilder/types";
import { getVacationTypeLabel, VACATION_CHILD_AGE_OPTIONS } from "@/locales/he/abroadVacation";
import { getCategoryLabel } from "@/utils/categoryLabels";
import { generateTripIntent } from "@/services/tripBuilder/tripIntentService";
import { saveTripIntent } from "@/services/tripBuilder/sessionService";
import { normalizeAnswers, decideCategoryPlan, countDays, categoryPlanForDay } from "@/services/tripBuilder/categoryPlanService";
import { saveCategoryPlan } from "@/services/tripBuilder/sessionService";
import { saveFinalItinerary } from "@/services/tripBuilder/sessionService";
import { appendDayStops } from "@/services/tripBuilder/sessionService";
import { buildVacationContext } from "@/services/tripBuilder/vacationContext";
import { generateDayBlueprint } from "@/services/tripBuilder/dayBlueprintService";
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
 * תיקון באג קריטי אמיתי (זוהה מפורשות ב-MASTER SPEC סעיף 65/250 -
 * "Verify all Weekend calls to dayTripBudgetToMaxPriceLevel() ... Do not
 * silently return null and thereby turn a limited Weekend budget into
 * effectively unlimited"): בדקתי בפועל - `answers.budgetBand` לא קיים
 * בכלל לא ב-WeekendAnswers ולא ב-AbroadVacationAnswers (בשניהם השדה
 * נקרא `budgetPerPerson`, עם סקאלת ערכים שונה לגמרי מ-DayTripAnswers.
 * budgetBand - זה Budget Envelope לכל הטיול לאדם, לא מחיר למקום בודד
 * כמו ביום כיף). `dayTripBudgetToMaxPriceLevel(undefined)` מחזיר תמיד
 * null - כלומר עד עכשיו, לכל בנייה של סופ"ש/חופשה בחו"ל, מגבלת התקציב
 * שהמשתמש בחר **התעלמה לגמרי** מהחיפוש בפועל (maxPriceLevel=null =
 * ללא הגבלה), בלי קשר אם המשתמש בחר "0-1,000" או "ללא הגבלה".
 */
const VACATION_BUDGET_PER_PERSON_MAX_PRICE_LEVEL: Record<string, number | null> = {
  // סופ"ש (WEEKEND_BUDGET_STEPS)
  "0-1000": 1,
  "1000-3000": 2,
  "3000+": 3,
  // חופשה בחו"ל (VACATION_BUDGET_STEPS) - סקאלה שונה, אותו עיקרון
  "0-2500": 1,
  "2500-7500": 2,
  "7500-12000": 3,
  "12000+": 4,
  unlimited: null,
};

function vacationBudgetToMaxPriceLevel(budgetPerPerson: string | null | undefined): number | null {
  if (!budgetPerPerson) return null;
  return VACATION_BUDGET_PER_PERSON_MAX_PRICE_LEVEL[budgetPerPerson] ?? null;
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
    //
    // תיקון באג אמיתי (בקשה מפורשת - "הזנתי את מקום הלינה - והוא לא
    // מופיע בליינאפ" + "המסלול שוב מפנה אותי חזרה לתל אביב"): geocodePlaceName
    // משתמש ב-Geocoding API הרגיל, שנועד לכתובות רחוב מובנות - לא לשמות
    // עסקים (מלון/צימר/הוסטל). אותו עיקרון בדיוק שכבר תועד ב-
    // placeResolutionService.ts לגבי עסקים לא-רשמיים: לפעמים הוא לא מוצא
    // כלום, ולפעמים "תופס" רק חלק מהמחרוזת ומחזיר קואורדינטות של מקום
    // אחר לגמרי. Places Text Search (findPlaceStatusAndPhoto) בנוי בדיוק
    // בשביל שמות עסקים כאלה ומחזיר את הקואורדינטות המדויקות של העסק
    // עצמו. מנסים אותו קודם (עם שם+כתובת יחד, המידע העשיר ביותר שיש) -
    // ורק אם הוא לא מוצא בכלל, נופלים ל-geocodePlaceName כרשת ביטחון.
    async function resolveLodgingCoords(name: string | null | undefined, address: string): Promise<{ lat: number; lng: number } | null> {
      const query = name && name.trim() && name.trim() !== address.trim() ? `${name.trim()} ${address.trim()}` : address.trim();
      const textSearchResult = await findPlaceStatusAndPhoto(query);
      if (textSearchResult.latitude != null && textSearchResult.longitude != null) {
        return { lat: textSearchResult.latitude, lng: textSearchResult.longitude };
      }
      return geocodePlaceName(address);
    }

    let dayOriginOverride: { lat: number; lng: number } | null = null;
    // מבדיל בין לינה אמיתית (BASE סמכותי - אף פעם לא נדרס) לבין יעד
    // שהתגלה אוטומטית (ניחוש-ברירת-מחדל, פחות סמכותי מבקשת אזור מפורשת
    // שעשויה עוד להיפתר אחרי הנקודה הזו - ר' ההערה למטה ליד "אזור מבוקש").
    let dayOriginOverrideIsLodging = false;
    if (session.trip_type === "abroad_vacation") {
      const hotels = (session as unknown as { hotels?: { name: string; address: string }[] }).hotels ?? [];
      if (hotels.length > 0 && hotels[0].address) {
        dayOriginOverride = await resolveLodgingCoords(hotels[0].name, hotels[0].address);
      }
    } else if (session.trip_type === "weekend") {
      // סופ"ש: אותו רעיון כמו חופשה בחו"ל - כל הימים "מתחילים" ממיקום
      // הלינה בפועל (אם כבר נסגרה), לא מהבית. שדה יחיד (lodgingAddress),
      // לא מערך hotels - סופ"ש הוא בדרך כלל לינה אחת לכל הטיול.
      const weekendAnswers = answers as unknown as {
        hasBookedLodging?: boolean;
        lodgingName?: string | null;
        lodgingAddress?: string | null;
      };
      if (weekendAnswers.hasBookedLodging && weekendAnswers.lodgingAddress) {
        dayOriginOverride = await resolveLodgingCoords(weekendAnswers.lodgingName, weekendAnswers.lodgingAddress);
        dayOriginOverrideIsLodging = dayOriginOverride != null;
        if (!dayOriginOverride) {
          logAiError("לא הצלחנו לגאוקד את מקום הלינה שהוזן בסופ\"ש - נופלים חזרה למיקום הבית", {
            sessionId,
            lodgingName: weekendAnswers.lodgingName ?? null,
            lodgingAddress: weekendAnswers.lodgingAddress,
          });
        }
      } else {
        // תיקון פער אמיתי שאותר ב-Audit מול ה-MASTER SPEC (סעיפים 25-29,
        // 90, 197): בלי לינה, לא הייתה שום בחירת יעד אמיתית - החיפוש
        // נשאר שטוח סביב הבית בכל הרדיוס המקסימלי, בדיוק התרחיש שסעיף
        // 197 מזהיר עליו ("5h תמיד מחזיר near-home"). רצים את זה גם אם
        // ייתכן ש-tripIntent.requestedArea עוד יתברר כאמיתי בהמשך (הוא
        // נפתר lazy, לא בהכרח מוכן כאן עדיין) - dayOriginOverrideIsLodging
        // נשאר false, כך שאם אזור מפורש כן מתגלה בהמשך, הוא עדיין גובר
        // על הניחוש הזה (ר' הבדיקה למטה ליד "אזור מבוקש").
        const weekendFullAnswers = answers as unknown as {
          weekendStyles?: string[];
          budgetPerPerson?: string;
          distanceBand?: string;
        };
        const dnaSummaryPartsForWeekendDestination: string[] = [];
        if (dna) {
          if (dna.interests?.length) dnaSummaryPartsForWeekendDestination.push(`תחומי עניין: ${dna.interests.map(getCategoryLabel).join(", ")}`);
          if (dna.kosher) dnaSummaryPartsForWeekendDestination.push("חובה: כשרות");
          if (dna.accessibility) dnaSummaryPartsForWeekendDestination.push("חובה: נגישות");
        }
        const chosenWeekendDestination = await pickWeekendDestination({
          origin,
          maxRadiusKm: distanceBandToRadiusKm(weekendFullAnswers.distanceBand as Parameters<typeof distanceBandToRadiusKm>[0]),
          weekendStyleLabels: (weekendFullAnswers.weekendStyles ?? []).map(getWeekendStyleLabel),
          freeText: answers.freeText,
          budgetLabel: weekendFullAnswers.budgetPerPerson ?? "לא צוין",
          travelDnaSummary: dnaSummaryPartsForWeekendDestination.length ? dnaSummaryPartsForWeekendDestination.join(". ") : null,
        });
        if (chosenWeekendDestination) {
          dayOriginOverride = chosenWeekendDestination.coords;
        }
        // אם לא נמצא יעד מתאים בטווח (candidates=[] או timeout/שגיאה) -
        // dayOriginOverride נשאר null, ו-auto-build ממשיך בהתנהגות המקורית
        // (חיפוש שטוח סביב הבית) כרשת ביטחון - לא נכשל.
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
        // תיקון (בקשה מפורשת - "רק דרך תיקיית האדמין שלנו, לא גוגל"):
        // מוצאים את הקואורדינטות של היעד אך ורק מתוך טבלת ה-places שלנו
        // (בדיוק אותו מקור כמו "תפתיעו אותי" למטה) - בלי שום קריאה
        // ל-Google Geocoding. גם מעדכנים את השם המוצג לכתיב המדויק שקיים
        // אצלנו באדמין, כדי שהתצוגה תמיד תואמת את מה שבאמת נבנה.
        const matched = await findAdminDestinationByName(vacationAnswers.destination);
        if (matched) {
          searchOrigin = { lat: matched.latitude, lng: matched.longitude };
          requestedAreaRadiusKm = 20;
          vacationDestinationName = `${matched.name}, ${matched.country}`;
        } else {
          logAiError("היעד שהוזן לא נמצא בין היעדים עם תוכן קיים באדמין (places) - לא בוצע geocoding חיצוני", {
            destination: vacationAnswers.destination,
          });
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

    // תיקון באג אמיתי (בקשה מפורשת - "רשמתי מקום לינה, הוא לא הופיע
    // במסלול"): כשכבר יש dayOriginOverride מוצק (לינה שנרשמה ונגאוקדה
    // בהצלחה, למשל בסופ"ש) - אסור לדרוס אותו כאן רק כי המלל החופשי גם
    // הזכיר שם אזור (למשל "כנרת"). לפני התיקון, התנאי הזה החריג רק
    // "abroad_vacation" ולא "weekend" - כך שסופ"ש עם לינה קיימת נדרס
    // בפועל בכל פעם שהמלל החופשי הזכיר שם מקום, וכל הבנייה עברה לעגן
    // סביב geocoding גנרי של השם (רדיוס 3 ק"מ בלבד) במקום סביב הלינה.
    //
    // תיקון נוסף (Audit): dayOriginOverrideIsLodging, לא רק dayOriginOverride -
    // יעד שהתגלה אוטומטית (pickWeekendDestination, בלי לינה בכלל) הוא
    // ניחוש-ברירת-מחדל, פחות סמכותי מבקשת אזור מפורשת בפועל. אם tripIntent
    // עוד לא היה מוכן כשהיעד התגלה (נפתר lazy), ורק עכשיו מתברר שהמשתמש
    // כן ביקש אזור ספציפי - האזור המפורש עדיין צריך לגבור על הניחוש.
    if (tripIntent?.requestedArea && session.trip_type !== "abroad_vacation" && !dayOriginOverrideIsLodging) {
      const geocoded = await geocodePlaceName(tripIntent.requestedArea);
      if (geocoded) {
        searchOrigin = geocoded;
        requestedAreaRadiusKm = 3;
      }
    }

    // חופשה בחו"ל: יום 1 ויום אחרון דטרמיניסטיים לגמרי (בלי AI). ימים
    // "רגילים" שביניהם משתמשים בקריאת Blueprint אחת לכל יום (ר'
    // dayBlueprintService.ts) - אסטרטגיה ברמת-על בלבד (כותרת/עוצמה/מיקוד),
    // לא בחירת מקומות בפועל - זה עדיין fetchCandidatePool/rankCandidatesFast
    // הרגילים, בדיוק כמו כל תחנה אחרת. כל יום הוא job עצמאי, נשמר בנפרד
    // ברגע שהוא מוכן (isFinal=false) - סקלטון אמיתי יום-אחרי-יום, לא רק
    // "יום 1 ואז הכל".
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
      if (vacationAnswers.companions?.includes("family") && vacationAnswers.childAgeBands?.length) {
        const ageLabels = vacationAnswers.childAgeBands.map(
          (band) => VACATION_CHILD_AGE_OPTIONS.find((o) => o.value === band)?.label ?? band
        );
        dnaSummaryParts.push(
          `חובה: נוסעים עם ילדים בגילאי ${ageLabels.join(", ")} - כל מקום מוצע חייב להתאים לגילאים האלה (בטיחות, שעות, עניין), לא רק מקומות למבוגרים`
        );
      }
      // dnaSummaryParts כבר נאסף למעלה - dnaSummary עצמו לא נחוץ יותר כאן
      // אחרי הסרת ה-AI fallback (בקשה מפורשת - "רק במאגר!!!").

      // רדיוס תקין סביב מרכז היעד: אם המשתמש/AI כבר קבע רדיוס אזור מפורש
      // (requestedAreaRadiusKm) - נותנים מרווח פי 2 ממנו (יעד יכול להתפרס
      // מעבר למרכז המדויק); אחרת ברירת מחדל של עיר גדולה + פרברים.
      // סופ"ש בארץ - קנה מידה קטן בהרבה מ"עיר בחו"ל", אז ברירת המחדל
      // (בלי רדיוס מפורש) נשענת על distanceBand של המשתמש, לא על 60 ק"מ קבוע.
      //
      // תיקון באג קריטי אמיתי (בקשה מפורשת - "שוב מחזיר אותי לתל אביב"):
      // distanceBand הוא "כמה רחוק מהבית מוכנים לנסוע בשביל הסופ"ש כולו"
      // (יכול להגיע ל-150+ ק"מ) - לא "כמה רחוק מהלינה עצמה הגיוני שאתר
      // חובה/מקום חיי-לילה יהיה". כשכבר יש dayOriginOverride (לינה שנפתרה
      // בהצלחה), destinationMaxDistanceKm שימש בפועל כרדיוס החיפוש של
      // findMustSeePlaces/nightlife/ה-fallback הרחב סביב searchOrigin (=
      // מיקום הלינה) - כלומר "אתר חובה" יכול היה להימצא בכל מקום בטווח
      // 100+ ק"מ מהלינה, כולל בחזרה בתל אביב (המרחק האמיתי מכמה אזורי
      // לינה בצפון לתל אביב). WEEKEND_LODGING_TRIP_RADIUS_KM מגביל את זה
      // לטווח סביר סביב הלינה עצמה - בלי לגעת בטיולים בלי לינה קבועה
      // (שם אין "עוגן" לחשב ממנו מרחק סביר, ונשארים עם distanceBand המלא).
      const WEEKEND_LODGING_TRIP_RADIUS_KM = 30;
      const destinationMaxDistanceKm = requestedAreaRadiusKm
        ? requestedAreaRadiusKm * 2
        : session.trip_type === "weekend"
          ? dayOriginOverride
            ? Math.min(
                distanceBandToRadiusKm((answers as unknown as WeekendAnswers).distanceBand),
                WEEKEND_LODGING_TRIP_RADIUS_KM
              )
            : distanceBandToRadiusKm((answers as unknown as WeekendAnswers).distanceBand)
          : 60;

      // לוג אבחוני זמני (בקשה מפורשת - "עדיין קופץ לתל אביב, אני לא
      // מאמין לך יותר") - מציג את כל הערכים שבפועל נכנסים לחישוב הרדיוס
      // ולחיפוש אתרי החובה, כדי לדעת בוודאות איפה הניתוק קורה במקום
      // לנחש שוב. יוסר אחרי שהבעיה תיפתר סופית.
      console.error("[auto-build DEBUG] רדיוס חיפוש אתרי חובה/סופ\"ש", {
        sessionId,
        tripType: session.trip_type,
        dayOriginOverride,
        searchOrigin,
        requestedAreaRadiusKm: requestedAreaRadiusKm ?? null,
        distanceBand: (answers as unknown as WeekendAnswers).distanceBand ?? null,
        distanceBandRadiusKm: distanceBandToRadiusKm((answers as unknown as WeekendAnswers).distanceBand),
        WEEKEND_LODGING_TRIP_RADIUS_KM,
        finalDestinationMaxDistanceKm: destinationMaxDistanceKm,
      });

      // בקשה מפורשת נוספת ("חסר לי הקוליזיאום, הוותיקן, המדרגות
      // הספרדיות!"): התקרה נגזרת מאורך הטיול בפועל, לא מספר קבוע - יעד
      // עשיר כמו רומא לטיול 5 ימים צריך יותר מ-6 הצעות.
      //
      // תיקון ביצועים (בקשה מפורשת - "המשחק קפץ רגע לפני שהמסלול היה
      // מוכן"): שרשרת "אתרי חובה" (Claude + חיפוש/יצירה) ושרשרת "השכונה
      // המרכזית" (DB + Claude) בלתי-תלויות זו בזו לגמרי - היו רצות
      // ברצף, כל אחת כמה שניות, מה שדחף את יום 1 קרוב מדי לתקרת ההמתנה
      // בצ'אט. עכשיו רצות במקביל.
      const vacationDatesForMustSee = answers as unknown as { startDate?: string; endDate?: string };
      const estimatedNumDays = countDays(vacationDatesForMustSee.startDate ?? "", vacationDatesForMustSee.endDate ?? "");

      const [mustSeePlaces, centralNeighborhood] = await Promise.all([
        (async () => {
          // בקשה מפורשת: אתרי "חובה" מובהקים ליעד (למשל מגדל אייפל + שייט
          // בסיין לפריז) חייבים להיכנס למסלול כשקיימים אצלנו במאגר - לא
          // "אולי ייבחרו" דרך הדירוג הרגיל. Claude מציע שמות (בלי שום
          // קריאת Google), ומחפשים כל שם **רק** במאגר שלנו; שם שלא נמצא
          // נשמט בשקט (לא מומצא/מאומת דרך Google).
          // סדר העדיפות של Claude (השם הראשון = הכי מובהק/מתאים לטיול
          // הזה) נשמר - זה מה שקובע אילו אתרי חובה "זוכים" למקום כשיש
          // יותר אתרי חובה שנמצאו מאשר סלוטים פנויים בטיול קצר.
          const mustSeeNames = await suggestMustSeeLandmarks({
            destination: destinationName,
            vacationTypeLabels: vacationTypeValues.map(getVacationTypeLabel),
            freeText: answers.freeText,
            maxCount: estimatedNumDays * 2,
          });
          console.error("[auto-build DEBUG] אתרי חובה - הצעות גולמיות מ-Claude", {
            sessionId,
            destinationName,
            mustSeeNames,
          });
          return findMustSeePlaces(supabase, mustSeeNames, searchOrigin, destinationMaxDistanceKm, destinationName);
        })(),
        // בקשה מפורשת: השכונה המרכזית של היעד - לכרטיס התצוגה של יום 1
        // (ר' centralNeighborhoodService.ts) וגם לעיגון רדיוס חיפוש
        // מסעדת יום 1 (עד 1 ק"מ מהשכונה, לא מהמלון ולא ממרכז היעד
        // הכללי). רק בחופשה בחו"ל - לסופ"ש אין כרטיס כזה.
        session.trip_type === "abroad_vacation"
          ? findCentralNeighborhood(supabase, {
              destination: destinationName,
              origin: searchOrigin,
              radiusKm: destinationMaxDistanceKm,
            })
          : Promise.resolve(null),
      ]);
      if (session.trip_type === "abroad_vacation" && !centralNeighborhood) {
        logAiError("לא אותרה שכונה מרכזית ליום 1 - מסעדת יום 1 תיפול חזרה לרדיוס הרגיל של היעד", {
          sessionId,
          destinationName,
        });
      }
      // (המקור המדויק לכל תוצאה - מהמאגר שלנו מול נוצר דרך Google -
      // כבר נרשם בלוג בתוך findMustSeePlaces עצמו, ר' vacationMustSeeService.ts)
      // תיקון לפי בקשה מפורשת: קודם מנסים למלא כל תחנה מהמאגר הפנימי
      // (ADMIN PLACES) - בדיוק כמו שכבר נעשה לטיול יומי/טבע/מסעדות/חיי
      // לילה/דייט רומנטי. יש גם תוכן מחו"ל במאגר (לא רק ישראל), אז זה
      // רלוונטי גם לחופשה בחו"ל, לא רק לסופ"ש. Claude (generateVacationItinerary)
      // הוא **רק** גיבוי לתחנות שהמאגר לא הצליח למלא - לא הנתיב הראשי יותר.
      // בקשה מפורשת - ארכיטקטורת "יום 1 תוך 10-15 שניות, אח"כ סקלטון
      // לשאר הימים": יום 1 נבנה ונשמר **לפני** שממשיכים לשאר הימים, לא
      // כחלק מאותה לולאה שממלאת הכל ואז שומרת פעם אחת בסוף. ר' fillStopsFromPoolThenAi
      // + הקריאה החלקית ל-finalizeItinerary(..., isFinal=false) למטה.
      //
      // תיקון קריטי נוסף (בקשה מפורשת - "הכל צריך להיות בסמיכות וקרוב
      // אחד לשני, באותו יום"): קודם כל תחנה בכל יום חיפשה סביב אותה
      // נקודת מוצא קבועה אחת (מרכז היעד כולו, searchOrigin) - בדיוק כמו
      // בטיול יומי *לפני* שהוא קיבל origin/cursor נודד. עכשיו, בדיוק כמו
      // בטיול יומי: מהתחנה השנייה של כל יום והלאה, החיפוש מוגבל לרדיוס
      // צר (INTER_STOP_RADIUS_KM) **מהתחנה הקודמת בפועל באותו יום** - לא
      // ממרכז העיר. dayCursors עוקב אחרי המיקום האחרון שנבחר בכל יום.
      const excludePlaceIdsForVacation = [...excludePlaceIds];
      let mustSeeCursor = 0;
      // תיקון באג אמיתי (בקשה מפורשת - "יש מאגר עם מאות אטרקציות...
      // למה לא להשתמש בזה?? יוצא מקומות מוזרים כמו Magdala"): קודם *כל*
      // סלוט role="attraction" קיבל עדיפות מוחלטת לרשימת mustSeePlaces
      // (הצעות Claude + אימות/יצירה מול Google) - בלי קשר לכמה כאלה כבר
      // שובצו, ובלי לתת שום סיכוי למאגר הפנימי המתויג/האצור שלנו (שכן
      // עדיפות ראשונה בכל role אחר - food/nightlife). "אתרי חובה" נועד
      // ל-1-2 אתרים באמת איקוניים שאסור לפספס (כמו מגדל אייפל) - לא
      // מקור ראשי לכל תחנה. עכשיו מוגבל למספר קטן קבוע; מעבר לזה, סלוטי
      // "attraction" עוברים לנתיב הרגיל (fetchCandidatePool על המאגר
      // הפנימי, בדיוק כמו כל role אחר) - ורק אם גם הוא ריק, התחנה נשמטת
      // בשקט (לא ממציאים ולא פונים ל-Google בשבילה).
      const MAX_MUST_SEE_STOPS = 2;
      let mustSeeAssignedCount = 0;
      const INTER_STOP_RADIUS_KM = 5;
      // תיקון באג אמיתי (בקשה מפורשת - "מסלול קפץ בין תל אביב לצפון בין
      // ימים שונים"): בלי זה, התחנה הראשונה של *כל* יום שעדיין אין לו
      // dayCursor הייתה מחפשת סביב searchOrigin ברדיוס destinationMaxDistanceKm -
      // שזה בפועל כל רדיוס הנסיעה המקסימלי מהשאלון (יכול להגיע ל-150+
      // ק"מ). כלומר כל יום "מגריל" עוגן עצמאי בתוך רדיוס ענק, בלי שום
      // קשר ליום הקודם או ללינה - זו הסיבה שימים שונים באותו סופ"ש יצאו
      // רחוקים זה מזה עשרות ק"מ. בסופ"ש עם לינה קבועה לכל הטיול, התחנה
      // הראשונה של כל יום שאין לו עדיין עוגן מחפשת סביב הלינה עצמה,
      // ברדיוס סביר (לא כל רדיוס הנסיעה המקסימלי) - לא סביב searchOrigin.
      const WEEKEND_DAY_ANCHOR_RADIUS_KM = 20;
      const dayCursors = new Map<number, LatLng>();
      if (centralNeighborhood) {
        dayCursors.set(1, centralNeighborhood.coords);
      }
      // TypeScript לא שומר על הצרות הטיפוס (user לא null, בדיקה למעלה בקובץ)
      // בתוך פונקציה מקוננת (closure) שמוגדרת ונקראת בהמשך - מגבלה ידועה,
      // לא באג אמיתי. משתנה עזר פשוט פותר את זה.
      const userId = user.id;

      /**
       * ממלאת קבוצת תחנות נתונה (יום 1 לבד, או שאר הימים יחד) - קודם
       * מהמאגר הפנימי (fetchCandidatePool/fetchNightlifeCandidatePool +
       * rankCandidatesFast, דטרמיניסטי ומהיר, בלי AI), ורק למה שנשאר -
       * קריאת AI אחת מרוכזת (generateVacationItinerary), מוגבלת לימים
       * שבאמת מיוצגים בקבוצה שהועברה. משתפת mustSeeCursor/
       * excludePlaceIdsForVacation/dayCursors עם קריאות קודמות (state
       * חיצוני, לא מאותחל כאן) - כדי שאתר-חובה/מקום/מוצא לא "יתפוס"
       * פעמיים בין יום 1 לשאר הימים.
       */
      async function fillStopsFromPoolThenAi(stopsToFill: TripBuilderStop[]): Promise<void> {
        const remainingStops: TripBuilderStop[] = [];

        for (const stop of stopsToFill) {
          const day = stop.day_index ?? 1;
          // אתרי חובה תופסים סלוטים מסוג "attraction" קודם לכל דבר אחר -
          // כל עוד יש עוד אתר חובה שלא נוצל, הוא זוכה לסלוט הבא, בלי לעבור
          // דרך fetchCandidatePool/rankCandidatesFast הרגילים בכלל.
          if (stop.role === "attraction" && mustSeeAssignedCount < MAX_MUST_SEE_STOPS && mustSeeCursor < mustSeePlaces.length) {
            const mustSee = mustSeePlaces[mustSeeCursor];
            if (!excludePlaceIdsForVacation.includes(mustSee.id)) {
              console.error("[auto-build DEBUG] אתר חובה משובץ לסלוט", {
                sessionId,
                day,
                mustSeeName: mustSee.name,
                mustSeeLat: mustSee.latitude,
                mustSeeLng: mustSee.longitude,
                dayOriginOverride,
                distanceFromLodgingKm: dayOriginOverride
                  ? Math.round(
                      Math.sqrt(
                        Math.pow((mustSee.latitude - dayOriginOverride.lat) * 111, 2) +
                          Math.pow((mustSee.longitude - dayOriginOverride.lng) * 111 * Math.cos((dayOriginOverride.lat * Math.PI) / 180), 2)
                      ) * 10
                    ) / 10
                  : null,
              });
              await likeStop(supabase, userId, stop.id, mustSee);
              // תיקון באג אמיתי (בקשה מפורשת - "התגית של היום לא רלוונטית
              // לאטרקציות שמופיעות!"): אתר-חובה תופס סלוט בלי קשר לקטגוריה
              // שתוכננה לו במקור (למשל "חופי ים" שClaude תכנן, אבל בפועל
              // האקרופוליס נכנס לשם) - אם לא מעדכנים את category בפועל,
              // deriveDayTitles (finalizeService.ts) ממשיך לגזור את כותרת
              // היום מהקטגוריה המתוכננת-אבל-לא-אמיתית, במקום ממה שבאמת נבחר.
              if (mustSee.tripTypeTags?.[0]) {
                await supabase.from("trip_builder_stops").update({ category: mustSee.tripTypeTags[0] }).eq("id", stop.id);
              }
              excludePlaceIdsForVacation.push(mustSee.id);
              dayCursors.set(day, { lat: mustSee.latitude, lng: mustSee.longitude });
              mustSeeCursor += 1;
              mustSeeAssignedCount += 1;
              continue;
            }
            mustSeeCursor += 1;
          }

          // בקשה מפורשת: תחנת "חיי לילה" נשלפת אך ורק דרך category="nightlife"
          // הראשי (fetchNightlifeCandidatePool) - לא trip_type_tags כמו כל
          // תחנה אחרת כאן. אם אין מועמד - התחנה נשמטת בשקט (לא ממציאים
          // חיי-לילה שלא קיימים אצלנו ביעד הזה). מחפשת קרוב לתחנה האחרונה
          // של אותו יום (לא כל היעד) - רדיוס קצת יותר רחב מרגיל כי מקומות
          // חיי-לילה נדירים יותר בכל אזור נתון.
          if (stop.role === "nightlife") {
            const nightlifeOrigin = dayCursors.get(day) ?? searchOrigin;
            const nightlifePool = await fetchNightlifeCandidatePool(supabase, {
              origin: nightlifeOrigin,
              radiusKm: dayCursors.has(day) ? INTER_STOP_RADIUS_KM * 2 : destinationMaxDistanceKm,
              excludePlaceIds: excludePlaceIdsForVacation,
            });
            const rankedNightlife = rankCandidatesFast(nightlifePool, dna, answers.freeText, attributeScoreMap, (answers as unknown as { childAgeBands?: string[] }).childAgeBands);
            const topNightlife = rankedNightlife[0];
            if (!topNightlife) {
              continue; // אין מקום חיי-לילה מתאים ביעד הזה - לא remainingStops (אין AI fallback לזה)
            }
            await likeStop(supabase, userId, stop.id, topNightlife);
            excludePlaceIdsForVacation.push(topNightlife.id);
            dayCursors.set(day, { lat: topNightlife.latitude, lng: topNightlife.longitude });
            continue;
          }

          // בקשה מפורשת: מסעדת יום 1 מחפשת עד 1 ק"מ מהשכונה המרכזית שאותרה
          // למעלה (לא מהמלון, לא ממרכז היעד הכללי) - אם השכונה לא אותרה,
          // נופלים חזרה לרדיוס/מוצא הרגילים של היעד במקום לפספס את התחנה.
          const isFirstDayFood = stop.day_index === 1 && stop.role === "food" && centralNeighborhood != null;
          const cursor = dayCursors.get(day);
          const searchParamsForStop = isFirstDayFood
            ? { origin: centralNeighborhood!.coords, maxDistanceKm: 1 }
            : cursor
              ? { origin: cursor, maxDistanceKm: INTER_STOP_RADIUS_KM }
              : session.trip_type === "weekend" && dayOriginOverride
                ? { origin: dayOriginOverride, maxDistanceKm: Math.min(destinationMaxDistanceKm, WEEKEND_DAY_ANCHOR_RADIUS_KM) }
                : { origin: searchOrigin, maxDistanceKm: destinationMaxDistanceKm };

          // תיקון באג קריטי אמיתי (בקשה מפורשת - "עדיין קופץ רחוק, למרות
          // שכל הרדיוסים המפורשים שחישבתי נראים נכונים"): "5h" כאן היה
          // אמור להיות "לא בשימוש בפועל" כי maxDistanceKm מפורש תמיד
          // גובר - נכון עבור החיפוש הראשון עצמו. אבל fetchCandidatePool
          // (candidatePoolService.ts) יש לו רשת-ביטחון פנימית משלו: אם
          // אין בכלל מועמדים ברדיוס הצר (maxDistanceKm), הוא מרחיב לבד
          // ל-distanceBandToRadiusKm(params.distanceBand) - כלומר "5h"
          // הקשיח היה הופך בשקט לרדיוס של 160 ק"מ (!) בכל פעם שהחיפוש
          // הצר לא מצא כלום (למשל קטגוריה נדירה בעיירה קטנה) - בדיוק מה
          // שגרם לתחנות ליפול רחוק (עד יגור/חיפה) בלי שום קשר לרדיוסים
          // שחושבו למעלה. בסופ"ש, מעבירים את distanceBand האמיתי שהמשתמש
          // בחר - כך שגם ה"רשת ביטחון" הפנימית הזו נשארת בגבול שהמשתמש
          // בפועל אישר, לא מתפרצת לכל הארץ.
          const effectiveDistanceBand: import("@/services/tripBuilder/types").DistanceBand =
            session.trip_type === "weekend" ? (answers as unknown as WeekendAnswers).distanceBand : "5h";

          let pool = await fetchCandidatePool(supabase, {
            category: stop.category,
            origin: searchParamsForStop.origin,
            distanceBand: effectiveDistanceBand,
            maxDistanceKm: searchParamsForStop.maxDistanceKm,
            maxPriceLevel: vacationBudgetToMaxPriceLevel((answers as unknown as { budgetPerPerson?: string }).budgetPerPerson),
            excludePlaceIds: excludePlaceIdsForVacation,
            requireKosher: dna?.kosher === true,
            requireAccessible: dna?.accessibility === true,
          });

          // רשת ביטחון: אם החיפוש הצר (סביב התחנה הקודמת) לא מצא כלום -
          // מרחיבים פעם אחת לרדיוס הרגיל של כל היעד, במקום לוותר על
          // התחנה. עדיף תחנה קצת רחוקה יותר מאשר לא להציג כלום.
          if (pool.length === 0 && !isFirstDayFood && cursor) {
            pool = await fetchCandidatePool(supabase, {
              category: stop.category,
              origin: searchOrigin,
              distanceBand: effectiveDistanceBand,
              maxDistanceKm: destinationMaxDistanceKm,
              maxPriceLevel: vacationBudgetToMaxPriceLevel((answers as unknown as { budgetPerPerson?: string }).budgetPerPerson),
              excludePlaceIds: excludePlaceIdsForVacation,
              requireKosher: dna?.kosher === true,
              requireAccessible: dna?.accessibility === true,
            });
          }

          if (pool.length === 0) {
            remainingStops.push(stop);
            continue;
          }

          // תיקון ביצועים (בקשה מפורשת - "יש הכל אצלי באדמין, למה AI לכל
          // תחנה?"): דירוג דטרמיניסטי מהיר (rankCandidatesFast, בלי שום
          // קריאת AI) מספיק כדי לבחור את המקום הכי מתאים מתוך המועמדים.
          const ranked = rankCandidatesFast(pool, dna, stop.note ? `${answers.freeText}. ${stop.note}` : answers.freeText, attributeScoreMap, (answers as unknown as { childAgeBands?: string[] }).childAgeBands);

          const top = ranked[0];
          if (!top) {
            remainingStops.push(stop);
            continue;
          }
          dayCursors.set(day, { lat: top.latitude, lng: top.longitude });

          await likeStop(supabase, userId, stop.id, top);
          excludePlaceIdsForVacation.push(top.id);
        }

        console.error("[auto-build] מילוי מהמאגר הפנימי לפני AI (חופשה/סופ\"ש)", {
          sessionId,
          tripType: session.trip_type,
          totalSlots: stopsToFill.length,
          filledFromDb: stopsToFill.length - remainingStops.length,
          remainingForAi: remainingStops.length,
        });

        // בקשה מפורשת וחוזרת ("רק במאגר!!! עם 1254 האטרקציות שיש לנו!! לא
        // משהו אחר!") - אחרי שהמקרה של "משרד נדל'ן" הופיע כתחנה (AI
        // שהמציא תוכן לא רלוונטי כי חיפוש המאגר לא מצא כלום), מסירים את
        // ה-AI fallback הזה **לגמרי**. אם המאגר (כולל הרדיוס הרחב יותר,
        // ר' fetchCandidatePool למעלה) לא הצליח למלא תחנה - היא פשוט
        // נשמטת מהמסלול, לא מומצאת. עדיף יום עם קצת פחות תחנות מאשר תחנה
        // לא רלוונטית/לא אמיתית. הערה: זה שונה במפורש מ-must-see landmarks
        // (findMustSeePlaces) - שם יצירה דרך Google עדיין קורית, כי היא
        // מאמתת מקום אמיתי מ-Google Places, לא ממציאה תוכן כמו כאן.
        if (remainingStops.length > 0) {
          console.error("[auto-build] תחנות נשמטו - לא נמצאו במאגר (בלי AI fallback, לפי בקשה מפורשת)", {
            sessionId,
            skippedCount: remainingStops.length,
            skipped: remainingStops.map((s) => ({ day: s.day_index, role: s.role, category: s.category })),
          });
        }
      }

      // "כוונת הטיול" (tripIntent) - מחשבים במקביל למילוי יום 1 (לא ברצף
      // לפניו), כדי שיום 1 לא יחכה לקריאת Claude נוספת סתם.
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

      const day1Stops = pendingStops.filter((s) => s.day_index === 1);
      // מכיוון ש-buildMultiDayVacationPlan כבר לא מייצר ימים "רגילים"
      // מראש (ר' categoryPlanService.ts) - pendingStops בשלב הזה מכיל רק
      // יום 1 ויום אחרון. ימים "רגילים" (2..numDays-1) נבנים דינמית למטה.
      const lastDayStops = pendingStops.filter((s) => s.day_index !== null && s.day_index !== 1);

      await fillStopsFromPoolThenAi(day1Stops);
      tripIntent = await tripIntentPromise;

      // שמירה חלקית: יום 1 בלבד, status נשאר "building" - זה מה שמאפשר
      // לעמוד התוצאה להציג אותו תוך שניות, לפני ששאר הימים מוכנים
      // (רק בחופשה בחו"ל - לסופ"ש אין ריבוי ימים משמעותי שמצדיק את זה).
      let latestItinerary: Awaited<ReturnType<typeof finalizeItinerary>> | null = null;
      if (session.trip_type === "abroad_vacation" && day1Stops.length > 0) {
        latestItinerary = await finalizeItinerary(
          supabase,
          sessionId,
          searchOrigin,
          (answers as unknown as { budgetPerPerson?: string }).budgetPerPerson ?? "unlimited",
          answers.durationBand,
          tripIntent,
          answers.freeText,
          false
        );
      }

      // Context Engine - נבנה פעם אחת כאן (אחרי שיש כבר destinationName/
      // centralNeighborhood/searchOrigin), נשמר על ה-session, ומועבר
      // (לא נבנה מחדש) לכל קריאת Blueprint של יום למטה.
      //
      // תיקון באג אמיתי (נמצא בלוג בפועל - startDate/endDate ריקים!):
      // countDays כבר כולל ברירת מחדל חכמה (5 ימים) כשהתאריכים ריקים/לא
      // תקינים - זו בדיוק הפונקציה ש-sessions/route.ts כבר משתמש בה
      // ליצירת יום 1/יום אחרון. הגרסה הקודמת כאן עקפה את ברירת המחדל הזו
      // עם תנאי משלה שהחזירה 1 במקום זאת - מה שגרם לחוסר-התאמה בין מספר
      // הימים שבאמת נבנה (5, מה-session) למספר שה-Blueprint loop ראה (1) -
      // וזו הסיבה שהלולאה דילגה על עצמה לגמרי. עכשיו קוראים ל-countDays
      // ישירות, בלי שכבת "תיקון" משלי - מבטיח התאמה מלאה בין שני המקומות.
      const vacationDates = answers as unknown as { startDate?: string; endDate?: string };
      const numDays = countDays(vacationDates.startDate ?? "", vacationDates.endDate ?? "");
      const includesNightlife = vacationTypeValues.includes("nightlife");

      // לוג אבחון זמני (בקשה מפורשת - "זה נעלם שוב, למה?") - כדי לדעת
      // בוודאות אם הבעיה היא ש-numDays יוצא נמוך מדי, או שמשהו אחר קורה
      // בתוך הלולאה עצמה. יישאר עד שהבאג הזה ייסגר סופית.
      console.error("[auto-build] בדיקת numDays לפני לולאת Blueprint", {
        sessionId,
        startDate: vacationDates.startDate,
        endDate: vacationDates.endDate,
        numDays,
        willRunBlueprintLoop: numDays > 2,
      });

      // בקשה מפורשת ("תעשה שגיאות גלויות באפליקציה") - כל תקלה בבניית יום
      // "רגיל" נאספת כאן, ומוזרקת ל-warnings של המסלול הסופי (finalizeItinerary
      // extraWarnings) - נראה בעמוד התוצאה עצמו, בלי צורך בטרמינל בכלל.
      const dayBuildWarnings: string[] = [];
      if (numDays <= 2) {
        dayBuildWarnings.push(
          `לא נבנו ימים "רגילים" - numDays חושב כ-${numDays} (startDate="${vacationDates.startDate}", endDate="${vacationDates.endDate}")`
        );
      }

      if (numDays > 2) {
        const contextWeatherSummary = await getWeatherSummary(origin.lat, origin.lng);
        // תיקון באג אמיתי (בקשה מפורשת - "למה אין התייחסות למלל החופשי??
        // ביקשתי אטרקציות, חיי לילה וחופים!"): buildVacationContext קורא
        // רק answers.vacationTypes - שדה ששייך לחופשה בחו"ל בלבד. בסופ"ש
        // השדה נקרא weekendStyles (אותו רעיון, שם אחר - ר' הערה דומה
        // ב-vacationDestinationName קודם בקובץ הזה) - ה-cast הגולמי ל-
        // AbroadVacationAnswers לא "ממפה" בין השמות, כך ש-vacationTypes
        // יצא [] תמיד עבור סופ"ש, גם כשהמשתמש בחר "חיי לילה"/"חופים"
        // בפירוש. Context Engine (buildVacationContext) מזין את זה ישירות
        // ל-focusCategories/effectiveVacationTypes של כל קריאת Blueprint
        // ליום - כך שהסגנונות שהמשתמש בחר מעולם לא הגיעו לתכנון הימים
        // בפועל, רק freeText (שכן הגיע, אבל בלי vacationTypes לחזק אותו).
        const weekendAnswersForContext = answers as unknown as { vacationTypes?: string[]; weekendStyles?: string[] };
        const contextAnswers = {
          ...(answers as unknown as AbroadVacationAnswers),
          vacationTypes: weekendAnswersForContext.vacationTypes ?? weekendAnswersForContext.weekendStyles ?? [],
        };
        const vacationContext = buildVacationContext({
          answers: contextAnswers,
          dna,
          destinationName,
          numDays,
          centralNeighborhoodName: centralNeighborhood?.name ?? null,
          weatherSummary: contextWeatherSummary,
        });
        await supabase.from("trip_builder_sessions").update({ vacation_context: vacationContext }).eq("id", sessionId);

        // תיקון באג אמיתי (נמצא בלוגים בפועל): trip_builder_stops.slot_index
        // ייחודי לכל ה-session (constraint DB: trip_builder_stops_session_id_slot_index_key),
        // לא רק בתוך אותו יום. קודם העברתי startOrder=0 קבוע לכל יום "רגיל" -
        // זה התנגש עם slot_index שכבר תפוס (יום 1/יום אחרון, ובין ימים
        // "רגילים" זה עם זה). עכשיו שומרים מונה רץ אחד שממשיך מהערך הגבוה
        // ביותר שכבר קיים ב-session.
        let nextSlotOrder = Math.max(0, ...pendingStops.map((s) => s.slot_index + 1));

        // ימים "רגילים" (לא 1, לא אחרון) - job נפרד לכל יום, ברצף: Blueprint
        // (AI, עד 5 שניות עם fallback דטרמיניסטי) → תרגום ל-slots בפועל →
        // מילוי מהמאגר → שמירה חלקית. כל יום שמופיע כאן "נדלק" בעמוד
        // התוצאה מסקלטון לתוכן אמיתי ברגע שהוא מוכן - לא רק בקפיצה אחת
        // מיום 1 לכל השאר.
        const previousDayTitles: string[] = [latestItinerary?.dayTitles?.["1"] ?? "נחיתה והיכרות"];

        for (let day = 2; day < numDays; day++) {
          console.error("[auto-build] מתחיל יום Blueprint", { sessionId, day, numDays });
          try {
            const blueprint = await generateDayBlueprint(vacationContext, day, previousDayTitles);
            previousDayTitles.push(blueprint.title);

            const dayPlan = categoryPlanForDay(blueprint, day, nextSlotOrder, includesNightlife);
            nextSlotOrder += dayPlan.length;
            const dayStops = await appendDayStops(supabase, sessionId, dayPlan);
            await fillStopsFromPoolThenAi(dayStops);

            latestItinerary = await finalizeItinerary(
              supabase,
              sessionId,
              searchOrigin,
              (answers as unknown as { budgetPerPerson?: string }).budgetPerPerson ?? "unlimited",
              answers.durationBand,
              tripIntent,
              answers.freeText,
              false
            );
          } catch (dayError) {
            // בקשה מפורשת - יום בודד שנכשל לא אמור "לבלוע" בשקט את כל
            // שאר הימים (לפני התיקון הזה, שגיאה כאן הייתה קופצת ישר
            // ל-catch הכללי של כל ה-route ומדלגת על יום 5 + שאר הימים).
            // רושמים את השגיאה המדויקת - גם ללוג, גם לרשימה שתופיע
            // בפועל למשתמש בעמוד התוצאה (warnings) - וממשיכים ליום הבא.
            const dayErrorMessage = dayError instanceof Error ? dayError.message : String(dayError);
            console.error("[auto-build] יום Blueprint בודד נכשל - ממשיכים לימים הבאים", {
              sessionId,
              day,
              message: dayErrorMessage,
            });
            dayBuildWarnings.push(`יום ${day} נכשל בבנייה: ${dayErrorMessage}`);
          }
        }
      }

      await fillStopsFromPoolThenAi(lastDayStops);

      const itinerary = await finalizeItinerary(
        supabase,
        sessionId,
        searchOrigin,
        (answers as unknown as { budgetPerPerson?: string }).budgetPerPerson ?? "unlimited",
        answers.durationBand,
        tripIntent,
        answers.freeText,
        true,
        dayBuildWarnings
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
      if (answers.companions?.length) questionnaireSummaryParts.push(`הרכב מטיילים: ${answers.companions.join(", ")}`);
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
