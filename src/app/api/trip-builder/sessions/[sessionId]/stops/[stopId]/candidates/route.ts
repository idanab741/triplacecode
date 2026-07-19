import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates } from "@/services/tripBuilder/rankingService";
import { getAttributeScoreMap, summarizeTopAttributes } from "@/services/travelDna/attributeLearningService";
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

  // רצף גיאוגרפי: מהתחנה השנייה ואילך, נקודת המוצא היא התחנה האחרונה שנבחרה
  // בפועל (לא הבית) - כדי שהמסלול יזוז בהיגיון ולא יקפוץ בין אזורים
  const likedStops = stops
    .filter((s) => s.status === "liked" && s.place_id && s.slot_index < stop.slot_index)
    .sort((a, b) => b.slot_index - a.slot_index);

  let currentOrigin = { lat: session.origin_latitude, lng: session.origin_longitude };
  if (likedStops.length > 0) {
    const { data: lastPlace } = await supabase
      .from("places")
      .select("latitude, longitude")
      .eq("id", likedStops[0].place_id)
      .maybeSingle();
    if (lastPlace?.latitude != null && lastPlace?.longitude != null) {
      currentOrigin = { lat: lastPlace.latitude, lng: lastPlace.longitude };
    }
  }

  const answers = session.answers as unknown as DayTripAnswers;
  const alreadyUsedPlaceIds = stops
    .filter((s) => s.place_id && s.id !== stopId)
    .map((s) => s.place_id as string);
  const excludePlaceIds = [...alreadyUsedPlaceIds, ...stop.rejected_place_ids];

  try {
const dnaForFilters = await getTravelDna(supabase, user.id);
    const pool = await fetchCandidatePool(supabase, {
      category: stop.category,
      origin: currentOrigin,
      distanceBand: answers.distanceBand,
      maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
      excludePlaceIds,
      requireKosher: dnaForFilters?.kosher === true,
      requireAccessible: dnaForFilters?.accessibility === true,
    });

    if (pool.length === 0) {
      return NextResponse.json({ stop, candidates: [] });
    }

const dna = await getTravelDna(supabase, user.id);
    const attributeScoreMap = await getAttributeScoreMap(supabase, user.id);
    const learnedAttributes = summarizeTopAttributes(attributeScoreMap);
    const rules = getTripTypeRules(session.trip_type);
        const remainingBudgetLabel = answers.budgetBand === "unlimited" ? "ללא הגבלה" : answers.budgetBand;

   const ranked = await rankCandidates({
      dna,
      candidates: pool,
      freeText: answers.freeText,
      remainingBudgetLabel,
      rankingPromptRules: rules.rankingPromptRules,
      attributeScoreMap,
      learnedAttributes,
    });

    return NextResponse.json({ stop, candidates: ranked });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
