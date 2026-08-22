import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
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
import { getCategoryLabel } from "@/utils/categoryLabels";
import type { DayTripAnswers } from "@/services/tripBuilder/types";

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
 * מחליף תחנה בודדת במסלול קיים במועמד אחר, כאשר המשתמש לא מרוצה מהתחנה
 * שנבחרה. שולף מועמדים חדשים מסביב למיקום הנוכחי של התחנה (לא מהבית),
 * מדרג אותם, ובוחר את המדורג הראשון שאינו כבר חלק מהמסלול. בסוף בונה
 * מחדש את כל המסלול (זמנים, סדר) עם התחנה החדשה.
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

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  const { session } = result;
  const itinerary = session.final_itinerary;
  if (!itinerary) return NextResponse.json({ error: "אין עדיין מסלול סופי" }, { status: 400 });

  const targetStop = itinerary.stops.find((s) => s.stopId === stopId);
  if (!targetStop) return NextResponse.json({ error: "התחנה לא נמצאה" }, { status: 404 });

  const isVacationLikeTrip = session.trip_type === "weekend" || session.trip_type === "abroad_vacation";
  const answers = session.answers as unknown as DayTripAnswers;
  const vacationAnswers = session.answers as unknown as { budgetPerPerson?: string; distanceBand?: string };
  const effectiveBudgetBand = isVacationLikeTrip ? (vacationAnswers.budgetPerPerson ?? "unlimited") : answers.budgetBand;

  try {
    const dna = await getTravelDna(supabase, user.id);
    const attributeScoreMap = await getAttributeScoreMap(supabase, user.id);
    const learnedAttributes = summarizeTopAttributes(attributeScoreMap);
    const rules = getTripTypeRules(session.trip_type);
    const remainingBudgetLabel = effectiveBudgetBand === "unlimited" ? "ללא הגבלה" : effectiveBudgetBand;
    const tripIntent = session.trip_intent;

    // חוסמים את כל המקומות שכבר במסלול, כולל התחנה שמוחלפת עצמה
    const excludePlaceIds = itinerary.stops.map((s) => s.placeId);
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
      return NextResponse.json({ error: "לא נמצא מקום חלופי מתאים בקרבת מקום" }, { status: 404 });
    }

    const ranked = await rankCandidates({
      dna,
      candidates: pool,
      freeText: answers.freeText,
      remainingBudgetLabel,
      rankingPromptRules: rules.rankingPromptRules,
      attributeScoreMap,
      learnedAttributes,
      tripIntent,
      // רק לטיול יומי כרגע - ר' הסבר מפורט ב-categoryPlanService.ts /
      // rankingService.ts. שאר סוגי הטיול יתווספו בהמשך, אחד-אחד.
      questionnaireAnswers:
        session.trip_type === "day_trip"
          ? {
              companions: answers.companions,
              childAgeBands: answers.childAgeBands,
              timing: answers.timing,
              distanceBand: answers.distanceBand,
              budgetBand: answers.budgetBand,
              interests: (answers.interests ?? []).map(getCategoryLabel),
              durationBand: answers.durationBand,
            }
          : undefined,
    });

    const top = ranked[0];
    if (!top) {
      return NextResponse.json({ error: "לא נמצא מקום חלופי מתאים" }, { status: 404 });
    }

    await likeStop(supabase, user.id, stopId, top);

const updatedItinerary = await finalizeItinerary(
      supabase,
      sessionId,
      { lat: session.origin_latitude!, lng: session.origin_longitude! },
      effectiveBudgetBand,
      answers.durationBand,
      tripIntent,
      answers.freeText,
      true,
      [],
      {
        childAgeBands: (answers as unknown as { childAgeBands?: string[] }).childAgeBands,
        isCulinaryFocused: (
          (answers as unknown as { vacationTypes?: string[]; weekendStyles?: string[] }).vacationTypes ??
          (answers as unknown as { vacationTypes?: string[]; weekendStyles?: string[] }).weekendStyles ??
          []
        ).includes("culinary"),
      }
    );

    return NextResponse.json({ itinerary: updatedItinerary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}