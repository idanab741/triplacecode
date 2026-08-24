import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** מוחק לגמרי session של טיול (בלתי הפיך) - רק אם הוא שייך למשתמש המחובר. */
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
    .delete()
    .eq("id", sessionId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
