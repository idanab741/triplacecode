import type { SupabaseClient } from "@supabase/supabase-js";
import { createPost } from "./postService";

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

  if (input.mediaIds?.length && !existing) {
    const rows = input.mediaIds.map((mediaId, sortOrder) => ({ review_id: review.id, media_id: mediaId, sort_order: sortOrder }));
    await supabase.from("review_media").insert(rows);
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
