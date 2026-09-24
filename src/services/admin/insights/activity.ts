import { type Db, safeFetchAll, sinceIso, DAY } from "./core";

/** כל סוגי הפעולות שנחשבות "פעילות אמיתית" של משתמש באפליקציה. */
export type ActivityKind =
  | "trip"
  | "trippy"
  | "tripmatch"
  | "post"
  | "comment"
  | "review"
  | "story"
  | "favorite"
  | "like"
  | "dm"
  | "follow"
  | "token"
  | "seen";

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  trip: "בניית טיול",
  trippy: "Trippy AI",
  tripmatch: "TripMatch",
  post: "פוסט",
  comment: "תגובה",
  review: "ביקורת",
  story: "סטורי",
  favorite: "שמירה/לייק למקום",
  like: "לייק לפוסט",
  dm: "הודעה פרטית",
  follow: "מעקב",
  token: "שימוש בטוקנים",
  seen: "כניסה לאפליקציה",
};

export interface ActivityEvent {
  userId: string;
  at: string;
  kind: ActivityKind;
}

export interface AdminUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  provider: string;
  isAnonymous: boolean;
  isBanned: boolean;
}

export interface ProfileLite {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  city: string | null;
  country: string | null;
  last_seen: string | null;
  created_at: string | null;
  main_onboarding_completed_at: string | null;
  referred_by: string | null;
  is_creator: boolean | null;
}

export interface TripSessionRow {
  id: string;
  user_id: string;
  trip_type: string;
  status: string;
  is_saved: boolean | null;
  created_at: string;
  updated_at: string | null;
}
export interface TrippyRow {
  id: string;
  user_id: string;
  title: string | null;
  city: string | null;
  is_saved: boolean | null;
  created_at: string;
}
export interface TripMatchRow {
  id: string;
  user_id: string;
  city: string | null;
  category: string | null;
  liked_place_ids: string[] | null;
  rejected_place_ids: string[] | null;
  created_at: string;
  updated_at: string | null;
}
export interface TokenRow {
  user_id: string;
  type: string;
  amount: number;
  created_at: string;
}
export interface PostRow {
  id: string;
  author_id: string;
  post_type: string;
  text: string | null;
  visibility: string;
  created_at: string;
  deleted_at: string | null;
}
export interface ReviewRow {
  id: string;
  user_id: string;
  place_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function loadAuthUsers(db: Db): Promise<AdminUser[]> {
  const out: AdminUser[] = [];
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      out.push({
        id: u.id,
        email: u.email ?? "",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        provider: u.is_anonymous ? "guest" : ((u.app_metadata?.provider as string | undefined) ?? "email"),
        isAnonymous: Boolean(u.is_anonymous),
        isBanned: Boolean(u.banned_until && new Date(u.banned_until) > new Date()),
      });
    }
    if (users.length < 1000) break;
  }
  return out;
}

export interface ActivityDataset {
  users: AdminUser[];
  profiles: ProfileLite[];
  tripSessions: TripSessionRow[];
  trippy: TrippyRow[];
  tripMatch: TripMatchRow[];
  tokens: TokenRow[];
  posts: PostRow[];
  reviews: ReviewRow[];
  events: ActivityEvent[];
  errors: string[];
}

/** טוען את כל מה שצריך כדי להבין "מי עשה מה ומתי" - מקור אחד משותף
 *  לדשבורד, לקוהורטות, למשתמשים ולמוצרים. `lookbackDays` מגביל היסטוריה. */
