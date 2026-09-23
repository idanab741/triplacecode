import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { updatePost, deletePost } from "@/services/social/postService";
import { getFeed } from "@/services/social/feedService";
import type { PostVisibility } from "@/services/social/types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  await updatePost(supabase, id, user.id, {
    text: body?.text,
    visibility: body?.visibility as PostVisibility | undefined,
  });
  return NextResponse.json({ success: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  await deletePost(supabase, id, user.id);
  return NextResponse.json({ success: true });
}

/** פוסט בודד (כ-FeedItemDto) - לעמוד הפוסט /places/post/[id]. ה-RLS של posts מחליט אם הצופה רשאי לראות אותו. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { id } = await params;
  const { items } = await getFeed(supabase, user.id, "for_you", 1, undefined, undefined, undefined, id);
  const post = items[0] ?? null;
  if (!post) return NextResponse.json({ error: "הפוסט לא נמצא" }, { status: 404 });
  return NextResponse.json({ post });
}
