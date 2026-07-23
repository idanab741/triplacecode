import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createTripMatchSession, fetchTripMatchCandidates } from "@/services/tripMatch/tripMatchService";
import { generateAndSaveDestinationAttractions } from "@/services/tripmatch/destinationAttractionsService";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const city: string | undefined = body?.city;
  const interests: string[] = Array.isArray(body?.interests) ? body.interests : [];

  if (!city || !city.trim()) {
    return NextResponse.json({ error: "יש לספק עיר" }, { status: 400 });
  }

  try {
    const session = await createTripMatchSession(supabase, user.id, city.trim(), interests);
    let candidates = await fetchTripMatchCandidates(supabase, session);

    // אין עדיין מועמדים ליעד הזה ב-DB (בעיקר יעדים בינלאומיים) - Claude יוצר
    // רשימת אטרקציות אמיתית, שומר אותה, ואז שולפים שוב.
    if (candidates.length === 0) {
      await generateAndSaveDestinationAttractions(supabase, session.city, session.interests);
      candidates = await fetchTripMatchCandidates(supabase, session);
    }

    return NextResponse.json({ session, candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}