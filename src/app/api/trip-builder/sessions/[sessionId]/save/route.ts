import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

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
    .eq("id", sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}