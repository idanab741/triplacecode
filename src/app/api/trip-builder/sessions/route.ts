import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getWeeklyForecast } from "@/services/weather/weatherService";
import { describeWeatherCode } from "@/utils/weatherCodes";
import { createSession, getSessionWithStops, saveCategoryPlan, saveTripIntent } from "@/services/tripBuilder/sessionService";
import { decideCategoryPlan } from "@/services/tripBuilder/categoryPlanService";
import { generateTripIntent } from "@/services/tripBuilder/tripIntentService";
import type { DayTripAnswers, TripType } from "@/services/tripBuilder/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const tripType: TripType | undefined = body?.tripType;
  const answers: DayTripAnswers | undefined = body?.answers;
  const origin: { lat: number; lng: number } | undefined = body?.origin;

  if (!tripType || !answers || !origin) {
    return NextResponse.json({ error: "יש לספק tripType, answers ו-origin" }, { status: 400 });
  }

  try {
    const session = await createSession(
      supabase,
      user.id,
      tripType,
      answers as unknown as Record<string, unknown>,
      origin
    );

const dna = await getTravelDna(supabase, user.id);
    const weatherSummary = await getWeatherSummary(origin.lat, origin.lng);

    // Trip Intent: קריאת Claude אחת שמסכמת את הבנת המשתמש - נוצרת פעם אחת כאן,
    // ומשמשת את כל שאר תהליך התכנון (בחירת קטגוריות, ובהמשך גם דירוג מועמדים).
    const tripIntent = await generateTripIntent({ dna, answers, weatherSummary });
    if (tripIntent) {
      await saveTripIntent(supabase, session.id, tripIntent);
    }

    const plan = await decideCategoryPlan({ tripType, dna, answers, weatherSummary, tripIntent });
    const stops = await saveCategoryPlan(supabase, session.id, plan);

    return NextResponse.json({
      session: { ...session, category_plan: plan, status: "building", trip_intent: tripIntent },
      stops,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "יש לספק sessionId" }, { status: 400 });

  const result = await getSessionWithStops(supabase, sessionId);
  if (!result) return NextResponse.json({ error: "ה-session לא נמצא" }, { status: 404 });

  return NextResponse.json(result);
}

async function getWeatherSummary(lat: number, lng: number): Promise<string | null> {
  try {
    const forecast = await Promise.race([
      getWeeklyForecast(lat, lng),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("weather timeout")), 4000)),
    ]);
    const today = forecast[0];
    if (!today) return null;
    const { label } = describeWeatherCode(today.weatherCode);
    return `${label}, ${today.maxTemp}°/${today.minTemp}°`;
  } catch {
    return null;
  }
}
