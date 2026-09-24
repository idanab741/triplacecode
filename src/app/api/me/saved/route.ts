import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import { getViewerSavedTripCards } from "@/services/social/tripService";
import { getViewerSavedCollectionCards } from "@/services/social/collectionService";

/**
 * *** חדש (בקשה מפורשת - "יש המון כפתורי שמירה באפליקציה - לסדר את זה, כולל פוסטים"):
 * כל מה שנשמר ב-social_saves (פוסטים, טיולים ואוספים של הקהילה) במבנה אחד, עם זמן השמירה -
 * כדי ש"הבחירות שלי" יציג הכל. מקומות (favorites) נטענים בצד הלקוח, כמו קודם.
 */

export interface SavedSocialItemDto {
  kind: "post" | "trip" | "collection";
  id: string;
  savedAt: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  href: string;
  /** trip: סוג הטיול (לאייקון) / מספר תחנות. */
  tripType: string | null;
  stopCount: number | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data: saves, error } = await supabase
    .from("social_saves")
    .select("target_type, target_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(150);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const savedAt = new Map((saves ?? []).map((s) => [`${s.target_type}:${s.target_id}`, s.created_at as string]));
  const postIds = (saves ?? []).filter((s) => s.target_type === "post").map((s) => s.target_id as string);

  const [trips, collections, postsRes, mediaRes] = await Promise.all([
    getViewerSavedTripCards(supabase, user.id).catch(() => []),
    getViewerSavedCollectionCards(supabase, user.id).catch(() => []),
    postIds.length
      ? supabase.from("posts").select("id, text, author_id, created_at").in("id", postIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as { id: string; text: string | null; author_id: string; created_at: string }[] }),
    // post_media / media_assets מוגבלים לבעלים ב-RLS - admin client, בטוח כי הפוסטים עצמם נשלפים עם ה-client הרגיל
    // (רק פוסטים שהמשתמש רשאי לראות מקבלים תמונה). אותו דפוס כמו בתצוגה המקדימה של הצ'אט.
    postIds.length
      ? createAdminClient()
          .from("post_media")
          .select("post_id, sort_order, media:media_assets(url, thumbnail_url, type)")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const posts = (postsRes.data ?? []) as { id: string; text: string | null; author_id: string; created_at: string }[];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, username, full_name").in("id", authorIds)
    : { data: [] as { id: string; username: string | null; full_name: string | null }[] };
  const authorName = new Map((authors ?? []).map((a) => [a.id as string, (a.full_name as string | null) ?? (a.username as string | null) ?? "מטייל"]));

  type MediaRow = { post_id: string; media: { url: string; thumbnail_url: string | null; type: string } | { url: string; thumbnail_url: string | null; type: string }[] | null };
  const firstMedia = new Map<string, string>();
  for (const row of (mediaRes.data ?? []) as unknown as MediaRow[]) {
    if (firstMedia.has(row.post_id)) continue;
    const media = Array.isArray(row.media) ? row.media[0] : row.media;
    if (media) firstMedia.set(row.post_id, media.type === "video" ? (media.thumbnail_url ?? media.url) : media.url);
  }

  const items: SavedSocialItemDto[] = [
    ...posts.map((p) => ({
      kind: "post" as const,
      id: p.id,
      savedAt: savedAt.get(`post:${p.id}`) ?? p.created_at,
      title: p.text?.trim() ? p.text.trim().slice(0, 90) : `פוסט של ${authorName.get(p.author_id) ?? "מטייל"}`,
      subtitle: `פוסט של ${authorName.get(p.author_id) ?? "מטייל"}`,
      imageUrl: firstMedia.get(p.id) ?? null,
      href: `/places/post/${p.id}`,
      tripType: null,
      stopCount: null,
    })),
    ...trips.map((t) => ({
      kind: "trip" as const,
      id: t.id,
      savedAt: savedAt.get(`trip:${t.id}`) ?? t.createdAt,
      title: t.title,
      subtitle: `${t.stopCount} תחנות · מאת ${t.author.fullName ?? t.author.username ?? "מטייל"}`,
      imageUrl: t.coverUrl ?? t.autoCoverUrl,
      href: `/places/trip/${t.id}`,
      tripType: t.tripType,
      stopCount: t.stopCount,
    })),
    ...collections.map((c) => ({
      kind: "collection" as const,
      id: c.id,
      savedAt: savedAt.get(`collection:${c.id}`) ?? c.createdAt,
      title: c.title,
      subtitle: `${c.itemCount} פריטים · מאת ${c.author.fullName ?? c.author.username ?? "מטייל"}`,
      imageUrl: c.coverUrl ?? c.collageUrls[0] ?? null,
      href: `/places/collection/${c.id}`,
      tripType: null,
      stopCount: null,
    })),
  ].sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  return NextResponse.json({ items });
}
