import { geocodePlaceNameNear } from "./geocodingService";
import { findPlaceStatusAndPhoto } from "./placePhotoService";
import { findExistingPlace } from "./aiPlaceInsertionService";
import { logAiError } from "@/services/ai/claudeService";
import type { createAdminClient } from "@/services/supabase/admin";
import type { CandidatePlace, LatLng, StopRole } from "./types";

const MIN_RATING_COUNT = 5;

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
  if (existing) {
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

  const [coords, photoResult] = await Promise.all([
    geocodePlaceNameNear(`${item.name}, ${areaLabel}`, areaOrigin, maxDistanceKm),
    findPlacePhotoReferenceWithFallback(item.name, areaLabel),
  ]);

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
