import type { SupabaseClient } from "@supabase/supabase-js";
import type { FeedTab } from "./feedService";

/**
 * Like / Comment / feed-filter משותפים לתוכן חברתי שאינו Post (אוספים, טיולים).
 * כולם משתמשים באותן טבלאות קיימות - post_likes ו-comments - עם עמודת יעד ייעודית
 * (collection_id / trip_id; ר' migrations 0089-0090). Save עובר דרך social_saves (toggleSocialSave).
 */
export type SocialTargetColumn = "collection_id" | "trip_id";

export async function toggleTargetLike(
  supabase: SupabaseClient,
  column: SocialTargetColumn,
  targetId: string,
  userId: string
): Promise<boolean> {
  const { data: existing } = await supabase.from("post_likes").select("id").eq(column, targetId).eq("user_id", userId).maybeSingle();

  if (existing) {
    const { error } = await supabase.from("post_likes").delete().eq("id", existing.id);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase.from("post_likes").insert({ [column]: targetId, user_id: userId });
  if (error) throw error;
  return true;
}

export async function getTargetComments(supabase: SupabaseClient, column: SocialTargetColumn, targetId: string, limit = 30, before?: string) {
  let query = supabase
    .from("comments")
    .select("id, text, created_at, parent_comment_id, author:profiles!comments_author_id_fkey(id, username, full_name, avatar_url)")
    .eq(column, targetId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function addTargetComment(
  supabase: SupabaseClient,
  column: SocialTargetColumn,
  targetId: string,
  authorId: string,
  text: string,
  parentCommentId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from("comments")
    .insert({ [column]: targetId, author_id: authorId, text, parent_comment_id: parentCommentId ?? null })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** מחיקה אמיתית של התגובה של המשתמש עצמו (policy "Users can delete their own comments").
 *  לא soft-delete כמו ב-deleteComment של פוסטים - UPDATE של deleted_at נחסם ע"י ה-RLS (ר' migration 0089). */
export async function deleteTargetComment(
  supabase: SupabaseClient,
  column: SocialTargetColumn,
  commentId: string,
  authorId: string
): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("author_id", authorId).not(column, "is", null);
  if (error) throw error;
}

/** מזהי היוצרים שה-Feed מוגבל אליהם לפי הטאב (חברים / במעקב). null = ללא הגבלה ("עבורך");
 *  מערך ריק = אין תוצאות. אותה לוגיקה כמו getFeed של פוסטים. */
export async function resolveFeedAuthorIds(supabase: SupabaseClient, viewerId: string, tab: FeedTab): Promise<string[] | null> {
  if (tab === "friends") {
    const { data } = await supabase
      .from("friendships")
      .select("requester_id, addressee_id")
      .or(`requester_id.eq.${viewerId},addressee_id.eq.${viewerId}`)
      .eq("status", "accepted");
    return (data ?? []).map((row) => (row.requester_id === viewerId ? row.addressee_id : row.requester_id));
  }
  if (tab === "following") {
    const { data } = await supabase.from("follows").select("following_id").eq("follower_id", viewerId);
    return (data ?? []).map((row) => row.following_id);
  }
  return null;
}
