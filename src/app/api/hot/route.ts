import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import { getTripSummaries } from "@/services/social/tripService";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

/**
 * *** חדש (בקשה מפורשת - עמוד "כל מה שחם").
 * *** תיקון (בקשה מפורשת - "צריך שזה יהיה רק מהדברים שהמשתמשים מעלים/מדרגים!"): המקומות מגיעים
 * אך ורק מתוכן שמשתמשים יצרו - בלי לייקים של TripMatch ובלי השלמה לפי דירוג Google:
 *  • ביקורות/דירוגים על מקומות (place_reviews - זרימת "מקום" בעמוד התוכן),
 *  • מקומות שמשתמשים העלו (tripadd_submissions מאושרים) + הביקורות עליהם (tripadd_reviews),
 *  • פוסטים ציבוריים שמתייגים מקום (posts.place_id / tripadd_submission_id).
 * "חם" = הכי הרבה פעילות כזו ב-30 הימים האחרונים; בשוויון - הכי הרבה פעילות בסך הכל, ואז הדירוג
 * הקהילתי. הדירוג שמוצג הוא הממוצע של המשתמשים שלנו בלבד (לא Google). התמונה: קודם תמונה שמשתמש
 * העלה (בביקורת/בפוסט/בהעלאה), ורק אם אין - תמונת המקום הקיימת. מקום בלי אף פעילות - לא מופיע.
 *  • טיולים (רק ב"הכל"): הטיולים שקיבלו הכי הרבה לייקים ושמירות ב-30 הימים האחרונים. הצגתם עוברת
 *    דרך ה-client של המשתמש (RLS של trips) - טיול פרטי/של חברים לא ייחשף למי שלא רשאי לראות אותו.
 * הספירות רצות עם admin client ומחזירות ללקוח רק סכומים ופרטים ציבוריים - לעולם לא מי כתב.
 *
 * GET /api/hot?category=all|attraction|food|shopping|nature|nightlife|sleep
 */

const RESULT_LIMIT = 30;
const WINDOW_DAYS = 30;
const MIN_TRIP_SCORE = 1;
/** כמה מועמדים (לפי פעילות) טוענים לפרטים - מספיק כדי שגם סינון לפי סוג יחזיר רשימה מלאה. */
const CANDIDATE_LIMIT = 250;

/** מזהי הקטגוריות של האפליקציה (HOME_QUICK_CATEGORIES / tripadd) -> places.category. */
const PLACE_CATEGORY_BY_ID: Record<HomeQuickCategoryId, string> = {
  attraction: "attractions",
  food: "restaurants",
  shopping: "shopping",
  nature: "nature",
  nightlife: "nightlife",
  sleep: "hotels",
};
const ID_BY_PLACE_CATEGORY = Object.fromEntries(Object.entries(PLACE_CATEGORY_BY_ID).map(([id, cat]) => [cat, id])) as Record<string, HomeQuickCategoryId>;

export interface HotPlaceItem {
  id: string;
  name: string;
  /** תמונה (או סרטון) - עדיפות למדיה שמשתמשים העלו. null = אין שום מדיה. */
  imageUrl: string | null;
  mediaType: "image" | "video";
  city: string | null;
  category: HomeQuickCategoryId | null;
  /** ממוצע הדירוגים של המשתמשים שלנו. null = אף אחד עוד לא דירג (רק העלה/שיתף). */
  communityRating: number | null;
  /** כמה דירגו. */
  ratingCount: number;
  /** כמה פעילויות (דירוג / העלאה / פוסט) ב-30 הימים האחרונים. */
  recentCount: number;
}

export interface HotTripItem {
  id: string;
  title: string;
  imageUrl: string | null;
  stopCount: number;
  /** לייקים + שמירות ב-30 הימים האחרונים. */
  score: number;
}

type Kind = "place" | "tripadd";
type MediaRow = { sort_order: number; media_assets: { url: string; type?: string } | null };

interface Activity {
  kind: Kind;
  id: string;
  recent: number;
  total: number;
  ratings: number[];
  latestAt: string;
}

