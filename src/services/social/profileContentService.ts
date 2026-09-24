import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/services/supabase/admin";
import type { ProfileContentFilter, ProfileTileDto } from "./profileContentTypes";

/**
 * תוכן הפרופיל כ-Grid אחד: פוסטים + ביקורות + אוספים + טיולים של משתמש, ממוזגים לפי זמן.
 *
 * *** מהירות (בקשה מפורשת - "הפרופיל נטען המון זמן, הכל צריך להיות מהיר וישר"): אריח צריך רק תמונה + כותרת + דירוג,
 * לא לייקים/תגובות/מחברים/viewerState. לכן כאן שאילתות רזות במקום getFeed / getCollectionCards / getTripCards
 * (שהן ~10 שאילתות כל אחת): כל המקורות רצים במקביל, ובסך הכל 2 סבבי רשת:
 *  - פוסטים: שאילתה אחת, ואז במקביל (מדיה, מקומות, tripadd, דירוגי ביקורות)
 *  - אוספים / טיולים: שאילתה אחת כל אחד, עם embed לתמונה הראשונה (בלי סבב נוסף)
 * ה-RLS של כל טבלה ממשיך לקבוע מה הצופה רשאי לראות. מיזוג + cursor כמו ב-/api/social/feed: שולפים limit מכל
 * מקור (created_at < cursor), ממיינים, חותכים ל-limit; ה-cursor הבא = createdAt של האריח האחרון שהוחזר.
 */

interface PostRow {
  id: string;
  text: string | null;
  post_type: string;
  place_id: string | null;
  tripadd_submission_id: string | null;
  created_at: string;
}

async function getPostTiles(
  supabase: SupabaseClient,
  authorId: string,
  filter: ProfileContentFilter,
  cursor: string | undefined,
  limit: number
): Promise<{ tiles: ProfileTileDto[]; full: boolean }> {
  let query = supabase
    .from("posts")
    .select("id, text, post_type, place_id, tripadd_submission_id, created_at")
    .eq("author_id", authorId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (cursor) query = query.lt("created_at", cursor);
  if (filter === "review") query = query.eq("post_type", "review");
  else if (filter === "post") query = query.neq("post_type", "review");

  const { data, error } = await query;
  if (error) throw error;
  const posts = (data ?? []) as PostRow[];
  if (posts.length === 0) return { tiles: [], full: false };

  const ids = posts.map((p) => p.id);
  const placeIds = [...new Set(posts.map((p) => p.place_id).filter(Boolean))] as string[];
  const tripAddIds = [...new Set(posts.map((p) => p.tripadd_submission_id).filter(Boolean))] as string[];
  const reviewIds = posts.filter((p) => p.post_type === "review").map((p) => p.id);

  // מדיה ו-tripadd דרך admin client - אותה סיבה בדיוק כמו ב-getFeed: RLS על media_assets/tripadd_submissions מוגבל,
  // וכאן זה רק "השלמת תצוגה" לפוסטים שכבר עברו RLS מלא בשאילתת posts למעלה.
  const admin = createAdminClient();
  const [mediaRes, placesRes, tripAddRes, ratingsRes] = await Promise.all([
    admin
      .from("post_media")
      .select("post_id, sort_order, media:media_assets(type, url, thumbnail_url)")
      .in("post_id", ids)
      .order("sort_order", { ascending: true }),
    placeIds.length ? supabase.from("places").select("id, name, image_urls").in("id", placeIds) : Promise.resolve({ data: [] }),
    tripAddIds.length
      ? admin.from("tripadd_submissions").select("id, name, tripadd_submission_media(sort_order, media_assets(url))").in("id", tripAddIds)
      : Promise.resolve({ data: [] }),
    reviewIds.length ? supabase.from("place_reviews").select("post_id, rating").in("post_id", reviewIds) : Promise.resolve({ data: [] }),
  ]);

  const firstMedia = new Map<string, { type: string; url: string; thumb: string | null }>();
  for (const row of (mediaRes.data ?? []) as unknown as { post_id: string; media: { type: string; url: string; thumbnail_url: string | null } | null }[]) {
    if (!row.media || firstMedia.has(row.post_id)) continue;
    firstMedia.set(row.post_id, { type: row.media.type, url: row.media.url, thumb: row.media.thumbnail_url });
  }
  const placesById = new Map(
    ((placesRes.data ?? []) as { id: string; name: string; image_urls: string[] | null }[]).map((p) => [p.id, { name: p.name, imageUrl: p.image_urls?.[0] ?? null }])
  );
  const tripAddById = new Map(
    ((tripAddRes.data ?? []) as unknown as { id: string; name: string; tripadd_submission_media?: { sort_order: number; media_assets: { url: string } | null }[] | null }[]).map(
      (t) => {
        const first = (t.tripadd_submission_media ?? []).filter((m) => m.media_assets?.url).sort((a, b) => a.sort_order - b.sort_order)[0];
        return [t.id, { name: t.name, imageUrl: first?.media_assets?.url ?? null }] as const;
      }
    )
  );
  const ratingByPost = new Map<string, number>();
  for (const row of (ratingsRes.data ?? []) as { post_id: string | null; rating: number | null }[]) {
    if (row.post_id && row.rating != null) ratingByPost.set(row.post_id, Number(row.rating));
  }

  const tiles = posts.map((post): ProfileTileDto => {
    const media = firstMedia.get(post.id);
    const isVideo = media?.type === "video";
    const isReview = post.post_type === "review";
    const place = post.tripadd_submission_id ? tripAddById.get(post.tripadd_submission_id) : post.place_id ? placesById.get(post.place_id) : undefined;
    return {
      key: `${isReview ? "review" : "post"}:${post.id}`,
      id: post.id,
      kind: isReview ? "review" : "post",
      href: `/places/post/${post.id}`,
      createdAt: post.created_at,
      imageUrl: media ? (isVideo ? media.thumb : media.url) : (place?.imageUrl ?? null),
      isVideo,
      videoUrl: isVideo && !media?.thumb ? media?.url ?? null : null,
      title: place?.name ?? null,
      text: post.text ? post.text.slice(0, 140) : null,
      rating: isReview ? (ratingByPost.get(post.id) ?? null) : null,
    };
  });
  return { tiles, full: posts.length === limit };
}

async function getCollectionTiles(supabase: SupabaseClient, authorId: string, cursor: string | undefined, limit: number): Promise<{ tiles: ProfileTileDto[]; full: boolean }> {
  let query = supabase
    .from("collections")
    .select("id, title, cover_url, created_at, collection_items(position, place:places(image_urls), trip:trips(cover_url))")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .order("position", { referencedTable: "collection_items", ascending: true })
    .limit(1, { referencedTable: "collection_items" });
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) return { tiles: [], full: false }; // migration 0089 עוד לא הורצה - אין אוספים
  type Row = {
    id: string;
    title: string;
    cover_url: string | null;
    created_at: string;
    collection_items: { place: { image_urls: string[] | null } | null; trip: { cover_url: string | null } | null }[];
  };
  const rows = (data ?? []) as unknown as Row[];
  return {
    tiles: rows.map(
      (c): ProfileTileDto => ({
        key: `collection:${c.id}`,
        id: c.id,
        kind: "collection",
        href: `/places/collection/${c.id}`,
        createdAt: c.created_at,
        imageUrl: c.cover_url ?? c.collection_items[0]?.place?.image_urls?.[0] ?? c.collection_items[0]?.trip?.cover_url ?? null,
        isVideo: false,
        title: c.title,
        text: null,
        rating: null,
      })
    ),
    full: rows.length === limit,
  };
}

