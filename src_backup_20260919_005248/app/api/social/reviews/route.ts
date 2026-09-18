import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createOrUpdateReview } from "@/services/social/reviewService";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const placeId = body?.placeId as string | undefined;
  const rating = Number(body?.rating);
  if (!placeId || !rating) return NextResponse.json({ error: "חסר placeId או rating" }, { status: 422 });

  try {
    const reviewId = await createOrUpdateReview(supabase, {
      userId: user.id,
      placeId,
      rating,
      comment: body?.comment,
      mediaIds: body?.mediaIds,
    });
    return NextResponse.json({ id: reviewId }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שגיאה" }, { status: 400 });
  }
}