export async function loadActivity(db: Db, lookbackDays = 730): Promise<ActivityDataset> {
  const errors: string[] = [];
  const since = sinceIso(lookbackDays * DAY);

  const [
    users,
    profiles,
    tripSessions,
    trippy,
    tripMatch,
    tokens,
    posts,
    comments,
    reviews,
    stories,
    favorites,
    postLikes,
    dms,
    follows,
  ] = await Promise.all([
    loadAuthUsers(db).catch((e) => {
      errors.push(`auth.users: ${e instanceof Error ? e.message : e}`);
      return [] as AdminUser[];
    }),
    safeFetchAll<ProfileLite>("profiles", errors, (f, t) =>
      db
        .from("profiles")
        .select("id,full_name,username,avatar_url,city,country,last_seen,created_at,main_onboarding_completed_at,referred_by,is_creator")
        .order("id")
        .range(f, t)
    ),
    safeFetchAll<TripSessionRow>("trip_builder_sessions", errors, (f, t) =>
      db.from("trip_builder_sessions").select("id,user_id,trip_type,status,is_saved,created_at,updated_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<TrippyRow>("trippy_ai_results", errors, (f, t) =>
      db.from("trippy_ai_results").select("id,user_id,title,is_saved,created_at,city:search_context->>city").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<TripMatchRow>("tripmatch_sessions", errors, (f, t) =>
      db
        .from("tripmatch_sessions")
        .select("id,user_id,city,category,liked_place_ids,rejected_place_ids,created_at,updated_at")
        .gte("created_at", since)
        .order("id")
        .range(f, t)
    ),
    safeFetchAll<TokenRow>("token_transactions", errors, (f, t) =>
      db.from("token_transactions").select("user_id,type,amount,created_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<PostRow>("posts", errors, (f, t) =>
      db.from("posts").select("id,author_id,post_type,text,visibility,created_at,deleted_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<{ author_id: string; created_at: string }>("comments", errors, (f, t) =>
      db.from("comments").select("author_id,created_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<ReviewRow>("place_reviews", errors, (f, t) =>
      db.from("place_reviews").select("id,user_id,place_id,rating,comment,created_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<{ author_id: string; created_at: string }>("stories", errors, (f, t) =>
      db.from("stories").select("author_id,created_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<{ user_id: string; created_at: string }>("favorites", errors, (f, t) =>
      db.from("favorites").select("user_id,created_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<{ user_id: string; created_at: string }>("post_likes", errors, (f, t) =>
      db.from("post_likes").select("user_id,created_at").gte("created_at", since).order("created_at").order("user_id").range(f, t)
    ),
    safeFetchAll<{ sender_id: string; created_at: string }>("dm_messages", errors, (f, t) =>
      db.from("dm_messages").select("sender_id,created_at").gte("created_at", since).order("id").range(f, t)
    ),
    safeFetchAll<{ follower_id: string; created_at: string }>("follows", errors, (f, t) =>
      db.from("follows").select("follower_id,created_at").gte("created_at", since).order("created_at").order("follower_id").range(f, t)
    ),
  ]);

  const events: ActivityEvent[] = [];
  const push = (userId: string | null | undefined, at: string | null | undefined, kind: ActivityKind) => {
    if (userId && at) events.push({ userId, at, kind });
  };
  for (const r of tripSessions) push(r.user_id, r.created_at, r.trip_type === "tripmatch" ? "tripmatch" : "trip");
  for (const r of trippy) push(r.user_id, r.created_at, "trippy");
  for (const r of tripMatch) {
    push(r.user_id, r.created_at, "tripmatch");
    if (r.updated_at && r.updated_at !== r.created_at) push(r.user_id, r.updated_at, "tripmatch");
  }
  for (const r of tokens) push(r.user_id, r.created_at, "token");
  for (const r of posts) push(r.author_id, r.created_at, "post");
  for (const r of comments) push(r.author_id, r.created_at, "comment");
  for (const r of reviews) push(r.user_id, r.created_at, "review");
  for (const r of stories) push(r.author_id, r.created_at, "story");
  for (const r of favorites) push(r.user_id, r.created_at, "favorite");
  for (const r of postLikes) push(r.user_id, r.created_at, "like");
  for (const r of dms) push(r.sender_id, r.created_at, "dm");
  for (const r of follows) push(r.follower_id, r.created_at, "follow");
  for (const p of profiles) push(p.id, p.last_seen, "seen");
  for (const u of users) push(u.id, u.lastSignInAt, "seen");

  return { users, profiles, tripSessions, trippy, tripMatch, tokens, posts, reviews, events, errors };
}

export function displayName(p: ProfileLite | undefined, fallbackEmail?: string): string {
  if (p?.full_name?.trim()) return p.full_name.trim();
  if (p?.username) return `@${p.username}`;
  if (fallbackEmail) return fallbackEmail.split("@")[0];
  return "משתמש";
}
