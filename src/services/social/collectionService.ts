import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/services/supabase/admin";
import { summarizeTripSessionRow, tripResultPath, type TripSessionRow } from "@/services/tripBuilder/savedTripsService";
import type { TrippyQuickStop } from "@/services/tripBuilder/trippyQuickShared";
import type { FeedTab } from "./feedService";
import type { PostVisibility } from "./types";
import { getTripSummaries } from "./tripService";
import { addTargetComment, deleteTargetComment, getTargetComments, resolveFeedAuthorIds, toggleTargetLike } from "./socialTargetService";
import {
  COLLECTION_LIMITS,
  type CollectionAuthorDto,
  type CollectionCardDto,
  type CollectionDetailDto,
  type CollectionItemDto,
  type CollectionItemInput,
  type CollectionTripSource,
  type CollectionType,
  type SaveCollectionInput,
} from "./collectionTypes";

/**
 * אוספים (Collections) - ר' migration 0089.
 *
 * אוסף הוא תוכן חברתי עצמאי (לא Post, לא Saved), אבל משתמש מחדש במערכות הקיימות:
 * Visibility (כמו posts), Likes (post_likes.collection_id), Comments (comments.collection_id),
 * Saves (social_saves, target_type='collection'), Places (places), Trips (שני מקורות "הטיולים שלי").
 */

/** שגיאת קלט צפויה - ה-route ממפה אותה ל-422 עם ההודעה (בעברית) כמו שהיא. */
export class CollectionInputError extends Error {}

