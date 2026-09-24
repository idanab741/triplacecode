import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createAdminClient } from "@/services/supabase/admin";
import {
  getOtherUserId,
  mapConversationRow,
  mapMessageRow,
  type DmConversationRow,
  type DmMessageRow,
  type DmSharedPreview,
} from "@/services/social/dmMappers";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** מוודאת שהשיחה קיימת *והמשתמש הנוכחי צד בה* - RLS כבר חוסמת גישה
 *  לשיחה של שני אנשים אחרים, אבל בדיקה מפורשת נותנת 404 ברור. */
async function loadOwnConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("dm_conversations")
    .select("*")
    .eq("id", conversationId)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
    .maybeSingle();
  if (error) throw error;
  return data as DmConversationRow | null;
}

/** מעשיר הודעות שיתוף (post/place) בתצוגה מקדימה: כותרת, תמונה וקישור. שאילתה אחת לכל סוג (בלי N+1).
 *  המדיה נשלפת עם admin client (media_assets מוגבל לבעלים ב-RLS) - בטוח כי הפוסטים עצמם נשלפים עם ה-client הרגיל,
 *  כלומר רק פוסטים שהצופה רשאי לראות מקבלים תצוגה מקדימה. */
async function buildSharedPreviews(
  supabase: Awaited<ReturnType<typeof createClient>>,
  messages: DmMessageRow[]
): Promise<Map<string, DmSharedPreview>> {
  const out = new Map<string, DmSharedPreview>();
  const postIds = [...new Set(messages.filter((m) => m.kind === "post" && m.post_id).map((m) => m.post_id as string))];
  const placeIds = [...new Set(messages.filter((m) => m.kind === "place" && m.place_id).map((m) => m.place_id as string))];
  const tripAddIds = [...new Set(messages.filter((m) => m.kind === "place" && m.tripadd_id).map((m) => m.tripadd_id as string))];
  if (postIds.length === 0 && placeIds.length === 0 && tripAddIds.length === 0) return out;

  const [postsRes, placesRes, mediaRes, tripAddRes] = await Promise.all([
    postIds.length ? supabase.from("posts").select("id, text, author_id").in("id", postIds) : Promise.resolve({ data: [] }),
    placeIds.length ? supabase.from("places").select("id, name, image_urls").in("id", placeIds) : Promise.resolve({ data: [] }),
    postIds.length
      ? createAdminClient()
          .from("post_media")
          .select("post_id, sort_order, media:media_assets(url, thumbnail_url, type)")
          .in("post_id", postIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    tripAddIds.length
      ? supabase
          .from("tripadd_submissions")
          .select("id, name, google_photo_url, tripadd_submission_media(sort_order, media_assets(url))")
          .in("id", tripAddIds)
      : Promise.resolve({ data: [] }),
  ]);

  const posts = (postsRes.data ?? []) as { id: string; text: string | null; author_id: string }[];
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, username, full_name").in("id", authorIds)
    : { data: [] };
  const authorById = new Map((authors ?? []).map((a) => [a.id as string, a]));

  const firstMedia = new Map<string, string>();
  for (const row of (mediaRes.data ?? []) as unknown as { post_id: string; media: { url: string; thumbnail_url: string | null; type: string } | { url: string; thumbnail_url: string | null; type: string }[] | null }[]) {
    if (firstMedia.has(row.post_id)) continue;
    const media = Array.isArray(row.media) ? row.media[0] : row.media;
    if (media) firstMedia.set(row.post_id, media.type === "video" ? (media.thumbnail_url ?? media.url) : media.url);
  }

  const postById = new Map(posts.map((p) => [p.id, p]));
  const placeById = new Map(((placesRes.data ?? []) as { id: string; name: string; image_urls: string[] | null }[]).map((p) => [p.id, p]));
  type TripAddPreviewRow = {
    id: string;
    name: string;
    google_photo_url: string | null;
    tripadd_submission_media: { sort_order: number; media_assets: { url: string } | { url: string }[] | null }[] | null;
  };
  const tripAddById = new Map(
    ((tripAddRes.data ?? []) as unknown as TripAddPreviewRow[]).map((t) => {
      const first = [...(t.tripadd_submission_media ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
      const media = first ? (Array.isArray(first.media_assets) ? first.media_assets[0] : first.media_assets) : null;
      return [t.id, { name: t.name, imageUrl: media?.url ?? t.google_photo_url ?? null }];
    })
  );

  for (const m of messages) {
    if (m.kind === "post" && m.post_id) {
      const post = postById.get(m.post_id);
      if (!post) continue;
      const author = authorById.get(post.author_id) as { full_name: string | null; username: string | null } | undefined;
      const authorName = author?.full_name ?? author?.username ?? "מטייל";
      out.set(m.id, {
        href: `/places/post/${post.id}`,
        title: post.text?.trim() ? post.text.trim().slice(0, 80) : `פוסט של ${authorName}`,
        subtitle: post.text?.trim() ? `פוסט של ${authorName}` : null,
        imageUrl: firstMedia.get(post.id) ?? null,
      });
    } else if (m.kind === "place" && m.place_id) {
      const place = placeById.get(m.place_id);
      if (!place) continue;
      out.set(m.id, { href: `/place/${place.id}`, title: place.name, subtitle: "מקום", imageUrl: place.image_urls?.[0] ?? null });
    } else if (m.kind === "place" && m.tripadd_id) {
      const place = tripAddById.get(m.tripadd_id);
      if (!place) continue;
      out.set(m.id, { href: `/place/${m.tripadd_id}`, title: place.name, subtitle: "מקום", imageUrl: place.imageUrl });
    }
  }
  return out;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  let conversation: DmConversationRow | null;
  try {
    conversation = await loadOwnConversation(supabase, user.id, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בטעינת השיחה" }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const otherId = getOtherUserId(conversation, user.id);

  const [messagesRes, otherProfileRes] = await Promise.all([
    supabase.from("dm_messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, username, full_name, avatar_url").eq("id", otherId).maybeSingle(),
  ]);
  if (messagesRes.error) return NextResponse.json({ error: messagesRes.error.message }, { status: 500 });

  const messages = (messagesRes.data ?? []) as DmMessageRow[];

  // המשתמש בפועל נכנס לשיחה עכשיו - כל הודעה של הצד השני שעדיין לא
  // נקראה מסומנת כנקראה (RLS מרשה עדכון read_at בתוך שיחות של עצמו בלבד).
  const unreadFromOtherIds = messages.filter((m) => m.sender_id !== user.id && !m.read_at).map((m) => m.id);
  if (unreadFromOtherIds.length > 0) {
    await supabase.from("dm_messages").update({ read_at: new Date().toISOString() }).in("id", unreadFromOtherIds);
  }

  const sharedByMessage = await buildSharedPreviews(supabase, messages);

  return NextResponse.json({
    conversation: mapConversationRow(conversation, user.id),
    otherUser: otherProfileRes.data
      ? {
          id: otherProfileRes.data.id,
          username: otherProfileRes.data.username,
          fullName: otherProfileRes.data.full_name,
          avatarUrl: otherProfileRes.data.avatar_url,
        }
      : null,
    messages: messages.map((m) => ({ ...mapMessageRow(m), shared: sharedByMessage.get(m.id) ?? null })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text: string | undefined = body?.text?.trim();
  const shareKind: "post" | "place" | undefined = body?.kind === "post" || body?.kind === "place" ? body.kind : undefined;
  // הודעת טקסט רגילה חייבת טקסט. הודעת שיתוף (post/place) חייבת מזהה, והטקסט הוא הערה אופציונלית.
  if (!shareKind && !text) return NextResponse.json({ error: "יש להזין הודעה" }, { status: 400 });
  if (shareKind === "post" && !body?.postId) return NextResponse.json({ error: "חסר postId" }, { status: 400 });
  if (shareKind === "place" && !body?.placeId) return NextResponse.json({ error: "חסר placeId" }, { status: 400 });

  let conversation: DmConversationRow | null;
  try {
    conversation = await loadOwnConversation(supabase, user.id, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בטעינת השיחה" }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  let row: Record<string, unknown> = { conversation_id: id, sender_id: user.id, kind: "text", text };
  if (shareKind === "post") {
    row = { conversation_id: id, sender_id: user.id, kind: "post", post_id: body.postId, text: text ?? null };
  } else if (shareKind === "place") {
    // place_id ב-dm_messages מפנה ל-places בלבד. מקום שהועלה ע"י משתמש (tripadd) לא שם - במקרה כזה שולחים את הפוסט.
    // *** מיגרציה 0096: מקום מ-tripadd_submissions נשלח עכשיו כמקום (tripadd_id) - לא רק כפוסט גיבוי.
    const [{ data: placeRow }, { data: tripAddRow }] = await Promise.all([
      supabase.from("places").select("id").eq("id", body.placeId).maybeSingle(),
      supabase.from("tripadd_submissions").select("id").eq("id", body.placeId).maybeSingle(),
    ]);
    if (placeRow) {
      row = { conversation_id: id, sender_id: user.id, kind: "place", place_id: body.placeId, text: text ?? null };
    } else if (tripAddRow) {
      row = { conversation_id: id, sender_id: user.id, kind: "place", tripadd_id: body.placeId, text: text ?? null };
    } else if (body.fallbackPostId) {
      row = { conversation_id: id, sender_id: user.id, kind: "post", post_id: body.fallbackPostId, text: text ?? null };
    } else {
      return NextResponse.json({ error: "אי אפשר לשתף את המקום הזה" }, { status: 422 });
    }
  }

  const { data: inserted, error: insertError } = await supabase.from("dm_messages").insert(row).select("*").single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ message: mapMessageRow(inserted as DmMessageRow) });
}
