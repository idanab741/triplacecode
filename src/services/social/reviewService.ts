import type { SupabaseClient } from "@supabase/supabase-js";
import { createPost } from "./postService";
import { createAdminClient } from "@/services/supabase/admin";

export interface CreateReviewInput {
  userId: string;
  placeId: string;
  rating: number; // 1-5
  comment?: string;
  mediaIds?: string[];
}

/** יוצר/מעדכן ביקורת ב-place_reviews הקיים (מקור האמת לדירוג - סעיף 37),
 *  ובמקביל יוצר Post מקושר (post_type='review') כדי שהביקורת תופיע
 *  ב-Feed עם לייקים/תגובות אמיתיים (סעיף 38). אם למשתמש כבר יש ביקורת
 *  לאותו מקום - מעדכן אותה (upsert לפי unique(place_id,user_id) הקיים)
 *  במקום ליצור כפולה, ויוצר post חדש רק בפעם הראשונה. */
export async function createOrUpdateReview(supabase: SupabaseClient, input: CreateReviewInput): Promise<string> {
  if (input.rating < 1 || input.rating > 5) throw new Error("דירוג חייב להיות בין 1 ל-5");

  const { data: existing } = await supabase
    .from("place_reviews")
    .select("id, post_id")
    .eq("place_id", input.placeId)
    .eq("user_id", input.userId)
    .maybeSingle();

  let postId = existing?.post_id ?? null;

  if (!postId) {
    postId = await createPost(supabase, {
      authorId: input.userId,
      text: input.comment,
      postType: "review",
      placeId: input.placeId,
      visibility: "public",
      mediaIds: input.mediaIds,
    });
  } else if (input.comment !== undefined) {
    await supabase.from("posts").update({ text: input.comment }).eq("id", postId).eq("author_id", input.userId);
  }

  const { data: review, error } = await supabase
    .from("place_reviews")
    .upsert(
      {
        id: existing?.id,
        place_id: input.placeId,
        user_id: input.userId,
        rating: input.rating,
        comment: input.comment ?? null,
        post_id: postId,
      },
      { onConflict: "place_id,user_id" }
    )
    .select("id")
    .single();
  if (error) throw error;

  if (input.mediaIds?.length) {
    // *** תיקון באג: קודם התנאי כלל && !existing - כך שאם למשתמש כבר
    // הייתה ביקורת קיימת לאותו מקום (עריכה), תמונות חדשות שהוא הוסיף
    // בעריכה מעולם לא נשמרו ב-review_media וגם לא סונכרנו לגלריית
    // המקום. עכשיו כל תמונה חדשה (מה-mediaIds שהתקבלו בקריאה הזו,
    // שממילא תמיד "טריים" - ר' CreateReviewSheet.tsx, ה-state שם תמיד
    // מתחיל ריק) נשמרת ומסונכרנת, גם בעריכה.
    const rows = input.mediaIds.map((mediaId, sortOrder) => ({ review_id: review.id, media_id: mediaId, sort_order: sortOrder }));
    await supabase.from("review_media").insert(rows);

    // *** נוסף (בקשה מפורשת - "שהתמונות יישמרו בתור התמונה של
    // האטרקציה"): תמונות שמשתמש מצרף לביקורת אמיתית על מקום נוספות גם
    // לגלריית התמונות של המקום עצמו (places.image_urls), לא רק
    // לביקורת. חייב admin client - RLS על places לא מאפשר UPDATE
    // למשתמשים רגילים (רק SELECT ציבורי, ר' מיגרציה 0004), רק וידאו לא
    // נכנס לגלריית תמונות (image_urls מיועד לתמונות בלבד).
    // *** תיקון (בקשה מפורשת): "התמונה הראשונה שמכניסים - תחליף את
    // התמונה הראשית של האטרקציה, התמונות שבאות אחר כך יופיעו בגלריה
    // למטה". has_user_photo קובע אם זו הפעם הראשונה (מחליפים את
    // image_urls[0], לא זורקים את הישנה - היא זזה להיות חלק מהגלריה)
    // או לא (רק append לסוף, בלי לגעת ב-index 0).
    const { data: mediaRows } = await supabase.from("media_assets").select("url, type").in("id", input.mediaIds);
    const imageUrls = (mediaRows ?? []).filter((m) => m.type === "image").map((m) => m.url);
    if (imageUrls.length) {
      const admin = createAdminClient();
      const { data: place, error: placeSelectError } = await admin
        .from("places")
        .select("image_urls, has_user_photo")
        .eq("id", input.placeId)
        .single();
      if (placeSelectError) {
        // *** לוג רועש בכוונה - אם זה נכשל בשקט (למשל כי מיגרציה 0076
        // עדיין לא רצה ב-DB ולעמודה has_user_photo אין קיום), התמונה
        // הראשית אף פעם לא מתעדכנת בלי שום סימן למה.
        console.error("[reviewService] נכשל לשלוף place לצורך עדכון image_urls:", placeSelectError);
      }
      const existingUrls: string[] = place?.image_urls ?? [];
      const [firstNew, ...restNew] = imageUrls;

      let merged: string[];
      if (!place?.has_user_photo) {
        // תמונת-המשתמש הראשונה אי-פעם למקום הזה - הופכת לראשית;
        // התמונה הקודמת (אם הייתה) לא נמחקת, רק זזה לגלריה.
        merged = [firstNew, ...existingUrls.filter((url) => url !== firstNew), ...restNew];
      } else {
        // כבר יש תמונת-משתמש ראשית - כל התמונות החדשות רק מתווספות לגלריה.
        merged = [...existingUrls, ...imageUrls.filter((url) => !existingUrls.includes(url))];
      }

      const { error: placeUpdateError } = await admin
        .from("places")
        .update({ image_urls: merged, has_user_photo: true })
        .eq("id", input.placeId);
      if (placeUpdateError) {
        console.error("[reviewService] נכשל לעדכן image_urls/has_user_photo על המקום:", placeUpdateError);
      }
    }
  }

  return review.id as string;
}

export async function getPlaceReviews(supabase: SupabaseClient, placeId: string) {
  const { data, error } = await supabase
    .from("place_reviews")
    .select(
      "id, rating, comment, created_at, user:profiles!place_reviews_user_id_fkey(id, username, full_name, avatar_url)"
    )
    .eq("place_id", placeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
