import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostType, PostVisibility } from "./types";

export interface CreatePostInput {
  authorId: string;
  text?: string;
  postType?: PostType;
  placeId?: string;
  destinationId?: string;
  tripId?: string;
  visibility?: PostVisibility;
  mediaIds?: string[];
}

export async function createPost(supabase: SupabaseClient, input: CreatePostInput) {
  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      author_id: input.authorId,
      text: input.text ?? null,
      post_type: input.postType ?? "post",
      place_id: input.placeId ?? null,
      destination_id: input.destinationId ?? null,
      trip_id: input.tripId ?? null,
      visibility: input.visibility ?? "public",
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
}

export async function updatePost(
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  updates: { text?: string; visibility?: PostVisibility }
) {
  const { error } = await supabase.from("posts").update(updates).eq("id", postId).eq("author_id", authorId);
  if (error) throw error;
}

/** מחיקה רכה - עקבי עם deleted_at בשאר המערכת ועם ה-RLS שמסנן לפיו */
export async function deletePost(supabase: SupabaseClient, postId: string, authorId: string) {
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export async function toggleLike(supabase: SupabaseClient, postId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    await supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    return false;
  }
  await supabase.from("post_likes").insert({ post_id: postId, user_id: userId });
  return true;
}

export async function addComment(
  supabase: SupabaseClient,
  postId: string,
  authorId: string,
  text: string,
  parentCommentId?: string
) {
  const { data, error } = await supabase
    .from("comments")
    .insert({ post_id: postId, author_id: authorId, text, parent_comment_id: parentCommentId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteComment(supabase: SupabaseClient, commentId: string, authorId: string) {
  const { error } = await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("author_id", authorId);
  if (error) throw error;
}

export async function getComments(supabase: SupabaseClient, postId: string, limit = 30, before?: string) {
  let query = supabase
    .from("comments")
    .select("id, text, created_at, parent_comment_id, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)")
    .eq("post_id", postId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Toggle social save (Post/Trip) - נפרד מ-Favorites (סעיף 110) */
export async function toggleSocialSave(
  supabase: SupabaseClient,
  userId: string,
  targetType: "post" | "trip",
  targetId: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("social_saves")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();

  if (existing) {
    await supabase.from("social_saves").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("social_saves").insert({ user_id: userId, target_type: targetType, target_id: targetId });
  return true;
}
