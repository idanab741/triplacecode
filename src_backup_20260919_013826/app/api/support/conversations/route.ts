import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { mapConversationRow, mapMessageRow, type SupportConversationRow, type SupportMessageRow } from "@/services/support/supportMappers";

/**
 * שיחת שירות לקוחות אחת קבועה למשתמש (ר' migration 0062 - "לא נוצרת
 * שיחה חדשה בכל פנייה"). GET מחזיר אותה + כל ההודעות, POST יוצר אותה
 * אם עוד אין (אידמפוטנטי - אם כבר קיימת, פשוט מחזיר אותה).
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

  const { data: conversation, error: convError } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ conversation: null, messages: [] });

  const { data: messages, error: msgError } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  // המשתמש בפועל נכנס לצ'אט עכשיו - כל תשובת admin שעדיין לא נקראה
  // מסומנת כנקראה (ר' migration 0062, RLS מרשה למשתמש לעדכן read_at
  // בתוך שיחות של עצמו בלבד).
  const unreadAdminIds = ((messages ?? []) as SupportMessageRow[])
    .filter((m) => m.sender_type === "admin" && !m.read_at)
    .map((m) => m.id);
  if (unreadAdminIds.length > 0) {
    await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).in("id", unreadAdminIds);
  }

  return NextResponse.json({
    conversation: mapConversationRow(conversation as SupportConversationRow),
    messages: ((messages ?? []) as SupportMessageRow[]).map(mapMessageRow),
  });
}

export async function POST() {
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data: existing, error: findError } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });
  if (existing) return NextResponse.json({ conversation: mapConversationRow(existing as SupportConversationRow) });

  const { data: created, error: createError } = await supabase
    .from("support_conversations")
    .insert({ user_id: user.id })
    .select("*")
    .single();

  if (createError) return NextResponse.json({ error: createError.message }, { status: 500 });
  return NextResponse.json({ conversation: mapConversationRow(created as SupportConversationRow) });
}
