import { createAdminClient } from "@/services/supabase/admin";
import { ensurePlaceCategories } from "./placeCategories";
import {
  matchGooglePlaceByLocation,
  searchCityPlace,
  extractCityAndCountry,
  type GooglePlaceRaw,
} from "@/services/places/googlePlacesService";
import { downloadAndStorePhoto } from "@/services/places/photoStorageService";

/** מקום שנוצר ע"י משתמש (זרימת "מקום" ב-place's) - מסומן בנפרד כדי שאדמין יוכל לסנן/לאשר,
 *  ולא ייראה כתוכן שנאסף ע"י הצוות (google_places). */
export const USER_PLACE_SOURCE = "user_review";

export type UserPlaceCategory = "restaurant" | "attraction" | "nature" | "nightlife" | "hotel" | "shopping";

/** הקטגוריות בטופס "הוסיפו מקום" -> 5 הקטגוריות הראשיות המותרות ב-places.category. */
const CATEGORY_TO_PLACE_CATEGORY: Record<UserPlaceCategory, string> = {
  restaurant: "restaurants",
  attraction: "attractions",
  nature: "nature",
  nightlife: "nightlife",
  hotel: "hotels",
  shopping: "shopping",
};

export function isUserPlaceCategory(value: unknown): value is UserPlaceCategory {
  return typeof value === "string" && value in CATEGORY_TO_PLACE_CATEGORY;
}

const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface MatchInput {
  name: string;
  googlePlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  address?: string | null;
}

/** מוצא את המקום בגוגל. אם כבר ידוע google_place_id - מקבלים רק התאמה עם אותו id
 *  (חיפוש טקסט לא מובטח להחזיר את אותו מקום, ולא רוצים לערבב נתונים ממקום אחר). */
async function findGoogleMatch(input: MatchInput): Promise<GooglePlaceRaw | null> {
  try {
    const raw =
      input.latitude != null && input.longitude != null
        ? await matchGooglePlaceByLocation({ name: input.name, latitude: input.latitude, longitude: input.longitude })
        : await searchCityPlace(`${input.name} ${input.city ?? input.address ?? ""}`.trim());
    if (!raw) return null;
    if (input.googlePlaceId && raw.id !== input.googlePlaceId) return null;
    return raw;
  } catch {
    // Google לא זמין / אין מפתח - לא מפילים את הפעולה, פשוט לא משלימים.
    return null;
  }
}

/** השדות ש-Google מספק - אותם עקרונות כמו TripAdd (דירוג, נגישות, שעות פעילות, מחיר, תמונה) ולא ממציאים ערכים. */
function googleFields(raw: GooglePlaceRaw) {
  const accessible = raw.accessibilityOptions?.wheelchairAccessibleEntrance;
  return {
    rating: raw.rating ?? null,
    rating_count: raw.userRatingCount ?? null,
    price_level: raw.priceLevel ? (PRICE_LEVEL_MAP[raw.priceLevel] ?? null) : null,
    opening_hours: raw.regularOpeningHours?.weekdayDescriptions ?? null,
    accessible: accessible === undefined ? null : accessible,
    phone: raw.nationalPhoneNumber ?? null,
    website: raw.websiteUri ?? null,
    google_maps_url: raw.googleMapsUri ?? null,
    short_description: raw.editorialSummary?.text ?? null,
    subcategory: raw.primaryTypeDisplayName?.text ?? null,
    address: raw.formattedAddress ?? null,
  };
}

async function storeFirstPhoto(raw: GooglePlaceRaw): Promise<string | null> {
  const photoName = raw.photos?.[0]?.name;
  if (!photoName) return null;
  try {
    return await downloadAndStorePhoto(photoName, `places/${raw.id}/0.jpg`);
  } catch {
    return null;
  }
}

/**
 * מעדכן מקום קיים ב-places לפי Google, בכל פעם שמשתמש כותב עליו ביקורת:
 *  - דירוג ומספר דירוגים של גוגל: מתרעננים תמיד (אלא אם אדמין ערך את המקום ידנית).
 *  - שעות פעילות, נגישות, מחיר, טלפון, אתר, תיאור, תמונה: רק משלימים מה שחסר - לעולם לא דורסים
 *    מידע קיים (אותו עיקרון כמו "השלם עם Google" באדמין).
 * לעולם לא זורק - כשל בהשלמה לא אמור להכשיל פרסום ביקורת.
 */
