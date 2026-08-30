import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { getTravelDna } from "@/services/travelDna/travelDnaService";
import { getWeeklyForecast } from "@/services/weather/weatherService";
import { describeWeatherCode } from "@/utils/weatherCodes";
import { createSession, getSessionWithStops, saveCategoryPlan, saveTripIntent } from "@/services/tripBuilder/sessionService";
import { decideCategoryPlan, buildMultiDayVacationPlan } from "@/services/tripBuilder/categoryPlanService";
import { getTripTypeRules } from "@/services/tripBuilder/rules";
import { generateTripIntent } from "@/services/tripBuilder/tripIntentService";
import { normalizeAnswers } from "@/services/tripBuilder/categoryPlanService";
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

    // "חופשה בחו\"ל": תוכנית התחנות (buildMultiDayVacationPlan) דטרמיניסטית
    // לגמרי - בלי קריאת AI - ולכן אין שום סיבה להמתין כאן ל-DNA/מזג
    // אוויר/"כוונת הטיול" (generateTripIntent, קריאת Claude שלוקחת כ-8
    // שניות) לפני שמחזירים תשובה ללקוח. אלה יחושבו בהמשך, במקביל לבניית
    // המסלול עצמה (auto-build) - לא ברצף לפניה - כדי שהניווט למסך
    // הבא יקרה כמה שיותר מהר.
    if (tripType === "abroad_vacation" || tripType === "weekend") {
      const vacationLikeAnswers = answers as unknown as {
        startDate: string;
        endDate: string;
        pace: string;
        vacationTypes?: string[];
        weekendStyles?: string[];
      };
      const plan = buildMultiDayVacationPlan({
        startDate: vacationLikeAnswers.startDate,
        endDate: vacationLikeAnswers.endDate,
        pace: vacationLikeAnswers.pace,
        vacationTypes: vacationLikeAnswers.vacationTypes ?? vacationLikeAnswers.weekendStyles ?? [],
        tripType,
      });
      const stops = await saveCategoryPlan(supabase, session.id, plan);

      return NextResponse.json({
        session: { ...session, category_plan: plan, status: "building", trip_intent: null },
        stops,
      });
    }

    // "מסעדות ובתי קפה": בדיוק כמו "חופשה בחו"ל"/"סופ"ש" למעלה - התוכנית
    // כאן דטרמיניסטית לגמרי (תחנה בודדת, role=food, קטגוריה קבועה
    // "wineries_dining" - ר' RESTAURANTS_CAFES_DURATION_RULES) ולא באמת
    // זקוקה ל-Claude בכלל כדי להחליט מה התחנה תהיה. קודם, decideCategoryPlan
    // תמיד קרא ל-Claude (tryClaudePlan) גם כאן - וגם generateTripIntent
    // רץ ברצף *לפניו* - שתי קריאות Claude רצופות (יחד ~9-11 שניות, ר'
    // "[Claude Timing]" בלוגים) שחסמו את התשובה ללקוח לפני שהוא בכלל
    // הגיע לעמוד הטעינה. "כוונת הטיול" (tripIntent) עדיין מחושבת - היא
    // כן קריטית (מזהה requestedPlaceName/אזור) - אבל בתוך auto-build,
    // *אחרי* שכבר עברנו למסך הטעינה, לא לפניו.
    if (tripType === "restaurants_cafes") {
      const restaurantRules = getTripTypeRules("restaurants_cafes");
      const defaultDurationRule = restaurantRules.durationRules["default"];
      const plan: import("@/services/tripBuilder/types").CategoryPlanItem[] = [
        {
          category: "wineries_dining",
          role: defaultDurationRule?.roles[0] ?? "food",
          order: 0,
        },
      ];
      const stops = await saveCategoryPlan(supabase, session.id, plan);

      return NextResponse.json({
        session: { ...session, category_plan: plan, status: "building", trip_intent: null },
        stops,
      });
    }

    // "חיי לילה ובילויים" ו"דייט רומנטי": בניגוד למסעדות (תחנה אחת קבועה),
    // כאן התוכנית בפועל תלויה בבחירה של המשתמש (בר/מועדון/הופעה, או עם מי
    // הדייט/איזה סוג דייט) ובמלל החופשי - Claude עדיין נחוץ כדי לבחור נכון,
    // לא ניתן לוותר עליו בלי לפגוע בדיוק ההתאמה. הפתרון: לא מוותרים על
    // Claude, רק לא **חוסמים** את הניווט למסך הטעינה בשבילו. מחזירים
    // תשובה מיד עם session בלי שום תחנות (category_plan ריק) -
    // decideCategoryPlan (כולל תוכנית + trip intent) רץ בתוך auto-build
    // עצמו, אחרי שהמשתמש כבר במסך הטעינה, ולא לפני. כך גם המהירות
    // משתפרת משמעותית וגם הדיוק (Claude) נשאר מלא בעינו.
    // "חיי לילה ובילויים", "דייט רומנטי", "טיול בטבע" ו"טיול יומי": כאן
    // התוכנית תלויה בבחירות המשתמש (בר/מועדון/הופעה, עם מי הדייט, סוגי
    // טבע/עניין וכו') ובמלל החופשי - Claude נחוץ לדיוק, ובנוסף (לטיול
    // בטבע/יומי במיוחד) הענף הייעודי ב-auto-build ממש **תלוי** בתוכנית
    // הזו (ר' ההערה המורחבת שם) - היא לא אופציונלית. הפתרון: לא מוותרים
    // על Claude בכלל, רק לא **חוסמים** את הניווט למסך הטעינה בשבילו.
    // מחזירים תשובה מיד עם session בלי שום תחנות - decideCategoryPlan
    // (כולל תוכנית + trip intent) רץ בתוך auto-build עצמו, אחרי שהמשתמש
    // כבר במסך הטעינה, ולא לפני. כך גם המהירות משתפרת משמעותית וגם
    // הדיוק (Claude) נשאר מלא בעינו.
    if (
      tripType === "nightlife" ||
      tripType === "romantic_date" ||
      tripType === "nature_trip" ||
      tripType === "day_trip"
    ) {
      return NextResponse.json({
        session: { ...session, category_plan: [], status: "building", trip_intent: null },
        stops: [],
      });
    }

const dna = await getTravelDna(supabase, user.id);
    const weatherSummary = await getWeatherSummary(origin.lat, origin.lng);

    const tripIntent = await generateTripIntent({ dna, answers: normalizeAnswers(tripType, answers), weatherSummary });
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
    console.error("[Sessions POST Error]", error);
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