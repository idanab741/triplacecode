import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { mapConversationRow, mapMessageRow, type SupportConversationRow, type SupportMessageRow } from "@/services/support/supportMappers";

async function getAuthedUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** מוודאת שהשיחה קיימת *ושייכת למשתמש הנוכחי* - RLS כבר חוסמת גישה
 *  לשיחה של מישהו אחר, אבל בדיקה מפורשת נותנת 404 ברור במקום שגיאת
 *  RLS גנרית, ומונעת מהקוד להמשיך אם השורה פשוט לא חזרה מה-select. */
async function loadOwnConversation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as SupportConversationRow | null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  let conversation: SupportConversationRow | null;
  try {
    conversation = await loadOwnConversation(supabase, user.id, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בטעינת השיחה" }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const { data: messages, error: msgError } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  const unreadAdminIds = ((messages ?? []) as SupportMessageRow[])
    .filter((m) => m.sender_type === "admin" && !m.read_at)
    .map((m) => m.id);
  if (unreadAdminIds.length > 0) {
    await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).in("id", unreadAdminIds);
  }

  return NextResponse.json({
    conversation: mapConversationRow(conversation),
    messages: ((messages ?? []) as SupportMessageRow[]).map(mapMessageRow),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const message: string | undefined = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "יש להזין הודעה" }, { status: 400 });

  let conversation: SupportConversationRow | null;
  try {
    conversation = await loadOwnConversation(supabase, user.id, id);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "שגיאה בטעינת השיחה" }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const { data: inserted, error: insertError } = await supabase
    .from("support_messages")
    .insert({ conversation_id: id, sender_type: "user", sender_user_id: user.id, message })
    .select("*")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // הטריגר (support_message_after_insert, ר' migration 0062) כבר עדכן
  // את ה-status/last_message_at - טוענים מחדש כדי להחזיר ללקוח מצב עדכני.
  const { data: updatedConversation } = await supabase.from("support_conversations").select("*").eq("id", id).single();

  return NextResponse.json({
    message: mapMessageRow(inserted as SupportMessageRow),
    conversation: updatedConversation ? mapConversationRow(updatedConversation as SupportConversationRow) : mapConversationRow(conversation),
  });
}
