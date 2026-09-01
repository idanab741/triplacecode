import type { SupabaseClient } from "@supabase/supabase-js";

export type FeedTab = "for_you" | "friends" | "following";

export interface FeedItemDto {
  id: string;
  type: string;
  createdAt: string;
  text: string | null;
  author: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null; isCreator: boolean };
  media: { id: string; type: string; url: string; thumbnailUrl: string | null }[];
  place: { id: string; name: string; imageUrl: string | null } | null;
  destination: { id: string; name: string } | null;
  stats: { likes: number; comments: number };
  viewerState: { liked: boolean; saved: boolean; following: boolean; isSelf: boolean };
  nextCursor: string | null;
}

/** מביא Feed לפי טאב, בלי N+1: שאילתת posts אחת, ואז batched queries
 *  לכל ה-authors/media/stats/viewerState של אותו עמוד תוצאות (סעיף 84,100). */
export async function getFeed(
  supabase: SupabaseClient,
  viewerId: string,
  tab: FeedTab,
  limit = 15,
  cursor?: string
): Promise<{ items: FeedItemDto[]; nextCursor: string | null }> {
  let authorFilterIds: string[] | null = null;

  if (tab === "friends") {
    const { data } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
      .eq("status", "accepted");
    authorFilterIds = (data ?? []).map((row) => (row.requester_id === viewerId ? row.addressee_id : row.requester_id));
    if (authorFilterIds.length === 0) return { items: [], nextCursor: null };
  } else if (tab === "following") {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
    authorFilterIds = (data ?? []).map((row) => row.following_id);
    if (authorFilterIds.length === 0) return { items: [], nextCursor: null };
  }
  // tab === "for_you": ה-RLS כבר מגביל ל-public/followers/friends רלוונטיים;
  // דירוג התאמה אישית (Travel DNA/relevance) מתווסף בשלב 3 (Advanced Feed Ranking, סעיף 58)

  let query = supabase
    .from("posts")
    .select("id, author_id, text, post_type, place_id, destination_id, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (authorFilterIds) query = query.in("author_id", authorFilterIds);
  if (cursor) query = query.lt("created_at", cursor);

  const { data: posts, error } = await query;
  if (error) throw error;
  if (!posts || posts.length === 0) return { items: [], nextCursor: null };

  const postIds = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const placeIds = [...new Set(posts.map((p) => p.place_id).filter(Boolean))] as string[];
  const destinationIds = [...new Set(posts.map((p) => p.destination_id).filter(Boolean))] as string[];

  const [authorsRes, placesRes, destinationsRes, mediaRes, likesRes, commentsRes, viewerLikesRes, viewerSavesRes, followingRes] =
    await Promise.all([
      supabase.from("profiles").select("id, username, full_name, avatar_url, is_creator").in("id", authorIds),
      placeIds.length ? supabase.from("places").select("id, name, image_urls").in("id", placeIds) : Promise.resolve({ data: [] }),
      destinationIds.length
        ? supabase.from("destinations").select("id, name").in("id", destinationIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("post_media")
        .select("post_id, sort_order, media:media_assets(id, type, url, thumbnail_url)")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true }),
      supabase.from("post_likes").select("post_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds).is("deleted_at", null),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", viewerId),
      supabase.from("social_saves").select("target_id").in("target_id", postIds).eq("user_id", viewerId).eq("target_type", "post"),
      supabase.from("follows").select("following_id").eq("follower_id", viewerId).in("following_id", authorIds),
    ]);

  const authorsById = new Map((authorsRes.data ?? []).map((a) => [a.id, a]));
  const placesById = new Map(
    (placesRes.data ?? []).map((p: { id: string; name: string; image_urls?: string[] | null }) => [
      p.id,
      { id: p.id, name: p.name, imageUrl: p.image_urls?.[0] ?? null },
    ])
  );
  const destinationsById = new Map((destinationsRes.data ?? []).map((d) => [d.id, d]));
  const mediaByPost = new Map<string, { id: string; type: string; url: string; thumbnailUrl: string | null }[]>();
  for (const row of mediaRes.data ?? []) {
    const media = row.media as unknown as { id: string; type: string; url: string; thumbnail_url: string | null };
    if (!media) continue;
    const list = mediaByPost.get(row.post_id) ?? [];
    list.push({ id: media.id, type: media.type, url: media.url, thumbnailUrl: media.thumbnail_url });
    mediaByPost.set(row.post_id, list);
  }
  const likeCountByPost = countBy(likesRes.data ?? [], "post_id");
  const commentCountByPost = countBy(commentsRes.data ?? [], "post_id");
  const viewerLikedSet = new Set((viewerLikesRes.data ?? []).map((r) => r.post_id));
  const viewerSavedSet = new Set((viewerSavesRes.data ?? []).map((r) => r.target_id));
  const followingSet = new Set((followingRes.data ?? []).map((r) => r.following_id));

  const items: FeedItemDto[] = posts.map((post) => {
    const author = authorsById.get(post.author_id);
    return {
      id: post.id,
      type: post.post_type,
      createdAt: post.created_at,
      text: post.text,
      author: {
        id: post.author_id,
        username: author?.username ?? null,
        fullName: author?.full_name ?? null,
        avatarUrl: author?.avatar_url ?? null,
        isCreator: author?.is_creator ?? false,
      },
      media: mediaByPost.get(post.id) ?? [],
      place: post.place_id ? placesById.get(post.place_id) ?? null : null,
      destination: post.destination_id ? destinationsById.get(post.destination_id) ?? null : null,
      stats: { likes: likeCountByPost.get(post.id) ?? 0, comments: commentCountByPost.get(post.id) ?? 0 },
      viewerState: {
        liked: viewerLikedSet.has(post.id),
        saved: viewerSavedSet.has(post.id),
        following: followingSet.has(post.author_id) || post.author_id === viewerId,
        isSelf: post.author_id === viewerId,
      },
      nextCursor: null,
    };
  });

  const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null;
  return { items, nextCursor };
}

function countBy<T extends Record<string, unknown>>(rows: T[], key: keyof T): Map<unknown, number> {
  const map = new Map<unknown, number>();
  for (const row of rows) {
    const k = row[key];
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** Feed ריק למשתמש חדש - נותן Creators/Public content רלוונטי לפי Preferences
 *  במקום מסך ריק (סעיף 59). כרגע גרסה בסיסית: creators מובילים + פוסטים ציבוריים
 *  אחרונים; התאמה מלאה לפי Travel DNA מתווספת בשלב 3 (Advanced Feed Ranking). */
export async function getNewUserFeed(supabase: SupabaseClient, viewerId: string, limit = 15) {
  return getFeed(supabase, viewerId, "for_you", limit);
}