const VISIBILITIES: PostVisibility[] = ["public", "followers", "friends", "private"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLLAGE_SIZE = 4;

// ────────────────────────────────────────────────────────────────────────────
// ולידציה
// ────────────────────────────────────────────────────────────────────────────

/** מנרמל ומאמת גוף בקשה גולמי (unknown) ל-SaveCollectionInput. זורק CollectionInputError. */
export function parseCollectionInput(type: CollectionType, raw: unknown): SaveCollectionInput {
  const body = (raw ?? {}) as Record<string, unknown>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new CollectionInputError("חסרה כותרת למפה");
  if (title.length > COLLECTION_LIMITS.maxTitle) {
    throw new CollectionInputError(`הכותרת ארוכה מדי (עד ${COLLECTION_LIMITS.maxTitle} תווים)`);
  }

  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (description && description.length > COLLECTION_LIMITS.maxDescription) {
    throw new CollectionInputError(`התיאור ארוך מדי (עד ${COLLECTION_LIMITS.maxDescription} תווים)`);
  }

  let coverUrl: string | null = null;
  if (typeof body.coverUrl === "string" && body.coverUrl.trim()) {
    coverUrl = body.coverUrl.trim();
    if (!/^https:\/\//i.test(coverUrl) || coverUrl.length > 1000) throw new CollectionInputError("תמונת המפה לא תקינה");
  }

  const visibility = (body.visibility ?? "public") as PostVisibility;
  if (!VISIBILITIES.includes(visibility)) throw new CollectionInputError("הגדרת הפרטיות לא תקינה");

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const seen = new Set<string>();
  const items: CollectionItemInput[] = [];
  for (const entry of rawItems) {
    const item = entry as Record<string, unknown>;
    const refId = typeof item.refId === "string" ? item.refId : "";
    if (!UUID_RE.test(refId)) throw new CollectionInputError("אחד הפריטים לא תקין");

    const expectedKind = type === "places" ? "place" : "trip";
    if (item.kind !== expectedKind) {
      // "אין לערבב Places ו-Trips באותו אוסף"
      throw new CollectionInputError(type === "places" ? "חוויית מקומות יכולה להכיל מקומות בלבד" : "חוויית טיולים יכולה להכיל טיולים בלבד");
    }

    let tripSource: CollectionTripSource | undefined;
    if (type === "trips") {
      if (item.tripSource !== "session" && item.tripSource !== "trippy_ai" && item.tripSource !== "trip") {
        throw new CollectionInputError("אחד הטיולים לא תקין");
      }
      tripSource = item.tripSource;
    }

    const key = `${tripSource ?? "place"}:${refId}`;
    if (seen.has(key)) continue; // אותו פריט פעמיים - מתעלמים מהכפילות
    seen.add(key);

    let note: string | null = null;
    if (typeof item.note === "string" && item.note.trim()) {
      note = item.note.trim();
      if (note.length > COLLECTION_LIMITS.maxNote) throw new CollectionInputError(`הערה ארוכה מדי (עד ${COLLECTION_LIMITS.maxNote} תווים)`);
    }
    items.push({ kind: expectedKind, refId, tripSource, note });
  }

  if (items.length < COLLECTION_LIMITS.minItems) {
    throw new CollectionInputError(`מפה חייבת להכיל לפחות ${COLLECTION_LIMITS.minItems} פריטים`);
  }
  if (items.length > COLLECTION_LIMITS.maxItems) {
    throw new CollectionInputError(`אפשר להוסיף עד ${COLLECTION_LIMITS.maxItems} פריטים למפה`);
  }

  return { title, description, coverUrl, visibility, items };
}

/** בודק שהפריטים באמת קיימים (places) / שייכים ליוצר ושמורים (trips), עם הודעה ברורה במקום שגיאת FK. */
async function assertItemsUsable(
  supabase: SupabaseClient,
  userId: string,
  type: CollectionType,
  items: CollectionItemInput[]
): Promise<void> {
  if (type === "places") {
    const ids = items.map((i) => i.refId);
    const { data, error } = await supabase.from("places").select("id").in("id", ids);
    if (error) throw error;
    if ((data ?? []).length !== ids.length) throw new CollectionInputError("אחד המקומות לא נמצא - ייתכן שהוסר");
    return;
  }

  const sessionIds = items.filter((i) => i.tripSource === "session").map((i) => i.refId);
  const trippyIds = items.filter((i) => i.tripSource === "trippy_ai").map((i) => i.refId);
  const socialTripIds = items.filter((i) => i.tripSource === "trip").map((i) => i.refId);
  // ה-RLS של שתי הטבלאות ממילא "בעלים בלבד"; ה-eq(user_id) מפורש כדי שההודעה תהיה נכונה.
  // *** רק טיולים שמורים (is_saved) - טיול זמני נמחק אוטומטית אחרי תקופת ההסרה, ואז האוסף "היה מאבד" פריט.
  const [sessionsRes, trippyRes, socialTripsRes] = await Promise.all([
    sessionIds.length
      ? supabase.from("trip_builder_sessions").select("id").in("id", sessionIds).eq("user_id", userId).eq("is_saved", true)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
    trippyIds.length
      ? supabase.from("trippy_ai_results").select("id").in("id", trippyIds).eq("user_id", userId).eq("is_saved", true)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
    // טיול חברתי (Trip): כל טיול שהיוצר רשאי *לראות* (ה-RLS של trips) - שלו, או ציבורי/חברים של מישהו אחר.
    socialTripIds.length
      ? supabase.from("trips").select("id").in("id", socialTripIds)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
  ]);
  if (sessionsRes.error) throw sessionsRes.error;
  if (trippyRes.error) throw trippyRes.error;
  if (socialTripsRes.error) throw socialTripsRes.error;
  if ((sessionsRes.data ?? []).length !== sessionIds.length || (trippyRes.data ?? []).length !== trippyIds.length) {
    throw new CollectionInputError("אפשר להוסיף למפה רק טיולים שמורים שלכם");
  }
  if ((socialTripsRes.data ?? []).length !== socialTripIds.length) {
    throw new CollectionInputError("אחד הטיולים לא נמצא - ייתכן שהוסר או שהפך לפרטי");
  }
}

function toItemRow(collectionId: string, item: CollectionItemInput, position: number) {
  return {
    collection_id: collectionId,
    item_type: item.kind,
    place_id: item.kind === "place" ? item.refId : null,
    trip_session_id: item.kind === "trip" && item.tripSource === "session" ? item.refId : null,
    trippy_ai_result_id: item.kind === "trip" && item.tripSource === "trippy_ai" ? item.refId : null,
    trip_id: item.kind === "trip" && item.tripSource === "trip" ? item.refId : null,
    position,
    note: item.note ?? null,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// יצירה / עריכה / מחיקה
// ────────────────────────────────────────────────────────────────────────────

export async function createCollection(
  supabase: SupabaseClient,
  userId: string,
  type: CollectionType,
  input: SaveCollectionInput
): Promise<string> {
  await assertItemsUsable(supabase, userId, type, input.items);

  const { data: created, error } = await supabase
    .from("collections")
    .insert({
      author_id: userId,
      collection_type: type,
      title: input.title,
      description: input.description,
      cover_url: input.coverUrl,
      visibility: input.visibility,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: itemsError } = await supabase
    .from("collection_items")
    .insert(input.items.map((item, index) => toItemRow(created.id, item, index)));
  if (itemsError) {
    // אין טרנזקציה בין שתי הקריאות - מנקים את האוסף ה"ריק" כדי שלא יישאר אוסף עם 0 פריטים.
    await supabase.from("collections").delete().eq("id", created.id).eq("author_id", userId);
    throw itemsError;
  }

  return created.id as string;
}

interface ExistingItemRow {
  id: string;
  item_type: "place" | "trip";
  place_id: string | null;
  trip_session_id: string | null;
  trippy_ai_result_id: string | null;
  trip_id: string | null;
}

function existingItemKey(row: ExistingItemRow): string {
  if (row.item_type === "place") return `place:${row.place_id}`;
  if (row.trip_id) return `trip:${row.trip_id}`;
  return row.trip_session_id ? `session:${row.trip_session_id}` : `trippy_ai:${row.trippy_ai_result_id}`;
}

function inputItemKey(item: CollectionItemInput): string {
  return item.kind === "place" ? `place:${item.refId}` : `${item.tripSource}:${item.refId}`;
}

/** עריכה מלאה ע"י היוצר: כותרת/תיאור/קאבר/פרטיות + החלפת קבוצת הפריטים והסדר שלהם.
 *  סוג האוסף (places/trips) לא ניתן לשינוי. סדר הפעולות (הוספה -> עדכון סדר -> הסרה) מבטיח
 *  שגם אם משהו נכשל באמצע האוסף לא יורד מתחת למינימום הפריטים. */
export async function updateCollection(
  supabase: SupabaseClient,
  userId: string,
  collectionId: string,
  raw: unknown
): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from("collections")
    .select("id, author_id, collection_type")
    .eq("id", collectionId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new CollectionInputError("המפה לא נמצאה");
  if (existing.author_id !== userId) throw new CollectionInputError("רק היוצר יכול לערוך את המפה");

  const type = existing.collection_type as CollectionType;
  const input = parseCollectionInput(type, raw);

  const { data: currentRows, error: currentError } = await supabase
    .from("collection_items")
    .select("id, item_type, place_id, trip_session_id, trippy_ai_result_id, trip_id")
    .eq("collection_id", collectionId);
  if (currentError) throw currentError;

  const current = (currentRows ?? []) as ExistingItemRow[];
  const currentByKey = new Map(current.map((row) => [existingItemKey(row), row]));
  const nextKeys = new Set(input.items.map(inputItemKey));

  const toInsert = input.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !currentByKey.has(inputItemKey(item)));
  const toKeep = input.items
    .map((item, index) => ({ item, index, row: currentByKey.get(inputItemKey(item)) }))
    .filter((entry): entry is { item: CollectionItemInput; index: number; row: ExistingItemRow } => !!entry.row);
  const toRemove = current.filter((row) => !nextKeys.has(existingItemKey(row)));

  // רק פריטים חדשים דורשים בדיקה (הקיימים כבר עברו אותה כשנוספו; טיול שנמחק/בוטל שמירה לא אמור לחסום עריכה).
  if (toInsert.length) await assertItemsUsable(supabase, userId, type, toInsert.map((entry) => entry.item));

  const { error: updateError } = await supabase
    .from("collections")
    .update({
      title: input.title,
      description: input.description,
      cover_url: input.coverUrl,
      visibility: input.visibility,
    })
    .eq("id", collectionId)
    .eq("author_id", userId);
  if (updateError) throw updateError;

  if (toInsert.length) {
    const { error } = await supabase
      .from("collection_items")
      .insert(toInsert.map(({ item, index }) => toItemRow(collectionId, item, index)));
    if (error) throw error;
  }

  const updateResults = await Promise.all(
    toKeep.map(({ item, index, row }) =>
      supabase.from("collection_items").update({ position: index, note: item.note ?? null }).eq("id", row.id)
    )
  );
  const failed = updateResults.find((result) => result.error);
  if (failed?.error) throw failed.error;

  if (toRemove.length) {
    const { error } = await supabase
      .from("collection_items")
      .delete()
      .in("id", toRemove.map((row) => row.id));
    if (error) throw error;
  }
}

/** מחיקה אמיתית (לא soft-delete) - ה-FK cascade מנקה פריטים/לייקים/תגובות. ר' הערה ב-migration 0089. */
export async function deleteCollection(supabase: SupabaseClient, userId: string, collectionId: string): Promise<void> {
  const { error } = await supabase.from("collections").delete().eq("id", collectionId).eq("author_id", userId);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// קריאה (Hydration) - בלי N+1: שאילתה לכל טבלה לכל עמוד תוצאות
// ────────────────────────────────────────────────────────────────────────────

interface CollectionRow {
  id: string;
  author_id: string;
  collection_type: CollectionType;
  title: string;
  description: string | null;
  cover_url: string | null;
  visibility: PostVisibility;
  created_at: string;
}

interface ItemRow {
  id: string;
  collection_id: string;
  item_type: "place" | "trip";
  place_id: string | null;
  trip_session_id: string | null;
  trippy_ai_result_id: string | null;
  trip_id: string | null;
  position: number;
  note: string | null;
}

const COLLECTION_COLUMNS = "id, author_id, collection_type, title, description, cover_url, visibility, created_at";

/** משלים לשורות-פריט את הנתונים להצגה (Place / Trip).
 *  places: ה-client הרגיל (places קריא לכל משתמש מחובר).
 *  trips: *admin client* - ה-RLS של trip_builder_sessions / trippy_ai_results הוא "בעלים בלבד", ולכן צופה
 *  אחר לא היה רואה אותם בכלל. זה בטוח כאן כי שורות האוסף עצמן כבר עברו את ה-RLS של האוסף
 *  (visibility/חסימות) לפני שהגענו לפה - משלימים תצוגה בלבד, בדיוק כמו post_media ב-feedService.
 *  לצופה שאינו הבעלים חושפים רק: כותרת, תמונה ראשונה, מספר תחנות, וקישור לצפייה. */
async function hydrateItems(supabase: SupabaseClient, viewerId: string, rows: ItemRow[]): Promise<Map<string, CollectionItemDto>> {
  const result = new Map<string, CollectionItemDto>();
  if (rows.length === 0) return result;

  const placeIds = [...new Set(rows.map((r) => r.place_id).filter(Boolean))] as string[];
  const sessionIds = [...new Set(rows.map((r) => r.trip_session_id).filter(Boolean))] as string[];
  const trippyIds = [...new Set(rows.map((r) => r.trippy_ai_result_id).filter(Boolean))] as string[];
  const socialTripIds = [...new Set(rows.map((r) => r.trip_id).filter(Boolean))] as string[];
  const admin = sessionIds.length || trippyIds.length ? createAdminClient() : null;

  // טיולים חברתיים (Trips): ה-client הרגיל - ה-RLS של trips מכבד visibility, כך שטיול שהפך פרטי פשוט נעלם מהאוסף.
  const [placesRes, sessionsRes, trippyRes, socialTrips] = await Promise.all([
    placeIds.length
      ? supabase.from("places").select("id, name, category, city, rating, image_urls, latitude, longitude").in("id", placeIds)
      : Promise.resolve({ data: [] as never[] }),
    admin && sessionIds.length
      ? admin
          .from("trip_builder_sessions")
          .select("id, user_id, trip_type, answers, final_itinerary, created_at, is_saved")
          .in("id", sessionIds)
      : Promise.resolve({ data: [] as never[] }),
    admin && trippyIds.length
      ? admin.from("trippy_ai_results").select("id, user_id, title, stops, share_token").in("id", trippyIds)
      : Promise.resolve({ data: [] as never[] }),
    getTripSummaries(supabase, viewerId, socialTripIds),
  ]);

  const placesById = new Map(
    (placesRes.data ?? []).map((p) => {
      const row = p as {
        id: string;
        name: string;
        category: string;
        city: string | null;
        rating: number | null;
        image_urls: string[] | null;
        latitude: number | null;
        longitude: number | null;
      };
      return [row.id, row] as const;
    })
  );
  const sessionsById = new Map((sessionsRes.data ?? []).map((s) => [(s as { id: string }).id, s as unknown as TripSessionRow & { user_id: string }]));
  const trippyById = new Map(
    (trippyRes.data ?? []).map((t) => {
      const row = t as { id: string; user_id: string; title: string | null; stops: TrippyQuickStop[] | null; share_token: string };
      return [row.id, row] as const;
    })
  );

  for (const row of rows) {
    if (row.item_type === "place" && row.place_id) {
      const place = placesById.get(row.place_id);
      if (!place) continue;
      result.set(row.id, {
        id: row.id,
        kind: "place",
        position: row.position,
        note: row.note,
        place: {
          id: place.id,
          name: place.name,
          category: place.category,
          city: place.city,
          rating: place.rating,
          imageUrls: place.image_urls ?? [],
          latitude: place.latitude,
          longitude: place.longitude,
        },
      });
      continue;
    }

    if (row.trip_id) {
      const socialTrip = socialTrips.get(row.trip_id);
      if (!socialTrip) continue;
      result.set(row.id, {
        id: row.id,
        kind: "trip",
        position: row.position,
        note: row.note,
        trip: {
          source: "trip",
          id: row.trip_id,
          title: socialTrip.title,
          imageUrl: socialTrip.imageUrl,
          stopCount: socialTrip.stopCount,
          href: `/places/trip/${row.trip_id}`,
          route: socialTrip.route,
        },
      });
      continue;
    }

    if (row.trip_session_id) {
      const session = sessionsById.get(row.trip_session_id);
      if (!session) continue;
      const summary = summarizeTripSessionRow(session);
      result.set(row.id, {
        id: row.id,
        kind: "trip",
        position: row.position,
        note: row.note,
        trip: {
          source: "session",
          id: session.id,
          title: summary.destinationLabel,
          imageUrl: summary.imageUrl,
          stopCount: summary.stopCount,
          // *** מגבלה קיימת: לטיולי האשף אין (עדיין) דף צפייה ציבורי - ה-result page שלהם הוא "בעלים בלבד"
          // (RLS). לכן רק הבעלים מקבל קישור; לשאר הצופים הכרטיס מוצג בלי ניווט.
          href: session.user_id === viewerId ? tripResultPath(session.trip_type, session.id) : null,
          route: routeFromPoints((session.final_itinerary as { stops?: { latitude?: number | null; longitude?: number | null }[] } | null)?.stops),
        },
      });
      continue;
    }

    if (row.trippy_ai_result_id) {
      const trippy = trippyById.get(row.trippy_ai_result_id);
      if (!trippy) continue;
      const stops = trippy.stops ?? [];
      result.set(row.id, {
        id: row.id,
        kind: "trip",
        position: row.position,
        note: row.note,
        trip: {
          source: "trippy_ai",
          id: trippy.id,
          title: trippy.title ?? "המסלול שלכם",
          imageUrl: stops[0]?.imageUrl ?? null,
          stopCount: stops.length,
          // ל-trippy AI כבר יש דף שיתוף ציבורי לפי share_token (migration 0058).
          href:
            trippy.user_id === viewerId
              ? `/trip-builder/trippy-quick/result?savedId=${trippy.id}`
              : `/trip-builder/trippy-quick/shared/${trippy.share_token}`,
          route: routeFromPoints(stops),
        },
      });
    }
  }

  return result;
}

/** נקודות מסלול מתוך רשימת תחנות גולמית - רק תחנות עם מיקום תקין, לפי הסדר. */
function routeFromPoints(stops: { latitude?: number | null; longitude?: number | null }[] | null | undefined) {
  return (stops ?? [])
    .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number" && Number.isFinite(s.latitude) && Number.isFinite(s.longitude))
    .map((s) => ({ latitude: s.latitude as number, longitude: s.longitude as number }));
}

function itemImage(item: CollectionItemDto): string | null {
  return item.kind === "place" ? (item.place.imageUrls[0] ?? null) : item.trip.imageUrl;
}

/** בונה CollectionCardDto לרשימת אוספים (וגם את פריטיהם, אם itemsMode="full").
 *  itemsMode="collage": מ-hydrate רק את 4 הפריטים הראשונים של כל אוסף (מספיק ל-Cover האוטומטי). */
async function buildCollections(
  supabase: SupabaseClient,
  viewerId: string,
  rows: CollectionRow[],
  itemsMode: "collage" | "full"
): Promise<{ cards: CollectionCardDto[]; itemsByCollection: Map<string, CollectionItemDto[]> }> {
  if (rows.length === 0) return { cards: [], itemsByCollection: new Map() };

  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.author_id))];

  const [authorsRes, itemsRes, likesRes, commentsRes, viewerLikesRes, viewerSavesRes] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url, is_creator").in("id", authorIds),
    supabase
      .from("collection_items")
      .select("id, collection_id, item_type, place_id, trip_session_id, trippy_ai_result_id, trip_id, position, note")
      .in("collection_id", ids)
      .order("position", { ascending: true }),
    supabase.from("post_likes").select("collection_id").in("collection_id", ids),
    supabase.from("comments").select("collection_id").in("collection_id", ids).is("deleted_at", null),
    supabase.from("post_likes").select("collection_id").in("collection_id", ids).eq("user_id", viewerId),
    supabase.from("social_saves").select("target_id").in("target_id", ids).eq("user_id", viewerId).eq("target_type", "collection"),
  ]);

  const authorsById = new Map((authorsRes.data ?? []).map((a) => [a.id as string, a]));

  const allItemRows = (itemsRes.data ?? []) as ItemRow[];
  const rowsByCollection = new Map<string, ItemRow[]>();
  for (const row of allItemRows) {
    const list = rowsByCollection.get(row.collection_id) ?? [];
    list.push(row);
    rowsByCollection.set(row.collection_id, list);
  }

  const rowsToHydrate =
    itemsMode === "full" ? allItemRows : [...rowsByCollection.values()].flatMap((list) => list.slice(0, COLLAGE_SIZE));
  const hydrated = await hydrateItems(supabase, viewerId, rowsToHydrate);

  const itemsByCollection = new Map<string, CollectionItemDto[]>();
  for (const [collectionId, list] of rowsByCollection) {
    const scoped = itemsMode === "full" ? list : list.slice(0, COLLAGE_SIZE);
    itemsByCollection.set(
      collectionId,
      scoped.map((row) => hydrated.get(row.id)).filter((item): item is CollectionItemDto => !!item)
    );
  }

  const likeCount = countBy(likesRes.data ?? [], "collection_id");
  const commentCount = countBy(commentsRes.data ?? [], "collection_id");
  const viewerLiked = new Set((viewerLikesRes.data ?? []).map((r) => r.collection_id as string));
  const viewerSaved = new Set((viewerSavesRes.data ?? []).map((r) => r.target_id as string));

  const cards = rows.map((row): CollectionCardDto => {
    const author = authorsById.get(row.author_id);
    const authorDto: CollectionAuthorDto = {
      id: row.author_id,
      username: author?.username ?? null,
      fullName: author?.full_name ?? null,
      avatarUrl: author?.avatar_url ?? null,
      isCreator: author?.is_creator ?? false,
    };
    const collageUrls = (itemsByCollection.get(row.id) ?? [])
      .slice(0, COLLAGE_SIZE)
      .map(itemImage)
      .filter((url): url is string => !!url);

    return {
      id: row.id,
      type: row.collection_type,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      visibility: row.visibility,
      author: authorDto,
      itemCount: rowsByCollection.get(row.id)?.length ?? 0,
      coverUrl: row.cover_url,
      collageUrls,
      stats: { likes: likeCount.get(row.id) ?? 0, comments: commentCount.get(row.id) ?? 0 },
      viewerState: { liked: viewerLiked.has(row.id), saved: viewerSaved.has(row.id), isSelf: row.author_id === viewerId },
    };
  });

  return { cards, itemsByCollection };
}

