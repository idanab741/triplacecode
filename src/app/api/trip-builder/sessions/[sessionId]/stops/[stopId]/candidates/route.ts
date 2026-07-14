import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates } from "@/services/tripBuilder/rankingService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { dayTripBudgetToMaxPriceLevel } from "@/services/tripBuilder/rules/dayTrip";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; stopId: string }> }
) {
  const { sessionId, stopId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const { session, stops } = result;
  const stop = stops.find((s) => s.id === stopId);
  if (!stop) return NextResponse.json({ error: "התחנה לא נמצאה" }, { status: 404 });

  if (session.origin_latitude == null || session.origin_longitude == null) {
    return NextResponse.json({ error: "חסר מיקום מוצא ל-session" }, { status: 400 });
  }

  const answers = session.answers as unknown as DayTripAnswers;
  const alreadyUsedPlaceIds = stops
    .filter((s) => s.place_id && s.id !== stopId)
    .map((s) => s.place_id as string);
  const excludePlaceIds = [...alreadyUsedPlaceIds, ...stop.rejected_place_ids];

  try {
    const pool = await fetchCandidatePool(supabase, {
      category: stop.category,
      origin: { lat: session.origin_latitude, lng: session.origin_longitude },
      distanceBand: answers.distanceBand,
      maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
      excludePlaceIds,
    });

    if (pool.length === 0) {
      return NextResponse.json({ stop, candidates: [] });
    }

    const dna = await getTravelDna(supabase, user.id);
    const rules = getTripTypeRules(session.trip_type);
    const remainingBudgetLabel = answers.budgetBand === "unlimited" ? "ללא הגבלה" : answers.budgetBand;

    const ranked = await rankCandidates({
      dna,
      candidates: pool,
      freeText: answers.freeText,
      remainingBudgetLabel,
      rankingPromptRules: rules.rankingPromptRules,
    });

    return NextResponse.json({ stop, candidates: ranked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
