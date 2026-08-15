import type { SupabaseClient } from "@supabase/supabase-js";

export interface PlaceReview {
  id: string;
  userId: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  userName: string | null;
}

export interface PlaceReviewsSummary {
  averageRating: number | null;
  reviewCount: number;
  reviews: PlaceReview[];
  myReview: { rating: number; comment: string | null } | null;
}

/** שולף את כל הדירוגים (ציבורי - RLS מאפשר לכולם) + מחשב ממוצע/כמות,
 *  ובנוסף, אם currentUserId סופק, מחזיר גם את הדירוג האישי שלו (אם קיים)
 *  בנפרד, כדי שה-UI ידע להציג "ערוך את הדירוג שלך" במקום "דרג עכשיו". */
export async function getPlaceReviewsSummary(
  supabase: SupabaseClient,
  placeId: string,
  currentUserId?: string | null
): Promise<PlaceReviewsSummary> {
  const { data: rows } = await supabase
    .from("place_reviews")
    .select("id,user_id,rating,comment,created_at")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(50);

  const reviews: PlaceReview[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    userId: r.user_id as string,
    rating: r.rating as number,
    comment: r.comment as string | null,
    createdAt: r.created_at as string,
    // *** שם משתמש אמיתי (לא רק "משתמש") ידרוש join לטבלת פרופילים -
    // לא קיימת עדיין תשתית לזה כאן, אז מוצג "מטייל/ת ב-TripLace" גנרי
    // בינתיים בצד ה-UI. משאירים null במפורש כדי שהכוונה תהיה ברורה.
    userName: null,
  }));

  const { count } = await supabase
    .from("place_reviews")
    .select("id", { count: "exact", head: true })
    .eq("place_id", placeId);

  const reviewCount = count ?? reviews.length;
  const averageRating =
    reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null;

  let myReview: PlaceReviewsSummary["myReview"] = null;
  if (currentUserId) {
    const mine = reviews.find((r) => r.userId === currentUserId);
    if (mine) myReview = { rating: mine.rating, comment: mine.comment };
  }

  return { averageRating, reviewCount, reviews, myReview };
}

/** יוצר/מעדכן את הדירוג של המשתמש הנוכחי למקום הזה (upsert לפי
 *  place_id+user_id, שיש עליו unique constraint ב-DB). */
export async function upsertPlaceReview(
  supabase: SupabaseClient,
  placeId: string,
  userId: string,
  rating: number,
  comment: string | null
): Promise<void> {
  const { error } = await supabase
    .from("place_reviews")
    .upsert(
      { place_id: placeId, user_id: userId, rating, comment, updated_at: new Date().toISOString() },
      { onConflict: "place_id,user_id" }
    );

  if (error) throw new Error(error.message);
}
