import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { addComment, getComments } from "@/services/social/postService";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before") ?? undefined;

  const comments = await getComments(supabase, id, 30, before);
  return NextResponse.json({ comments });
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

  const commentId = await addComment(supabase, id, user.id, text.trim(), body?.parentCommentId);
  return NextResponse.json({ id: commentId }, { status: 201 });
}
