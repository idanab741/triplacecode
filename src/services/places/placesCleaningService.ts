import type { GooglePlaceRaw } from "./googlePlacesService";
import { downloadAndStorePhoto } from "./photoStorageService";

/** מתחת לדירוג הזה, יעד לא נשמר. */
export const MIN_RATING = 3.5;

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export interface CleanPlaceRow {
  google_place_id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  city: string;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  estimated_visit_minutes: number | null;
  image_urls: string[];
  opening_hours: string[] | null;
  tags: string[];
  source: string;
}

/**
 * מנקה ומשלימה שדות חסרים ביעד גולמי מגוגל, ומורידה את התמונות שלו
 * פעם אחת בלבד לאחסון הקבוע שלנו (ראו photoStorageService).
 * מחזיר null אם היעד לא עומד בסף האיכות (בלי תמונה, או דירוג נמוך מדי).
 */
export async function cleanGooglePlace(
  raw: GooglePlaceRaw,
  category: string,
  city: string,
  country: string
): Promise<CleanPlaceRow | null> {
  const name = raw.displayName?.text?.trim();
  if (!name) return null;

  const photos = raw.photos ?? [];
  if (photos.length === 0) return null;

  const rating = raw.rating ?? null;
  if (rating !== null && rating < MIN_RATING) return null;

  const storedUrls = await Promise.all(
    photos.slice(0, 5).map((photo, index) =>
      downloadAndStorePhoto(photo.name, `places/${raw.id}/${index}.jpg`)
    )
  );
  const imageUrls = storedUrls.filter((url): url is string => url !== null);
  if (imageUrls.length === 0) return null;

  return {
    google_place_id: raw.id,
    name,
    category,
    subcategory: raw.primaryTypeDisplayName?.text ?? null,
    short_description: raw.editorialSummary?.text ?? null,
    city,
    country,
    address: raw.formattedAddress ?? null,
    latitude: raw.location?.latitude ?? null,
    longitude: raw.location?.longitude ?? null,
    rating,
    rating_count: raw.userRatingCount ?? null,
    price_level: raw.priceLevel ? PRICE_LEVEL_MAP[raw.priceLevel] ?? null : null,
    estimated_visit_minutes: null,
    image_urls: imageUrls,
    opening_hours: raw.regularOpeningHours?.weekdayDescriptions ?? null,
    tags: [],
    source: "google_places",
  };
}