function avg(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function isCategory(value: string | null): value is HomeQuickCategoryId {
  return value != null && value in PLACE_CATEGORY_BY_ID;
}

function firstImage(urls: unknown): string | null {
  return Array.isArray(urls) && typeof urls[0] === "string" && urls[0] ? (urls[0] as string) : null;
}

/** המדיה הראשונה (לפי sort_order) מתוך שורות *_media, עדיפות לתמונה על פני סרטון. */
function pickMedia(rows: MediaRow[] | null | undefined): { url: string; type: "image" | "video" } | null {
  const list = (rows ?? []).filter((m) => m.media_assets?.url).sort((a, b) => a.sort_order - b.sort_order);
  const image = list.find((m) => m.media_assets?.type !== "video");
  const chosen = image ?? list[0];
  if (!chosen?.media_assets) return null;
  return { url: chosen.media_assets.url, type: chosen.media_assets.type === "video" ? "video" : "image" };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const categoryParam = new URL(request.url).searchParams.get("category");
  const category = isCategory(categoryParam) ? categoryParam : null; // null = הכל
  const placeCategory = category ? PLACE_CATEGORY_BY_ID[category] : null;

  const admin = createAdminClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // ───────── 1) כל הפעילות של המשתמשים על מקומות ─────────
  const [reviewsRes, tripAddSubsRes, tripAddReviewsRes, postsRes] = await Promise.all([
    admin.from("place_reviews").select("place_id, rating, created_at").order("created_at", { ascending: false }).limit(10000),
    admin
      .from("tripadd_submissions")
      .select("id, rating, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(10000),
    admin.from("tripadd_reviews").select("submission_id, rating, created_at").order("created_at", { ascending: false }).limit(10000),
    admin
      .from("posts")
      .select("place_id, tripadd_submission_id, created_at")
      .eq("visibility", "public")
      .is("deleted_at", null)
      .or("place_id.not.is.null,tripadd_submission_id.not.is.null")
      .order("created_at", { ascending: false })
      .limit(10000),
  ]);

  const activity = new Map<string, Activity>();
  function track(kind: Kind, id: string | null, createdAt: string, rating?: number | null) {
    if (!id) return;
    const key = `${kind}:${id}`;
    let entry = activity.get(key);
    if (!entry) {
      entry = { kind, id, recent: 0, total: 0, ratings: [], latestAt: createdAt };
      activity.set(key, entry);
    }
    entry.total += 1;
    if (createdAt >= since) entry.recent += 1;
    if (createdAt > entry.latestAt) entry.latestAt = createdAt;
    if (typeof rating === "number" && rating >= 1 && rating <= 5) entry.ratings.push(rating);
  }

  for (const r of reviewsRes.data ?? []) track("place", r.place_id as string, r.created_at as string, r.rating as number);
  // העלאת מקום = פעילות, והדירוג של מי שהעלה נספר כדירוג.
  for (const r of tripAddSubsRes.data ?? []) track("tripadd", r.id as string, r.created_at as string, r.rating as number | null);
  for (const r of tripAddReviewsRes.data ?? []) track("tripadd", r.submission_id as string, r.created_at as string, r.rating as number | null);
  for (const r of postsRes.data ?? []) {
    if (r.place_id) track("place", r.place_id as string, r.created_at as string);
    else if (r.tripadd_submission_id) track("tripadd", r.tripadd_submission_id as string, r.created_at as string);
  }

  const ranked = [...activity.values()]
    .sort((a, b) => b.recent - a.recent || b.total - a.total || avg(b.ratings) - avg(a.ratings) || (b.latestAt > a.latestAt ? 1 : -1))
    .slice(0, CANDIDATE_LIMIT);
  const placeIds = ranked.filter((r) => r.kind === "place").map((r) => r.id);
  const tripAddIds = ranked.filter((r) => r.kind === "tripadd").map((r) => r.id);

  // ───────── 2) פרטי המקומות + המדיה שמשתמשים העלו ─────────
  let placesQuery = admin.from("places").select("id, name, image_urls, city, category").eq("is_legacy", false);
  let tripAddQuery = admin
    .from("tripadd_submissions")
    .select("id, name, city, category, tripadd_submission_media(sort_order, media_assets(url, type))")
    .eq("status", "approved");
  if (placeCategory) placesQuery = placesQuery.eq("category", placeCategory);
  if (category) tripAddQuery = tripAddQuery.eq("category", category);

  const [placesRes, tripAddRes, reviewMediaRes, postMediaByPlaceRes, postMediaByTripAddRes] = await Promise.all([
    placeIds.length > 0 ? placesQuery.in("id", placeIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    tripAddIds.length > 0 ? tripAddQuery.in("id", tripAddIds) : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    placeIds.length > 0
      ? admin
          .from("place_reviews")
          .select("place_id, created_at, review_media(sort_order, media_assets(url, type))")
          .in("place_id", placeIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    placeIds.length > 0
      ? admin
          .from("posts")
          .select("place_id, created_at, post_media(sort_order, media_assets(url, type))")
          .in("place_id", placeIds)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    tripAddIds.length > 0
      ? admin
          .from("posts")
          .select("tripadd_submission_id, created_at, post_media(sort_order, media_assets(url, type))")
          .in("tripadd_submission_id", tripAddIds)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  // המדיה הכי חדשה שמשתמש העלה לכל מקום (השורות כבר ממוינות מהחדש לישן).
  const userMedia = new Map<string, { url: string; type: "image" | "video" }>();
  function offerMedia(key: string, rows: MediaRow[] | null | undefined) {
    if (userMedia.has(key)) return;
    const media = pickMedia(rows);
    if (media) userMedia.set(key, media);
  }
  for (const r of (reviewMediaRes.data ?? []) as Record<string, unknown>[]) offerMedia(`place:${r.place_id}`, r.review_media as MediaRow[]);
  for (const r of (postMediaByPlaceRes.data ?? []) as Record<string, unknown>[]) offerMedia(`place:${r.place_id}`, r.post_media as MediaRow[]);
  for (const r of (postMediaByTripAddRes.data ?? []) as Record<string, unknown>[])
    offerMedia(`tripadd:${r.tripadd_submission_id}`, r.post_media as MediaRow[]);

  const placesById = new Map(((placesRes.data ?? []) as Record<string, unknown>[]).map((r) => [r.id as string, r]));
  const tripAddById = new Map(((tripAddRes.data ?? []) as Record<string, unknown>[]).map((r) => [r.id as string, r]));

  // ───────── 3) בניית הרשימה לפי סדר הפעילות ─────────
  const places: HotPlaceItem[] = [];
  for (const entry of ranked) {
    if (places.length >= RESULT_LIMIT) break;
    const key = `${entry.kind}:${entry.id}`;
    const row = entry.kind === "place" ? placesById.get(entry.id) : tripAddById.get(entry.id);
    if (!row) continue; // לא קיים / לא מאושר / לא בסוג שנבחר

    const own = userMedia.get(key) ?? (entry.kind === "tripadd" ? pickMedia(row.tripadd_submission_media as MediaRow[]) : null);
    // *** בקשה מפורשת: לעולם לא תמונות של Google למקומות קהילה - רק מה שמשתמשים העלו
    const fallbackUrl = entry.kind === "place" ? firstImage(row.image_urls) : null;
    const rating = avg(entry.ratings);

    places.push({
      id: entry.id,
      name: row.name as string,
      imageUrl: own?.url ?? fallbackUrl,
      mediaType: own?.type ?? "image",
      city: (row.city as string | null) ?? null,
      category:
        entry.kind === "place"
          ? (ID_BY_PLACE_CATEGORY[row.category as string] ?? null)
          : isCategory(row.category as string)
            ? (row.category as HomeQuickCategoryId)
            : null,
      communityRating: entry.ratings.length > 0 ? Math.round(rating * 10) / 10 : null,
      ratingCount: entry.ratings.length,
      recentCount: entry.recent,
    });
  }

  // ───────── 4) טיולים חמים (רק ב"הכל") ─────────
  let trips: HotTripItem[] = [];
  if (!category) {
    const [likesRes, savesRes] = await Promise.all([
      admin.from("post_likes").select("trip_id").not("trip_id", "is", null).gte("created_at", since).limit(5000),
      admin.from("social_saves").select("target_id").eq("target_type", "trip").gte("created_at", since).limit(5000),
    ]);
    const scores = new Map<string, number>();
    for (const row of likesRes.data ?? []) {
      const id = row.trip_id as string;
      scores.set(id, (scores.get(id) ?? 0) + 1);
    }
    for (const row of savesRes.data ?? []) {
      const id = row.target_id as string;
      scores.set(id, (scores.get(id) ?? 0) + 1);
    }
    const topIds = [...scores.entries()]
      .filter(([, score]) => score >= MIN_TRIP_SCORE)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id]) => id);
    // ה-client של המשתמש: ה-RLS של trips מחליט מה מותר לו לראות.
    const summaries = await getTripSummaries(supabase, user.id, topIds);
    trips = topIds
      .map((id) => {
        const summary = summaries.get(id);
        if (!summary || summary.stopCount === 0) return null;
        return { id, title: summary.title, imageUrl: summary.imageUrl, stopCount: summary.stopCount, score: scores.get(id) ?? 0 };
      })
      .filter((t): t is HotTripItem => t !== null)
      .slice(0, 8);
  }

  return NextResponse.json(
    { places: places.slice(0, RESULT_LIMIT), trips },
    { headers: { "Cache-Control": "private, max-age=300" } }
  );
}
