import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { mapConversationRow, type SupportConversationRow, type SupportConversationStatus, type SupportMessageRow } from "@/services/support/supportMappers";

/** אותו דפוס אימות בדיוק כמו שאר ה-admin API הקיים (ר' admin/notifications/route.ts). */
function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const VALID_STATUSES: SupportConversationStatus[] = ["open", "waiting_for_admin", "waiting_for_user", "closed"];

/**
 * רשימת פניות שירות הלקוחות ל-Admin. auth.users לא נגיש ישירות דרך
 * PostgREST (רק דרך Supabase Auth Admin API) - אז פרטי משתמש (email)
 * נשלפים עם auth.admin.listUsers() ומצטרפים בזיכרון, אותו pattern
 * בדיוק כמו /api/admin/users. חיפוש לפי שם/email גם הוא לכן מתבצע
 * בזיכרון (לא ניתן ל-SQL ILIKE ישירות מול auth.users) - מספיק וסביר
 * בהיקף פניות שירות לקוחות טיפוסי; אם הנפח יגדל משמעותית, שווה לשקול
 * עמודה מנורמלת ייעודית לחיפוש במקום.
 */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  const statusParam = searchParams.get("status");
  const statusFilter = VALID_STATUSES.includes(statusParam as SupportConversationStatus) ? (statusParam as SupportConversationStatus) : null;

  const supabase = createAdminClient();

  const { data: conversations, error: convError } = await supabase
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false });
  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });

  const conversationRows = (conversations ?? []) as SupportConversationRow[];
  const conversationIds = conversationRows.map((c) => c.id);

  const { data: messages, error: msgError } = conversationIds.length
    ? await supabase
        .from("support_messages")
        .select("id,conversation_id,sender_type,message,read_at,created_at")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: true })
    : { data: [] as SupportMessageRow[], error: null };
  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });

  const lastMessageByConversation = new Map<string, SupportMessageRow>();
  const unreadCountByConversation = new Map<string, number>();
  for (const m of (messages ?? []) as SupportMessageRow[]) {
    lastMessageByConversation.set(m.conversation_id, m); // asc order - האחרון שדורס הוא האחרון כרונולוגית
    if (m.sender_type === "user" && !m.read_at) {
      unreadCountByConversation.set(m.conversation_id, (unreadCountByConversation.get(m.conversation_id) ?? 0) + 1);
    }
  }

  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });
  const authUserById = new Map((authData.users as { id: string; email?: string }[]).map((u) => [u.id, u]));

  const userIds = Array.from(new Set(conversationRows.map((c) => c.user_id)));
  const { data: profilesData } = userIds.length
    ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] };
  const profiles = (profilesData ?? []) as { id: string; full_name: string | null; avatar_url: string | null }[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  let rows = conversationRows.map((c) => {
    const authUser = authUserById.get(c.user_id);
    const profile = profileById.get(c.user_id);
    const lastMessage = lastMessageByConversation.get(c.id);
    const unreadCount = unreadCountByConversation.get(c.id) ?? 0;
    return {
      ...mapConversationRow(c),
      user: {
        id: c.user_id,
        email: authUser?.email ?? "",
        fullName: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      },
      lastMessagePreview: lastMessage?.message ?? "",
      unreadCount,
      hasUnread: unreadCount > 0,
    };
  });

  // ספירות גלובליות (לא מושפעות מהסינון הנוכחי) - למונים בראש העמוד
  const counts = {
    open: rows.filter((r) => r.status === "open").length,
    waiting_for_admin: rows.filter((r) => r.status === "waiting_for_admin").length,
    waiting_for_user: rows.filter((r) => r.status === "waiting_for_user").length,
    closed: rows.filter((r) => r.status === "closed").length,
    unread: rows.filter((r) => r.hasUnread).length,
  };

  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);

  if (search) {
    rows = rows.filter((r) => {
      const haystack = `${r.user.fullName ?? ""} ${r.user.email} ${r.lastMessagePreview}`.toLowerCase();
      return haystack.includes(search);
    });
  }

  return NextResponse.json({ conversations: rows, counts });
}
