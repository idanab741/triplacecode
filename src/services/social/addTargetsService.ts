import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "הוספה ל..." - המפות (מפות מקומות) והטיולים שהמשתמש יצר, כדי להוסיף אליהם מקום בלחיצה אחת.
 * hasAll = כל המקומות שנבחרו כבר שם (השורה מסומנת "כבר כאן").
 */
export interface AddTargetDto {
  id: string;
  title: string;
  imageUrl: string | null;
  count: number;
  /** טיולים: מספר הימים (לתיאור "5 תחנות · 2 ימים") */
  days: number;
  hasAll: boolean;
}

export interface AddTargetsDto {
  maps: AddTargetDto[];
  trips: AddTargetDto[];
}

const LIMIT = 50;

export async function getAddTargets(supabase: SupabaseClient, userId: string, placeIds: string[]): Promise<AddTargetsDto> {
  const [mapsRes, tripsRes] = await Promise.all([
    supabase
      .from("collections")
      .select("id, title, cover_url, created_at")
      .eq("author_id", userId)
      .eq("collection_type", "places")
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    supabase.from("trips").select("id, title, cover_url, created_at").eq("author_id", userId).order("created_at", { ascending: false }).limit(LIMIT),
  ]);
  if (mapsRes.error) throw mapsRes.error;
  if (tripsRes.error) throw tripsRes.error;
  const maps = (mapsRes.data ?? []) as { id: string; title: string; cover_url: string | null }[];
  const trips = (tripsRes.data ?? []) as { id: string; title: string; cover_url: string | null }[];

  const [itemsRes, stopsRes] = await Promise.all([
    maps.length
      ? supabase.from("collection_items").select("collection_id, place_id, position").in("collection_id", maps.map((m) => m.id))
      : Promise.resolve({ data: [], error: null }),
    trips.length
      ? supabase.from("trip_stops").select("trip_id, place_id, day_index, position").in("trip_id", trips.map((t) => t.id))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (stopsRes.error) throw stopsRes.error;
  const items = (itemsRes.data ?? []) as { collection_id: string; place_id: string | null; position: number }[];
  const stops = (stopsRes.data ?? []) as { trip_id: string; place_id: string; day_index: number; position: number }[];

  // תמונה לשורה: הקאבר, ואם אין - התמונה של המקום הראשון
  const firstPlace = new Map<string, { placeId: string; rank: number }>();
  const note = (key: string, placeId: string | null, rank: number) => {
    if (!placeId) return;
    const prev = firstPlace.get(key);
    if (!prev || rank < prev.rank) firstPlace.set(key, { placeId, rank });
  };
  items.forEach((i) => note(`m:${i.collection_id}`, i.place_id, i.position));
  stops.forEach((s) => note(`t:${s.trip_id}`, s.place_id, s.day_index * 1000 + s.position));
  const needImage = [...new Set([...firstPlace.values()].map((v) => v.placeId))];
  const images = new Map<string, string | null>();
  if (needImage.length) {
    const { data } = await supabase.from("places").select("id, image_urls").in("id", needImage);
    for (const p of (data ?? []) as { id: string; image_urls: string[] | null }[]) images.set(p.id, p.image_urls?.[0] ?? null);
  }
  const imageFor = (key: string, cover: string | null) => cover ?? (firstPlace.get(key) ? images.get(firstPlace.get(key)!.placeId) ?? null : null);

  const wanted = new Set(placeIds);
  const hasAll = (present: Set<string>) => wanted.size > 0 && [...wanted].every((id) => present.has(id));

  return {
    maps: maps.map((m) => {
      const own = items.filter((i) => i.collection_id === m.id);
      return {
        id: m.id,
        title: m.title,
        imageUrl: imageFor(`m:${m.id}`, m.cover_url),
        count: own.length,
        days: 0,
        hasAll: hasAll(new Set(own.map((i) => i.place_id ?? ""))),
      };
    }),
    trips: trips.map((t) => {
      const own = stops.filter((s) => s.trip_id === t.id);
      return {
        id: t.id,
        title: t.title,
        imageUrl: imageFor(`t:${t.id}`, t.cover_url),
        count: own.length,
        days: new Set(own.map((s) => s.day_index)).size,
        hasAll: hasAll(new Set(own.map((s) => s.place_id))),
      };
    }),
  };
}
