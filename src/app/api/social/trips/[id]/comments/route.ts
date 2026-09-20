import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { addTripComment, getTripComments } from "@/services/social/tripService";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const before = new URL(request.url).searchParams.get("before") ?? undefined;

  try {
    const comments = await getTripComments(supabase, id, 30, before);
    return NextResponse.json({ comments });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בטעינת התגובות" }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const text = body?.text as string | undefined;
  if (!text?.trim()) return NextResponse.json({ error: "חסר טקסט לתגובה" }, { status: 422 });

  try {
    const commentId = await addTripComment(supabase, id, user.id, text.trim(), body?.parentCommentId);
    return NextResponse.json({ id: commentId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה בשליחת התגובה" }, { status: 400 });
  }
}