function countBy(rows: { collection_id: unknown }[], key: "collection_id"): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row[key] as string;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** אוסף בודד. null = לא קיים או שהצופה לא רשאי לראות אותו (ה-RLS של collections מחליט). */
export async function getCollection(supabase: SupabaseClient, viewerId: string, collectionId: string): Promise<CollectionDetailDto | null> {
  if (!UUID_RE.test(collectionId)) return null;
  const { data, error } = await supabase.from("collections").select(COLLECTION_COLUMNS).eq("id", collectionId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { cards, itemsByCollection } = await buildCollections(supabase, viewerId, [data as CollectionRow], "full");
  return { ...cards[0], items: itemsByCollection.get(collectionId) ?? [] };
}

export interface CollectionCardsOptions {
  /** טאב ה-Feed (חברים / במעקב) - אותה משמעות כמו ב-getFeed. */
  tab?: FeedTab;
  /** רק אוספים של יוצר בודד (טאב "אוספים" בפרופיל). */
  authorId?: string;
  limit?: number;
  /** created_at של הפריט האחרון בעמוד הקודם. */
  cursor?: string;
  /** true ב-Feed: תוכן פרטי לא מופיע ב-Feed (גם לא ליוצר עצמו) - הוא נגיש רק מהפרופיל / ישירות. */
  excludePrivate?: boolean;
}

/** אוספים כ-Cards, מהחדש לישן. ה-RLS כבר מגביל למה שהצופה רשאי לראות. */
export async function getCollectionCards(
  supabase: SupabaseClient,
  viewerId: string,
  options: CollectionCardsOptions = {}
): Promise<CollectionCardDto[]> {
  const { tab = "for_you", authorId, limit = 15, cursor, excludePrivate = false } = options;

  const authorFilterIds = await resolveFeedAuthorIds(supabase, viewerId, tab);
  if (authorFilterIds && authorFilterIds.length === 0) return [];

  let query = supabase.from("collections").select(COLLECTION_COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (authorId) query = query.eq("author_id", authorId);
  if (authorFilterIds) query = query.in("author_id", authorFilterIds);
  if (cursor) query = query.lt("created_at", cursor);
  if (excludePrivate) query = query.neq("visibility", "private");

  const { data, error } = await query;
  if (error) throw error;

  const { cards } = await buildCollections(supabase, viewerId, (data ?? []) as CollectionRow[], "collage");
  return cards;
}

/** האוספים ששמרתי (social_saves, target_type='collection'), לפי סדר השמירה (החדש ראשון).
 *  אותו דפוס בדיוק כמו getViewerSavedTripCards - ה-RLS מסנן אוספים שהפכו פרטיים. */
export async function getViewerSavedCollectionCards(supabase: SupabaseClient, viewerId: string, limit = 50): Promise<CollectionCardDto[]> {
  const { data: saves, error } = await supabase
    .from("social_saves")
    .select("target_id")
    .eq("user_id", viewerId)
    .eq("target_type", "collection")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ids = (saves ?? []).map((s) => s.target_id as string);
  if (ids.length === 0) return [];

  const { data: rows, error: rowsError } = await supabase.from("collections").select(COLLECTION_COLUMNS).in("id", ids);
  if (rowsError) throw rowsError;

  const { cards } = await buildCollections(supabase, viewerId, (rows ?? []) as CollectionRow[], "collage");
  const order = new Map(ids.map((id, index) => [id, index]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

// ────────────────────────────────────────────────────────────────────────────
// אינטראקציות: Like / Comment (Save עובר דרך toggleSocialSave הקיים)
// ────────────────────────────────────────────────────────────────────────────

export const toggleCollectionLike = (supabase: SupabaseClient, collectionId: string, userId: string) =>
  toggleTargetLike(supabase, "collection_id", collectionId, userId);

export const getCollectionComments = (supabase: SupabaseClient, collectionId: string, limit = 30, before?: string) =>
  getTargetComments(supabase, "collection_id", collectionId, limit, before);

export const addCollectionComment = (supabase: SupabaseClient, collectionId: string, authorId: string, text: string, parentCommentId?: string) =>
  addTargetComment(supabase, "collection_id", collectionId, authorId, text, parentCommentId);

export const deleteCollectionComment = (supabase: SupabaseClient, commentId: string, authorId: string) =>
  deleteTargetComment(supabase, "collection_id", commentId, authorId);
