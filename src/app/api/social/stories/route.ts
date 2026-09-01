import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createStory, getStoryRail } from "@/services/social/storyService";
import type { PostVisibility } from "@/services/social/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const rail = await getStoryRail(supabase, user.id);
  // *** DEBUG זמני - למחוק אחרי שמסיימים לאבחן את באג המסך השחור בסטורי.
  console.log("[DEBUG stories] rail:", JSON.stringify(rail, null, 2));
  return NextResponse.json({ rail });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || (!body.text && (!body.mediaIds || body.mediaIds.length === 0))) {
    return NextResponse.json({ error: "סטורי חייב לכלול טקסט או מדיה" }, { status: 422 });
  }

  const storyId = await createStory(supabase, {
    authorId: user.id,
    text: body.text,
    placeId: body.placeId,
    tripId: body.tripId,
    visibility: body.visibility as PostVisibility | undefined,
    mediaIds: body.mediaIds,
    mentionedUserIds: body.mentionedUserIds,
  });
  return NextResponse.json({ id: storyId }, { status: 201 });
}
