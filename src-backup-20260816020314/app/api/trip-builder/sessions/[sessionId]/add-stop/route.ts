import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getSessionWithStops, addDynamicStop } from "@/services/tripBuilder/sessionService";
import { decideNextStop } from "@/services/tripBuilder/categoryPlanService";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

/** מוסיפה תחנה אחת נוספת ל-session קיים, לפי המלל החופשי/תחומי העניין (זרימת החלקות דינמית). */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const { session, stops } = result;
  const answers = session.answers as unknown as DayTripAnswers;
  const usedCategories = stops.map((s) => s.category);

  try {
    const dna = await getTravelDna(supabase, user.id);
    const { category, role } = await decideNextStop({ dna, answers, usedCategories });
    const stop = await addDynamicStop(supabase, sessionId, category, role);
    return NextResponse.json({ stop });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}