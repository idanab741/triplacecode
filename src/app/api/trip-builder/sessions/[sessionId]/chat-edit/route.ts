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
import { distanceBandToRadiusKm } from "@/services/tripBuilder/geo";
import { finalizeItinerary } from "@/services/tripBuilder/finalizeService";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

/** תיקון פער אמיתי - אותו mapping בדיוק שכבר קיים ב-auto-build/route.ts
 *  (VACATION_BUDGET_PER_PERSON_MAX_PRICE_LEVEL) - סקאלת budgetPerPerson
 *  של סופ"ש/חופשה בחו"ל שונה לגמרי מ-DayTripAnswers.budgetBand. */
const VACATION_BUDGET_PER_PERSON_MAX_PRICE_LEVEL: Record<string, number | null> = {
  "0-1000": 1,
  "1000-3000": 2,
  "3000+": 3,
  "0-2500": 1,
  "2500-7500": 2,
  "7500-12000": 3,
  "12000+": 4,
  unlimited: null,
};
function vacationBudgetToMaxPriceLevel(budgetPerPerson: string | null | undefined): number | null {
  if (!budgetPerPerson) return null;
  return VACATION_BUDGET_PER_PERSON_MAX_PRICE_LEVEL[budgetPerPerson] ?? null;
}

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

  // תיקון פער אמיתי (Audit מול MASTER SPEC סעיף 115-118 - Chat Edit):
  // הקובץ הזה טיפל בכל trip_type כאילו הוא DayTripAnswers - אותו באג
  // בדיוק שכבר תוקן 3 פעמים ב-auto-build/route.ts/finalizeService.ts:
  // answers.budgetBand לא קיים בכלל בסופ"ש/חופשה (השדה שם הוא budgetPerPerson,
  // סקאלת ערכים שונה). כאן זה עוד יותר משמעותי כי chat-edit הוא בדיוק
  // הזרימה ש"תוזילו את המסלול" (סעיף 118) אמורה לעבוד בה - עם הבאג הזה,
  // בקשה כזו בסופ"ש/חופשה בכלל לא הייתה מוגבלת לשום תקציב אמיתי.
  const isVacationLikeTrip = session.trip_type === "weekend" || session.trip_type === "abroad_vacation";
  const answers = session.answers as unknown as DayTripAnswers;
  const vacationAnswers = session.answers as unknown as { budgetPerPerson?: string; distanceBand?: string };
  const effectiveBudgetBand = isVacationLikeTrip ? (vacationAnswers.budgetPerPerson ?? "unlimited") : answers.budgetBand;

  try {
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
      const remainingBudgetLabel = effectiveBudgetBand === "unlimited" ? "ללא הגבלה" : effectiveBudgetBand;
      const excludePlaceIds = itinerary.stops.map((s) => s.placeId);

      // תיקון פער אמיתי: distanceBand בפועל משמש רק כ-fallback אם pool
      // ריק ברדיוס 3 ק"מ המפורש - עבור abroad_vacation אין distanceBand
      // בכלל (undefined), מה שהיה עלול לגרום ל-fetchCandidatePool להיכשל
      // בשקט על ה-fallback שלה. "1h" הוא ברירת מחדל סבירה כשאין ערך אמיתי.
      const effectiveDistanceBand = isVacationLikeTrip
        ? ((vacationAnswers.distanceBand as Parameters<typeof distanceBandToRadiusKm>[0]) ?? "1h")
        : answers.distanceBand;

      const pool = await fetchCandidatePool(supabase, {
        category: targetStop.category,
        origin: { lat: targetStop.latitude, lng: targetStop.longitude },
        distanceBand: effectiveDistanceBand,
        maxDistanceKm: 3,
        maxPriceLevel: isVacationLikeTrip
          ? vacationBudgetToMaxPriceLevel(effectiveBudgetBand)
          : dayTripBudgetToMaxPriceLevel(answers.budgetBand),
        excludePlaceIds,
        requireKosher: dna?.kosher === true,
        requireAccessible: dna?.accessibility === true,
      });

      if (pool.length === 0) {
        return NextResponse.json({ error: "לא נמצא מקום חלופי מתאים" }, { status: 404 });
      }

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
      effectiveBudgetBand,
      answers.durationBand,
      session.trip_intent,
      undefined,
      true,
      [],
      {
        childAgeBands: (answers as unknown as { childAgeBands?: string[] }).childAgeBands,
      }
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