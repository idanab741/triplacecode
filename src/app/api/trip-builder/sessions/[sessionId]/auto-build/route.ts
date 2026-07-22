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
import { findBestCluster } from "@/services/tripBuilder/clusterService";
import { geocodePlaceName } from "@/services/tripBuilder/geocodingService";
import { getOrCreateAreaExperience } from "@/services/tripBuilder/areaExperienceService";
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
  const tripIntent = session.trip_intent;

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

// אם המלל החופשי ביקש אזור ספציפי (למשל "יום ביפו") - בונים את הטיול
    // סביב האזור הזה, לא סביב הבית של המשתמש. משתמשים בבית רק לחישוב
    // זמני נסיעה אמיתיים בהמשך (ב-finalizeItinerary), לא לחיפוש המקומות עצמם.
    // כשיש אזור מבוקש מפורש - משתמשים ברדיוס קטן וקבוע סביבו (לא ב-distanceBand,
    // שהוא "מרחק מקסימלי מהבית" ולא רלוונטי כשהמשתמש כבר ציין איפה הוא רוצה להיות).
    let searchOrigin = origin;
    let requestedAreaRadiusKm: number | undefined;
    if (tripIntent?.requestedArea) {
      const geocoded = await geocodePlaceName(tripIntent.requestedArea);
      if (geocoded) {
        searchOrigin = geocoded;
        requestedAreaRadiusKm = 3;
      }
    }

// Area Detection: לפני שבוחרים תחנה אחת, אוספים מועמדים מכל הקטגוריות
    // בתוכנית ומזהים את האזור הגיאוגרפי הצפוף ביותר במקומות איכותיים.
    // כל המסלול נבנה סביב האזור הזה, במקום לזחול תחנה-אחר-תחנה בלי לראות
    // את התמונה הכוללת - מונע קפיצות גיאוגרפיות ומסלולים לא רציפים.
const clusteringPools = await Promise.all(
      pendingStops.map(async (stop) => ({
        category: stop.category,
        candidates: await fetchCandidatePool(supabase, {
          category: stop.category,
          origin: searchOrigin,
          distanceBand: answers.distanceBand,
          maxDistanceKm: requestedAreaRadiusKm,
          maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
          excludePlaceIds,
        }),
      }))
    );
    const clusterCenter = findBestCluster(clusteringPools, searchOrigin);

    // רץ ברצף (לא במקביל): כל תחנה יוצאת מהתחנה הקודמת שבאמת נבחרה,
    // ומתחיל מהאזור שזוהה (לא מהבית) - כדי שהמסלול יהיה קרוב פיזית ולא מפוזר.
    let cursor = clusterCenter;

    for (let i = 0; i < pendingStops.length; i++) {
      const stop = pendingStops[i];
      const isFirstStop = i === 0;

const pool = await fetchCandidatePool(supabase, {
        category: stop.category,
        origin: cursor,
        distanceBand: answers.distanceBand,
        maxDistanceKm: isFirstStop
          ? requestedAreaRadiusKm
          : MAX_STOP_DISTANCE_KM[answers.durationBand],
        maxPriceLevel: dayTripBudgetToMaxPriceLevel(answers.budgetBand),
        excludePlaceIds,
      });

      // אין מועמד מתאים ב-DB, אבל המשתמש ביקש אזור ספציפי - ה-AI יוצר בעצמו
      // חוויית הסתובבות באזור, במקום פשוט לדלג על התחנה. ה-DB הוא רק גיבוי,
      // לא תנאי מקדים - ככה המנוע "מוביל" את התוצאה, לא מוגבל לרשימה קיימת.
      if (pool.length === 0 && tripIntent?.requestedArea) {
        const generatedStop = await getOrCreateAreaExperience(supabase, {
          areaName: tripIntent.requestedArea,
          category: stop.category,
          coords: cursor,
          origin: cursor,
        });

        if (generatedStop) {
          await likeStop(supabase, user.id, stop.id, generatedStop);
          excludePlaceIds.push(generatedStop.id);
          cursor = { lat: generatedStop.latitude, lng: generatedStop.longitude };
          continue;
        }
      }

      if (pool.length === 0) continue;

const ranked = await rankCandidates({
        dna,
        candidates: pool,
        freeText: answers.freeText,
        remainingBudgetLabel,
        rankingPromptRules: rules.rankingPromptRules,
        attributeScoreMap,
        learnedAttributes,
        tripIntent,
      });

const top = ranked[0];
      if (!top) continue;

      await likeStop(supabase, user.id, stop.id, top);

      excludePlaceIds.push(top.id);
      cursor = { lat: top.latitude, lng: top.longitude };

      // Area Experience: אם התחנה שנבחרה היא אזור חוויה שלם (למשל "נווה צדק"),
      // התחנות הבאות לא אמורות להיבחר מתוכו - הן כבר "בפנים" את החוויה הזו.
      // מרחיבים משמעותית את המרחק המינימלי הבא, כדי לא לבחור עוד תחנה
      // שנמצאת בתוך אותו אזור ממש.
      if (top.isAreaExperience) {
        excludePlaceIds.push(
          ...(await getPlaceIdsWithinRadius(supabase, cursor, 0.8, excludePlaceIds))
        );
      }
    }

const itinerary = await finalizeItinerary(
      supabase,
      sessionId,
      { lat: session.origin_latitude, lng: session.origin_longitude },
      answers.budgetBand,
      answers.durationBand,
      tripIntent
    );

    return NextResponse.json({ itinerary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
/**
 * מוצא מזהי מקומות שנמצאים ברדיוס נתון מנקודה - משמש למניעת בחירת עוד תחנות
 * בתוך אזור חוויה שכבר נבחר (Area Experience), כי הן כבר חלק מאותה חוויה.
 */
async function getPlaceIdsWithinRadius(
  supabase: Awaited<ReturnType<typeof createClient>>,
  center: { lat: number; lng: number },
  radiusKm: number,
  alreadyExcluded: string[]
): Promise<string[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180));

  let query = supabase
    .from("places")
    .select("id")
    .gte("latitude", center.lat - latDelta)
    .lte("latitude", center.lat + latDelta)
    .gte("longitude", center.lng - lngDelta)
    .lte("longitude", center.lng + lngDelta);

  if (alreadyExcluded.length > 0) {
    query = query.not("id", "in", `(${alreadyExcluded.join(",")})`);
  }

  const { data } = await query;
  return (data ?? []).map((row) => row.id as string);
}