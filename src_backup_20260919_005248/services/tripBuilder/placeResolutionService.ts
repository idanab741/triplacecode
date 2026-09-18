import { geocodePlaceNameNear } from "./geocodingService";
import { findPlaceStatusAndPhoto } from "./placePhotoService";
import { findExistingPlace } from "./aiPlaceInsertionService";
import { logAiError } from "@/services/ai/claudeService";
import { haversineDistanceKm } from "./geo";
import { downloadAndStoreLegacyPhoto } from "@/services/places/legacyPhotoStorageService";
import type { createAdminClient } from "@/services/supabase/admin";
import type { CandidatePlace, LatLng, StopRole } from "./types";

// ירדתי מ-5 ל-2: 5 ביקורות פסל בפועל בדיוק את סוג המקומות הלא-פורמליים
// שהמשתמש מבקש לפעמים במפורש (עגלת קפה ברחוב, דוכן, קיוסק) - למקום כזה
// לרוב אין נוכחות עסקית מסודרת בגוגל. "exists" (למעלה) כבר מוודא שהמקום
// אמיתי; הסף הזה הוא רק הגנה נוספת, לא ההגנה העיקרית נגד המצאות.
const MIN_RATING_COUNT = 2;
const MIN_RATING = 4.0;

/**
 * מחפש תמונה עם השם המלא + האזור; אם לא נמצא (למשל כי הניסוח לא תואם
 * בדיוק את מה שגוגל מזהה) - מנסה שוב עם השם בלבד, בלי האזור. בלי הגיבוי
 * הזה, מקומות אמיתיים לגמרי היו נשארים בלי תמונה רק כי הניסוח המדויק
 * לא התאים.
 */
async function findPlacePhotoReferenceWithFallback(name: string, areaLabel: string) {
  const primary = await findPlaceStatusAndPhoto(`${name} ${areaLabel}`);
  if (primary.exists) return primary;
  return findPlaceStatusAndPhoto(name);
}

export interface AiSuggestedPlaceInput {
  name: string;
  category: string;
  role: StopRole;
  reason: string;
  /** דקות שהייה משוערות - ברירת מחדל 90 לאטרקציה, 75 לאוכל, אם לא סופק. */
  estimatedVisitMinutes?: number;
}

/**
 * הופך שם מקום שClaude הציע (טקסט בלבד) למקום אמיתי ומאומת - או null אם
 * המקום נדחה. זהו מנוע ההגנה המרכזי נגד "המצאות": בלי שלב הזה, כל שם
 * שClaude כותב היה נכנס למסלול כאילו הוא אמיתי, גם אם הוא לא קיים בפועל.
 *
 * שלבי הבדיקה, לפי סדר:
 * 1. אם המקום כבר קיים ב-DB (מטיול/משתמש קודם) - משתמשים בו ישירות,
 *    ומדלגים לגמרי על קריאות Google (מהיר יותר, חוסך קרדיטים).
 * 2. גיאוקודינג + Google Places Text Search במקביל.
 * 3. פוסלים אם: אין קואורדינטות, רחוק מדי מהאזור, סגור (זמנית/לצמיתות),
 *    Google לא מצא מקום כזה בכלל (exists=false - חשד חזק להמצאה), אין
 *    לו אף תמונה בגוגל, או שיש לו פחות מ-5 ביקורות.
 * 4. שם המקום הסופי - השם הרשמי שגוגל מחזיר (מאומת), לא הניחוש של Claude.
 */
export type ResolvedAiPlace = CandidatePlace & { role: StopRole };

