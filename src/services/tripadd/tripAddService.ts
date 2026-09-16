import type { SupabaseClient } from "@supabase/supabase-js";
import type { HomeQuickCategoryId } from "@/constants/homeQuickCategories";

/** אותם 6 ערכים בדיוק כמו HomeQuickCategoryId (שורת "סוגי הטיול" בעמוד
 *  הבית) - לא טקסונומיה נפרדת. TripAdd הוא מאגר עצמאי, אבל הקטגוריות
 *  שלו מיושרות עם מה שכבר מוצג למשתמש בבית, לא ממציאות עוד סט. */
export type TripAddCategory = HomeQuickCategoryId;

export interface CreateTripAddSubmissionInput {
  submittedBy: string;
  name: string;
  category: TripAddCategory;
  description?: string;
  rating?: number;
  subcategory?: string;
  city?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  mediaIds?: string[];
  googlePlaceId?: string;
  googlePhotoUrl?: string;
  /** *** תוספת (מסמך העדכון, סעיפים 5,7,29 - migration 0087) */
  googleMatchStatus?: "matched" | "unmatched";
  googleMatchConfidence?: number;
}

/**
 * *** מאגר עצמאי ונפרד לגמרי (בקשה מפורשת - "המאגר הזה מנותק מהמאגר
 * שהיה"): בכוונה **אין כאן שום בדיקה** מול places/destinations/
 * place_submissions - זה בדיוק מה שגרם לבלבול הקודם ("כבר קיים
 * אצלנו"). tripadd_submissions היא טבלה נפרדת, RLS נפרד, לא נוגעת
 * במאגר הישן בשום צורה.
 *
 * *** תיקון (בקשה מפורשת - "הביקורות צריכות להיות רשומות מסודרות"):
 * זה עדיין יוצר "מקום" חדש - אבל עכשיו גם יוצר לו את הביקורת
 * הראשונה שלו (tripadd_reviews), כדי שממש מהתחלה יש ל-tripadd_place
 * רשימת ביקורות אחידה, לא תלויה בשדות rating/description הישנים
 * שיושבים על tripadd_submissions עצמה. ר' findTripAddSubmissionByGooglePlaceId
 * למטה - הוספה *שנייה* לאותו מקום לא עוברת כאן בכלל.
 */
