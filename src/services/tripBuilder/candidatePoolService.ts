import type { SupabaseClient } from "@supabase/supabase-js";
import type { CandidatePlace, LatLng, DistanceBand } from "./types";
import {
  distanceBandToRadiusKm,
  haversineDistanceKm,
  estimateTravelMinutes,
  kmToDegreesLat,
  kmToDegreesLng,
} from "./geo";

interface FetchCandidatePoolParams {
  category: string;
  origin: LatLng;
  distanceBand: DistanceBand;
  /** מגבלה קשיחה בין תחנות עוקבות (לא מהבית). כשמוגדר - עוקף את distanceBand. */
  maxDistanceKm?: number;
  maxPriceLevel: number | null;
  excludePlaceIds: string[];
  /** אילוץ קשיח: אם true, פוסלים רק מקומות שסומנו במפורש kosher=false. לא נוגע במקומות שעדיין לא תויגו (null). */
  requireKosher?: boolean;
  /** אילוץ קשיח: אם true, פוסלים רק מקומות שסומנו במפורש accessible=false. */
  requireAccessible?: boolean;
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
  trip_type_tags: string[] | null;
  cuisine_tags: string[] | null;
  kosher: boolean | null;
  accessible: boolean | null;
  suitable_child_ages: string[] | null;
  budget_tier: string | null;
}

/**
 * שולף מאגר מועמדים מטבלת places לקטגוריה נתונה.
 * הסינון מתבצע לפי רדיוס (Haversine) ותקציב.
 * אם אין תוצאות - מנסה שוב ללא מגבלת תקציב.
 */
export async function fetchCandidatePool(
  supabase: SupabaseClient,
  params: FetchCandidatePoolParams
): Promise<CandidatePlace[]> {
  const tightRadiusKm = params.maxDistanceKm ?? distanceBandToRadiusKm(params.distanceBand);

  let pool = await queryPool(supabase, params, tightRadiusKm, true);
  if (pool.length > 0) return pool;

  pool = await queryPool(supabase, params, tightRadiusKm, false);
  if (pool.length > 0) return pool;

  // אם היה רדיוס צר (בין תחנות) ועדיין אין מועמדים - מרחיבים בהדרגה
  if (params.maxDistanceKm != null) {
    const widerRadiusKm = distanceBandToRadiusKm(params.distanceBand);
    pool = await queryPool(supabase, params, widerRadiusKm, true);
    if (pool.length > 0) return pool;
    return queryPool(supabase, params, widerRadiusKm, false);
  }

  return pool;
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
      "id,name,category,subcategory,short_description,image_urls,rating,rating_count,price_level,estimated_visit_minutes,latitude,longitude,trip_type_tags,cuisine_tags,kosher,accessible,suitable_child_ages,budget_tier"
    )
    .overlaps("trip_type_tags", [params.category])
    .gte("latitude", params.origin.lat - latDelta)
    .lte("latitude", params.origin.lat + latDelta)
    .gte("longitude", params.origin.lng - lngDelta)
    .lte("longitude", params.origin.lng + lngDelta);

  if (applyBudget && params.maxPriceLevel != null) {
    query = query.or(`price_level.is.null,price_level.lte.${params.maxPriceLevel}`);
  }

  // אילוצים קשיחים: פוסלים רק סימון מפורש "לא" - מקומות שעדיין לא תויגו (null) נשארים בפנים
  if (params.requireKosher) {
    query = query.or("kosher.is.null,kosher.eq.true");
  }
  if (params.requireAccessible) {
    query = query.or("accessible.is.null,accessible.eq.true");
  }

  if (params.excludePlaceIds.length > 0) {
    query = query.not("id", "in", `(${params.excludePlaceIds.join(",")})`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[CandidatePool Error]", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      category: params.category,
    });

    return [];
  }

  const rows = (data ?? []) as PlaceRow[];

  return rows
    .filter((row) => row.latitude != null && row.longitude != null)
    .map((row) => {
      const distanceKm = haversineDistanceKm(params.origin, {
        lat: row.latitude!,
        lng: row.longitude!,
      });

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
        tripTypeTags: row.trip_type_tags ?? [],
        cuisineTags: row.cuisine_tags ?? [],
        kosher: row.kosher,
        accessible: row.accessible,
        suitableChildAges: row.suitable_child_ages ?? [],
        budgetTier: row.budget_tier,
      } satisfies CandidatePlace;
    })
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort(() => Math.random() - 0.5); // ערבוב רנדומלי - לא תמיד הקרוב ביותר ראשון
}