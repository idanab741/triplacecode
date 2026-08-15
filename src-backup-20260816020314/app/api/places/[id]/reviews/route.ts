import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getPlaceReviewsSummary, upsertPlaceReview } from "@/services/places/placeReviewsService";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const summary = await getPlaceReviewsSummary(supabase, id, user?.id ?? null);
  return NextResponse.json(summary);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר כדי לדרג" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);
  const comment: string | null = typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "דירוג חייב להיות בין 1 ל-5 כוכבים" }, { status: 400 });
  }

  try {
    await upsertPlaceReview(supabase, id, user.id, rating, comment);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שמירת הדירוג נכשלה" }, { status: 500 });
  }

  const summary = await getPlaceReviewsSummary(supabase, id, user.id);
  return NextResponse.json(summary);
}
