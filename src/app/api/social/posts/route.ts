import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createPost } from "@/services/social/postService";
import type { PostType, PostVisibility } from "@/services/social/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || (!body.text && (!body.mediaIds || body.mediaIds.length === 0))) {
    return NextResponse.json({ error: "פוסט חייב לכלול טקסט או מדיה" }, { status: 422 });
  }

  try {
    const postId = await createPost(supabase, {
      authorId: user.id,
      text: body.text,
      postType: body.postType as PostType | undefined,
      placeId: body.placeId,
      destinationId: body.destinationId,
      tripId: body.tripId,
      visibility: body.visibility as PostVisibility | undefined,
      mediaIds: body.mediaIds,
    });
    return NextResponse.json({ id: postId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה ביצירת הפוסט" }, { status: 400 });
  }
}
