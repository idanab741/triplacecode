import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";
import { mapConversationRow, mapMessageRow, type SupportConversationRow, type SupportMessageRow } from "@/services/support/supportMappers";

function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

/**
 * תשובת Admin לפנייה. שני שלבים:
 * 1. הכנסת ההודעה עצמה (sender_type='admin') - הטריגר (ר' migration
 *    0062) מעדכן את status ל-waiting_for_user אוטומטית.
 * 2. יצירת התראה אישית למשתמש דרך מערכת ה-notifications *הקיימת* (ר'
 *    migration 0059 + /api/admin/notifications) - לא נבנה מנגנון חדש.
 *    action_url מפנה ל-/support, כדי שלחיצה על ההתראה תפתח את הצ'אט
 *    ישירות (ר' דרישה מפורשת בסעיף 14).
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const message: string | undefined = body?.message?.trim();
  if (!message) return NextResponse.json({ error: "יש להזין הודעה" }, { status: 400 });

  const supabase = createAdminClient();

  const { data: conversation, error: convError } = await supabase.from("support_conversations").select("*").eq("id", id).maybeSingle();
  if (convError) return NextResponse.json({ error: convError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה" }, { status: 404 });

  const { data: inserted, error: insertError } = await supabase
    .from("support_messages")
    .insert({ conversation_id: id, sender_type: "admin", sender_user_id: null, message })
    .select("*")
    .single();
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: updatedConversation } = await supabase.from("support_conversations").select("*").eq("id", id).single();

  const { error: notificationError } = await supabase.from("notifications").insert({
    type: "system",
    title: "שירות הלקוחות השיב לפנייה שלך",
    description: "כדאי לבדוק את הצ'אט 💬",
    icon: "💬",
    priority: "important",
    status: "active",
    action_url: "/support",
    action_label: "לצפייה בצ'אט",
    user_id: (conversation as SupportConversationRow).user_id,
    push_enabled: false,
    published_at: new Date().toISOString(),
  });
  // כשל ביצירת ההתראה לא אמור לחסום/לבטל את התשובה שכבר נשלחה בפועל -
  // ההודעה כבר נשמרה ותופיע למשתמש בכל מקרה כשייכנס לצ'אט, רק בלי
  // "דחיפה" יזומה דרך מרכז ההתראות. מדווח ב-console כדי שלא ייעלם בשקט.
  if (notificationError) console.error("[admin/support/messages] notification insert failed:", notificationError.message);

  return NextResponse.json({
    message: mapMessageRow(inserted as SupportMessageRow),
    conversation: mapConversationRow((updatedConversation ?? conversation) as SupportConversationRow),
  });
}
