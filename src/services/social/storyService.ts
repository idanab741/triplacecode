import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostVisibility } from "./types";

export interface CreateStoryInput {
  authorId: string;
  text?: string;
  placeId?: string;
  tripId?: string;
  visibility?: PostVisibility;
  mediaIds?: string[];
  mentionedUserIds?: string[];
}

export async function createStory(supabase: SupabaseClient, input: CreateStoryInput) {
  const { data: story, error } = await supabase
    .from("stories")
    .insert({
      author_id: input.authorId,
      text: input.text ?? null,
      place_id: input.placeId ?? null,
      trip_id: input.tripId ?? null,
      visibility: input.visibility ?? "public",
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.mediaIds?.length) {
    const rows = input.mediaIds.map((mediaId, sortOrder) => ({ story_id: story.id, media_id: mediaId, sort_order: sortOrder }));
    const { error: mediaError } = await supabase.from("story_media").insert(rows);
    if (mediaError) throw mediaError;
  }

  if (input.mentionedUserIds?.length) {
    const rows = input.mentionedUserIds.map((userId) => ({ story_id: story.id, mentioned_user_id: userId }));
    const { error: mentionError } = await supabase.from("story_mentions").insert(rows);
    if (mentionError) throw mentionError;
  }

  return story.id as string;
}

export interface StoryRailAuthorDto {
  author: { id: string; username: string | null; fullName: string | null; avatarUrl: string | null };
  hasUnviewed: boolean;
  stories: {
    id: string;
    createdAt: string;
    text: string | null;
    viewed: boolean;
    media: { id: string; type: string; url: string }[];
  }[];
}

/** מחזיר את שורת ה-Stories למעלה ב-Home, מקובץ לפי מחבר, "הסטורי שלי" קודם
 *  (סעיף 6). RLS כבר מסנן expires_at + visibility + חסימות. */
export async function getStoryRail(supabase: SupabaseClient, viewerId: string): Promise<StoryRailAuthorDto[]> {
  const { data: stories, error } = await supabase
    .from("stories")
    .select("id, author_id, text, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!stories || stories.length === 0) return [];

  const authorIds = [...new Set(stories.map((s) => s.author_id))];
  const storyIds = stories.map((s) => s.id);

  const [authorsRes, viewsRes, mediaRes] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", authorIds),
    supabase.from("story_views").select("story_id").in("story_id", storyIds).eq("viewer_id", viewerId),
    supabase
      .from("story_media")
      .select("story_id, sort_order, media:media_assets(id, type, url)")
      .in("story_id", storyIds)
      .order("sort_order", { ascending: true }),
  ]);

  const authorsById = new Map((authorsRes.data ?? []).map((a) => [a.id, a]));
  const viewedSet = new Set((viewsRes.data ?? []).map((v) => v.story_id));
  const mediaByStory = new Map<string, { id: string; type: string; url: string }[]>();
  for (const row of mediaRes.data ?? []) {
    const media = row.media as unknown as { id: string; type: string; url: string } | null;
    if (!media) continue;
    const list = mediaByStory.get(row.story_id) ?? [];
    list.push(media);
    mediaByStory.set(row.story_id, list);
  }

  const grouped = new Map<string, StoryRailAuthorDto>();
  for (const story of stories) {
    const author = authorsById.get(story.author_id);
    if (!grouped.has(story.author_id)) {
      grouped.set(story.author_id, {
        author: {
          id: story.author_id,
          username: author?.username ?? null,
          fullName: author?.full_name ?? null,
          avatarUrl: author?.avatar_url ?? null,
        },
        hasUnviewed: false,
        stories: [],
      });
    }
    const entry = grouped.get(story.author_id)!;
    const viewed = viewedSet.has(story.id);
    entry.stories.push({
      id: story.id,
      createdAt: story.created_at,
      text: story.text,
      viewed,
      media: mediaByStory.get(story.id) ?? [],
    });
    // *** תיקון: קודם הסטורי של המשתמש עצמו הוחרג לגמרי מכאן (&&
    // story.author_id !== viewerId) - מה שגרם ל-hasUnviewed להיות
    // תמיד false עבור "הסטורי שלי", ללא קשר אם המשתמש בפועל צפה בו.
    // עכשיו זה עוקב אחרי מצב הצפייה האמיתי גם עבור הסטורי של עצמך
    // (בקשה מפורשת: "הטבעת עדיין לא נעלמת אחרי שצפיתי בכל הסטורי").
    if (!viewed) entry.hasUnviewed = true;
  }

  // "הסטורי שלי" תמיד ראשון
  const result = [...grouped.values()];
  result.sort((a, b) => {
    if (a.author.id === viewerId) return -1;
    if (b.author.id === viewerId) return 1;
    return Number(b.hasUnviewed) - Number(a.hasUnviewed);
  });
  return result;
}

export async function markStoryViewed(supabase: SupabaseClient, storyId: string, viewerId: string) {
  const { error } = await supabase
    .from("story_views")
    .upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: "story_id,viewer_id" });
  if (error) throw error;
}

export async function getStoryViewers(supabase: SupabaseClient, storyId: string) {
  const { data, error } = await supabase
    .from("story_views")
    .select("viewer_id, viewed_at, viewer:profiles!story_views_viewer_id_fkey(id, username, full_name, avatar_url)")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteStory(supabase: SupabaseClient, storyId: string, authorId: string) {
  const { error } = await supabase.from("stories").delete().eq("id", storyId).eq("author_id", authorId);
  if (error) throw error;
}