export async function resolveAiSuggestedPlace(
  supabase: ReturnType<typeof createAdminClient>,
  item: AiSuggestedPlaceInput,
  areaLabel: string,
  areaOrigin: LatLng,
  maxDistanceKm: number
): Promise<ResolvedAiPlace | null> {
  const existing = await findExistingPlace(supabase, item.name, areaLabel);
  // חשוב: findExistingPlace לא בודק מרחק בכלל (מחזיר distanceKm:0 קבוע) -
  // אם שם דומה כבר קיים ב-DB ממקום/משתמש/session אחר לגמרי (גם רחוק
  // מאוד), הוא היה מוחזר בלי שום בדיקת מרחק. זה בדיוק מה שגרם לתחנות
  // רחוקות (למשל כנרת) להיכנס למסלול למרות maxDistanceKm קטן.
  if (existing && haversineDistanceKm(areaOrigin, { lat: existing.latitude, lng: existing.longitude }) > maxDistanceKm) {
    logAiError("מקום קיים ב-DB נמצא, אבל רחוק מדי מהיעד הנוכחי - מתעלמים ובודקים כמקום חדש", {
      name: item.name,
      existingLat: existing.latitude,
      existingLng: existing.longitude,
    });
  } else if (existing) {
    if (existing.imageUrls.length === 0) {
      const backfill = await findPlacePhotoReferenceWithFallback(existing.name, areaLabel);
      if (backfill.photoRef) {
        // שומרים לצמיתות אצלנו, במקום URL "עצלן" שהיה גובה מגוגל שוב בכל
        // צפייה עתידית של כל משתמש בכל טיול - זה בדיוק מה שגרם לרוב
        // חיוב ה-Places Photo בפועל, כי הפונקציה הזו רצה בכל בניית מסלול.
        const imageUrl = await downloadAndStoreLegacyPhoto(backfill.photoRef, `trip-places/${existing.name}-${Date.now()}.jpg`);
        if (imageUrl) {
          await supabase.from("places").update({ image_urls: [imageUrl] }).eq("id", existing.id);
          existing.imageUrls = [imageUrl];
        }
      }
    }
    return { ...existing, role: item.role, reason: item.reason };
  }

  // תמונה/קיום/מיקום נשלפים באותה קריאה אחת ל-Places Text Search - מדויק
  // משמעותית מ-geocodePlaceNameNear (Geocoding API, מיועד לכתובות רחוב, לא
  // לעסקים לא-רשמיים כמו עגלת קפה בתוך פארק - זה בדיוק מה שגרם למיקומים
  // שגויים בפועל: היו שתי קריאות API נפרדות, לשני עסקים/פרשנויות שונות).
  // geocodePlaceNameNear נשאר רק כ-fallback אם Places לא סיפק קואורדינטות.
  const photoResult = await findPlacePhotoReferenceWithFallback(item.name, areaLabel);

  let coords: LatLng | null =
    photoResult.latitude != null && photoResult.longitude != null
      ? { lat: photoResult.latitude, lng: photoResult.longitude }
      : null;

  // קריטי: אם Places Text Search כן מצא מקום אמיתי בשם הזה, אבל הוא רחוק
  // מדי - זה כמעט תמיד סימן שהשם קיים במקום אחר לגמרי (למשל "גן לאומי
  // מגדל צדק" ליד ראש העין, כשמחפשים ליד "מגדל" בכנרת), לא שהחיפוש
  // "פספס" מיקום קרוב. בעבר קוד קפץ כאן ל-geocodePlaceNameNear עם אותו
  // שם בדיוק - אבל Geocoding API עושה התאמה חלקית/מטושטשת, ויכול "לתפוס"
  // רק את חלק השם שהוא כן מזהה (כאן "מגדל") ולהחזיר קואורדינטות קרובות
  // לאזור בלי קשר בכלל למקום שגוגל אימת. זה יצר בפועל תחנות עם שם/תמונה/
  // דירוג אמיתיים (מהמקום הרחוק שנמצא) אבל קואורדינטות שגויות (מהניחוש
  // המטושטש) - נעצו על המפה במקום שהמקום בכלל לא נמצא בו. לכן: אם Places
  // כבר מצא ואימת מקום בשם הזה והוא רחוק מדי - פוסלים לגמרי, לא מנחשים
  // מיקום חלופי לאותו שם.
  if (coords) {
    const distanceKm = haversineDistanceKm(areaOrigin, coords);
    if (distanceKm > maxDistanceKm) {
      logAiError("מקום אומת ב-Places Text Search אבל רחוק מדי מהיעד - נפסל (לא ננחש מיקום חלופי לאותו שם)", {
        name: item.name,
        distanceKm: Math.round(distanceKm),
        maxDistanceKm,
      });
      return null;
    }
  } else {
    // Places לא החזיר קואורדינטות בכלל (לא רק "רחוק מדי") - כאן, ורק כאן,
    // הגיבוי ל-Geocoding עדיין הגיוני: אין לנו שום מיקום מאומת להשוות
    // אליו מרחק, אז ניסיון גיאוקודינג נפרד הוא תוספת מידע, לא ניחוש
    // שסותר מיקום שכבר אומת.
    coords = await geocodePlaceNameNear(`${item.name}, ${areaLabel}`, areaOrigin, maxDistanceKm);
  }

  if (!coords || photoResult.isClosed || !photoResult.exists) return null;

  if (!photoResult.photoRef) {
    logAiError("מקום קיים ב-Google אבל בלי תמונה - נפסל", { name: item.name });
    return null;
  }

  if (photoResult.ratingCount !== null && photoResult.ratingCount < MIN_RATING_COUNT) {
    logAiError("מקום מוצע עם מעט מדי ביקורות ב-Google - נפסל", {
      name: item.name,
      ratingCount: photoResult.ratingCount,
    });
    return null;
  }

  if (photoResult.rating !== null && photoResult.rating < MIN_RATING) {
    logAiError("מקום מוצע עם דירוג נמוך מ-4.0 ב-Google - נפסל", {
      name: item.name,
      rating: photoResult.rating,
    });
    return null;
  }

  // מקום אמיתי (עובר את כל הבדיקות למעלה) אבל מסוג עסק שלא הגיוני בשום
  // תפקיד מסלול (Claude "השאיל" שם של עסק אמיתי ותיאר אותו כמשהו שהוא
  // לא - למשל אכסניה שתוארה כשביל טבע). אלה סוגים שגוגל מחזיר בעצמו,
  // לא ניחוש - אם מקום מסומן ככה, זה כמעט תמיד סימן לתיאור שגוי, לא
  // רק "מיון גס מדי".
  const DISQUALIFYING_TYPES = new Set([
    "lodging", "hospital", "pharmacy", "bank", "atm", "gas_station",
    "car_repair", "car_dealer", "real_estate_agency", "insurance_agency",
    "lawyer", "accounting", "electrician", "plumber", "storage",
    "moving_company", "funeral_home", "cemetery", "school", "university",
    "local_government_office", "courthouse", "police", "fire_station", "post_office",
  ]);
  const disqualifyingMatch = photoResult.types.find((t) => DISQUALIFYING_TYPES.has(t));
  if (disqualifyingMatch) {
    logAiError("מקום מוצע הוא מסוג עסק שלא הגיוני לתפקיד מסלול - נפסל", {
      name: item.name,
      matchedType: disqualifyingMatch,
      allTypes: photoResult.types,
      requestedRole: item.role,
    });
    return null;
  }

  // תפקיד "attraction" (אתר/מסלול/נקודת עניין) - הבעיה ההפוכה: לא סוג
  // "אסור" ספציפי, אלא **שום סימן טוב בכלל**. עסק רגיל (חנות, משרד,
  // ספק שירותים עסקי) שגוגל לא הצליח לסווג לשום קטגוריה ספציפית מקבל
  // רק "store"/"point_of_interest"/"establishment" גנריים - בדיוק המקרה
  // שבו Claude "שאל" שם עסק אמיתי (עובר את בדיקת ה-exists) וכתב לו תיאור
  // מומצא של אתר טבע/תצפית. תפקידי food/coffee/bar/spa לא עוברים את
  // הבדיקה הזו - יש להם סוגי Google אמינים משלהם (restaurant/cafe/bar/spa).
  const ATTRACTION_LIKE_TYPES = new Set([
    "tourist_attraction", "park", "natural_feature", "museum", "art_gallery",
    "zoo", "aquarium", "amusement_park", "place_of_worship", "church",
    "hindu_temple", "mosque", "synagogue", "stadium", "shopping_mall",
    "campground", "rv_park", "beach", "hiking_area", "national_park",
    "landmark", "historical_landmark", "viewpoint", "lake", "river",
  ]);
  if (item.role === "attraction" && photoResult.types.length > 0) {
    const hasAttractionSignal = photoResult.types.some((t) => ATTRACTION_LIKE_TYPES.has(t));
    const onlyGenericTypes = photoResult.types.every((t) => t === "point_of_interest" || t === "establishment" || t === "store");
    if (!hasAttractionSignal && onlyGenericTypes) {
      logAiError("מקום מוצע כ'אטרקציה' אבל גוגל לא מסווג אותו כשום דבר תיירותי/טבעי - נפסל", {
        name: item.name,
        allTypes: photoResult.types,
      });
      return null;
    }
  }

  const resolvedName = photoResult.googleName ?? item.name;
  // שומרים לצמיתות אצלנו - אותו עיקרון כמו בענף ה-backfill למעלה.
  const storedPhotoUrl = await downloadAndStoreLegacyPhoto(photoResult.photoRef, `trip-places/${resolvedName}-${Date.now()}.jpg`);
  const imageUrls = storedPhotoUrl ? [storedPhotoUrl] : [];

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: resolvedName,
    category: item.category,
    subcategory: null,
    shortDescription: null,
    imageUrls,
    rating: photoResult.rating,
    ratingCount: photoResult.ratingCount,
    priceLevel: null,
    estimatedVisitMinutes: item.estimatedVisitMinutes ?? (item.role === "food" ? 75 : 90),
    latitude: coords.lat,
    longitude: coords.lng,
    distanceKm: 0,
    etaMinutes: 0,
    tripTypeTags: [item.category],
    cuisineTags: [],
    kosher: null,
    accessible: null,
    suitableChildAges: [],
    budgetTier: null,
    isAreaExperience: false,
    role: item.role,
    reason: item.reason,
  } as ResolvedAiPlace;
}

