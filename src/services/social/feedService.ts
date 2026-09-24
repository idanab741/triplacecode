import type { SupabaseClient } from "@supabase/supabase-js";
import { getFriendIds } from "./friendIds";
import { createAdminClient } from "@/services/supabase/admin";

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
  /** shares = כמה פעמים הפוסט נשלח בצ'אט; saves = כמה שמרו אותו (בקשה מפורשת - "מספר ליד כל כפתור"). */
  stats: { likes: number; comments: number; shares?: number; saves?: number };
  /** *** ביצועים: עד 5 האחרונים שעשו לייק - מגיעים יחד עם הפיד, במקום בקשה נפרדת לכל פוסט. */
  likers?: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null }[];
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
  cursor?: string,
  authorId?: string,
  /** סינון לפי post_type (טאבים בפרופיל): include = רק הסוגים האלה, exclude = הכל חוץ מהסוגים האלה. */
  postTypes?: { include?: string[]; exclude?: string[] },
  /** *** תוספת (חיבור עמוד הפרופיל ל-PostMediaViewerModal - בקשה
   *  מפורשת "אמור לפתוח את החלונית כמו ב-places"): כשמועבר, מחזיר
   *  פוסט בודד לפי id (מתעלם מ-cursor/authorId/postTypes) - נוח לשליפת
   *  פוסט יחיד לצפייה, בלי לבנות endpoint נפרד עם כפילות לוגיקה. */
  postId?: string
): Promise<{ items: FeedItemDto[]; nextCursor: string | null }> {
  let authorFilterIds: string[] | null = null;

  if (tab === "friends") {
    // *** "חברים" = מי שאני עוקב אחריו + חברויות מאושרות - אותה הגדרה כמו במפה (friendIds.ts).
    authorFilterIds = [...(await getFriendIds(supabase, viewerId))];
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
    .select("id, author_id, text, post_type, place_id, destination_id, tripadd_submission_id, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  // *** נוסף (עמוד פרופיל - טאב "פוסטים"): מסנן לפוסטים של מחבר בודד
  // בלבד, בנפרד לגמרי מ-authorFilterIds (חברים/עוקב) - כאן רוצים את כל
  // הפוסטים של אותו משתמש שה-RLS מרשה לצופה לראות, לא רק אם הוא בין
  // החברים/הנעקבים של הצופה עצמו.
  if (authorId) query = query.eq("author_id", authorId);
  if (postId) query = query.eq("id", postId);
  if (postTypes?.include?.length) query = query.in("post_type", postTypes.include);
  if (postTypes?.exclude?.length) query = query.not("post_type", "in", `(${postTypes.exclude.join(",")})`);
  if (authorFilterIds) query = query.in("author_id", authorFilterIds);
  if (cursor) query = query.lt("created_at", cursor);

  const { data: posts, error } = await query;
  if (error) throw error;
  if (!posts || posts.length === 0) return { items: [], nextCursor: null };

  const postIds = posts.map((p) => p.id);
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const placeIds = [...new Set(posts.map((p) => p.place_id).filter(Boolean))] as string[];
  const destinationIds = [...new Set(posts.map((p) => p.destination_id).filter(Boolean))] as string[];
  // *** תוספת (בקשה מפורשת - "כשמוסיפים אטרקציה בעמוד הבית, שזה יופיע
  // גם כפוסט ב-place's"): posts.tripadd_submission_id (migration 0083) -
  // נפרד לגמרי מ-place_id הישן, ר' AddPlaceModal.tsx.
  const tripAddIds = [...new Set(posts.map((p) => p.tripadd_submission_id).filter(Boolean))] as string[];

  const [authorsRes, placesRes, destinationsRes, tripAddRes, mediaRes, likesRes, commentsRes, viewerLikesRes, viewerSavesRes, followingRes, sharesRes, savesRes] =
    await Promise.all([
      supabase.from("profiles").select("id, username, full_name, avatar_url, is_creator").in("id", authorIds),
      placeIds.length ? supabase.from("places").select("id, name, image_urls").in("id", placeIds) : Promise.resolve({ data: [] }),
      destinationIds.length
        ? supabase.from("destinations").select("id, name").in("id", destinationIds)
        : Promise.resolve({ data: [] }),
      // אותה סיבה בדיוק כמו ה-admin client על post_media למטה - RLS על
      // tripadd_submissions/media_assets מוגבל, וכאן זה "רק להשלים תצוגה"
      // לפוסטים שכבר עברו RLS filtering מלא בשאילתת posts למעלה.
      tripAddIds.length
        ? createAdminClient()
            .from("tripadd_submissions")
            .select("id, name, tripadd_submission_media(sort_order, media_assets(url))")
            .in("id", tripAddIds)
        : Promise.resolve({ data: [] }),
      // *** תיקון באג (בקשה מפורשת - "התמונות לא מופיעות לכל המשתמשים"):
      // media_assets ב-RLS מגביל SELECT לבעלים בלבד (auth.uid()=owner_id,
      // ר' מיגרציה 0067) - בדיוק אותה בעיה שכבר תועדה ותוקנה ב-
      // storyService.ts/getStoryRail. כשה-join הזה רץ עם ה-supabase
      // client הרגיל (כפוף ל-RLS של הצופה), פוסטים של מחברים אחרים
      // מקבלים media=null בשקט ומסוננים החוצה (ר' "if (!media) continue"
      // למטה) - הצופה רואה טקסט/צ'יפ מקום בלבד, בלי התמונה הגדולה של
      // הפוסט עצמו, גם כשהיא כן קיימת ב-DB. פותרים כאן עם admin client:
      // בטוח כי postIds כבר עברו RLS filtering מלא (visibility/חסימות)
      // בשאילתת posts למעלה - רק "משלימים" מדיה לפוסטים שכבר אושרו כנראים.
      createAdminClient()
        .from("post_media")
        .select("post_id, sort_order, media:media_assets(id, type, url, thumbnail_url)")
        .in("post_id", postIds)
        .order("sort_order", { ascending: true }),
      supabase.from("post_likes").select("post_id, user_id, created_at").in("post_id", postIds).order("created_at", { ascending: false }),
      // *** תיקון (בקשה מפורשת - "לכל תמונה תגובות משלה"): הספירה כאן
      // היא רק לתגובות הכלליות על הפוסט (media_id IS NULL) - בדיוק
      // מה שנפתח inline מתחת לשורה. תגובות על תמונות ספציפיות נספרות
      // בנפרד, בתוך חלון-הצפייה של כל תמונה.
      supabase.from("comments").select("post_id").in("post_id", postIds).is("deleted_at", null).is("media_id", null),
      supabase.from("post_likes").select("post_id").in("post_id", postIds).eq("user_id", viewerId),
      supabase.from("social_saves").select("target_id").in("target_id", postIds).eq("user_id", viewerId).eq("target_type", "post"),
      supabase.from("follows").select("following_id").eq("follower_id", viewerId).in("following_id", authorIds),
      // *** ספירות שיתופים ושמירות - admin client: ה-RLS של dm_messages / social_saves מאפשר לכל משתמש
      // לראות רק את השורות שלו, וכאן צריך את הסכום הכללי (רק מספר - בלי תוכן ההודעות או מי שמר).
      createAdminClient().from("dm_messages").select("post_id").in("post_id", postIds).eq("kind", "post"),
      createAdminClient().from("social_saves").select("target_id").in("target_id", postIds).eq("target_type", "post"),
    ]);

  const authorsById = new Map((authorsRes.data ?? []).map((a) => [a.id, a]));
  const placesById = new Map(
    (placesRes.data ?? []).map((p: { id: string; name: string; image_urls?: string[] | null }) => [
      p.id,
      { id: p.id, name: p.name, imageUrl: p.image_urls?.[0] ?? null },
    ])
  );
  const destinationsById = new Map((destinationsRes.data ?? []).map((d) => [d.id, d]));
  const tripAddPlacesById = new Map(
    (tripAddRes.data ?? []).map((t) => {
      const row = t as unknown as {
        id: string;
        name: string;
        tripadd_submission_media?: { sort_order: number; media_assets: { url: string } | null }[] | null;
      };
      const sorted = (row.tripadd_submission_media ?? [])
        .filter((m) => m.media_assets?.url)
        .sort((a, b) => a.sort_order - b.sort_order);
      return [row.id, { id: row.id, name: row.name, imageUrl: sorted[0]?.media_assets?.url ?? null }] as const;
    })
  );
  const mediaByPost = new Map<string, { id: string; type: string; url: string; thumbnailUrl: string | null }[]>();
  for (const row of mediaRes.data ?? []) {
    const media = row.media as unknown as { id: string; type: string; url: string; thumbnail_url: string | null };
    if (!media) continue;
    const list = mediaByPost.get(row.post_id) ?? [];
    list.push({ id: media.id, type: media.type, url: media.url, thumbnailUrl: media.thumbnail_url });
    mediaByPost.set(row.post_id, list);
  }
  const likeCountByPost = countBy(likesRes.data ?? [], "post_id");

  // עד 5 מי-שעשו-לייק לכל פוסט (הכי עדכניים) + שאילתת פרופילים אחת לכולם.
  const likerIdsByPost = new Map<string, string[]>();
  for (const row of (likesRes.data ?? []) as { post_id: string; user_id: string }[]) {
    const list = likerIdsByPost.get(row.post_id) ?? [];
    if (list.length < 5 && !list.includes(row.user_id)) list.push(row.user_id);
    likerIdsByPost.set(row.post_id, list);
  }
  const likerIds = [...new Set([...likerIdsByPost.values()].flat())];
  const { data: likerProfiles } = likerIds.length
    ? await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", likerIds)
    : { data: [] as { id: string; username: string | null; full_name: string | null; avatar_url: string | null }[] };
  const likerById = new Map((likerProfiles ?? []).map((p) => [p.id as string, p]));
  const commentCountByPost = countBy(commentsRes.data ?? [], "post_id");
  const shareCountByPost = countBy((sharesRes.data ?? []) as { post_id: string }[], "post_id");
  const saveCountByPost = countBy((savesRes.data ?? []) as { target_id: string }[], "target_id");
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
      // *** תוספת (בקשה מפורשת - פוסט משותף מהוספת אטרקציה): אם לפוסט
      // יש tripadd_submission_id, זה תמיד המקום המוצג (לא post.place_id
      // הישן - הם בלעדיים הדדית בפועל, נוצרים ע"י מסלולים שונים
      // לגמרי). ה-`place` ב-DTO משמש לשניהם בכוונה - אותה צורה בדיוק
      // ({id, name, imageUrl}), כך שהקישור הקיים ב-PostCard.tsx
      // (`/place/${item.place.id}`) עובד ללא שינוי - הוא כבר בודק
      // tripadd_submissions קודם (ר' app/place/[id]/page.tsx).
      place: post.tripadd_submission_id
        ? tripAddPlacesById.get(post.tripadd_submission_id) ?? null
        : post.place_id
          ? placesById.get(post.place_id) ?? null
          : null,
      destination: post.destination_id ? destinationsById.get(post.destination_id) ?? null : null,
      likers: (likerIdsByPost.get(post.id) ?? [])
        .map((uid) => likerById.get(uid))
        .filter((p): p is NonNullable<typeof p> => !!p)
        .map((p) => ({
          id: p.id as string,
          username: (p.username as string | null) ?? null,
          fullName: (p.full_name as string | null) ?? null,
          avatarUrl: (p.avatar_url as string | null) ?? null,
        })),
      stats: {
        likes: likeCountByPost.get(post.id) ?? 0,
        comments: commentCountByPost.get(post.id) ?? 0,
        shares: shareCountByPost.get(post.id) ?? 0,
        saves: saveCountByPost.get(post.id) ?? 0,
      },
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
