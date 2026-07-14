import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidatePlace, LatLng } from "./types";
import { distanceBandToRadiusKm, haversineDistanceKm, estimateTravelMinutes, kmToDegreesLat, kmToDegreesLng } from "./geo";
import type { DistanceBand } from "./types";

interface FetchCandidatePoolParams {
  category: string;
  origin: LatLng;
  distanceBand: DistanceBand;
  maxPriceLevel: number | null;
  excludePlaceIds: string[];
}

interface PlaceRow {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  short_description: string | null;
  image_urls: string[];
  rating: number | null;
  rating_count: number | null;
  price_level: number | null;
  estimated_visit_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
}

/**
 * שולף מאגר מועמדים מטבלת places לקטגוריה נתונה, מסונן לפי רדיוס נסיעה
 * (Haversine, לא API ניתוב) ותקציב. נופל בעדינות אם המאגר ריק - ראשית
 * מוותר על מגבלת התקציב, ואז מחזיר [] כדי שהמסך יציג הודעה במקום לקרוס.
 */
export async function fetchCandidatePool(
  supabase: SupabaseClient,
  params: FetchCandidatePoolParams
): Promise<CandidatePlace[]> {
  const radiusKm = distanceBandToRadiusKm(params.distanceBand);

  const pool = await queryPool(supabase, params, radiusKm, true);
  if (pool.length > 0) return pool;

  // נסיגה 1: בלי מגבלת תקציב
  const withoutBudget = await queryPool(supabase, params, radiusKm, false);
  return withoutBudget;
}

async function queryPool(
  supabase: SupabaseClient,
  params: FetchCandidatePoolParams,
  radiusKm: number,
  applyBudget: boolean
): Promise<CandidatePlace[]> {
  const latDelta = kmToDegreesLat(radiusKm);
  const lngDelta = kmToDegreesLng(radiusKm, params.origin.lat);

  let query = supabase
    .from("places")
    .select(
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude"
    )
    .eq("category", params.category)
    .gte("latitude", params.origin.lat - latDelta)
    .lte("latitude", params.origin.lat + latDelta)
    .gte("longitude", params.origin.lng - lngDelta)
    .lte("longitude", params.origin.lng + lngDelta);

  if (applyBudget && params.maxPriceLevel != null) {
    query = query.or(`price_level.is.null,price_level.lte.${params.maxPriceLevel}`);
  }

  if (params.excludePlaceIds.length > 0) {
    query = query.not("id", "in", `(${params.excludePlaceIds.join(",")})`);
  }

  const { data } = await query;
  const rows = (data ?? []) as PlaceRow[];

  return rows
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => {
      const distanceKm = haversineDistanceKm(params.origin, { lat: row.latitude!, lng: row.longitude! });
      return {
        id: row.id,
        name: row.name,
        category: row.category,
        subcategory: row.subcategory,
        shortDescription: row.short_description,
        imageUrls: row.image_urls ?? [],
        rating: row.rating,
        ratingCount: row.rating_count,
        priceLevel: row.price_level,
        estimatedVisitMinutes: row.estimated_visit_minutes,
        latitude: row.latitude!,
        longitude: row.longitude!,
        distanceKm,
        etaMinutes: estimateTravelMinutes(distanceKm, "drive"),
      } satisfies CandidatePlace;
    })
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
