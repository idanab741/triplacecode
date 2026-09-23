import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";

/** Toggle לייק על תגובה (או תגובה-לתגובה). מחזיר { liked } - המצב החדש. */
export async function POST(_request: Request, { params }: { params: Promise<{ commentId: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { commentId } = await params;

  const { data: existing, error: findError } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("comment_id", commentId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (findError) return NextResponse.json({ error: findError.message }, { status: 500 });

  if (existing) {
    const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ liked: false });
  }

  const { error } = await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ liked: true });
}
