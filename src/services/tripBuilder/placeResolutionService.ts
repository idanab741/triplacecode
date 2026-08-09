import { geocodePlaceNameNear } from "./geocodingService";
import { findPlaceStatusAndPhoto } from "./placePhotoService";
import { findExistingPlace } from "./aiPlaceInsertionService";
import { logAiError } from "@/services/ai/claudeService";
import { haversineDistanceKm } from "./geo";
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
        const imageUrl = `/api/places/photo?ref=${encodeURIComponent(backfill.photoRef)}`;
        await supabase.from("places").update({ image_urls: [imageUrl] }).eq("id", existing.id);
        existing.imageUrls = [imageUrl];
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

  if (coords) {
    const distanceKm = haversineDistanceKm(areaOrigin, coords);
    if (distanceKm > maxDistanceKm) {
      logAiError("מיקום מ-Places Text Search רחוק מדי מהיעד - נופל ל-Geocoding כגיבוי", {
        name: item.name,
        distanceKm: Math.round(distanceKm),
        maxDistanceKm,
      });
      coords = null;
    }
  }

  if (!coords) {
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
  const imageUrls = [`/api/places/photo?ref=${encodeURIComponent(photoResult.photoRef)}`];

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
