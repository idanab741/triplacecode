import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

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
  const date = body?.date as string | undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "תאריך לא תקין" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trip_builder_sessions")
    .update({ calendar_date: date, is_saved: true })
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "הטיול לא נמצא או שאין הרשאה" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}