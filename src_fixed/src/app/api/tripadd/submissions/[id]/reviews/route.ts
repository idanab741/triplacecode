import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { upsertTripAddReview } from "@/services/tripadd/tripAddService";

/**
 * *** חדש (בקשה מפורשת - "דרגו את המקום הזה" בעמוד האטרקציה של
 * TripAdd): עד עכשיו upsertTripAddReview נקרא רק פעם אחת, בתוך יצירת
 * submission חדש (POST /api/tripadd/submissions) - לא הייתה שום דרך
 * לדרג/לעדכן דירוג על מקום TripAdd **קיים** אחרי שהוא כבר נוצר. אותה
 * פונקציית שירות בדיוק (unique(submission_id,user_id) - מעדכן את
 * הדירוג הקיים של אותו משתמש, לא יוצר כפול), רק endpoint נפרד
 * שמאפשר לקרוא לה מעמוד המקום עצמו, לא רק מטופס ההוספה.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "יש להתחבר כדי לדרג" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);
  const description: string | null = typeof body?.comment === "string" && body.comment.trim() ? body.comment.trim() : null;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "דירוג חייב להיות בין 1 ל-5 כוכבים" }, { status: 400 });
  }

  try {
    await upsertTripAddReview(supabase, {
      submissionId: id,
      userId: user.id,
      rating,
      description: description ?? undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "שמירת הדירוג נכשלה" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
