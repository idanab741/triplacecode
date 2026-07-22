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
 * "טריפי" - עריכת המסלול בשיחה חופשית. המשתמש כותב בקשה ("תחליף את המסעדה
 * למשהו זול יותר", "תוריד את התצפית") - Claude מפרש את הבקשה ומבצע אותה:
 * מזהה איזו תחנה רלוונטית, ומחליט אם להחליף אותה במקום אחר או להסיר אותה.
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

  const answers = session.answers as unknown as DayTripAnswers;

  try {
    // שלב 1: Claude מפרש מה בדיוק המשתמש מבקש, ביחס למסלול הקיים
    const interpretation = await interpretInstruction(instruction, itinerary.stops);

    if (!interpretation || interpretation.action === "unclear") {
      return NextResponse.json(
        { error: "לא הצלחנו להבין את הבקשה. אפשר לנסח אחרת?" },
        { status: 400 }
      );
    }

    const targetStop = itinerary.stops.find((s) => s.stopId === interpretation.stopId);
    if (!targetStop) {
      return NextResponse.json({ error: "לא זיהינו לאיזו תחנה הכוונה" }, { status: 400 });
    }

    if (interpretation.action === "remove") {
      await supabase.from("trip_builder_stops").delete().eq("id", targetStop.stopId);
    } else if (interpretation.action === "swap") {
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

      // משלבים את המלל המקורי + הבקשה החדשה, כדי שהדירוג יתחשב גם בבקשה הספציפית
      const combinedFreeText = `${answers.freeText}. בקשה נוספת: ${instruction}`;

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
      session.trip_intent
    );

    return NextResponse.json({ itinerary: updatedItinerary, message: interpretation.confirmationMessage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface Interpretation {
  action: "swap" | "remove" | "unclear";
  stopId: string;
  confirmationMessage: string;
}

async function interpretInstruction(
  instruction: string,
  stops: { stopId: string; name: string; category: string }[]
): Promise<Interpretation | null> {
  const prompt = `המשתמש מבקש לשנות משהו במסלול הטיול שלו. פרש את הבקשה שלו וקבע:
1. לאיזו תחנה הבקשה מתייחסת (לפי ה-stopId מהרשימה למטה).
2. מה הפעולה המבוקשת: "swap" (להחליף את התחנה במקום אחר, למשל "יותר זול", "משהו אחר") או
   "remove" (להסיר את התחנה לגמרי מהמסלול, בלי תחליף).
אם אי אפשר לזהות בבירור לאיזו תחנה הכוונה, החזר action: "unclear".

בקשת המשתמש: "${instruction}"

התחנות במסלול:
${JSON.stringify(stops.map((s) => ({ stopId: s.stopId, name: s.name, category: s.category })))}

השב אך ורק במבנה JSON הבא, בלי שום טקסט נוסף:
{"action": "swap" | "remove" | "unclear", "stopId": "...", "confirmationMessage": "משפט קצר בעברית שמאשר מה נעשה"}`;

  const { text, error } = await callClaude(prompt, 400);
  if (error || !text) return null;

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]) as Interpretation;
  } catch (parseError) {
    logAiError("כשל בפענוח פרשנות בקשת שינוי", {
      message: parseError instanceof Error ? parseError.message : String(parseError),
    });
    return null;
  }
}