export async function createTripAddSubmission(supabase: SupabaseClient, input: CreateTripAddSubmissionInput): Promise<string> {
  const { data: submission, error } = await supabase
    .from("tripadd_submissions")
    .insert({
      submitted_by: input.submittedBy,
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      rating: input.rating ?? null,
      // *** תיקון (בקשה מפורשת - "תתי קטגוריה קבועות לכל סוג"): המשתמש
      // יכול לבחור תת-קטגוריה בעצמו מרשימה סגורה בטופס - נשמר ישירות,
      // לא רק מחכה ל-AI אחרי השמירה (ר' tripAddEnrichmentService, שם
      // מכבד ערך קיים ולא דורס אותו).
      subcategory: input.subcategory ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      website: input.website ?? null,
      google_place_id: input.googlePlaceId ?? null,
      google_photo_url: input.googlePhotoUrl ?? null,
      google_match_status: input.googleMatchStatus ?? null,
      google_match_confidence: input.googleMatchConfidence ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.mediaIds?.length) {
    const rows = input.mediaIds.map((mediaId, sortOrder) => ({ submission_id: submission.id, media_id: mediaId, sort_order: sortOrder }));
    const { error: mediaError } = await supabase.from("tripadd_submission_media").insert(rows);
    if (mediaError) throw mediaError;
  }

  // הביקורת הראשונה על המקום החדש - אותו rating/description שכבר
  // נשמרו למעלה, רק גם דרך הטבלה החדשה (ר' ההערה מעל הפונקציה).
  await upsertTripAddReview(supabase, {
    submissionId: submission.id as string,
    userId: input.submittedBy,
    rating: input.rating,
    description: input.description,
  });

  return submission.id as string;
}

/**
 * *** תוספת (בקשה מפורשת - "כשמוסיפים אטרקציה בעמוד הבית, שזה יופיע
 * גם כפוסט ב-place's, בפרופיל של המשתמש ובפיד"): יוצר שורה רגילה
 * בטבלת posts הכללית (לא טבלה נפרדת) - עם tripadd_submission_id
 * (migration 0083) במקום place_id הישן, אותו טקסט אישי שהמשתמש כתב,
 * ואותן תמונות שהוא כבר העלה (mediaIds - אין העלאה כפולה, אותם
 * media_assets מקושרים גם לפוסט וגם ל-tripadd_submission).
 * visibility: 'public' - זה בדיוק העניין ("שיתוף"), לא טיוטה פרטית.
 */
export async function createTripAddSharePost(
  supabase: SupabaseClient,
  input: { userId: string; submissionId: string; text?: string; mediaIds?: string[] }
): Promise<string> {
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.userId,
      text: input.text?.trim() || null,
      post_type: input.mediaIds?.length ? "photo" : "place_recommendation",
      tripadd_submission_id: input.submissionId,
      visibility: "public",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.mediaIds?.length) {
    const rows = input.mediaIds.map((mediaId, sortOrder) => ({ post_id: post.id, media_id: mediaId, sort_order: sortOrder }));
    const { error: mediaError } = await supabase.from("post_media").insert(rows);
    if (mediaError) throw mediaError;
  }

  return post.id as string;
} - אם מקום עם
 * אותו google_place_id כבר קיים במאגר, לא נוצר "מקום" שני (זו הייתה
 * הסיבה ל-"Jasmino מופיע פעמיים") - במקום זה נוסף/מתעדכן רק ביקורת
 * על המקום הקיים (ר' upsertTripAddReview). מקומות בלי google_place_id
 * (המשתמש המשיך ידנית כי גוגל לא מצא) לא ניתנים לזיהוי-כפילות
 * אוטומטי - נשארים כמקומות נפרדים, זו מגבלה מודעת.
 */
export async function findTripAddSubmissionByGooglePlaceId(
  supabase: SupabaseClient,
  googlePlaceId: string
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("tripadd_submissions")
    .select("id")
    .eq("google_place_id", googlePlaceId)
    .maybeSingle();
  return data ?? null;
}

export interface UpsertTripAddReviewInput {
  submissionId: string;
  userId: string;
  rating?: number;
  description?: string;
  mediaIds?: string[];
}

/**
 * מוסיף ביקורת, או מעדכן את הביקורת הקיימת של אותו משתמש על אותו
 * מקום (unique(submission_id, user_id) ב-migration 0081) - אדם אחד
 * לא "מצטבר" לכמה ביקורות על אותו מקום, רק מעדכן את שלו. תמונות
 * שמצורפות לביקורת השנייה נוספות לגלריה המשותפת של המקום (אותו
 * submission_id ב-tripadd_submission_media, sort_order ממשיך מהמקסימום
 * הקיים - לא מתחיל מ-0 ודורס תמונות קודמות).
 */
export async function upsertTripAddReview(
  supabase: SupabaseClient,
  input: UpsertTripAddReviewInput
): Promise<void> {
  const { error } = await supabase.from("tripadd_reviews").upsert(
    {
      submission_id: input.submissionId,
      user_id: input.userId,
      rating: input.rating ?? null,
      description: input.description ?? null,
    },
    { onConflict: "submission_id,user_id" }
  );
  if (error) throw error;

  if (input.mediaIds?.length) {
    const { data: existingMedia } = await supabase
      .from("tripadd_submission_media")
      .select("sort_order")
      .eq("submission_id", input.submissionId)
      .order("sort_order", { ascending: false })
      .limit(1);
    const nextSortOrder = (existingMedia?.[0]?.sort_order ?? -1) + 1;
    const rows = input.mediaIds.map((mediaId, i) => ({
      submission_id: input.submissionId,
      media_id: mediaId,
      sort_order: nextSortOrder + i,
    }));
    const { error: mediaError } = await supabase.from("tripadd_submission_media").insert(rows);
    if (mediaError) throw mediaError;
  }
}

export interface TripAddEnrichmentPatch {
  /** תת-קטגוריה - AI, לא גוגל. */
  subcategory?: string | null;
  /** מכאן ולמטה: אך ורק השדות שמותר לשלוף ולשמור מגוגל (בקשה
   *  מפורשת - מינימלי). לא טלפון, לא תיאור, לא שעות פתיחה, לא תמונות -
   *  המיקום (address/lat/lng) כבר מגיע מגוגל בשלב ההגשה עצמה. */
  accessible?: boolean | null;
  /** *** תוספת (בקשה מפורשת - "נגישות = מה שיש בגוגל", migration
   *  0085): שלוש עוד עובדות נגישות שגוגל מספק, מעבר לכניסה נגישה
   *  (accessible) שכבר הייתה. */
  accessibleParking?: boolean | null;
  accessibleRestroom?: boolean | null;
  accessibleSeating?: boolean | null;
  priceLevel?: number | null;
  /** דירוג ממוצע שגוגל מספק - שונה מ-rating (הדירוג האישי שהמשתמש
   *  עצמו נתן בטופס, "דירוג TRIPLACE"). מוצג בנפרד בכרטיסייה. */
  googleRating?: number | null;
  googleRatingCount?: number | null;
}

/** מיושם רק אחרי השמירה, ע"י tripAddEnrichmentService.ts בלבד - לא
 *  ישירות מהטופס (אותו עיקרון בדיוק כמו במאגר הישן, רק על הטבלה
 *  העצמאית tripadd_submissions). */
export async function applyTripAddEnrichment(
  supabase: SupabaseClient,
  submissionId: string,
  patch: TripAddEnrichmentPatch,
  status: "done" | "failed" | "skipped"
): Promise<void> {
  const update: Record<string, unknown> = { enrichment_status: status };
  if (patch.subcategory !== undefined) update.subcategory = patch.subcategory;
  if (patch.accessible !== undefined) update.accessible = patch.accessible;
  if (patch.accessibleParking !== undefined) update.accessible_parking = patch.accessibleParking;
  if (patch.accessibleRestroom !== undefined) update.accessible_restroom = patch.accessibleRestroom;
  if (patch.accessibleSeating !== undefined) update.accessible_seating = patch.accessibleSeating;
  if (patch.priceLevel !== undefined) update.price_level = patch.priceLevel;
  if (patch.googleRating !== undefined) update.google_rating = patch.googleRating;
  if (patch.googleRatingCount !== undefined) update.google_rating_count = patch.googleRatingCount;

  const { error } = await supabase.from("tripadd_submissions").update(update).eq("id", submissionId);
  if (error) throw error;
}

export async function getMyTripAddSubmissions(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tripadd_submissions")
    .select("id, name, category, status, created_at, rejection_reason")
    .eq("submitted_by", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
