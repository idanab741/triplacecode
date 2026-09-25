import { COLLECTION_LIMITS } from "@/services/social/collectionTypes";
import { COLLECTION_DRAFT_KEY, TRIP_DRAFT_KEY } from "./createDrafts";
import { formItemKey, type CollectionFormItem } from "./collectionFormTypes";

/** מקום שאפשר להכניס למפה / טיול - אחרי המרה ל-places.id (ר' /api/places/collectable). */
export interface CollectablePlace {
  inputId: string;
  placeId: string;
  name: string;
  subtitle: string | null;
  imageUrl: string | null;
}

/** ממיר מזהים (places.id או מקומות קהילה) ל-Places אמיתיים, בלי כפילויות. זורק Error עם הודעה בעברית. */
export async function resolveCollectablePlaces(ids: string[]): Promise<CollectablePlace[]> {
  const res = await fetch("/api/places/collectable", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const data = (await res.json().catch(() => ({}))) as { places?: CollectablePlace[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? "משהו השתבש, נסו שוב");
  const seen = new Set<string>();
  const places = (data.places ?? []).filter((p) => (seen.has(p.placeId) ? false : (seen.add(p.placeId), true)));
  if (places.length === 0) throw new Error("לא הצלחנו להוסיף את המקומות שנבחרו");
  return places;
}

/** ממלא מראש טיוטה של מפה חדשה (אותה טיוטה שהטופס כבר יודע לשחזר) ומחזיר את הנתיב לעמוד היצירה. */
export function prepareNewMap(places: CollectablePlace[]): string {
  const items: CollectionFormItem[] = places.slice(0, COLLECTION_LIMITS.maxItems).map((p) => ({
    key: formItemKey("place", p.placeId),
    kind: "place",
    refId: p.placeId,
    title: p.name,
    subtitle: p.subtitle,
    imageUrl: p.imageUrl,
    note: "",
  }));
  localStorage.setItem(COLLECTION_DRAFT_KEY, JSON.stringify({ type: "places", title: "", description: "", coverUrl: null, visibility: "public", items }));
  return "/places/collection/create?type=places";
}

/** ממלא מראש טיוטה של טיול חדש ומחזיר את הנתיב לעמוד היצירה. */
export function prepareNewTrip(places: CollectablePlace[]): string {
  const stamp = Date.now().toString(36);
  const stops = places.map((p, i) => ({ key: `stop-sel-${stamp}-${i}`, placeId: p.placeId, title: p.name, subtitle: p.subtitle, imageUrl: p.imageUrl, note: "" }));
  sessionStorage.setItem(
    TRIP_DRAFT_KEY,
    JSON.stringify({ title: "", description: "", coverUrl: null, tripType: null, visibility: "public", days: [{ id: `day-sel-${stamp}`, stops }] })
  );
  return "/places/trip/create";
}

/** הוספה למפה / טיול קיימים. מחזיר כמה נוספו בפועל. */
export async function addPlacesToTarget(kind: "map" | "trip", id: string, placeIds: string[], day?: number): Promise<{ added: number; skipped: number }> {
  const url = kind === "map" ? `/api/social/collections/${id}/items` : `/api/social/trips/${id}/stops`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(kind === "map" ? { placeIds } : { placeIds, day }),
  });
  const data = (await res.json().catch(() => ({}))) as { added?: number; skipped?: number; error?: string };
  if (!res.ok) throw new Error(data.error ?? "ההוספה נכשלה, נסו שוב");
  return { added: data.added ?? 0, skipped: data.skipped ?? 0 };
}
