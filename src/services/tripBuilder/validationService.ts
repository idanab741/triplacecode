import type { FinalItineraryStop } from "./types";
import { haversineDistanceKm } from "./geo";
import { INFANT_UNSAFE_CATEGORIES } from "./candidatePoolService";

/**
 * תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 72/173 - Opening Hours):
 * מקור הנתונים אומת בפועל - placesCleaningService.ts ממלא opening_hours
 * מ-Google Places API הרשמי (regularOpeningHours.weekdayDescriptions,
 * שדה מתועד: מערך 7 מחרוזות "<Weekday>: <H:MM AM> – <H:MM PM>" / "Closed"
 * / "Open 24 hours", תמיד באנגלית מ-Google, סדר תמיד Monday-Sunday).
 * זה **לא** "פורמט לא מתועד" - יש כאן מקור אמין. אבל: (1) זה טקסט
 * בשפה טבעית, לא שעות מובנות - פרסור עלול להיכשל על תבניות לא-צפויות.
 * (2) לא כל השורות בהכרח עברו את הצינור הזה (admin-curated ישן, למשל).
 * לכן: הבדיקה הזו **fail-open** לחלוטין - כל אי-ודאות (פורמט לא מוכר,
 * יום חסר, שדה ריק) גורמת לדילוג שקט על התחנה הזו, לא לאזהרת "סגור"
 * שגויה. זו החלטה מכוונת: false negative (מפספסים מקום שבאמת סגור)
 * עדיף לאין שיעור על false positive (מזהירים בטעות על מקום פתוח).
 */
const WEEKDAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parseGoogleHoursLine(line: string): { openMinutes: number; closeMinutes: number } | null {
  // "9:00 AM – 6:00 PM" / "9:00 AM – 6:00 PM, 7:00 PM – 10:00 PM" (טווח כפול - לוקחים רק את הראשון, שמרני)
  const match = line.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–-]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  const to24 = (h: string, ampm: string) => {
    let hour = parseInt(h, 10);
    if (/PM/i.test(ampm) && hour !== 12) hour += 12;
    if (/AM/i.test(ampm) && hour === 12) hour = 0;
    return hour;
  };
  const openMinutes = to24(match[1], match[3]) * 60 + parseInt(match[2], 10);
  const closeMinutes = to24(match[4], match[6]) * 60 + parseInt(match[5], 10);
  return { openMinutes, closeMinutes };
}

/**
 * בודקת אם תחנה מגיעה בזמן שהמקום מוגדר סגור בו, לפי Google
 * weekdayDescriptions. Soft Warning בלבד (לא Hard Failure חוסם) - חוסר
 * הוודאות סביב כיסוי הנתונים/תרגום ימים (חג/מועד מיוחד) גדול מדי בשביל
 * לחסום Finalize על בסיס זה, לפי אותו עיקרון "עדיף להראות אזהרה מאשר
 * להפיל בנייה שלמה על ניחוש".
 */
