import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import {
  getOtherUserId,
  mapConversationRow,
  mapMessageRow,
  type DmConversationRow,
  type DmMessageRow,
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
    messages: messages.map(mapMessageRow),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text: string | undefined = body?.text?.trim();
  // *** kind='text' בלבד לעת עתה - שיתוף מסלולים/אטרקציות/פוסטים/ביקורות
  // (trip/place/post/review) מגיע כשלב הבא, ישירות מעל אותו schema/route
  // (ר' migration 0093 - כבר תומכת בכל סוגי ה-kind).
  if (!text) return NextResponse.json({ error: "יש להזין הודעה" }, { status: 400 });

  let conversation: DmConversationRow | null;
  try {
    conversation = await loadOwnConversation(supabase, user.id, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בטעינת השיחה" }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const { data: inserted, error: insertError } = await supabase
    .from("dm_messages")
    .insert({ conversation_id: id, sender_id: user.id, kind: "text", text })
    .select("*")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ message: mapMessageRow(inserted as DmMessageRow) });
}
