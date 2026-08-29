import { NextResponse } from "next/server";
import { createAdminClient } from "@/services/supabase/admin";

/** אותו דפוס אימות בדיוק כמו שאר ה-admin API הקיים (ר' destination-editions/route.ts) -
 *  header x-admin-secret מול ADMIN_API_SECRET. */
function checkAuth(request: Request): boolean {
  const secret = request.headers.get("x-admin-secret");
  return Boolean(secret) && secret === process.env.ADMIN_API_SECRET;
}

const VALID_PRIORITIES = ["normal", "important", "urgent"];

/** רשימת כל הודעות המערכת (כולל לא-פעילות/פגות) - לתצוגה מלאה במסך
 *  הניהול. משתמש ב-service_role (עוקף RLS, שמוגבלת ל"פעיל+בתוקף
 *  בלבד" לצד הלקוח הרגיל) - האדמין צריך לראות הכל כדי לערוך/להפעיל
 *  מחדש הודעות ישנות. */
export async function GET(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notifications: data ?? [] });
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title: string | undefined = body?.title?.trim();
  const description: string = body?.description?.trim() ?? "";

  if (!title) {
    return NextResponse.json({ error: "יש לספק כותרת" }, { status: 400 });
  }
  const priority = VALID_PRIORITIES.includes(body?.priority) ? body.priority : "normal";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      type: body?.type === "recommendation" ? "recommendation" : "system",
      title,
      description,
      image_url: body?.imageUrl || null,
      icon: body?.icon || null,
      priority,
      status: body?.status === "disabled" ? "disabled" : "active",
      action_url: body?.actionUrl || null,
      action_label: body?.actionLabel || null,
      // null = גלובלי לכולם, אחרת הודעה אישית למשתמש ספציפי (MASTER
      // PROMPT סעיף 12 - "Audience: כולם / משתמש ספציפי").
      user_id: body?.userId || null,
      push_enabled: Boolean(body?.pushEnabled),
      published_at: body?.publishedAt || new Date().toISOString(),
      expires_at: body?.expiresAt || null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notification: data });
}
