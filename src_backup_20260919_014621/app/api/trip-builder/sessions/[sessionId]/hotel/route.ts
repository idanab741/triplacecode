import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/**
 * מעדכן פרטי מלון (שם+כתובת) ל-session קיים - נדרש כשהמשתמש לא הזין מלון
 * מראש בשאלון, ורוצה להוסיף אותו אחר כך בעמוד התוצאות (למשל לפני שמירת
 * הטיול), כדי שהתצוגה תוכל להציג "הגעה למלון" עם שם אמיתי.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name: string | undefined = body?.name;
  const address: string | undefined = body?.address;

  if (!name) return NextResponse.json({ error: "יש לספק שם מלון" }, { status: 400 });

  const { data: session } = await supabase
    .from("trip_builder_sessions")
    .select("answers")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const answers = (session.answers ?? {}) as Record<string, unknown>;
  const updatedAnswers = {
    ...answers,
    hotels: [{ name, address: address ?? "" }],
  };

  const { error } = await supabase
    .from("trip_builder_sessions")
    .update({ answers: updatedAnswers })
    .eq("id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ hotel: { name, address: address ?? "" } });
}
