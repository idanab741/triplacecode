import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getSessionWithStops, saveFinalItinerary } from "@/services/tripBuilder/sessionService";
import type { FinalItinerary } from "@/services/tripBuilder/types";

/** שומר סדר תחנות חדש (אחרי גרירה בעמוד התוצאות) - מחליף את itinerary.stops בסדר החדש. */
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

  const body = await request.json().catch(() => null);
  const itinerary: FinalItinerary | undefined = body?.itinerary;
  if (!itinerary) return NextResponse.json({ error: "יש לספק itinerary" }, { status: 400 });

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  await saveFinalItinerary(supabase, sessionId, itinerary);

  return NextResponse.json({ success: true });
}