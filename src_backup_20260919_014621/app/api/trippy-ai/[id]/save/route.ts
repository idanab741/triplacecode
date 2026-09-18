import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * *** תוספת (בקשה מפורשת - "עמוד הבחירות שלי - שינויים", סעיף "אם
 * המשתמש לוחץ שמור"): מסמן/מבטל סימון "שמור" לתוצאת trippy AI - אותו
 * דפוס בדיוק כמו /api/trip-builder/sessions/[sessionId]/save/route.ts
 * (GET לבדיקת מצב התחלתי, POST לשמירה, DELETE לביטול שמירה), רק על
 * טבלת trippy_ai_results (ר' migration 0064 - is_saved).
 */

/** בודק האם התוצאה מסומנת כרגע כ"שמורה" - משמש לטעינת המצב ההתחלתי של כפתור השמירה. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data, error } = await supabase
    .from("trippy_ai_results")
    .select("is_saved")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data?.is_saved === true });
}

/** מסמן תוצאה כ"שמורה" - קבועה, מופיעה בלשונית "שמורים", לא נמחקת לפי המנגנון הקיים. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { error } = await supabase
    .from("trippy_ai_results")
    .update({ is_saved: true })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** מבטל שמירה - התוצאה חוזרת להיות זמנית, כפופה למנגנון ההסרה הקיים. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { error } = await supabase
    .from("trippy_ai_results")
    .update({ is_saved: false })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
