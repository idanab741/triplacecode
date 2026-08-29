import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { mapConversationRow, mapMessageRow, type SupportConversationRow, type SupportConversationStatus, type SupportMessageRow } from "@/services/support/supportMappers";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const VALID_STATUSES: SupportConversationStatus[] = ["open", "waiting_for_admin", "waiting_for_user", "closed"];

/** שיחה מלאה + פרטי המשתמש שפתח אותה (ר' דרישה מפורשת - "הקשר צריך
 *  להיות באמצעות auth.users/user id הקיים, אין ליצור משתמש חדש"). מסמנת
 *  את הודעות המשתמש שעדיין לא נקראו כ"נקראו" - זו הנקודה שבה Admin
 *  בפועל פתח את הפנייה (ר' דרישה מפורשת בסעיף 13). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const supabase = createAdminClient();

  const { data: conversation, error: convError } = await supabase.from("support_conversations").select("*").eq("id", id).maybeSingle();
  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const { data: messages, error: msgError } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  const unreadUserIds = ((messages ?? []) as SupportMessageRow[])
    .filter((m) => m.sender_type === "user" && !m.read_at)
    .map((m) => m.id);
  if (unreadUserIds.length > 0) {
    await supabase.from("support_messages").update({ read_at: new Date().toISOString() }).in("id", unreadUserIds);
  }

  const userId = (conversation as SupportConversationRow).user_id;
  const [{ data: authUser }, { data: profile }] = await Promise.all([
    supabase.auth.admin.getUserById(userId),
    supabase.from("profiles").select("full_name,avatar_url").eq("id", userId).maybeSingle(),
  ]);

  return NextResponse.json({
    conversation: mapConversationRow(conversation as SupportConversationRow),
    user: {
      id: userId,
      email: authUser?.user?.email ?? "",
      fullName: profile?.full_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    },
    messages: ((messages ?? []) as SupportMessageRow[]).map(mapMessageRow),
  });
}

/** משנה status ידנית (ר' דרישה מפורשת - "לאפשר ל-ADMIN לשנות סטטוס"). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const status = body?.status;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "סטטוס לא תקין" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("support_conversations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: mapConversationRow(data as SupportConversationRow) });
}
