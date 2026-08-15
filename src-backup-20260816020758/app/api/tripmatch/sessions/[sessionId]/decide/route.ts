import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTripMatchSession, recordTripMatchDecision, fetchTripMatchCandidates } from "@/services/tripMatch/tripMatchService";
import { toggleFavorite } from "@/services/favorites/favoritesService";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
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
    return NextResponse.json({ error: "בקשה לא תקינה" }, { status: 400 });
  }

  const session = await getTripMatchSession(supabase, sessionId);
  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "session לא נמצא" }, { status: 404 });
  }

  await recordTripMatchDecision(supabase, sessionId, placeId, liked);

  if (liked) {
    await toggleFavorite(supabase, user.id, placeId, "place", "liked", "tripmatch").catch(() => {});
  }

  const updatedSession = await getTripMatchSession(supabase, sessionId);
  const candidates = updatedSession ? await fetchTripMatchCandidates(supabase, updatedSession) : [];

  return NextResponse.json({ candidates });
}
