import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { mapConversationRow, orderedPair, type DmConversationRow, type DmMessageKind } from "@/services/social/dmMappers";

/**
 * תיבת הצ'אטים של המשתמש הנוכחי - כל שיחה עם: פרופיל הצד השני, תצוגה
 * מקדימה של ההודעה האחרונה, ומספר הודעות שלא נקראו. GET מחזיר את
 * הרשימה, POST פותח שיחה עם משתמש (אידמפוטנטי - אם כבר קיימת, פשוט
 * מחזיר אותה, בלי ליצור שיחה כפולה).
 */

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data: rows, error } = await supabase
    .from("dm_conversations")
    .select("*")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order("last_message_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const conversations = (rows ?? []) as DmConversationRow[];
  if (conversations.length === 0) return NextResponse.json({ conversations: [] });

  const otherIds = [...new Set(conversations.map((c) => (c.user_a_id === user.id ? c.user_b_id : c.user_a_id)))];
  const conversationIds = conversations.map((c) => c.id);

  const [profilesRes, lastMessagesRes, unreadRes] = await Promise.all([
    supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", otherIds),
    // *** נשלף ממוין יורד ואז לוקחים רק את הראשון לכל conversation_id
    // (ה-Map למטה) - מסד הנתונים לא תומך ב-"DISTINCT ON" דרך ה-client,
    // וזה בכל זאת שאילתה אחת בלבד (לא N+1 - לא שאילתה נפרדת לכל שיחה).
    supabase
      .from("dm_messages")
      .select("conversation_id, kind, text, sender_id, created_at")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false }),
    supabase
      .from("dm_messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", user.id)
      .is("read_at", null),
  ]);
  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });
  if (lastMessagesRes.error) return NextResponse.json({ error: lastMessagesRes.error.message }, { status: 500 });

  const profilesById = new Map((profilesRes.data ?? []).map((p) => [p.id as string, p]));

  const lastMessageByConversation = new Map<string, { kind: DmMessageKind; text: string | null; isMine: boolean; createdAt: string }>();
  for (const m of lastMessagesRes.data ?? []) {
    if (!lastMessageByConversation.has(m.conversation_id)) {
      lastMessageByConversation.set(m.conversation_id, {
        kind: m.kind,
        text: m.text,
        isMine: m.sender_id === user.id,
        createdAt: m.created_at,
      });
    }
  }

  const unreadCountByConversation = new Map<string, number>();
  for (const m of unreadRes.data ?? []) {
    unreadCountByConversation.set(m.conversation_id, (unreadCountByConversation.get(m.conversation_id) ?? 0) + 1);
  }

  const result = conversations.map((c) => {
    const dto = mapConversationRow(c, user.id);
    const profile = profilesById.get(dto.otherUserId) as
      | { id: string; username: string | null; full_name: string | null; avatar_url: string | null }
      | undefined;
    return {
      ...dto,
      otherUser: profile
        ? { id: profile.id, username: profile.username, fullName: profile.full_name, avatarUrl: profile.avatar_url }
        : null,
      lastMessage: lastMessageByConversation.get(c.id) ?? null,
      unreadCount: unreadCountByConversation.get(c.id) ?? 0,
    };
  });

  return NextResponse.json({ conversations: result });
}

export async function POST(request: Request) {
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const otherUserId: string | undefined = body?.userId;
  if (!otherUserId) return NextResponse.json({ error: "חסר userId" }, { status: 400 });
  if (otherUserId === user.id) return NextResponse.json({ error: "אי אפשר לפתוח צ'אט עם עצמך" }, { status: 400 });

  const { userAId, userBId } = orderedPair(user.id, otherUserId);

  const { data: existing, error: findError } = await supabase
    .from("dm_conversations")
    .select("*")
    .eq("user_a_id", userAId)
    .eq("user_b_id", userBId)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (existing) return NextResponse.json({ conversation: mapConversationRow(existing as DmConversationRow, user.id) });

  const { data: created, error: createError } = await supabase
    .from("dm_conversations")
    .insert({ user_a_id: userAId, user_b_id: userBId })
    .select("*")
    .single();
  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });

  return NextResponse.json({ conversation: mapConversationRow(created as DmConversationRow, user.id) });
}