export async function enrichPlaceFromGoogle(placeId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: place } = await supabase.from("places").select("*").eq("id", placeId).maybeSingle();
    if (!place) return;

    const raw = await findGoogleMatch({
      name: place.name,
      googlePlaceId: place.google_place_id,
      latitude: place.latitude,
      longitude: place.longitude,
      city: place.city,
      address: place.address,
    });
    if (!raw) return;

    const g = googleFields(raw);
    const patch: Record<string, unknown> = {};

    if (!place.google_place_id) patch.google_place_id = raw.id;
    if (!place.is_manually_edited) {
      if (g.rating !== null) patch.rating = g.rating;
      if (g.rating_count !== null) patch.rating_count = g.rating_count;
    }
    if ((!place.opening_hours || place.opening_hours.length === 0) && g.opening_hours?.length) patch.opening_hours = g.opening_hours;
    if (place.accessible === null || place.accessible === undefined) {
      if (g.accessible !== null) {
        patch.accessible = g.accessible;
        const tags: string[] = place.tags ?? [];
        if (g.accessible && !tags.includes("accessible")) patch.tags = [...tags, "accessible"];
      }
    }
    if (place.price_level == null && g.price_level !== null) patch.price_level = g.price_level;
    if (!place.phone && g.phone) patch.phone = g.phone;
    if (!place.website && g.website) patch.website = g.website;
    if (!place.google_maps_url && g.google_maps_url) patch.google_maps_url = g.google_maps_url;
    if (!place.short_description && g.short_description) patch.short_description = g.short_description;
    if (!place.subcategory && g.subcategory) patch.subcategory = g.subcategory;
    if (!place.address && g.address) patch.address = g.address;
    if ((!place.image_urls || place.image_urls.length === 0) && !place.has_user_photo) {
      const photo = await storeFirstPhoto(raw);
      if (photo) patch.image_urls = [photo];
    }

    if (Object.keys(patch).length > 0) {
      await supabase.from("places").update(patch).eq("id", placeId);
    }
  } catch (err) {
    console.error("[placeEnrichment] נכשל להשלים מקום מ-Google:", err);
  }
}

export interface CreatePlaceFromUserInput {
  name: string;
  /** מי הוסיף את המקום - נשמר ב-places.created_by (מיגרציה 0095), כדי שיופיע אצלו ב"שלי" במפה. */
  createdBy?: string;
  category: UserPlaceCategory;
  googlePlaceId?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
}

/** יוצר Place אמיתי מיד (בלי המתנה לאישור), או מחזיר את הקיים אם אותו google_place_id כבר קיים.
 *  אחרי היצירה משלים אותו מ-Google (תמונה, דירוג, נגישות, שעות). */
export async function createPlaceFromUser(input: CreatePlaceFromUserInput): Promise<{ id: string; name: string; existed: boolean }> {
  const supabase = createAdminClient();

  if (input.googlePlaceId) {
    const { data: existing } = await supabase
      .from("places")
      .select("id, name")
      .eq("google_place_id", input.googlePlaceId)
      .maybeSingle();
    if (existing) {
      await enrichPlaceFromGoogle(existing.id);
      await ensurePlaceCategories(existing.id as string).catch(() => 0);
      return { id: existing.id as string, name: existing.name as string, existed: true };
    }
  }

  const raw = await findGoogleMatch({
    name: input.name,
    googlePlaceId: input.googlePlaceId,
    latitude: input.latitude,
    longitude: input.longitude,
    address: input.address,
  });
  const { city, country } = raw ? extractCityAndCountry(raw) : { city: null, country: null };
  const placeCategory = CATEGORY_TO_PLACE_CATEGORY[input.category];

  const row = {
      name: input.name,
      category: placeCategory,
      trip_type_tags: [placeCategory],
      source: USER_PLACE_SOURCE,
      is_legacy: false,
      google_place_id: input.googlePlaceId ?? null,
      address: input.address ?? raw?.formattedAddress ?? null,
      latitude: input.latitude ?? raw?.location?.latitude ?? null,
      longitude: input.longitude ?? raw?.location?.longitude ?? null,
      city: city ?? "",
      country: country ?? null,
      website: input.website ?? null,
      image_urls: [],
    };
  // *** created_by (מיגרציה 0095 - כבר רצה במסד).
  // *** תיקון build (TypeScript): Supabase בודק "שדות עודפים" מול הטיפוס של האובייקט, ו-created_by
  // לא הופיע בטיפוס של row. בונים את השורה כאובייקט כללי אחד ומוסיפים את created_by אליו.
  const payload: Record<string, unknown> = { ...row };
  if (input.createdBy) payload.created_by = input.createdBy;
  const { data, error } = await supabase.from("places").insert(payload).select("id, name").single();
  if (error || !data) throw new Error(error?.message ?? "יצירת המקום נכשלה");

  await enrichPlaceFromGoogle(data.id as string);
  // *** חובה 3 קטגוריות לכל אטרקציה (AI) - אחרי ההעשרה מ-Google, כדי שיהיה לו את סוג המקום.
  await ensurePlaceCategories(data.id as string).catch(() => 0);
  return { id: data.id as string, name: data.name as string, existed: false };
}
