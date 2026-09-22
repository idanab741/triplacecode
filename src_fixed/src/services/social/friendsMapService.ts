import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/services/supabase/admin";

export interface FriendsMapRecommender {
  id: string;
  name: string;
  avatarUrl: string | null;
  isSelf: boolean;
}

export interface FriendsMapPin {
  /** מפתח יציב לפין (סוג+id) - משמש גם כ-key ב-React. */
  key: string;
  placeId: string;
  source: "place" | "tripadd";
  name: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  city: string | null;
  rating: number | null;
  ratingCount: number | null;
  /** מי המליץ (הכי עדכני קודם, עד 5). */
  recommenders: FriendsMapRecommender[];
  recommendersCount: number;
  latestText: string | null;
  latestAt: string;
  hasFriend: boolean;
  hasSelf: boolean;
}

const POST_LIMIT = 300;
const TEXT_SNIPPET_CHARS = 140;

/**
 * *** חדש (בקשה מפורשת - "המפה בעמוד place's: כל ההמלצות של החברים"): מאחד את כל
 * הפוסטים שמקושרים למקום (places או tripadd) של החברים המאושרים של הצופה - וגם של
 * הצופה עצמו, כדי שהמפה לא תהיה ריקה למי שעוד אין לו חברים - לפינים ייחודיים
 * למקום, כשלכל פין: מי המליץ, מתי, ופסקת הטקסט האחרונה.
 * הפוסטים נשלפים עם הלקוח הרגיל (RLS כבר מסנן מה שהצופה רשאי לראות); פרטי
 * tripadd (שהטבלה שלו מוגבלת ב-RLS) מושלמים עם admin client - רק כתצוגה לפוסטים
 * שכבר אושרו כנראים, בדיוק כמו ב-feedService.
 */
export async function getFriendsMapPins(
  supabase: SupabaseClient,
  viewerId: string
): Promise<{ pins: FriendsMapPin[]; friendsCount: number }> {
  const { data: friendships } = await supabase
    .from("friendships")
    .select("requester_id, addressee_id")
    .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
    .eq("status", "accepted");
  const friendIds = (friendships ?? []).map((row) => (row.requester_id === viewerId ? row.addressee_id : row.requester_id));
  const authorIds = [viewerId, ...friendIds];

  const { data: posts, error } = await supabase
    .from("posts")
    .select("id, author_id, text, place_id, tripadd_submission_id, created_at")
    .is("deleted_at", null)
    .in("author_id", authorIds)
    .or("place_id.not.is.null,tripadd_submission_id.not.is.null")
    .order("created_at", { ascending: false })
    .limit(POST_LIMIT);
  if (error) throw error;
  if (!posts || posts.length === 0) return { pins: [], friendsCount: friendIds.length };

  const placeIds = [...new Set(posts.map((p) => p.place_id).filter(Boolean))] as string[];
  const tripAddIds = [...new Set(posts.map((p) => p.tripadd_submission_id).filter(Boolean))] as string[];

  const [profilesRes, placesRes, tripAddRes] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", authorIds),
    placeIds.length
      ? supabase.from("places").select("id, name, image_urls, latitude, longitude, city, rating, rating_count").in("id", placeIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    tripAddIds.length
      ? createAdminClient()
          .from("tripadd_submissions")
          .select(
            "id, name, latitude, longitude, city, address, google_rating, google_rating_count, tripadd_submission_media(sort_order, media_assets(url))"
          )
          .in("id", tripAddIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  interface ProfileRow {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  }
  const profilesById = new Map<string, ProfileRow>(
    ((profilesRes.data ?? []) as ProfileRow[]).map((p): [string, ProfileRow] => [p.id, p])
  );

  interface PlaceInfo {
    name: string;
    latitude: number | null;
    longitude: number | null;
    imageUrl: string | null;
    city: string | null;
    rating: number | null;
    ratingCount: number | null;
  }
  const placeInfo = new Map<string, PlaceInfo>();
  for (const row of (placesRes.data ?? []) as Record<string, unknown>[]) {
    const images = row.image_urls as string[] | null;
    placeInfo.set(`place:${row.id}`, {
      name: row.name as string,
      latitude: (row.latitude as number | null) ?? null,
      longitude: (row.longitude as number | null) ?? null,
      imageUrl: images?.[0] ?? null,
      city: (row.city as string | null) ?? null,
      rating: (row.rating as number | null) ?? null,
      ratingCount: (row.rating_count as number | null) ?? null,
    });
  }
  for (const row of (tripAddRes.data ?? []) as Record<string, unknown>[]) {
    const media = (row.tripadd_submission_media as { sort_order: number; media_assets: { url: string } | null }[] | null)
      ?.filter((m) => m.media_assets?.url)
      .sort((a, b) => a.sort_order - b.sort_order);
    placeInfo.set(`tripadd:${row.id}`, {
      name: row.name as string,
      latitude: (row.latitude as number | null) ?? null,
      longitude: (row.longitude as number | null) ?? null,
      imageUrl: media?.[0]?.media_assets?.url ?? null,
      city: (row.city as string | null) ?? (row.address as string | null) ?? null,
      rating: (row.google_rating as number | null) ?? null,
      ratingCount: (row.google_rating_count as number | null) ?? null,
    });
  }

  const pinsByKey = new Map<string, FriendsMapPin>();
  // posts כבר ממוין מהחדש לישן - הראשון שנתקלים בו הוא העדכני ביותר לאותו מקום.
  for (const post of posts) {
    const source: "place" | "tripadd" = post.place_id ? "place" : "tripadd";
    const placeId = (post.place_id ?? post.tripadd_submission_id) as string;
    const key = `${source}:${placeId}`;
    const info = placeInfo.get(key);
    if (!info || info.latitude == null || info.longitude == null) continue;

    const author = profilesById.get(post.author_id as string);
    const recommender: FriendsMapRecommender = {
      id: post.author_id as string,
      name: author?.full_name ?? author?.username ?? "מטייל",
      avatarUrl: author?.avatar_url ?? null,
      isSelf: post.author_id === viewerId,
    };

    let pin = pinsByKey.get(key);
    if (!pin) {
      const text = (post.text as string | null)?.trim() || null;
      pin = {
        key,
        placeId,
        source,
        name: info.name,
        latitude: info.latitude,
        longitude: info.longitude,
        imageUrl: info.imageUrl,
        city: info.city,
        rating: info.rating,
        ratingCount: info.ratingCount,
        recommenders: [],
        recommendersCount: 0,
        latestText: text ? (text.length > TEXT_SNIPPET_CHARS ? `${text.slice(0, TEXT_SNIPPET_CHARS)}…` : text) : null,
        latestAt: post.created_at as string,
        hasFriend: false,
        hasSelf: false,
      };
      pinsByKey.set(key, pin);
    }
    if (!pin.recommenders.some((r) => r.id === recommender.id)) {
      pin.recommendersCount += 1;
      if (pin.recommenders.length < 5) pin.recommenders.push(recommender);
      if (recommender.isSelf) pin.hasSelf = true;
      else pin.hasFriend = true;
    }
  }

  return { pins: [...pinsByKey.values()], friendsCount: friendIds.length };
}
