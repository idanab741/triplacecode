import { type Db, type RangeKey, periodFor, buildBuckets, seriesCount, inCurrent, inPrevious, pctDelta, topCounts, safeFetchAll, sinceIso, DAY } from "./core";
import { POST_TYPE_LABELS, label } from "./labels";

interface Named {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

async function namesFor(db: Db, ids: string[]): Promise<Map<string, Named>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data } = await db.from("profiles").select("id,full_name,username,avatar_url").in("id", unique);
  return new Map(((data ?? []) as Named[]).map((p) => [p.id, p]));
}

const nameOf = (m: Map<string, Named>, id: string | null) => {
  const p = id ? m.get(id) : undefined;
  return p?.full_name?.trim() || (p?.username ? `@${p.username}` : "משתמש");
};

export async function buildCommunity(db: Db, range: RangeKey) {
  const p = periodFor(range);
  const b = buildBuckets(p);
  const errors: string[] = [];
  const since = sinceIso(2 * p.days * DAY + DAY);

  type Row = { at: string; user: string };
  const load = (table: string, userCol: string, extra?: string) => {
    const columns: string = `${userCol},created_at${extra ? `,${extra}` : ""}`;
    return safeFetchAll<Record<string, string>>(table, errors, (f, t) =>
      db
        .from(table)
        .select(columns)
        .gte("created_at", since)
        .order("created_at")
        .range(f, t) as unknown as PromiseLike<{ data: Record<string, string>[] | null; error: { message: string } | null }>
    );
  };

  const [posts, comments, reviews, stories, likes, follows, dms, saves] = await Promise.all([
    load("posts", "author_id", "id,post_type,deleted_at"),
    load("comments", "author_id", "deleted_at"),
    load("place_reviews", "user_id", "rating"),
    load("stories", "author_id"),
    load("post_likes", "user_id", "post_id"),
    load("follows", "follower_id"),
    load("dm_messages", "sender_id"),
    load("social_saves", "user_id"),
  ]);

  const metric = (key: string, lbl: string, rows: Record<string, string>[], userCol: string) => {
    const mapped: Row[] = rows.map((r) => ({ at: r.created_at, user: r[userCol] }));
    const current = mapped.filter((r) => inCurrent(p, r.at));
    const previous = mapped.filter((r) => inPrevious(p, r.at)).length;
    return {
      key,
      label: lbl,
      value: current.length,
      deltaPct: pctDelta(current.length, previous),
      users: new Set(current.map((r) => r.user)).size,
      spark: seriesCount(b, mapped.map((r) => r.at)),
    };
  };

  const liveComments = comments.filter((c) => !c.deleted_at);
  const livePosts = posts.filter((x) => !x.deleted_at);
  const metrics = [
    metric("posts", "פוסטים", livePosts, "author_id"),
    metric("comments", "תגובות", liveComments, "author_id"),
    metric("reviews", "ביקורות", reviews, "user_id"),
    metric("stories", "סטוריז", stories, "author_id"),
    metric("likes", "לייקים", likes, "user_id"),
    metric("follows", "מעקבים", follows, "follower_id"),
    metric("dms", "הודעות פרטיות", dms, "sender_id"),
    metric("saves", "שמירות", saves, "user_id"),
  ];

  const postTypes = topCounts(livePosts.filter((x) => inCurrent(p, x.created_at)).map((x) => x.post_type), 10).map((x) => ({
    ...x,
    label: label(POST_TYPE_LABELS, x.label),
  }));

  const ratingDist = [1, 2, 3, 4, 5].map((r) => ({
    label: `${r}★`,
    value: reviews.filter((x) => inCurrent(p, x.created_at) && Number(x.rating) === r).length,
  }));

  // --- יוצרי תוכן מובילים (בתקופה): פוסטים + ביקורות + סטוריז, ולייקים שקיבלו ---
  const authorByPost = new Map(posts.map((x) => [x.id, x.author_id]));
  const score = new Map<string, { posts: number; reviews: number; stories: number; likesReceived: number }>();
  const bump = (id: string, k: "posts" | "reviews" | "stories" | "likesReceived") => {
    if (!id) return;
    const s = score.get(id) ?? { posts: 0, reviews: 0, stories: 0, likesReceived: 0 };
    s[k] += 1;
    score.set(id, s);
  };
  for (const x of livePosts) if (inCurrent(p, x.created_at)) bump(x.author_id, "posts");
  for (const x of reviews) if (inCurrent(p, x.created_at)) bump(x.user_id, "reviews");
  for (const x of stories) if (inCurrent(p, x.created_at)) bump(x.author_id, "stories");
  for (const x of likes) if (inCurrent(p, x.created_at)) bump(authorByPost.get(x.post_id) ?? "", "likesReceived");
  const topCreatorIds = [...score.entries()]
    .sort((a, c) => c[1].posts + c[1].reviews + c[1].stories + c[1].likesReceived * 0.5 - (a[1].posts + a[1].reviews + a[1].stories + a[1].likesReceived * 0.5))
    .slice(0, 8);

  // --- תור מודרציה ---
  const [recentPostsRes, lowReviewsRes] = await Promise.all([
    db.from("posts").select("id,author_id,text,post_type,visibility,created_at,post_media(media_id)").is("deleted_at", null).order("created_at", { ascending: false }).limit(15),
    db.from("place_reviews").select("id,user_id,place_id,rating,comment,created_at,places(name,city)").lte("rating", 2).order("created_at", { ascending: false }).limit(10),
  ]);

  type PostRow = { id: string; author_id: string; text: string | null; post_type: string; visibility: string; created_at: string; post_media: { media_id: string }[] | null };
  type ReviewRow = { id: string; user_id: string; place_id: string; rating: number; comment: string | null; created_at: string; places: { name: string; city: string | null } | null };
  const recentPosts = (recentPostsRes.data ?? []) as unknown as PostRow[];
  const lowReviews = (lowReviewsRes.data ?? []) as unknown as ReviewRow[];
  for (const r of [recentPostsRes, lowReviewsRes]) if (r.error) errors.push(r.error.message);

  const names = await namesFor(db, [
    ...topCreatorIds.map(([id]) => id),
    ...recentPosts.map((x) => x.author_id),
    ...lowReviews.map((x) => x.user_id),
  ]);

  return {
    range,
    labels: b.labels,
    generatedAt: new Date().toISOString(),
    metrics,
    postTypes,
    ratingDist,
    topCreators: topCreatorIds.map(([id, s]) => ({ id, name: nameOf(names, id), avatarUrl: names.get(id)?.avatar_url ?? null, ...s })),
    recentPosts: recentPosts.map((x) => ({
      id: x.id,
      authorId: x.author_id,
      authorName: nameOf(names, x.author_id),
      avatarUrl: names.get(x.author_id)?.avatar_url ?? null,
      text: x.text,
      type: label(POST_TYPE_LABELS, x.post_type),
      visibility: x.visibility,
      mediaCount: x.post_media?.length ?? 0,
      at: x.created_at,
    })),
    lowReviews: lowReviews.map((x) => ({
      id: x.id,
      userName: nameOf(names, x.user_id),
      placeId: x.place_id,
      placeName: x.places?.name ?? "מקום",
      city: x.places?.city ?? null,
      rating: x.rating,
      comment: x.comment,
      at: x.created_at,
    })),
    warnings: errors,
  };
}

export type CommunityData = Awaited<ReturnType<typeof buildCommunity>>;

export type ModerationAction =
  | { action: "approve_submission"; kind: "place" | "tripadd"; id: string }
  | { action: "reject_submission"; kind: "place" | "tripadd"; id: string; reason?: string }
  | { action: "hide_post"; id: string };

export async function moderate(db: Db, input: ModerationAction): Promise<void> {
  const now = new Date().toISOString();
  if (input.action === "approve_submission" || input.action === "reject_submission") {
    const table = input.kind === "place" ? "place_submissions" : "tripadd_submissions";
    const update =
      input.action === "approve_submission"
        ? { status: "approved", reviewed_at: now, rejection_reason: null }
        : { status: "rejected", reviewed_at: now, rejection_reason: input.reason?.trim() || null };
    const { data, error } = await db.from(table).update(update).eq("id", input.id).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("ההצעה לא נמצאה");
    return;
  }
  if (input.action === "hide_post") {
    const { error } = await db.from("posts").update({ deleted_at: now }).eq("id", input.id).is("deleted_at", null);
    if (error) throw new Error(error.message);
    return;
  }
  throw new Error("פעולה לא מוכרת");
}
