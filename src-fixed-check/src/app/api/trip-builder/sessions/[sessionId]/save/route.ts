import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** בודק האם הטיול מסומן כרגע כ"שמור" - משמש לטעינת המצב ההתחלתי של כפתור השמירה. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .select("is_saved")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ saved: data?.is_saved === true });
}

/** מסמן טיול כ"שמור" - שלב ראשון, בלי שיתוף בשלב זה. */
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

  const { error } = await supabase
    .from("trip_builder_sessions")
    .update({ is_saved: true })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

/** מבטל שמירה - מוציא את הטיול מעמוד "השמורים" (לחיצה חוזרת על כפתור השמירה). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { error } = await supabase
    .from("trip_builder_sessions")
    .update({ is_saved: false })
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}