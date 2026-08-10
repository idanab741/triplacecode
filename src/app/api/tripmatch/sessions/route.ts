import { NextResponse } from "next/server";
import { createClient } from "@/services/supabase/server";
import { createTripMatchSession, fetchTripMatchCandidates } from "@/services/tripMatch/tripMatchService";
import { generateAndSaveDestinationAttractions } from "@/services/tripMatch/destinationAttractionsService";
import { isValidPlaceCategory } from "@/constants/placeCategories";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "יש להתחבר" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const city: string | undefined = body?.city;
  const category: string | undefined = body?.category;
  const interests: string[] = Array.isArray(body?.interests) ? body.interests : [];

  if (!city || !city.trim()) {
    return NextResponse.json({ error: "יש לספק עיר" }, { status: 400 });
  }
  // חייבת להיות אחת מ-5 הקטגוריות הראשיות (חוץ ממלונות - TripMatch הוא
  // לפעילויות, לא ללינה) - בלי זה, שאילתת המועמדים לא תמצא כלום.
  if (!category || !isValidPlaceCategory(category) || category === "hotels") {
    return NextResponse.json({ error: "יש לספק קטגוריה תקינה" }, { status: 400 });
  }

  try {
    const session = await createTripMatchSession(supabase, user.id, city.trim(), category, interests);
    let candidates = await fetchTripMatchCandidates(supabase, session);

    // אין עדיין מועמדים ליעד הזה ב-DB (בעיקר יעדים בינלאומיים) - Claude יוצר
    // רשימת אטרקציות אמיתית, שומר אותה, ואז שולפים שוב.
    if (candidates.length === 0) {
      await generateAndSaveDestinationAttractions(supabase, session.city, session.category, session.interests);
      candidates = await fetchTripMatchCandidates(supabase, session);
    }

    // *** נוסף: פרופיל ההעדפות האמיתי מהאונבורדינג (תחומי עניין, סגנון
    // קולינרי, כשרות, נגישות) - כדי שאחוז ההתאמה והפילטרים בעמוד יתבססו
    // על מה שהמשתמש באמת ענה, לא רק על דירוג גוגל. לפני זה זה בכלל לא
    // הגיע ללקוח.
    const { data: preferences } = await supabase
      .from("user_preferences")
      .select("interests, culinary_styles, kosher, accessibility")
      .eq("id", user.id)
      .maybeSingle();

    return NextResponse.json({
      session,
      candidates,
      userPreferences: {
        interests: preferences?.interests ?? [],
        culinaryStyles: preferences?.culinary_styles ?? [],
        kosher: preferences?.kosher ?? false,
        accessibility: preferences?.accessibility ?? false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "שגיאה לא ידועה";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
