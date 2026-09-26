import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlaceCategoryLabel } from "@/constants/placeCategories";
import { USER_PLACE_SOURCE } from "./placeEnrichmentService";

/**
 * *** בקשה מפורשת ("בחירה מרובה - לבחור כמה אטרקציות / נעצים במפה ואז ליצור אוסף חדש / מסלול"):
 * אוספים וטיולים מקבלים רק מקומות מטבלת places (ר' collectionService / tripService). אבל חלק גדול
 * ממה שהמשתמש רואה - נעצים במפה, החלקות ב-TripMatch, "הבחירות שלי" - הם מקומות קהילה
 * (tripadd_submissions). כאן כל מזהה נפתר ל-Place אמיתי:
 *  1. כבר places.id - כמו שהוא.
 *  2. tripadd_submissions.id - מחפשים Place קיים (אותו google_place_id, או שם תואם במרחק קצר),
 *     ואם אין - יוצרים Place חדש מהנתונים של ההעלאה (בלי קריאות Google - מהיר). ההעשרה מ-Google
 *     רצה אחר כך ברקע (ר' ה-route).
 * מזהה שלא נמצא (או יעד ברמת עיר) - מדלגים עליו.
 */

export interface CollectablePlace {
  /** המזהה שהתקבל (places.id או tripadd id) */
  inputId: string;
  /** places.id - מה שנשלח לאוסף/טיול */
  placeId: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
}

export interface ResolveResult {
  places: CollectablePlace[];
  /** Places חדשים שנוצרו - להעשרה ברקע */
  createdPlaceIds: string[];
  skipped: string[];
}

const UUID = /^[0-9a-f-]{36}$/i;
const MAX_IDS = 60;
/** ~150 מ' - מספיק לאותו מקום, לא מספיק כדי לבלבל בין שכנים עם שם דומה */
const NEAR_DEG = 0.0015;

const TRIPADD_TO_PLACE_CATEGORY: Record<string, string> = {
  food: "restaurants",
  attraction: "attractions",
  nature: "nature",
  nightlife: "nightlife",
  sleep: "hotels",
  shopping: "shopping",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/["'`׳״.,\-–—_()|/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function namesMatch(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 3 && long.includes(short);
}

type PlaceRow = { id: string; name: string; category: string | null; city: string | null; image_urls: string[] | null };

function toCollectable(inputId: string, p: PlaceRow, fallbackImage: string | null = null): CollectablePlace {
  return {
    inputId,
    placeId: p.id,
    name: p.name,
    subtitle: [p.category ? getPlaceCategoryLabel(p.category) : null, p.city].filter(Boolean).join(" · ") || null,
    imageUrl: p.image_urls?.[0] ?? fallbackImage,
  };
}

/** admin = service-role client (יצירת Place עוקפת RLS; מי שיצר נשמר ב-created_by). */
export async function resolveCollectablePlaces(admin: SupabaseClient, ids: string[], viewerId: string): Promise<ResolveResult> {
  const unique = [...new Set(ids.filter((id) => UUID.test(id)))].slice(0, MAX_IDS);
  const result: ResolveResult = { places: [], createdPlaceIds: [], skipped: [] };
  if (unique.length === 0) return result;

  const PLACE_COLS = "id, name, category, city, image_urls";
  const { data: direct } = await admin.from("places").select(PLACE_COLS).in("id", unique);
  const byId = new Map(((direct ?? []) as PlaceRow[]).map((p) => [p.id, p]));

  const rest = unique.filter((id) => !byId.has(id));
  const { data: subs } = rest.length
    ? await admin
        .from("tripadd_submissions")
        .select("id, submitted_by, name, category, city, address, latitude, longitude, google_place_id, status")
        .in("id", rest)
    : { data: [] };
  const subById = new Map(((subs ?? []) as Record<string, unknown>[]).map((s) => [s.id as string, s]));

  // תמונה ראשונה שהמשתמש העלה עם המקום (עדיפה על תמונת Google)
  const subIds = [...subById.keys()];
  const firstPhoto = new Map<string, string>();
  if (subIds.length) {
    const { data: media } = await admin
      .from("tripadd_submission_media")
      .select("submission_id, sort_order, media:media_assets(type, url, thumbnail_url)")
      .in("submission_id", subIds)
      .order("sort_order");
    for (const row of (media ?? []) as { submission_id: string; media: unknown }[]) {
      if (firstPhoto.has(row.submission_id)) continue;
      const m = (Array.isArray(row.media) ? row.media[0] : row.media) as { type?: string; url?: string; thumbnail_url?: string } | null;
      const url = m ? (m.type === "video" ? m.thumbnail_url : m.url ?? m.thumbnail_url) : null;
      if (url) firstPhoto.set(row.submission_id, url);
    }
  }

  for (const id of unique) {
    const place = byId.get(id);
    if (place) {
      result.places.push(toCollectable(id, place));
      continue;
    }
    const sub = subById.get(id);
    if (!sub || sub.status === "rejected") {
      result.skipped.push(id);
      continue;
    }
    const name = String(sub.name ?? "").trim();
    const lat = typeof sub.latitude === "number" ? sub.latitude : null;
    const lng = typeof sub.longitude === "number" ? sub.longitude : null;
    const googleId = (sub.google_place_id as string | null) ?? null;
    // *** בקשה מפורשת: לעולם לא תמונות של Google - רק תמונה שמשתמש העלה
    const photo = firstPhoto.get(id) ?? null;

    // 1) Place קיים עם אותו google_place_id
    let existing: PlaceRow | null = null;
    if (googleId) {
      const { data } = await admin.from("places").select(PLACE_COLS).eq("google_place_id", googleId).limit(1).maybeSingle();
      existing = (data as PlaceRow | null) ?? null;
    }
    // 2) שם תואם במרחק קצר
    if (!existing && lat != null && lng != null && name) {
      const { data } = await admin
        .from("places")
        .select(`${PLACE_COLS}, latitude, longitude`)
        .gte("latitude", lat - NEAR_DEG)
        .lte("latitude", lat + NEAR_DEG)
        .gte("longitude", lng - NEAR_DEG)
        .lte("longitude", lng + NEAR_DEG)
        .limit(20);
      existing = ((data ?? []) as PlaceRow[]).find((p) => namesMatch(p.name, name)) ?? null;
    }
    if (existing) {
      result.places.push(toCollectable(id, existing, photo));
      continue;
    }

    // 3) Place חדש מההעלאה
    if (!name) {
      result.skipped.push(id);
      continue;
    }
    const category = TRIPADD_TO_PLACE_CATEGORY[String(sub.category ?? "")] ?? "attractions";
    const { data: created, error } = await admin
      .from("places")
      .insert({
        name,
        category,
        trip_type_tags: [category],
        source: USER_PLACE_SOURCE,
        is_legacy: false,
        google_place_id: googleId,
        address: (sub.address as string | null) ?? null,
        latitude: lat,
        longitude: lng,
        city: (sub.city as string | null) ?? "",
        image_urls: photo ? [photo] : [],
        created_by: (sub.submitted_by as string | null) ?? viewerId,
      })
      .select(PLACE_COLS)
      .single();
    if (error || !created) {
      result.skipped.push(id);
      continue;
    }
    result.createdPlaceIds.push((created as PlaceRow).id);
    result.places.push(toCollectable(id, created as PlaceRow));
  }

  return result;
}
