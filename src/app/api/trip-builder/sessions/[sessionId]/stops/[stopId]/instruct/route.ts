import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { callClaude, logAiError } from "@/services/ai/claudeService";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getAttributeScoreMap, summarizeTopAttributes } from "@/services/travelDna/attributeLearningService";
import { getSessionWithStops } from "@/services/tripBuilder/sessionService";
import { fetchCandidatePool } from "@/services/tripBuilder/candidatePoolService";
import { rankCandidates } from "@/services/tripBuilder/rankingService";
import { likeStop } from "@/services/tripBuilder/swipeService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { dayTripBudgetToMaxPriceLevel } from "@/services/tripBuilder/rules/dayTrip";
import { finalizeItinerary } from "@/services/tripBuilder/finalizeService";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

/**
 * "טריפי" לפי תחנה ספציפית - בשונה מ-chat-edit הכללי, כאן כבר יודעים בוודאות
 * לאיזו תחנה הבקשה מתייחסת (הגיע מכפתור TRIPPY על הכרטיס עצמו) - אז Claude
 * צריך רק לקבוע *מה* לעשות (החלף/הסר), לא *לאיזו תחנה*.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; stopId: string }> }
) {
  const { sessionId, stopId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const instruction: string | undefined = body?.instruction;
  if (!instruction || !instruction.trim()) {
    return NextResponse.json({ error: "יש לכתוב בקשה" }, { status: 400 });
  }

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const { session } = result;
  const itinerary = session.final_itinerary;
  if (!itinerary) return NextResponse.json({ error: "אין עדיין מסלול סופי" }, { status: 400 });

  const targetStop = itinerary.stops.find((s) => s.stopId === stopId);
  if (!targetStop) return NextResponse.json({ error: "התחנה לא נמצאה" }, { status: 404 });

  const answers = session.answers as unknown as DayTripAnswers;

  try {
    const action = await interpretAction(instruction);

    if (action === "remove") {
      await supabase.from("trip_builder_stops").delete().eq("id", targetStop.stopId);
    } else {
      // ברירת מחדל: "swap" - אם לא בטוחים, עדיף להחליף (פחות הרסני מהסרה מוחלטת)
      const dna = await getTravelDna(supabase, user.id);
      const attributeScoreMap = await getAttributeScoreMap(supabase, user.id);
      const learnedAttributes = summarizeTopAttributes(attributeScoreMap);
      const rules = getTripTypeRules(session.trip_type);
      const remainingBudgetLabel = answers.budgetBand === "unlimited" ? "ללא הגבלה" : answers.budgetBand;
      const excludePlaceIds = itinerary.stops.map((s) => s.placeId);

      const pool = await fetchCandidatePool(supabase, {
        category: targetStop.category,
        origin: { lat: targetStop.latitude, lng: targetStop.longitude },
        distanceBand: answers.distanceBand,
        maxDistanceKm: 3,
        maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
        excludePlaceIds,
      });

      if (pool.length === 0) {
        return NextResponse.json({ error: "לא נמצא מקום חלופי מתאים" }, { status: 404 });
      }

      const combinedFreeText = `${answers.freeText}. בקשה ספציפית לתחנה הזו: ${instruction}`;

      const ranked = await rankCandidates({
        dna,
        candidates: pool,
        freeText: combinedFreeText,
        remainingBudgetLabel,
        rankingPromptRules: rules.rankingPromptRules,
        attributeScoreMap,
        learnedAttributes,
        tripIntent: session.trip_intent,
      });

      const top = ranked[0];
      if (!top) {
        return NextResponse.json({ error: "לא נמצא מקום חלופי מתאים" }, { status: 404 });
      }

      await likeStop(supabase, user.id, targetStop.stopId, top);
    }

const updatedItinerary = await finalizeItinerary(
      supabase,
      sessionId,
      { lat: session.origin_latitude!, lng: session.origin_longitude! },
      answers.budgetBand,
      answers.durationBand,
      session.trip_intent,
      answers.freeText
    );

    return NextResponse.json({ itinerary: updatedItinerary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function interpretAction(instruction: string): Promise<"swap" | "remove"> {
  const prompt = `המשתמש מבקש לשנות תחנה ספציפית במסלול הטיול שלו. קבע:
"remove" - אם המשתמש מבקש להסיר/למחוק את התחנה לגמרי, בלי תחליף.
"swap" - בכל מקרה אחר (בקשה להחליף למשהו אחר, זול יותר, שונה וכו').

בקשת המשתמש: "${instruction}"

השב אך ורק במילה אחת: swap או remove`;

  const { text } = await callClaude(prompt, 20);
  if (text?.trim().toLowerCase().includes("remove")) return "remove";
  return "swap";
}