import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedTab } from "./feedService";
import type { PostVisibility } from "./types";
import type { CollectionAuthorDto } from "./collectionTypes";
import { addTargetComment, deleteTargetComment, getTargetComments, resolveFeedAuthorIds, toggleTargetLike } from "./socialTargetService";
import {
  TRIP_LIMITS,
  isTripTypeId,
  type SaveTripInput,
  type TripCardDto,
  type TripDetailDto,
  type TripPlaceDto,
  type TripStopDto,
  type TripTypeId,
} from "./tripTypes";

/**
 * טיולים (Trips) - ר' migration 0090.
 *
 * טיול = מסלול של תחנות (places) בסדר ברור עם חלוקה לימים; תוכן חברתי עצמאי (לא Post, לא Collection).
 * משתמש מחדש במערכות הקיימות: Visibility (כמו posts), Likes/Comments (post_likes/comments עם trip_id),
 * Saves (social_saves, target_type='trip'), Places (places), סוגי טיול (QuickCategoryId).
 */

/** שגיאת קלט צפויה - ה-route ממפה אותה ל-422 עם ההודעה (בעברית) כמו שהיא. */
export class TripInputError extends Error {}

const VISIBILITIES: PostVisibility[] = ["public", "followers", "friends", "private"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_SIZE = 3;
/** כמה תחנות ראשונות טוענים לכל טיול ב-Card: 3 ל-Preview + אחת נוספת כדי למצוא תמונה ל-Cover האוטומטי. */
const CARD_HYDRATE_SIZE = 4;

// ────────────────────────────────────────────────────────────────────────────
// ולידציה
// ────────────────────────────────────────────────────────────────────────────

/** מנרמל ומאמת גוף בקשה גולמי ל-SaveTripInput. זורק TripInputError.
 *  ימים ריקים נזרקים והימים מתמספרים מחדש ברצף (יום 1, 2, 3...). */
export function parseTripInput(raw: unknown): SaveTripInput {
  const body = (raw ?? {}) as Record<string, unknown>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new TripInputError("חסר שם לטיול");
  if (title.length > TRIP_LIMITS.maxTitle) throw new TripInputError(`השם ארוך מדי (עד ${TRIP_LIMITS.maxTitle} תווים)`);

  const description = typeof body.description === "string" && body.description.trim() ? body.description.trim() : null;
  if (description && description.length > TRIP_LIMITS.maxDescription) {
    throw new TripInputError(`התיאור ארוך מדי (עד ${TRIP_LIMITS.maxDescription} תווים)`);
  }

  let coverUrl: string | null = null;
  if (typeof body.coverUrl === "string" && body.coverUrl.trim()) {
    coverUrl = body.coverUrl.trim();
    if (!/^https:\/\//i.test(coverUrl) || coverUrl.length > 1000) throw new TripInputError("תמונת הקאבר לא תקינה");
  }

  let tripType: TripTypeId | null = null;
  if (body.tripType != null && body.tripType !== "") {
    if (!isTripTypeId(body.tripType)) throw new TripInputError("סוג הטיול לא תקין");
    tripType = body.tripType;
  }

  const visibility = (body.visibility ?? "public") as PostVisibility;
  if (!VISIBILITIES.includes(visibility)) throw new TripInputError("הגדרת הפרטיות לא תקינה");

  const rawDays = Array.isArray(body.days) ? body.days : [];
  const days: SaveTripInput["days"] = [];
  for (const rawDay of rawDays) {
    const rawStops = Array.isArray((rawDay as { stops?: unknown })?.stops) ? ((rawDay as { stops: unknown[] }).stops as unknown[]) : [];
    const stops = rawStops.map((entry) => {
      const stop = entry as Record<string, unknown>;
      const placeId = typeof stop.placeId === "string" ? stop.placeId : "";
      if (!UUID_RE.test(placeId)) throw new TripInputError("אחת התחנות לא תקינה");
      let note: string | null = null;
      if (typeof stop.note === "string" && stop.note.trim()) {
        note = stop.note.trim();
        if (note.length > TRIP_LIMITS.maxNote) throw new TripInputError(`הערה ארוכה מדי (עד ${TRIP_LIMITS.maxNote} תווים)`);
      }
      return { placeId, note };
    });
    if (stops.length > 0) days.push({ stops });
  }

  const stopCount = days.reduce((sum, day) => sum + day.stops.length, 0);
  if (stopCount < TRIP_LIMITS.minStops) throw new TripInputError(`טיול חייב לכלול לפחות ${TRIP_LIMITS.minStops} תחנות`);
  if (stopCount > TRIP_LIMITS.maxStops) throw new TripInputError(`אפשר להוסיף עד ${TRIP_LIMITS.maxStops} תחנות לטיול`);
  if (days.length > TRIP_LIMITS.maxDays) throw new TripInputError(`אפשר לתכנן עד ${TRIP_LIMITS.maxDays} ימים`);

  return { title, description, coverUrl, tripType, visibility, days };
}

/** בודק שכל המקומות קיימים (הודעה ברורה במקום שגיאת FK). אותו מקום יכול להופיע כמה פעמים בטיול. */
async function assertPlacesExist(supabase: SupabaseClient, input: SaveTripInput): Promise<void> {
  const ids = [...new Set(input.days.flatMap((day) => day.stops.map((s) => s.placeId)))];
  const { data, error } = await supabase.from("places").select("id").in("id", ids);
  if (error) throw error;
  if ((data ?? []).length !== ids.length) throw new TripInputError("אחד המקומות לא נמצא - ייתכן שהוסר");
}

function toStopsPayload(input: SaveTripInput) {
  return input.days.flatMap((day, dayIndex) =>
    day.stops.map((stop, position) => ({ placeId: stop.placeId, day: dayIndex + 1, position, note: stop.note ?? null }))
  );
}

// ────────────────────────────────────────────────────────────────────────────
// יצירה / עריכה / מחיקה
// ────────────────────────────────────────────────────────────────────────────

export async function createTrip(supabase: SupabaseClient, userId: string, input: SaveTripInput): Promise<string> {
  await assertPlacesExist(supabase, input);

  const { data: created, error } = await supabase
    .from("trips")
    .insert({
      author_id: userId,
      title: input.title,
      description: input.description,
      cover_url: input.coverUrl,
      trip_type: input.tripType,
      visibility: input.visibility,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: stopsError } = await supabase.rpc("replace_trip_stops", { p_trip_id: created.id, p_stops: toStopsPayload(input) });
  if (stopsError) {
    // אין טרנזקציה בין יצירת הטיול לתחנות - מנקים את הטיול ה"ריק" כדי שלא יישאר טיול בלי תחנות.
    await supabase.from("trips").delete().eq("id", created.id).eq("author_id", userId);
    throw stopsError;
  }
  return created.id as string;
}

/** עריכה מלאה ע"י היוצר: פרטים + כל התחנות (הוספה/הסרה/סדר/ימים/הערות). התחנות מוחלפות באטומיות
 *  (replace_trip_stops = טרנזקציה אחת) - כשל באמצע לא משאיר טיול חצי-מעודכן. */
export async function updateTrip(supabase: SupabaseClient, userId: string, tripId: string, raw: unknown): Promise<void> {
  const { data: existing, error: existingError } = await supabase.from("trips").select("id, author_id").eq("id", tripId).maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new TripInputError("הטיול לא נמצא");
  if (existing.author_id !== userId) throw new TripInputError("רק היוצר יכול לערוך את הטיול");

  const input = parseTripInput(raw);
  await assertPlacesExist(supabase, input);

  const { error: updateError } = await supabase
    .from("trips")
    .update({
      title: input.title,
      description: input.description,
      cover_url: input.coverUrl,
      trip_type: input.tripType,
      visibility: input.visibility,
    })
    .eq("id", tripId)
    .eq("author_id", userId);
  if (updateError) throw updateError;

  const { error: stopsError } = await supabase.rpc("replace_trip_stops", { p_trip_id: tripId, p_stops: toStopsPayload(input) });
  if (stopsError) throw stopsError;
}

/** מחיקה אמיתית - ה-FK cascade מנקה תחנות/לייקים/תגובות ופריטים באוספים. */
export async function deleteTrip(supabase: SupabaseClient, userId: string, tripId: string): Promise<void> {
  const { error } = await supabase.from("trips").delete().eq("id", tripId).eq("author_id", userId);
  if (error) throw error;
}

// ────────────────────────────────────────────────────────────────────────────
// קריאה (Hydration) - בלי N+1: שאילתה לכל טבלה לכל עמוד תוצאות
// ────────────────────────────────────────────────────────────────────────────

interface TripRow {
  id: string;
  author_id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  trip_type: string | null;
  visibility: PostVisibility;
  created_at: string;
}

interface StopRow {
  id: string;
  trip_id: string;
  place_id: string;
  day_index: number;
  position: number;
  note: string | null;
}

const TRIP_COLUMNS = "id, author_id, title, description, cover_url, trip_type, visibility, created_at";
const PLACE_COLUMNS = "id, name, category, city, rating, image_urls, latitude, longitude";

/** places קריא לכל משתמש מחובר - ה-client הרגיל מספיק. */
async function loadPlaces(supabase: SupabaseClient, placeIds: string[]): Promise<Map<string, TripPlaceDto>> {
  const map = new Map<string, TripPlaceDto>();
  if (placeIds.length === 0) return map;
  const { data } = await supabase.from("places").select(PLACE_COLUMNS).in("id", placeIds);
  for (const p of data ?? []) {
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
    map.set(row.id, {
      id: row.id,
      name: row.name,
      category: row.category,
      city: row.city,
      rating: row.rating,
      imageUrls: row.image_urls ?? [],
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }
  return map;
}

function sortStops(rows: StopRow[]): StopRow[] {
  return [...rows].sort((a, b) => a.day_index - b.day_index || a.position - b.position);
}

function countBy(rows: { trip_id: unknown }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = row.trip_id as string;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** בונה TripCardDto לרשימת טיולים (ואת התחנות המלאות, אם mode="full").
 *  mode="card": רק CARD_HYDRATE_SIZE התחנות הראשונות של כל טיול (מספיק ל-Preview ול-Cover אוטומטי). */
async function buildTrips(
  supabase: SupabaseClient,
  viewerId: string,
  rows: TripRow[],
  mode: "card" | "full"
): Promise<{ cards: TripCardDto[]; stopsByTrip: Map<string, TripStopDto[]> }> {
  if (rows.length === 0) return { cards: [], stopsByTrip: new Map() };

  const ids = rows.map((r) => r.id);
  const authorIds = [...new Set(rows.map((r) => r.author_id))];

  const [authorsRes, stopsRes, likesRes, commentsRes, viewerLikesRes, viewerSavesRes] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url, is_creator").in("id", authorIds),
    supabase.from("trip_stops").select("id, trip_id, place_id, day_index, position, note").in("trip_id", ids),
    supabase.from("post_likes").select("trip_id").in("trip_id", ids),
    supabase.from("comments").select("trip_id").in("trip_id", ids).is("deleted_at", null),
    supabase.from("post_likes").select("trip_id").in("trip_id", ids).eq("user_id", viewerId),
    supabase.from("social_saves").select("target_id").in("target_id", ids).eq("user_id", viewerId).eq("target_type", "trip"),
  ]);

  const authorsById = new Map((authorsRes.data ?? []).map((a) => [a.id as string, a]));

  const stopRowsByTrip = new Map<string, StopRow[]>();
  for (const row of (stopsRes.data ?? []) as StopRow[]) {
    const list = stopRowsByTrip.get(row.trip_id) ?? [];
    list.push(row);
    stopRowsByTrip.set(row.trip_id, list);
  }
  for (const [tripId, list] of stopRowsByTrip) stopRowsByTrip.set(tripId, sortStops(list));

  const rowsToHydrate =
    mode === "full" ? [...stopRowsByTrip.values()].flat() : [...stopRowsByTrip.values()].flatMap((list) => list.slice(0, CARD_HYDRATE_SIZE));
  const placesById = await loadPlaces(supabase, [...new Set(rowsToHydrate.map((r) => r.place_id))]);

  const stopsByTrip = new Map<string, TripStopDto[]>();
  for (const [tripId, list] of stopRowsByTrip) {
    const scoped = mode === "full" ? list : list.slice(0, CARD_HYDRATE_SIZE);
    const dtos: TripStopDto[] = [];
    for (const row of scoped) {
      const place = placesById.get(row.place_id);
      if (place) dtos.push({ id: row.id, day: row.day_index, position: row.position, note: row.note, place });
    }
    stopsByTrip.set(tripId, dtos);
  }

  const likeCount = countBy(likesRes.data ?? []);
  const commentCount = countBy(commentsRes.data ?? []);
  const viewerLiked = new Set((viewerLikesRes.data ?? []).map((r) => r.trip_id as string));
  const viewerSaved = new Set((viewerSavesRes.data ?? []).map((r) => r.target_id as string));

  const cards = rows.map((row): TripCardDto => {
    const author = authorsById.get(row.author_id);
    const authorDto: CollectionAuthorDto = {
      id: row.author_id,
      username: author?.username ?? null,
      fullName: author?.full_name ?? null,
      avatarUrl: author?.avatar_url ?? null,
      isCreator: author?.is_creator ?? false,
    };
    const allRows = stopRowsByTrip.get(row.id) ?? [];
    const hydrated = stopsByTrip.get(row.id) ?? [];

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      createdAt: row.created_at,
      visibility: row.visibility,
      tripType: isTripTypeId(row.trip_type) ? row.trip_type : null,
      author: authorDto,
      stopCount: allRows.length,
      dayCount: allRows.reduce((max, r) => Math.max(max, r.day_index), 0),
      coverUrl: row.cover_url,
      autoCoverUrl: hydrated.map((s) => s.place.imageUrls[0]).find((url): url is string => !!url) ?? null,
      previewStops: hydrated.slice(0, PREVIEW_SIZE).map((s) => ({
        name: s.place.name,
        category: s.place.category,
        imageUrl: s.place.imageUrls[0] ?? null,
      })),
      stats: { likes: likeCount.get(row.id) ?? 0, comments: commentCount.get(row.id) ?? 0 },
      viewerState: { liked: viewerLiked.has(row.id), saved: viewerSaved.has(row.id), isSelf: row.author_id === viewerId },
    };
  });

  return { cards, stopsByTrip };
}

/** טיול בודד. null = לא קיים או שהצופה לא רשאי לראות אותו (ה-RLS של trips מחליט - טיול פרטי לא זמין לאחרים). */
export async function getTrip(supabase: SupabaseClient, viewerId: string, tripId: string): Promise<TripDetailDto | null> {
  if (!UUID_RE.test(tripId)) return null;
  const { data, error } = await supabase.from("trips").select(TRIP_COLUMNS).eq("id", tripId).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { cards, stopsByTrip } = await buildTrips(supabase, viewerId, [data as TripRow], "full");
  return { ...cards[0], stops: stopsByTrip.get(tripId) ?? [] };
}

export interface TripCardsOptions {
  /** טאב ה-Feed (חברים / במעקב) - אותה משמעות כמו ב-getFeed. */
  tab?: FeedTab;
  /** רק טיולים של יוצר בודד (טאב "טיולים" בפרופיל). */
  authorId?: string;
  limit?: number;
  /** created_at של הפריט האחרון בעמוד הקודם. */
  cursor?: string;
  /** true ב-Feed: תוכן פרטי לא מופיע ב-Feed (גם לא ליוצר עצמו) - הוא נגיש רק מהפרופיל / ישירות. */
  excludePrivate?: boolean;
}

/** טיולים כ-Cards, מהחדש לישן. ה-RLS כבר מגביל למה שהצופה רשאי לראות. */
export async function getTripCards(supabase: SupabaseClient, viewerId: string, options: TripCardsOptions = {}): Promise<TripCardDto[]> {
  const { tab = "for_you", authorId, limit = 15, cursor, excludePrivate = false } = options;

  const authorFilterIds = await resolveFeedAuthorIds(supabase, viewerId, tab);
  if (authorFilterIds && authorFilterIds.length === 0) return [];

  let query = supabase.from("trips").select(TRIP_COLUMNS).order("created_at", { ascending: false }).limit(limit);
  if (authorId) query = query.eq("author_id", authorId);
  if (authorFilterIds) query = query.in("author_id", authorFilterIds);
  if (cursor) query = query.lt("created_at", cursor);
  if (excludePrivate) query = query.neq("visibility", "private");

  const { data, error } = await query;
  if (error) throw error;

  const { cards } = await buildTrips(supabase, viewerId, (data ?? []) as TripRow[], "card");
  return cards;
}

/** הטיולים ששמרתי (social_saves, target_type='trip') - רק אלה שעדיין גלויים לי (ה-RLS מסנן טיולים שהפכו פרטיים). */
export async function getViewerSavedTripCards(supabase: SupabaseClient, viewerId: string, limit = 50): Promise<TripCardDto[]> {
  const { data: saves, error } = await supabase
    .from("social_saves")
    .select("target_id")
    .eq("user_id", viewerId)
    .eq("target_type", "trip")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const ids = (saves ?? []).map((s) => s.target_id as string);
  if (ids.length === 0) return [];

  const { data: rows, error: tripsError } = await supabase.from("trips").select(TRIP_COLUMNS).in("id", ids);
  if (tripsError) throw tripsError;

  const { cards } = await buildTrips(supabase, viewerId, (rows ?? []) as TripRow[], "card");
  // שומרים על סדר השמירה (החדש ראשון)
  const order = new Map(ids.map((id, index) => [id, index]));
  return cards.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** תקציר טיול (כותרת/תמונה/מספר תחנות) לתצוגת פריט-טיול בתוך אוסף (collectionService).
 *  ה-client הרגיל - טיול שהצופה לא רשאי לראות פשוט לא חוזר (ה-RLS מכבד visibility). */
export interface TripSummary {
  title: string;
  imageUrl: string | null;
  stopCount: number;
  /** נקודות המסלול לפי יום וסדר (רק תחנות עם מיקום) - למפת "חוויה של טיולים". */
  route: { latitude: number; longitude: number }[];
}

export async function getTripSummaries(supabase: SupabaseClient, viewerId: string, tripIds: string[]): Promise<Map<string, TripSummary>> {
  const result = new Map<string, TripSummary>();
  if (tripIds.length === 0) return result;

  const { data } = await supabase.from("trips").select(TRIP_COLUMNS).in("id", tripIds);
  // *** "full" (במקום "card"): צריך את כל התחנות עם המיקומים שלהן כדי לצייר את המסלול על המפה.
  const { cards, stopsByTrip } = await buildTrips(supabase, viewerId, (data ?? []) as TripRow[], "full");
  for (const card of cards) {
    const route = (stopsByTrip.get(card.id) ?? [])
      .filter((s) => s.place.latitude != null && s.place.longitude != null)
      .map((s) => ({ latitude: s.place.latitude as number, longitude: s.place.longitude as number }));
    result.set(card.id, { title: card.title, imageUrl: card.coverUrl ?? card.autoCoverUrl, stopCount: card.stopCount, route });
  }
  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// אינטראקציות: Like / Comment (Save עובר דרך toggleSocialSave הקיים, target_type='trip')
// ────────────────────────────────────────────────────────────────────────────

export const toggleTripLike = (supabase: SupabaseClient, tripId: string, userId: string) =>
  toggleTargetLike(supabase, "trip_id", tripId, userId);

export const getTripComments = (supabase: SupabaseClient, tripId: string, limit = 30, before?: string) =>
  getTargetComments(supabase, "trip_id", tripId, limit, before);

export const addTripComment = (supabase: SupabaseClient, tripId: string, authorId: string, text: string, parentCommentId?: string) =>
  addTargetComment(supabase, "trip_id", tripId, authorId, text, parentCommentId);

export const deleteTripComment = (supabase: SupabaseClient, commentId: string, authorId: string) =>
  deleteTargetComment(supabase, "trip_id", commentId, authorId);