async function getTripTiles(supabase: SupabaseClient, authorId: string, cursor: string | undefined, limit: number): Promise<{ tiles: ProfileTileDto[]; full: boolean }> {
  let query = supabase
    .from("trips")
    .select("id, title, cover_url, created_at, trip_stops(day_index, position, place:places(image_urls))")
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .order("day_index", { referencedTable: "trip_stops", ascending: true })
    .order("position", { referencedTable: "trip_stops", ascending: true })
    .limit(1, { referencedTable: "trip_stops" });
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) return { tiles: [], full: false }; // migration 0090 עוד לא הורצה - אין טיולים
  type Row = { id: string; title: string; cover_url: string | null; created_at: string; trip_stops: { place: { image_urls: string[] | null } | null }[] };
  const rows = (data ?? []) as unknown as Row[];
  return {
    tiles: rows.map(
      (t): ProfileTileDto => ({
        key: `trip:${t.id}`,
        id: t.id,
        kind: "trip",
        href: `/places/trip/${t.id}`,
        createdAt: t.created_at,
        imageUrl: t.cover_url ?? t.trip_stops[0]?.place?.image_urls?.[0] ?? null,
        isVideo: false,
        title: t.title,
        text: null,
        rating: null,
      })
    ),
    full: rows.length === limit,
  };
}

export async function getProfileContent(
  supabase: SupabaseClient,
  authorId: string,
  filter: ProfileContentFilter,
  cursor?: string,
  limit = 18
): Promise<{ tiles: ProfileTileDto[]; nextCursor: string | null }> {
  const empty = { tiles: [] as ProfileTileDto[], full: false };
  const [posts, collections, trips] = await Promise.all([
    filter === "all" || filter === "post" || filter === "review" ? getPostTiles(supabase, authorId, filter, cursor, limit) : Promise.resolve(empty),
    filter === "all" || filter === "collection" ? getCollectionTiles(supabase, authorId, cursor, limit) : Promise.resolve(empty),
    filter === "all" || filter === "trip" ? getTripTiles(supabase, authorId, cursor, limit) : Promise.resolve(empty),
  ]);

  const tiles = [...posts.tiles, ...collections.tiles, ...trips.tiles].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const page = tiles.slice(0, limit);
  const hasMore = tiles.length > limit || posts.full || collections.full || trips.full;
  return { tiles: page, nextCursor: hasMore && page.length > 0 ? page[page.length - 1].createdAt : null };
}
