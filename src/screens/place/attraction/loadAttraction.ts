import { createClient } from "@/services/supabase/server";
import { placeCategoryLabels } from "@/services/places/placeCategories";
import { HOME_QUICK_CATEGORY_LABELS } from "@/locales/he/homeQuickCategories";
import type { TripAddPlace } from "@/services/tripadd/tripAddPlaceService";
import type { PlaceDetail } from "@/services/places/placesServerService";
import type { AttractionData } from "./types";

function googleSearchUrl(name: string, where: string | null): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${where ?? ""}`.trim())}`;
}

function asStringArray(v: unknown): string[] | null {
  return Array.isArray(v) && v.every((x) => typeof x === "string") && v.length > 0 ? (v as string[]) : null;
}

/** מקום מטבלת places -> המבנה האחיד. */
export async function attractionFromPlace(place: PlaceDetail): Promise<AttractionData> {
  const p = place as PlaceDetail & Record<string, unknown>;
  const supabase = await createClient();
  const { data: reviews } = await supabase.from("place_reviews").select("rating").eq("place_id", place.id);
  const ratings = (reviews ?? []).map((r) => Number(r.rating)).filter((r) => r >= 1 && r <= 5);

  const acc = ((p.google_raw as Record<string, unknown> | null)?.accessibilityOptions ?? {}) as Record<string, boolean | undefined>;
  const address = (p.address as string | null) || (p.city as string | null) || null;

  return {
    id: place.id,
    source: "place",
    name: place.name,
    imageUrls: ((p.image_urls as string[] | null) ?? []).filter(Boolean),
    address,
    latitude: (p.latitude as number | null) ?? null,
    longitude: (p.longitude as number | null) ?? null,
    openingHours: asStringArray(p.opening_hours),
    priceLevel: (p.price_level as number | null) ?? null,
    accessibility: {
      entrance: acc.wheelchairAccessibleEntrance ?? ((p.accessible as boolean | null) ?? null),
      parking: acc.wheelchairAccessibleParking ?? null,
      restroom: acc.wheelchairAccessibleRestroom ?? null,
      seating: acc.wheelchairAccessibleSeating ?? null,
    },
    categories: placeCategoryLabels({
      category: (p.category as string | null) ?? null,
      trip_type_tags: (p.trip_type_tags as string[] | null) ?? null,
      cuisine_tags: (p.cuisine_tags as string[] | null) ?? null,
      tags: (p.tags as string[] | null) ?? null,
    }),
    googleRating: p.rating != null ? Number(p.rating) : null,
    googleRatingCount: (p.rating_count as number | null) ?? null,
    googleUrl: (p.google_maps_url as string | null) || googleSearchUrl(place.name, address),
    triplaceRating: ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : null,
    triplaceRatingCount: ratings.length,
  };
}

/** מקום מ-tripadd_submissions -> המבנה האחיד. */
export function attractionFromTripAdd(place: TripAddPlace): AttractionData {
  const address = [place.address, place.city].filter(Boolean).join(", ") || null;
  const categories = [HOME_QUICK_CATEGORY_LABELS[place.category] ?? null, place.subcategory].filter(
    (v, i, all): v is string => !!v && all.indexOf(v) === i
  );
  return {
    id: place.id,
    source: "tripadd",
    name: place.name,
    imageUrls: place.photoUrls,
    address,
    latitude: place.latitude,
    longitude: place.longitude,
    openingHours: place.openingHours && place.openingHours.length ? place.openingHours : null,
    priceLevel: place.priceLevel,
    accessibility: {
      entrance: place.accessible,
      parking: place.accessibleParking,
      restroom: place.accessibleRestroom,
      seating: place.accessibleSeating,
    },
    categories,
    googleRating: place.googleRating,
    googleRatingCount: place.googleRatingCount,
    googleUrl: googleSearchUrl(place.name, address),
    triplaceRating: place.rating,
    triplaceRatingCount: place.reviewCount,
  };
}
