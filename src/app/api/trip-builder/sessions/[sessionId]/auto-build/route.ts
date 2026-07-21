import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getAttributeScoreMap, summarizeTopAttributes } from "@/services/travelDna/attributeLearningService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates } from "@/services/tripBuilder/rankingService";
import { likeStop } from "@/services/tripBuilder/swipeService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { dayTripBudgetToMaxPriceLevel, MAX_STOP_DISTANCE_KM } from "@/services/tripBuilder/rules/dayTrip";
import { finalizeItinerary } from "@/services/tripBuilder/finalizeService";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

/**
 * "TripLace" - בונה מסלול מלא אוטומטית, בלי לשאול את המשתמש בכלל.
 * לכל תחנה: שולף מועמדים, מדרג, ובוחר את המדורג הראשון - כאילו המשתמש
 * עשה Like על הראשון בכל שלב. משתמש באותה שרשרת בדיוק כמו ההחלקות הרגילות.
 */
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
  if (session.origin_latitude == null || session.origin_longitude == null) {
    return NextResponse.json({ error: "חסר מיקום מוצא ל-session" }, { status: 400 });
  }

  const answers = session.answers as unknown as DayTripAnswers;

  try {
    const dna = await getTravelDna(supabase, user.id);
    const attributeScoreMap = await getAttributeScoreMap(supabase, user.id);
    const learnedAttributes = summarizeTopAttributes(attributeScoreMap);
    const rules = getTripTypeRules(session.trip_type);
    const remainingBudgetLabel = answers.budgetBand === "unlimited" ? "ללא הגבלה" : answers.budgetBand;

const origin = { lat: session.origin_latitude, lng: session.origin_longitude };
    const pendingStops = stops
      .filter((s) => s.status === "pending")
      .sort((a, b) => a.slot_index - b.slot_index);
    const excludePlaceIds = stops.filter((s) => s.place_id).map((s) => s.place_id as string);

    // רץ ברצף (לא במקביל): כל תחנה יוצאת מהתחנה הקודמת שבאמת נבחרה,
    // לא מהבית - כדי שהמסלול יהיה קרוב פיזית ולא מפוזר.
    let cursor = origin;

    for (let i = 0; i < pendingStops.length; i++) {
      const stop = pendingStops[i];
      const isFirstStop = i === 0;

      const pool = await fetchCandidatePool(supabase, {
        category: stop.category,
        origin: cursor,
        distanceBand: answers.distanceBand,
        maxDistanceKm: isFirstStop ? undefined : MAX_STOP_DISTANCE_KM[answers.durationBand],
        maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
        excludePlaceIds,
      });

      if (pool.length === 0) continue;

      const ranked = await rankCandidates({
        dna,
        candidates: pool,
        freeText: answers.freeText,
        remainingBudgetLabel,
        rankingPromptRules: rules.rankingPromptRules,
        attributeScoreMap,
        learnedAttributes,
      });

      const top = ranked[0];
      if (!top) continue;

      await likeStop(supabase, user.id, stop.id, top);

      excludePlaceIds.push(top.id);
      cursor = { lat: top.latitude, lng: top.longitude };
    }

    const itinerary = await finalizeItinerary(
      supabase,
      sessionId,
      { lat: session.origin_latitude, lng: session.origin_longitude },
      answers.budgetBand
    );

    return NextResponse.json({ itinerary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}