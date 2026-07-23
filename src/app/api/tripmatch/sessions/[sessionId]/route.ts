import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { recordTripMatchDecision, getTripMatchSession, fetchTripMatchCandidates } from "@/services/tripMatch/tripMatchService";
import { recordSwipeSignal } from "@/services/travelDna/attributeLearningService";
import { toggleFavorite, skipPlace } from "@/services/favorites/favoritesService";

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
  const placeId: string | undefined = body?.placeId;
  const liked: boolean | undefined = body?.liked;

  if (!placeId || typeof liked !== "boolean") {
    return NextResponse.json({ error: "יש לספק placeId ו-liked" }, { status: 400 });
  }

  await recordTripMatchDecision(supabase, sessionId, placeId, liked);

  // אותם מנגנוני למידה שכבר קיימים בטיול היומי - כדי שהחלקות ב-TripMatch
  // ישפיעו על אותו Travel DNA וילמדו את אותן העדפות
  await recordSwipeSignal(supabase, user.id, placeId, liked);
  if (liked) {
    await toggleFavorite(supabase, user.id, placeId, "place", "liked");
  } else {
    await skipPlace(supabase, user.id, placeId, "place");
  }

  const session = await getTripMatchSession(supabase, sessionId);
  if (!session) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const candidates = await fetchTripMatchCandidates(supabase, session);
  return NextResponse.json({ candidates });
}