export function detectOpeningHoursWarnings(stops: FinalItineraryStop[], tripStartDate?: string): string[] {
  if (!tripStartDate) return []; // fail-open: בלי תאריך התחלה אין דרך לדעת יום בשבוע בכלל
  const warnings: string[] = [];
  const startDate = new Date(tripStartDate);
  if (isNaN(startDate.getTime())) return []; // fail-open: תאריך לא תקין

  for (const stop of stops) {
    if (stop.specialType) continue;
    if (!stop.openingHours || stop.openingHours.length !== 7) continue; // fail-open: לא בפורמט הצפוי (7 ימים)

    const dayOffset = (stop.dayIndex ?? 1) - 1;
    const arrivalDate = new Date(startDate);
    arrivalDate.setDate(arrivalDate.getDate() + dayOffset);
    const jsWeekday = arrivalDate.getDay(); // 0=Sunday..6=Saturday
    const googleWeekdayName = WEEKDAY_ORDER[(jsWeekday + 6) % 7]; // JS Sunday=0 -> Google Monday-first index

    const dayLine = stop.openingHours.find((l) => l.startsWith(`${googleWeekdayName}:`));
    if (!dayLine) continue; // fail-open: לא מצאנו שורה תואמת ליום הזה

    if (/closed/i.test(dayLine)) {
      warnings.push(`התחנה "${stop.name}" מוגדרת סגורה ב${googleWeekdayName} (לפי הנתונים שלנו) - כדאי לוודא לפני היציאה.`);
      continue;
    }
    if (/24 hours/i.test(dayLine)) continue; // פתוח כל השעות - אין מה לבדוק

    const parsed = parseGoogleHoursLine(dayLine);
    if (!parsed) continue; // fail-open: פורמט לא מוכר

    const arrivalMinutesOfDay = 9 * 60 + stop.arrivalOffsetMinutes; // 9:00 = תחילת יום ברירת מחדל, כמו שאר המערכת
    if (arrivalMinutesOfDay < parsed.openMinutes || arrivalMinutesOfDay > parsed.closeMinutes) {
      warnings.push(
        `התחנה "${stop.name}" עשויה להיות סגורה בשעת ההגעה המשוערת (לפי שעות הפתיחה הידועות ל${googleWeekdayName}) - כדאי לבדוק לפני היציאה.`
      );
    }
  }

  return warnings;
}

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
  requirements?: { requireKosher?: boolean; requireAccessible?: boolean; childAgeBands?: string[]; lodgingCoords?: { lat: number; lng: number } | null }
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

    // תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 2/3 - "זמן נסיעה
    // לא מאפשר להגיע בזמן" / "משך ביקור חורג מהחלון"): arrivalOffsetMinutes
    // כבר מחושב במצטבר לאורך היום (נסיעה+ביקור, מתאפס בכל יום חדש -
    // finalizeService.ts) - עד עכשיו אף אחד לא בדק אם הסכום הזה בכלל
    // הגיוני. אם התחנה האחרונה ביום "מגיעה" אחרי 15 שעות מ-09:00 (=
    // חצות) - היום פשוט לא ריאלי מבחינת זמן, בלי קשר למרחק הבודד בין
    // תחנות (שכן יכול להיות תקין כשלעצמו, אבל בסך הכל - יותר מדי).
    const MAX_REASONABLE_DAY_MINUTES = 900; // 15 שעות מ-09:00 = חצות
    const lastStopOffset = Math.max(...dayStops.map((s) => s.arrivalOffsetMinutes));
    if (lastStopOffset > MAX_REASONABLE_DAY_MINUTES) {
      warnings.push(`יום ${day}: לפי זמני הנסיעה/ביקור המחושבים, היום הזה נמשך עד אחרי חצות - כנראה עמוס מדי בפועל.`);
    }

    // תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 5 - "Breakfast לא
    // מתאים לבוקר"): התחנה הראשונה בכל יום (אם role=coffee_dessert, כפי
    // שהמערכת אמורה להבטיח - ר' categoryPlanService.ts) חייבת להיות
    // בקטגוריה coffee_carts_cafes בפועל, לא רק בתכנון - defense-in-depth
    // למקרה שמנגנון אחר (Repair/Chat Edit/must-see) שינה אותה בדיעבד.
    const firstStop = dayStops[0];
    if (firstStop?.role === "coffee_dessert" && firstStop.category !== "coffee_carts_cafes") {
      warnings.push(`יום ${day}: התחנה הראשונה (בוקר) מתויגת "${firstStop.category}" ולא כבית קפה/עגלת קפה - ייתכן שאינה מתאימה לארוחת בוקר.`);
    }

    // תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 8 - "יום מפוזר
    // גיאוגרפית"): שונה מ-40km Rule (שבודק רק תחנות *עוקבות*) - כאן
    // בודקים את המרחק בין שתי התחנות **הרחוקות ביותר זו מזו** באותו יום
    // (לא בהכרח עוקבות) - יום יכול לעבור את בדיקת ה-40km הרגילה (כל
    // קפיצה בודדת סבירה) ועדיין להיות "מפושט" על פני שטח גדול מדי בסך
    // הכל (למשל: A->B->C->A, כשA ו-C רחוקים 60 ק"מ אבל B באמצע מקרב).
    const MAX_DAY_SPREAD_KM = 60;
    let maxSpreadKm = 0;
    for (let i = 0; i < dayStops.length; i++) {
      for (let j = i + 1; j < dayStops.length; j++) {
        const d = haversineDistanceKm(
          { lat: dayStops[i].latitude, lng: dayStops[i].longitude },
          { lat: dayStops[j].latitude, lng: dayStops[j].longitude }
        );
        if (d > maxSpreadKm) maxSpreadKm = d;
      }
    }
    if (maxSpreadKm > MAX_DAY_SPREAD_KM) {
      warnings.push(`יום ${day}: התחנות פרושות על פני כ-${Math.round(maxSpreadKm)} ק"מ בסך הכל - ייתכן שהיום מפוזר גיאוגרפית יותר מהרצוי.`);
    }

    // תיקון פער אמיתי (Audit מול MASTER SPEC Breaker 18 - "סתירת לינה"):
    // שונה מ-40km/Day Spread - בודק במפורש מרחק מה-BASE/הלינה עצמה (לא
    // רק בין תחנות זו לזו). רשת ביטחון נוספת - אם dayOriginOverride/
    // WEEKEND_LODGING_TRIP_RADIUS_KM עבדו נכון בזמן הבנייה, זה לא אמור
    // לקרות; זו בדיקה עצמאית אחרי העובדה, לא תלויה בהנחה שהמנגנון ההוא תקין.
    if (requirements?.lodgingCoords) {
      const MAX_DISTANCE_FROM_LODGING_KM = 50;
      for (const s of dayStops) {
        const distanceFromLodging = haversineDistanceKm(requirements.lodgingCoords, { lat: s.latitude, lng: s.longitude });
        if (distanceFromLodging > MAX_DISTANCE_FROM_LODGING_KM) {
          warnings.push(`התחנה "${s.name}" (יום ${day}) נמצאת כ-${Math.round(distanceFromLodging)} ק"מ מהלינה - רחוקה מהמצופה.`);
        }
      }
    }
  }

  // תיקון (Audit מול "תיקון חשוב מאוד להגדרת ה-Food Quota" - "אסור ש-
  // wineries_dining ייכנס ל-attraction role"): הגנה-בעומק אחרונה על
  // המסלול הסופי בפועל - אם משום מה תחנת מסעדה/יין הגיעה לכאן מתויגת
  // כ-role="attraction" (למשל דרך עריכה ידנית/Chat Edit שלא עברה דרך
  // categoryPlanForDay), מזהירים על כך במפורש.
  for (const stop of realStops) {
    if (stop.category === "wineries_dining" && stop.role === "attraction") {
      warnings.push(`התחנה "${stop.name}" היא מסעדה/יין (wineries_dining) אבל מתויגת כאטרקציה - ייתכן שהיא נספרת בטעות כפעילות ולא כארוחה.`);
    }
  }

  // תיקון ארכיטקטוני (Audit מול "בחן מחדש את כל מנגנון בניית המסלול" -
  // "18. Quality Evaluator... WHY DOES EACH STOP EXIST?"): בדיקת התאמה
  // דטרמיניסטית (לא AI - ר' qualityCheckService.ts לבדיקת האיכות
  // המבוססת-AI, נפרדת ולא-חוסמת) בין ה-SlotRequirements שנקבעו ל-Slot
  // בזמן התכנון (categoryPlanForDay) לבין המקום שבפועל נבחר עבורו.
  // הגנה-בעומק: Retrieval (candidatePoolService.ts) כבר אמור למנוע חלק
  // מזה מראש - זו בדיקה עצמאית *אחרי העובדה*, לא תלויה בהנחה שהמסנן שם
  // תמיד רץ (למשל תחנה שהוזנה/הוחלפה ידנית דרך Chat Edit/Swap, שלא
  // תמיד מעבירים requirements/hasInfant הלאה - ר' "Remaining Problems").
  for (const stop of realStops) {
    if (stop.requirements?.infantSafe && INFANT_UNSAFE_CATEGORIES.has(stop.category)) {
      warnings.push(
        `התחנה "${stop.name}" תויגה כ-Slot שדורש infantSafe (יש תינוק בטיול), אבל הקטגוריה שלה (${stop.category}) אינה מתאימה לתינוק.`
      );
    }
    if (
      stop.requirements?.mealType &&
      stop.requirements.mealType !== "breakfast" &&
      stop.role !== "food"
    ) {
      warnings.push(
        `התחנה "${stop.name}" נועדה למלא ארוחת ${stop.requirements.mealType === "lunch" ? "צהריים" : "ערב"} אבל אינה מתויגת role="food" בפועל.`
      );
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

export function validateFinalItinerary(
  stops: FinalItineraryStop[],
  /**
   * תיקון פער אמיתי (Audit מול המסמך "המסלול שמתקבל כרגע אינו תקין",
   * סעיף 11/18 - "Category Quotas הם Hard Constraint" / "Layer 3 - Final
   * Validation"): המסמך דורש במפורש `restaurant_count > 1 -> INVALID`,
   * לא Warning. attemptFoodQuotaRepair (repairService.ts) כבר אמור
   * להבטיח את זה **בפועל** לפני שמגיעים לכאן (עם הסרה כרשת ביטחון גם
   * בלי מועמד תחליף) - זו בדיקת הגנה-בעומק (defense-in-depth) בלבד:
   * אם משום מה ה-Repair לא רץ/לא הצליח, זו רשת הביטחון האחרונה שבאמת
   * **חוסמת** (throw), לא רק מזהירה - בדיוק כמו שאר הבדיקות המבניות
   * למעלה בפונקציה הזו. undefined = לא נבדק (מסלול יום-אחד, שאין לו
   * "מכסת מסעדות ליום" רלוונטית בכלל).
   */
  foodQuotaCheck?: { maxFoodPerDay: number }
): ItineraryValidationResult {
  const errors: string[] = [];

  if (stops.length === 0) {
    errors.push("המסלול שנבנה ריק - אין אף תחנה עם place תקין.");
  }

  if (foodQuotaCheck) {
    const foodCountByDay = new Map<number, number>();
    for (const stop of stops) {
      if (stop.specialType || stop.dayIndex == null || stop.role !== "food") continue;
      foodCountByDay.set(stop.dayIndex, (foodCountByDay.get(stop.dayIndex) ?? 0) + 1);
    }
    for (const [day, count] of foodCountByDay) {
      if (count > foodQuotaCheck.maxFoodPerDay) {
        errors.push(
          `יום ${day}: ${count} מסעדות מתוכננות - חורג ממכסת ${foodQuotaCheck.maxFoodPerDay} המסעדות המקסימלית ליום (חופשה אינה רשימת מסעדות).`
        );
      }
    }
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