/**
 * חיפוש ישיר לפי שם עסק ספציפי שהמשתמש ביקש במפורש (tripIntent.requestedPlaceName,
 * למשל "עדיפות במסעדת מלכה") - עוקף לגמרי סינון קטגוריה/trip_type_tags, כי
 * המשתמש כבר אמר בדיוק מה הוא רוצה; אין טעם לסנן לפי תיוג כשיש שם מדויק.
 * שונה מ-findExistingPlace (שלא בודק מרחק בכלל) - כאן המרחק מהאזור המבוקש
 * הוא תנאי, כדי לא "לתפוס" עסק אחר עם שם דומה/זהה שנמצא בעיר אחרת לגמרי.
 * מחפש בכל הקטגוריות (לא רק "places" שכבר מתויגות למסעדות) כי ייתכן שהעסק
 * טרם תויג נכון בכלל - אם המשתמש נקב בשמו, זה כשלעצמו אישור שהוא המקום הנכון.
 */
export async function findRequestedPlaceNear(
  supabase: ReturnType<typeof createAdminClient>,
  requestedName: string,
  origin: LatLng,
  maxDistanceKm: number
): Promise<CandidatePlace | null> {
  const normalizedName = requestedName.trim();
  if (!normalizedName) return null;

  const { data } = await supabase
    .from("places")
    .select(
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier,is_area_experience"
    )
    .ilike("name", `%${normalizedName}%`)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(10);

  if (!data || data.length === 0) return null;

  // אם יש כמה תוצאות עם שם דומה (למשל רשת סניפים) - בוחרים את הקרוב ביותר
  // בפועל למקור, ולא סתם את הראשון שחזר מה-DB.
  let closest: (typeof data)[number] | null = null;
  let closestDistanceKm = Infinity;
  for (const row of data) {
    if (row.latitude == null || row.longitude == null) continue;
    const distanceKm = haversineDistanceKm(origin, { lat: row.latitude, lng: row.longitude });
    if (distanceKm < closestDistanceKm) {
      closestDistanceKm = distanceKm;
      closest = row;
    }
  }

  if (!closest || closestDistanceKm > maxDistanceKm) return null;

  return {
    id: closest.id,
    name: closest.name,
    category: closest.category,
    subcategory: closest.subcategory,
    shortDescription: closest.short_description,
    imageUrls: closest.image_urls ?? [],
    rating: closest.rating,
    ratingCount: closest.rating_count,
    priceLevel: closest.price_level,
    estimatedVisitMinutes: closest.estimated_visit_minutes,
    latitude: closest.latitude,
    longitude: closest.longitude,
    distanceKm: closestDistanceKm,
    etaMinutes: 0,
    tripTypeTags: closest.trip_type_tags ?? [],
    cuisineTags: closest.cuisine_tags ?? [],
    kosher: closest.kosher,
    accessible: closest.accessible,
    suitableChildAges: closest.suitable_child_ages ?? [],
    budgetTier: closest.budget_tier,
    isAreaExperience: closest.is_area_experience ?? false,
  } satisfies CandidatePlace;
}
